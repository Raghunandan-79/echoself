import { Router } from "express";
import { updateUserSchema } from "@echoself/shared/schemas";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { notFound } from "../../utils/errors.js";
import { storage } from "../../storage/index.js";

export const usersRouter: Router = Router();
usersRouter.use(requireAuth);

usersRouter.get("/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user || user.deletedAt) throw notFound("User not found");
    const [voiceCount, faceCount, audioCount, videoCount, storageBytes] = await Promise.all([
      prisma.voiceProfile.count({ where: { userId: user.id, status: { not: "DELETED" } } }),
      prisma.faceProfile.count({ where: { userId: user.id, status: { not: "DELETED" } } }),
      prisma.generationJob.count({ where: { userId: user.id, type: "SPEECH", state: "COMPLETED" } }),
      prisma.generationJob.count({ where: { userId: user.id, type: "VIDEO", state: "COMPLETED" } }),
      prisma.asset.aggregate({ where: { userId: user.id, deletedAt: null }, _sum: { sizeBytes: true } }),
    ]);
    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        stats: {
          voiceProfiles: voiceCount,
          faceProfiles: faceCount,
          generatedAudio: audioCount,
          generatedVideos: videoCount,
          storageBytes: Number(storageBytes._sum.sizeBytes ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch("/me", validate(updateUserSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { name: req.body.name ?? null },
    });
    res.json({ data: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

usersRouter.delete("/me", async (req, res, next) => {
  try {
    const userId = req.userId!;
    // Delete all R2/local objects owned by the user, then cascade DB rows.
    const assets = await prisma.asset.findMany({ where: { userId, deletedAt: null }, select: { objectKey: true } });
    await Promise.allSettled(assets.map((a) => storage.deleteObject(a.objectKey)));
    await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), email: `deleted-${userId}@deleted.local` } });
    await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId, action: "user.delete", resource: userId, ipAddress: req.ip } });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
