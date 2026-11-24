import { Router } from "express";
import argon2 from "argon2";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@echoself/shared/schemas";
import { prisma } from "../../database/prisma.js";
import { validate } from "../../middleware/validate.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { badRequest, unauthorized, notFound } from "../../utils/errors.js";
import { sha256, randomToken } from "../../utils/crypto.js";
import { signAccessToken, refreshExpiry } from "../../utils/jwt.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import type { Request, Response } from "express";

export const authRouter: Router = Router();

function publicUser(u: { id: string; email: string; name: string | null; createdAt: Date }) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt.toISOString() };
}

async function issueTokens(userId: string, req: Request) {
  const refreshToken = randomToken(48);
  const session = await prisma.session.create({
    data: {
      userId,
      refreshHash: sha256(refreshToken),
      userAgent: req.headers["user-agent"]?.slice(0, 300),
      ipAddress: req.ip ?? null,
      expiresAt: refreshExpiry(),
    },
  });
  const accessToken = await signAccessToken({ sub: userId, sid: session.id });
  return { accessToken, refreshToken, sessionId: session.id };
}

async function rotateRefreshToken(rawToken: string, req: Request) {
  const hash = sha256(rawToken);
  const session = await prisma.session.findUnique({
    where: { refreshHash: hash },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.deletedAt) {
    throw unauthorized("Invalid refresh token");
  }
  // rotate: revoke old, issue new session
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  const tokens = await issueTokens(session.userId, req);
  return { ...tokens, user: session.user };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie("es_refresh", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86400_000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("es_refresh", { path: "/api/v1/auth" });
}

authRouter.post("/register", authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const normalized = email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing && !existing.deletedAt) throw badRequest("An account with this email already exists");
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await prisma.user.upsert({
      where: { email: normalized },
      update: { passwordHash, name: name ?? null, deletedAt: null },
      create: { email: normalized, passwordHash, name: name ?? null },
    });
    await prisma.auditLog.create({
      data: { userId: user.id, action: "user.register", resource: user.id, ipAddress: req.ip },
    });
    const tokens = await issueTokens(user.id, req);
    setRefreshCookie(res, tokens.refreshToken);
    res.status(201).json({ data: { accessToken: tokens.accessToken, user: publicUser(user) } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deletedAt || !(await argon2.verify(user.passwordHash, password).catch(() => false))) {
      throw unauthorized("Invalid email or password");
    }
    const tokens = await issueTokens(user.id, req);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({ data: { accessToken: tokens.accessToken, user: publicUser(user) } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", authLimiter, async (req, res, next) => {
  try {
    const bodyToken = (req.body as { refreshToken?: string })?.refreshToken;
    const cookieToken = req.cookies?.es_refresh as string | undefined;
    const token = bodyToken ?? cookieToken;
    if (!token) throw unauthorized("Missing refresh token");
    const rotated = await rotateRefreshToken(token, req);
    setRefreshCookie(res, rotated.refreshToken);
    res.json({ data: { accessToken: rotated.accessToken, user: publicUser(rotated.user) } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const bodyToken = (req.body as { refreshToken?: string })?.refreshToken;
    const cookieToken = req.cookies?.es_refresh as string | undefined;
    const token = bodyToken ?? cookieToken;
    if (token) {
      await prisma.session.updateMany({
        where: { refreshHash: sha256(token) },
        data: { revokedAt: new Date() },
      });
    }
    clearRefreshCookie(res);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always respond the same to avoid user enumeration.
    if (user && !user.deletedAt) {
      const token = randomToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      // No SMTP on free tier by default: log a dev-only notice. In production,
      // wire an email provider here. The token is never returned to the client.
      logger.info("password_reset_requested", { userId: user.id });
      if (env.NODE_ENV === "development") {
        logger.info("dev_reset_token", { token });
      }
    }
    res.json({ data: { ok: true, message: "If the account exists, a reset link has been sent." } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/reset-password", authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw badRequest("Invalid or expired reset token");
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
