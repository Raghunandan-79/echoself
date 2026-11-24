import "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      userId?: string;
      sessionId?: string;
    }
  }
}

export {};
