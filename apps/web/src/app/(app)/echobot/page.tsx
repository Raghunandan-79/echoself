"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, Trash2, Send, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { PageHeader, Card, Button, Textarea, Badge, EmptyState, Alert } from "@/components/ui";
import { listConversations, getConversation, deleteConversation, sendChatMessage, chatCapabilities, chatStreamUrl } from "@/services/api";
import { getAccessToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MessageDTO } from "@echoself/shared/types";

const SUGGESTIONS = [
  "Write a 30-second product intro script",
  "Rewrite this script to be more engaging",
  "Suggest 5 video topics for my channel",
  "Translate a script to Spanish",
  "Summarize this script in 2 sentences",
];

export default function EchoBotPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const caps = useQuery({ queryKey: ["chat-caps"], queryFn: chatCapabilities, staleTime: 60_000 });
  const convos = useQuery({ queryKey: ["conversations"], queryFn: listConversations });
  const convo = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => getConversation(activeId!),
    enabled: !!activeId,
  });

  const messages: MessageDTO[] = convo.data?.messages ?? [];
  const displayMessages = streaming !== null
    ? [...messages, { id: "streaming", role: "assistant" as const, content: streaming, createdAt: "" }]
    : messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, streaming]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      setError(null);
      setStreaming("");
      let streamStartedFlag = false;
      // Try SSE streaming first
      try {
        const token = getAccessToken();
        const res = await fetch(chatStreamUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ content, conversationId: activeId ?? undefined }),
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        let convoId: string | undefined;
        const markStarted = () => { streamStartedFlag = true; };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const chunk = JSON.parse(line.slice(6)) as { delta?: string; done?: boolean; error?: string; conversationId?: string };
              if (chunk.error) throw new Error(chunk.error);
              if (chunk.conversationId) convoId = chunk.conversationId;
              if (chunk.delta) {
                markStarted();
                acc += chunk.delta;
                setStreaming(acc);
              }
            } catch { /* ignore */ }
          }
        }
        setStreaming(null);
        if (convoId) setActiveId(convoId);
        return convoId ?? activeId ?? null;
      } catch (streamErr) {
        // If the stream already produced output, don't double-send — surface the error.
        if (streamStartedFlag) {
          setStreaming(null);
          throw streamErr;
        }
        // Fallback: non-streaming endpoint
        const result = await sendChatMessage(content, activeId ?? undefined);
        setActiveId(result.conversationId);
        setStreaming(null);
        return result.conversationId;
      }
      return null;
    },
    onSuccess: (cid: string | null) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", cid ?? activeId] });
    },
    onError: (e) => {
      setStreaming(null);
      setError(e instanceof Error ? e.message : "EchoBot request failed");
    },
  });

  // fix: capture result for invalidation
  const send = (content: string) => {
    if (!content.trim() || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(content.trim());
  };

  const delMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setActiveId(null);
    },
  });

  const available = caps.data?.available;

  return (
    <div>
      <PageHeader
        title="EchoBot"
        description="Local LLM assistant for scripts, topics, titles and app guidance."
        actions={
          <div className="flex items-center gap-2">
            {caps.data && (
              <Badge tone={available ? "green" : "red"}>
                {available ? `Ollama · ${caps.data.model}` : "Ollama offline"}
              </Badge>
            )}
            <Button variant="secondary" onClick={() => setActiveId(null)}><Plus className="h-4 w-4" /> New chat</Button>
          </div>
        }
      />

      {caps.data && !available && (
        <Alert tone="amber">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />
            EchoBot is unavailable: {caps.data.reason ?? "Ollama is not running."}
            Install Ollama and run <code className="rounded bg-black/20 px-1">ollama pull {caps.data.model ?? "qwen2.5:7b"}</code> to enable it.
          </span>
        </Alert>
      )}

      <div className="flex h-[calc(100vh-220px)] gap-4">
        {/* Conversation list */}
        <Card className="hidden w-64 shrink-0 flex-col md:flex">
          <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Conversations</div>
          <div className="flex-1 overflow-y-auto">
            {(convos.data ?? []).map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm hover:bg-card",
                  activeId === c.id && "bg-card text-accent-soft",
                )}
                onClick={() => setActiveId(c.id)}
              >
                <span className="truncate">{c.title ?? "Conversation"}</span>
                <button
                  className="hidden text-text-muted hover:text-red-400 group-hover:block"
                  onClick={(e) => { e.stopPropagation(); delMutation.mutate(c.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {convos.data?.length === 0 && <p className="p-4 text-xs text-text-muted">No conversations yet.</p>}
          </div>
        </Card>

        {/* Chat */}
        <Card className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-5">
            {displayMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Bot className="mb-3 h-10 w-10 text-text-muted" />
                <h3 className="font-semibold">How can I help?</h3>
                <p className="mt-1 max-w-sm text-sm text-text-muted">Draft scripts, get topic ideas, translate, summarize — all processed locally.</p>
                <div className="mt-5 grid w-full max-w-md grid-cols-1 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-left text-sm text-text-muted transition-colors hover:border-accent/40 hover:text-text">
                      <Sparkles className="mr-2 inline h-3.5 w-3.5 text-accent" />{s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {displayMessages.map((m) => (
                  <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user" ? "bg-accent text-white" : "bg-bg-secondary text-text",
                    )}>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {error && <div className="px-5 pb-2"><Alert>{error}</Alert></div>}

          <div className="border-t border-border p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={available ? "Message EchoBot… (Enter to send)" : "EchoBot offline — start Ollama to chat"}
                className="min-h-[44px] flex-1"
                disabled={!available}
              />
              <Button onClick={() => send(input)} disabled={!input.trim() || !available} loading={sendMutation.isPending && streaming === ""}>
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
