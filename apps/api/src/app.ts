import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { API_PREFIX } from "@echoself/shared/constants";
import { env } from "./config/env.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { healthRouter } from "./modules/health/index.js";
import { authRouter } from "./modules/auth/index.js";
import { usersRouter } from "./modules/users/index.js";
import { consentsRouter } from "./modules/consents/index.js";
import { voicesRouter } from "./modules/voices/index.js";
import { facesRouter } from "./modules/faces/index.js";
import { assetsRouter } from "./modules/assets/index.js";
import { speechRouter } from "./modules/speech/index.js";
import { videosRouter } from "./modules/videos/index.js";
import { jobsRouter } from "./modules/jobs/index.js";
import { chatRouter } from "./modules/chat/index.js";
import { localStorageRouter } from "./storage/localRoute.js";

export function createApp(): import("express").Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(apiLimiter);

  app.get("/", (_req, res) => res.json({ name: "echoself-api", version: "0.1.0" }));

  app.use(`${API_PREFIX}/storage`, localStorageRouter);
  app.use(`${API_PREFIX}/health`, healthRouter);
  app.use(`${API_PREFIX}/auth`, authRouter);
  app.use(`${API_PREFIX}/users`, usersRouter);
  app.use(`${API_PREFIX}/consents`, consentsRouter);
  app.use(`${API_PREFIX}/voices`, voicesRouter);
  app.use(`${API_PREFIX}/faces`, facesRouter);
  app.use(`${API_PREFIX}/assets`, assetsRouter);
  app.use(`${API_PREFIX}/speech`, speechRouter);
  app.use(`${API_PREFIX}/videos`, videosRouter);
  app.use(`${API_PREFIX}/jobs`, jobsRouter);
  app.use(`${API_PREFIX}/chat`, chatRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
