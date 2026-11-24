import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { prisma } from "./database/prisma.js";

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  logger.info("api_listening", { port: env.API_PORT, env: env.NODE_ENV });
});

async function shutdown() {
  logger.info("api_shutting_down");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
