import { Router } from "express";
import { paginationSchema } from "@echoself/shared/schemas";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { notFound, badRequest } from "../../utils/errors.js";
import { cancelQueueJob } from "../../queues/index.js";
import { QUEUE_NAMES } from "@echoself/shared/constants";

export const jobsRouter: Router = Router();
jobsRouter.use(requireAuth);

function dto(j: {
  id: string; type: string; state: string; progress: number; error: string | null;
  input: unknown; outputAssetId: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: j.id, type: j.type, state: j.state, progress: j.progress, error: j.error,
    input: j.input, outputAssetId: j.outputAssetId,
    createdAt: j.createdAt.toISOString(), updatedAt: j.updatedAt.toISOString(),
  };
}

jobsRouter.get("/", validate(paginationSchema, "query"), async (req, res, next) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const where = { userId: req.userId! };
    const [total, jobs] = await Promise.all([
      prisma.generationJob.count({ where }),
      prisma.generationJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    res.json({ data: jobs.map(dto), meta: { page, pageSize, total } });
  } catch (err) {
    next(err);
  }
});

jobsRouter.get("/:id", async (req, res, next) => {
  try {
    const job = await prisma.generationJob.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!job) throw notFound("Job not found");
    res.json({ data: dto(job) });
  } catch (err) {
    next(err);
  }
});

jobsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const job = await prisma.generationJob.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!job) throw notFound("Job not found");
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.state)) {
      throw badRequest(`Job already ${job.state.toLowerCase()}`);
    }
    const queueName = job.type === "VIDEO" ? QUEUE_NAMES.VIDEO : job.type === "SPEECH" ? QUEUE_NAMES.VOICE : QUEUE_NAMES.MEDIA;
    await cancelQueueJob(job.queueJobId, queueName);
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { state: "CANCELLED", finishedAt: new Date() },
    });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
