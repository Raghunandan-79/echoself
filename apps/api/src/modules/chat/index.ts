import { Router } from "express";
import { chatMessageSchema } from "@echoself/shared/schemas";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { notFound, unavailable } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export const chatRouter: Router = Router();
chatRouter.use(requireAuth);

const SYSTEM_PROMPT = `You are EchoBot, the built-in assistant for EchoSelf — a privacy-first AI digital twin platform.
You help users write, rewrite, translate, and summarize video scripts; suggest topics and titles; generate descriptions; and explain how to use the app (Voice Studio, Face Studio, Video Studio, Gallery, consent & privacy settings).
Keep answers concise and practical. Never ask for or process biometric data. If asked to impersonate a real person without authorization, decline.`;

interface OllamaMessage { role: string; content: string }

async function ollamaChat(messages: OllamaMessage[], stream = false): Promise<Response> {
  const res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.OLLAMA_MODEL, messages, stream, options: { temperature: 0.7 } }),
    signal: AbortSignal.timeout(stream ? 120_000 : 60_000),
  });
  if (!res.ok) throw unavailable(`Ollama request failed (${res.status})`);
  return res;
}

async function checkOllama(): Promise<{ available: boolean; model: string | null; reason?: string }> {
  try {
    const res = await fetch(`${env.OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { available: false, model: null, reason: `Ollama returned ${res.status}` };
    const data = (await res.json()) as { models?: { name: string }[] };
    const names = (data.models ?? []).map((m) => m.name);
    const has = names.some((n) => n === env.OLLAMA_MODEL || n.startsWith(env.OLLAMA_MODEL.split(":")[0]!));
    if (!has) return { available: false, model: env.OLLAMA_MODEL, reason: `Model ${env.OLLAMA_MODEL} not pulled. Run: ollama pull ${env.OLLAMA_MODEL}` };
    return { available: true, model: env.OLLAMA_MODEL };
  } catch (err) {
    return { available: false, model: null, reason: `Ollama unreachable at ${env.OLLAMA_URL}: ${String(err)}` };
  }
}

chatRouter.get("/capabilities", async (_req, res) => {
  const caps = await checkOllama();
  res.json({
    data: {
      available: caps.available,
      provider: "ollama",
      model: caps.model,
      streaming: caps.available,
      reason: caps.reason,
    },
  });
});

chatRouter.get("/conversations", async (req, res, next) => {
  try {
    const convos = await prisma.conversation.findMany({
      where: { userId: req.userId! },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });
    res.json({ data: convos.map((c) => ({ id: c.id, title: c.title, messageCount: c._count.messages, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })) });
  } catch (err) {
    next(err);
  }
});

chatRouter.get("/conversations/:id", async (req, res, next) => {
  try {
    const convo = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
    });
    if (!convo) throw notFound("Conversation not found");
    res.json({ data: { id: convo.id, title: convo.title, messages: convo.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() })) } });
  } catch (err) {
    next(err);
  }
});

chatRouter.delete("/conversations/:id", async (req, res, next) => {
  try {
    const convo = await prisma.conversation.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!convo) throw notFound("Conversation not found");
    await prisma.conversation.delete({ where: { id: convo.id } });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

async function getOrCreateConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    const convo = await prisma.conversation.findFirst({ where: { id: conversationId, userId } });
    if (!convo) throw notFound("Conversation not found");
    return convo;
  }
  return prisma.conversation.create({ data: { userId, title: "New conversation" } });
}

async function buildContext(conversationId: string) {
  const msgs = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return msgs.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }) as OllamaMessage);
}

chatRouter.post("/messages", validate(chatMessageSchema), async (req, res, next) => {
  try {
    const caps = await checkOllama();
    if (!caps.available) throw unavailable(caps.reason ?? "EchoBot is unavailable — Ollama is not running or the model is not installed");

    const { conversationId, content } = req.body;
    const convo = await getOrCreateConversation(req.userId!, conversationId);
    await prisma.message.create({ data: { conversationId: convo.id, role: "user", content } });

    const history = await buildContext(convo.id);
    const messages: OllamaMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

    const ollamaRes = await ollamaChat(messages, false);
    const data = (await ollamaRes.json()) as { message?: { content?: string } };
    const reply = data.message?.content?.trim() ?? "";
    if (!reply) throw unavailable("Model returned an empty response");

    const saved = await prisma.message.create({ data: { conversationId: convo.id, role: "assistant", content: reply } });
    await prisma.conversation.update({
      where: { id: convo.id },
      data: { title: convo.title === "New conversation" ? content.slice(0, 60) : convo.title },
    });
    logger.info("chat.message", { userId: req.userId, conversationId: convo.id });

    res.status(201).json({
      data: {
        conversationId: convo.id,
        message: { id: saved.id, role: "assistant", content: reply, createdAt: saved.createdAt.toISOString() },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Streaming endpoint (SSE) — optional enhancement
chatRouter.post("/messages/stream", validate(chatMessageSchema), async (req, res, next) => {
  try {
    const caps = await checkOllama();
    if (!caps.available) throw unavailable(caps.reason ?? "EchoBot is unavailable");

    const { conversationId, content } = req.body;
    const convo = await getOrCreateConversation(req.userId!, conversationId);
    await prisma.message.create({ data: { conversationId: convo.id, role: "user", content } });
    const history = await buildContext(convo.id);
    const messages: OllamaMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const ollamaRes = await ollamaChat(messages, true);
    if (!ollamaRes.body) throw unavailable("Streaming unsupported");

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          const piece = chunk.message?.content ?? "";
          if (piece) {
            full += piece;
            res.write(`data: ${JSON.stringify({ delta: piece })}\n\n`);
          }
        } catch { /* partial line */ }
      }
    }
    const saved = await prisma.message.create({ data: { conversationId: convo.id, role: "assistant", content: full } });
    await prisma.conversation.update({
      where: { id: convo.id },
      data: { title: convo.title === "New conversation" ? content.slice(0, 60) : convo.title },
    });
    res.write(`data: ${JSON.stringify({ done: true, messageId: saved.id, conversationId: convo.id })}\n\n`);
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
      res.end();
    } else {
      next(err);
    }
  }
});
