import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { unauthorized } from "../utils/errors.js";
import { prisma } from "../database/prisma.js";


export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw unauthorized();
    const payload = await verifyAccessToken(token);
    if (!payload) throw unauthorized("Invalid or expired token");

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true, user: { select: { deletedAt: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.deletedAt) {
      throw unauthorized("Session expired");
    }
    req.userId = session.userId;
    req.sessionId = session.id;
    next();
  } catch (err) {
    next(err);
  }
}
