import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

export function validate(schema: ZodType, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      // attach issues; errorHandler formats ZodError-like response
      const err = result.error;
      (err as unknown as { __validated: false }).__validated = false;
      next(err);
      return;
    }
    if (source === "query") {
      // Express 5 req.query is a getter-only accessor — redefine on the instance.
      Object.defineProperty(req, "query", { value: result.data, writable: true, configurable: true });
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}
