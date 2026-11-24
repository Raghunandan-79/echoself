import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { QUEUE_NAMES } from "@echoself/shared/constants";
import { logger } from "../utils/logger.js";
import { randomUUID } from "node:crypto";

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface JobPayload {
  generationJobId: string;
  userId: string;
  type: "SPEECH" | "VIDEO" | "MEDIA";
}

/* ---------- BullMQ over Redis (Upstash or local) ---------- */
class BullMQBackend {
  readonly kind = "bullmq" as const;
  private connection: Redis;
  private queues = new Map<string, Queue>();

  constructor(url: string) {
    // Upstash REST is not directly compatible with BullMQ's blocking commands;
    // use ioredis over the rediss:// URL (Upstash supports the Redis protocol).
    this.connection = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.connection.on("error", (e) => logger.warn("redis_error", { err: String(e) }));
  }

  queue(name: QueueName) {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection });
      this.queues.set(name, q);
    }
    return q;
  }

  async enqueue(name: QueueName, payload: JobPayload, opts?: { jobId?: string; delay?: number }) {
    const job = await this.queue(name).add(name, payload, {
      jobId: opts?.jobId,
      delay: opts?.delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
    return job.id ?? "";
  }

  async createWorker(name: QueueName, processor: (job: Job<JobPayload>) => Promise<void>) {
    return new Worker(name, processor, {
      connection: this.connection,
      concurrency: name === QUEUE_NAMES.VIDEO ? 1 : 2,
      limiter: { max: 4, duration: 60_000 },
    });
  }

  async cancel(queueJobId: string, name: QueueName) {
    const job = await this.queue(name).getJob(queueJobId);
    if (job) await job.remove();
  }

  async close() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection.quit();
  }
}

/* ---------- In-memory backend (development only, no Redis) ---------- */
type MemoryProcessor = (payload: JobPayload) => Promise<void>;

class MemoryBackend {
  readonly kind = "memory" as const;
  private processors = new Map<QueueName, MemoryProcessor[]>();
  private pending = new Map<string, { name: QueueName; payload: JobPayload }>();

  async enqueue(name: QueueName, payload: JobPayload) {
    const id = randomUUID();
    const processors = this.processors.get(name) ?? [];
    if (processors.length > 0) {
      const proc = processors[0]!;
      void proc(payload).catch((e) => logger.error("memory_worker_error", { err: String(e) }));
    } else {
      this.pending.set(id, { name, payload });
      logger.warn("job_enqueued_without_worker", { queue: name, id });
    }
    return id;
  }

  async createWorker(name: QueueName, processor: MemoryProcessor) {
    const list = this.processors.get(name) ?? [];
    list.push(processor);
    this.processors.set(name, list);
    // drain pending
    for (const [id, item] of this.pending) {
      if (item.name === name) {
        this.pending.delete(id);
        void processor(item.payload).catch((e) => logger.error("memory_worker_error", { err: String(e) }));
      }
    }
    return { close: async () => {} };
  }

  async cancel() {}

  async close() {}
}

export type QueueBackend = BullMQBackend | MemoryBackend;

let backend: QueueBackend | null = null;

export function getQueueBackend(): QueueBackend {
  if (!backend) {
    backend = env.REDIS_URL ? new BullMQBackend(env.REDIS_URL) : new MemoryBackend();
    logger.info("queue_backend_initialized", { kind: backend.kind });
  }
  return backend;
}

export async function enqueueJob(name: QueueName, payload: JobPayload, opts?: { jobId?: string; delay?: number }) {
  return getQueueBackend().enqueue(name, payload, opts);
}

export async function createWorker(name: QueueName, processor: (payload: JobPayload) => Promise<void>) {
  const b = getQueueBackend();
  if (b instanceof BullMQBackend) {
    return b.createWorker(name, async (job) => processor(job.data));
  }
  return b.createWorker(name, processor);
}

export async function cancelQueueJob(queueJobId: string | null, name: QueueName) {
  if (!queueJobId) return;
  const b = getQueueBackend();
  if (b instanceof BullMQBackend) await b.cancel(queueJobId, name);
}
