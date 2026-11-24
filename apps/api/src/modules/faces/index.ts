import { Router } from "express";
import { faceProfileSchema } from "@echoself/shared/schemas";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { hasActiveConsent } from "../consents/index.js";

export const facesRouter: Router = Router();
facesRouter.use(requireAuth);

facesRouter.post("/", validate(faceProfileSchema), async (req, res, next) => {
  try {
    const { name, referenceAssetId } = req.body;
    if (!(await hasActiveConsent(req.userId!, "face_animation"))) {
      throw badRequest("Active face_animation consent is required to create a face profile");
    }
    const asset = await prisma.asset.findFirst({
      where: { id: referenceAssetId, userId: req.userId!, kind: "face_reference", status: "UPLOADED", deletedAt: null },
    });
    if (!asset) throw badRequest("Reference image asset not found or not uploaded");
    const profile = await prisma.faceProfile.create({
      data: { userId: req.userId!, name, referenceAssetId, status: "ACTIVE" },
    });
    await prisma.auditLog.create({ data: { userId: req.userId!, action: "face.create", resource: profile.id } });
    res.status(201).json({ data: profile });
  } catch (err) {
    next(err);
  }
});

facesRouter.get("/", async (req, res, next) => {
  try {
    const profiles = await prisma.faceProfile.findMany({
      where: { userId: req.userId!, status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: profiles });
  } catch (err) {
    next(err);
  }
});

facesRouter.get("/:id", async (req, res, next) => {
  try {
    const profile = await prisma.faceProfile.findFirst({
      where: { id: String(req.params.id), userId: req.userId!, status: { not: "DELETED" } },
    });
    if (!profile) throw notFound("Face profile not found");
    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});

facesRouter.patch("/:id", validate(z.object({ name: z.string().trim().min(1).max(120).optional(), referenceAssetId: z.uuid().optional() })), async (req, res, next) => {
  try {
    const profile = await prisma.faceProfile.findFirst({ where: { id: String(req.params.id), userId: req.userId! } });
    if (!profile) throw notFound("Face profile not found");
    const { name, referenceAssetId } = req.body;
    if (referenceAssetId) {
      const asset = await prisma.asset.findFirst({
        where: { id: referenceAssetId, userId: req.userId!, kind: "face_reference", status: "UPLOADED", deletedAt: null },
      });
      if (!asset) throw badRequest("Reference image asset not found or not uploaded");
    }
    const updated = await prisma.faceProfile.update({
      where: { id: profile.id },
      data: { name: name ?? profile.name, referenceAssetId: referenceAssetId ?? profile.referenceAssetId },
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

facesRouter.delete("/:id", async (req, res, next) => {
  try {
    const profile = await prisma.faceProfile.findFirst({ where: { id: String(req.params.id), userId: req.userId! } });
    if (!profile) throw notFound("Face profile not found");
    await prisma.faceProfile.update({ where: { id: profile.id }, data: { status: "DELETED" } });
    await prisma.auditLog.create({ data: { userId: req.userId!, action: "face.delete", resource: profile.id } });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
