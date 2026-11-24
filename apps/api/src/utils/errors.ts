export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Authentication required") => new HttpError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "You do not have access to this resource") => new HttpError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Resource not found") => new HttpError(404, "NOT_FOUND", msg);
export const conflict = (msg: string) => new HttpError(409, "CONFLICT", msg);
export const tooMany = (msg: string) => new HttpError(429, "RATE_LIMITED", msg);
export const unavailable = (msg: string) => new HttpError(503, "SERVICE_UNAVAILABLE", msg);
