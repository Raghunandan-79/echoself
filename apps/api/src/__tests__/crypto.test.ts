import { describe, it, expect } from "vitest";
import { sha256, randomToken } from "../utils/crypto.js";

describe("crypto utils", () => {
  it("sha256 is deterministic", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });
  it("randomToken produces unique url-safe tokens", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
