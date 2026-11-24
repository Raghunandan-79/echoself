import { Router } from "express";
import { createHash } from "node:crypto";
import { speechJobSchema } from "@echoself/shared/schemas";
import { QUEUE_NAMES } from "@echoself/shared/constants";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { badRequest, notFound, conflict } from "../../utils/errors.js";
import { hasActiveConsent } from "../consents/index.js";
import { enqueueJob } from "../../queues/index.js";

export const speechRouter: Router = Router();
speechRouter.use(requireAuth);

speechRouter.post("/jobs", validate(speechJobSchema), async (req, res, next) => {
  try {
    const { voiceProfileId, text, language } = req.body;
    const profile = await prisma.voiceProfile.findFirst({
      where: { id: voiceProfileId, userId: req.userId!, status: "ACTIVE" },
      include: { reference: true },
    });
    if (!profile) throw notFound("Voice profile not found");
    if (!(await hasActiveConsent(req.userId!, "voice_cloning"))) {
      throw badRequest("Voice cloning consent is not active");
    }

    // duplicate job prevention: same voice+text hash within active jobs
    const idem = createHash("sha256").update(`${voiceProfileId}:${language ?? ""}:${text}`).digest("hex").slice(0, 32);
    const existing = await prisma.generationJob.findFirst({
      where: { userId: req.userId!, type: "SPEECH", idempotencyKey: idem, state: { in: ["PENDING", "QUEUED", "PROCESSING"] } },
    });
    if (existing) throw conflict("An identical speech job is already in progress");

    const job = await prisma.generationJob.create({
      data: {
        userId: req.userId!,
        type: "SPEECH",
        state: "PENDING",
        idempotencyKey: idem,
        voiceProfileId: profile.id,
        input: { text, language: language ?? profile.language ?? "en" },
      },
    });

    const queueJobId = await enqueueJob(QUEUE_NAMES.VOICE, {
      generationJobId: job.id,
      userId: req.userId!,
      type: "SPEECH",
    });
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { state: "QUEUED", queueJobId, progress: 5 },
    });
    await prisma.auditLog.create({ data: { userId: req.userId!, action: "speech.job.create", resource: job.id } });

    res.status(201).json({ data: { id: job.id, state: "QUEUED" } });
  } catch (err) {
    next(err);
  }
});
