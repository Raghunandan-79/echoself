import { Router } from "express";
import { voiceProfileSchema } from "@echoself/shared/schemas";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { hasActiveConsent } from "../consents/index.js";

export const voicesRouter: Router = Router();
voicesRouter.use(requireAuth);

voicesRouter.post("/", validate(voiceProfileSchema), async (req, res, next) => {
  try {
    const { name, language, referenceAssetId } = req.body;
    if (!(await hasActiveConsent(req.userId!, "voice_cloning"))) {
      throw badRequest("Active voice_cloning consent is required to create a voice profile");
    }
    if (referenceAssetId) {
      const asset = await prisma.asset.findFirst({
        where: { id: referenceAssetId, userId: req.userId!, kind: "voice_reference", status: "UPLOADED", deletedAt: null },
      });
      if (!asset) throw badRequest("Reference audio asset not found or not uploaded");
    }
    const profile = await prisma.voiceProfile.create({
      data: { userId: req.userId!, name, language: language ?? null, referenceAssetId: referenceAssetId ?? null, status: "ACTIVE" },
    });
    await prisma.auditLog.create({ data: { userId: req.userId!, action: "voice.create", resource: profile.id } });
    res.status(201).json({ data: profile });
  } catch (err) {
    next(err);
  }
});

voicesRouter.get("/", async (req, res, next) => {
  try {
    const profiles = await prisma.voiceProfile.findMany({
      where: { userId: req.userId!, status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: profiles });
  } catch (err) {
    next(err);
  }
});

voicesRouter.get("/:id", async (req, res, next) => {
  try {
    const profile = await prisma.voiceProfile.findFirst({
      where: { id: req.params.id, userId: req.userId!, status: { not: "DELETED" } },
    });
    if (!profile) throw notFound("Voice profile not found");
    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});

voicesRouter.delete("/:id", async (req, res, next) => {
  try {
    const profile = await prisma.voiceProfile.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!profile) throw notFound("Voice profile not found");
    await prisma.voiceProfile.update({ where: { id: profile.id }, data: { status: "DELETED" } });
    await prisma.auditLog.create({ data: { userId: req.userId!, action: "voice.delete", resource: profile.id } });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
