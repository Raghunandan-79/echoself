import { Router } from "express";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { uploadAuthorizeSchema, paginationSchema } from "@echoself/shared/schemas";
import { UPLOAD_LIMITS, R2_PREFIXES, type AssetKind } from "@echoself/shared/constants";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { badRequest, forbidden, notFound, unauthorized } from "../../utils/errors.js";
import { storage, storageDriverName } from "../../storage/index.js";
import { env } from "../../config/env.js";
import { signAccessToken } from "../../utils/jwt.js";
import { logger } from "../../utils/logger.js";

export const assetsRouter: Router = Router();
assetsRouter.use(requireAuth);

const KIND_TO_ASSET: Record<string, AssetKind> = {
  voice_reference: "voice_reference",
  face_reference: "face_reference",
  temporary_media: "temporary_media",
};

function extFor(mime: string) {
  const map: Record<string, string> = {
    "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    "audio/webm": "webm", "audio/ogg": "ogg", "audio/flac": "flac",
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "video/mp4": "mp4", "video/webm": "webm",
  };
  return map[mime] ?? "bin";
}

// Step 1: request upload authorization -> presigned PUT (R2) or local upload URL
assetsRouter.post("/uploads", validate(uploadAuthorizeSchema), async (req, res, next) => {
  try {
    const { kind, sizeBytes } = req.body;
    // Normalize MIME: strip codec parameters (e.g. "audio/webm;codecs=opus" -> "audio/webm")
    const mimeType = String(req.body.mimeType ?? "").split(";")[0]!.trim().toLowerCase();
    const limits = UPLOAD_LIMITS[kind as keyof typeof UPLOAD_LIMITS];
    if (!limits) throw badRequest("Invalid upload kind");
    if (sizeBytes > limits.maxBytes) throw badRequest(`File exceeds ${limits.maxBytes} byte limit`);
    if (sizeBytes > env.MAX_UPLOAD_BYTES) throw badRequest("File exceeds server upload limit");
    const allowed = limits.mimeTypes.some((m) => m === mimeType || (m.endsWith("/*") && mimeType.startsWith(m.slice(0, -1))));
    if (!allowed) throw badRequest(`MIME type ${mimeType} not allowed for ${kind}`);

    const assetKind = KIND_TO_ASSET[kind];
    if (!assetKind) throw badRequest("Invalid upload kind");
    const assetId = randomUUID();
    const objectKey = `${R2_PREFIXES[assetKind]}${req.userId!}/${assetId}.${extFor(mimeType)}`;

    const asset = await prisma.asset.create({
      data: {
        id: assetId,
        userId: req.userId!,
        kind: assetKind,
        objectKey,
        mimeType,
        sizeBytes: BigInt(sizeBytes),
        status: "PENDING_UPLOAD",
      },
    });

    let uploadUrl: string;
    let headers: Record<string, string> = {};
    if (storageDriverName === "r2") {
      uploadUrl = await storage.presignPut(objectKey, mimeType, 300);
      headers = { "Content-Type": mimeType };
    } else {
      // local driver: client PUTs to our own endpoint
      uploadUrl = `/api/v1/assets/${asset.id}/content`;
    }

    res.status(201).json({
      data: {
        assetId: asset.id,
        objectKey,
        uploadUrl,
        method: "PUT" as const,
        headers,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Local-driver upload endpoint (also usable to finalize R2 uploads is NOT needed; R2 PUTs go direct)
assetsRouter.put("/:id/content", async (req, res, next) => {
  try {
    if (storageDriverName !== "local") throw badRequest("Direct content upload is only available with local storage driver");
    const asset = await prisma.asset.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!asset) throw notFound("Asset not found");
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    await storage.putObject(asset.objectKey, body, asset.mimeType ?? undefined);
    await prisma.asset.update({
      where: { id: asset.id },
      data: { status: "UPLOADED", sizeBytes: BigInt(body.length) },
    });
    res.json({ data: { ok: true, sizeBytes: body.length } });
  } catch (err) {
    next(err);
  }
});

// Step 3: notify backend upload complete -> HeadObject verify -> mark UPLOADED
assetsRouter.post("/:id/complete", async (req, res, next) => {
  try {
    const asset = await prisma.asset.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!asset) throw notFound("Asset not found");
    const head = await storage.headObject(asset.objectKey);
    if (!head) throw badRequest("Object not found in storage; upload may have failed");
    await prisma.asset.update({
      where: { id: asset.id },
      data: { status: "UPLOADED", sizeBytes: BigInt(head.size) },
    });
    res.json({ data: { ok: true, sizeBytes: head.size } });
  } catch (err) {
    next(err);
  }
});

assetsRouter.get("/", validate(paginationSchema, "query"), async (req, res, next) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const where = { userId: req.userId!, deletedAt: null };
    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({
      data: assets.map((a) => ({
        id: a.id, kind: a.kind, mimeType: a.mimeType,
        sizeBytes: a.sizeBytes === null ? null : Number(a.sizeBytes),
        status: a.status, createdAt: a.createdAt.toISOString(),
      })),
      meta: { page, pageSize, total },
    });
  } catch (err) {
    next(err);
  }
});

assetsRouter.get("/:id", async (req, res, next) => {
  try {
    const asset = await prisma.asset.findFirst({ where: { id: req.params.id, userId: req.userId!, deletedAt: null } });
    if (!asset) throw notFound("Asset not found");
    res.json({
      data: {
        id: asset.id, kind: asset.kind, mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes === null ? null : Number(asset.sizeBytes),
        status: asset.status, createdAt: asset.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Returns a short-lived access URL (presigned GET for R2, signed local URL otherwise)
assetsRouter.get("/:id/access", async (req, res, next) => {
  try {
    const asset = await prisma.asset.findFirst({ where: { id: req.params.id, userId: req.userId!, deletedAt: null } });
    if (!asset) throw notFound("Asset not found");
    if (asset.status === "DELETED") throw forbidden("Asset deleted");

    let url: string;
    if (storageDriverName === "r2") {
      url = await storage.presignGet(asset.objectKey, 300, `echoself-${asset.kind}.${extFor(asset.mimeType ?? "")}`);
    } else {
      // mint a short-lived access token; the local storage route validates it
      const token = await signAccessToken({ sub: req.userId!, sid: req.sessionId! });
      url = `/api/v1/storage/local/${encodeURIComponent(asset.objectKey)}?token=${encodeURIComponent(token)}`;
    }
    res.json({ data: { url, expiresIn: 300 } });
  } catch (err) {
    next(err);
  }
});

// Stream asset bytes directly (convenience for previews)
assetsRouter.get("/:id/content", async (req, res, next) => {
  try {
    const asset = await prisma.asset.findFirst({ where: { id: req.params.id, userId: req.userId!, deletedAt: null } });
    if (!asset) throw notFound("Asset not found");
    const head = await storage.headObject(asset.objectKey);
    if (!head) throw notFound("Object missing in storage");
    const body = await storage.getObject(asset.objectKey);
    res.setHeader("Content-Type", asset.mimeType ?? "application/octet-stream");
    res.setHeader("Content-Length", head.size);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.send(body);
  } catch (err) {
    next(err);
  }
});

assetsRouter.delete("/:id", async (req, res, next) => {
  try {
    const asset = await prisma.asset.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!asset) throw notFound("Asset not found");
    if (asset.status !== "DELETED") {
      await storage.deleteObject(asset.objectKey).catch((e) => logger.warn("asset_delete_failed", { objectKey: asset.objectKey, err: String(e) }));
      await prisma.asset.update({ where: { id: asset.id }, data: { status: "DELETED", deletedAt: new Date() } });
      // detach references
      await prisma.voiceProfile.updateMany({ where: { referenceAssetId: asset.id }, data: { referenceAssetId: null, status: "PENDING" } });
      await prisma.faceProfile.updateMany({ where: { referenceAssetId: asset.id }, data: { referenceAssetId: null, status: "PENDING" } });
      await prisma.auditLog.create({ data: { userId: req.userId!, action: "asset.delete", resource: asset.id } });
    }
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
