import { Router } from "express";
import { prisma } from "../../database/prisma.js";
import { getCapabilities } from "../../ai/client.js";
import { storageDriverName } from "../../storage/index.js";
import { getQueueBackend } from "../../queues/index.js";

export const healthRouter: Router = Router();

healthRouter.get("/health", async (_req, res) => {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  res.json({
    data: {
      status: db === "ok" ? "ok" : "degraded",
      db,
      storage: storageDriverName,
      queue: getQueueBackend().kind,
      timestamp: new Date().toISOString(),
    },
  });
});

healthRouter.get("/capabilities", async (_req, res) => {
  const caps = await getCapabilities();
  res.json({ data: caps ?? { service: "unreachable", voice: { available: false, model: null, mock: false }, talkingFace: { available: false, model: null, mock: false }, device: null } });
});
