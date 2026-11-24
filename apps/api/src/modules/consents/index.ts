import { Router } from "express";
import { consentSchema } from "@echoself/shared/schemas";
import { CONSENT_VERSIONS, type ConsentScope } from "@echoself/shared/constants";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { notFound } from "../../utils/errors.js";

export const consentsRouter: Router = Router();
consentsRouter.use(requireAuth);

consentsRouter.post("/", validate(consentSchema), async (req, res, next) => {
  try {
    const { scope, granted } = req.body as { scope: ConsentScope; granted: boolean };
    const consent = await prisma.consent.create({
      data: {
        userId: req.userId!,
        scope,
        version: CONSENT_VERSIONS[scope],
        granted,
        revokedAt: granted ? null : new Date(),
      },
    });
    await prisma.auditLog.create({
      data: { userId: req.userId!, action: granted ? "consent.grant" : "consent.revoke", resource: consent.id, metadata: { scope } },
    });
    res.status(201).json({ data: consent });
  } catch (err) {
    next(err);
  }
});

consentsRouter.get("/", async (req, res, next) => {
  try {
    const consents = await prisma.consent.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
    });
    // latest per scope
    const latest = new Map<string, (typeof consents)[number]>();
    for (const c of consents) if (!latest.has(c.scope)) latest.set(c.scope, c);
    res.json({ data: [...latest.values()] });
  } catch (err) {
    next(err);
  }
});

consentsRouter.delete("/:id", async (req, res, next) => {
  try {
    const consent = await prisma.consent.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!consent) throw notFound("Consent not found");
    await prisma.consent.update({ where: { id: consent.id }, data: { granted: false, revokedAt: new Date() } });
    await prisma.auditLog.create({
      data: { userId: req.userId!, action: "consent.revoke", resource: consent.id, metadata: { scope: consent.scope } },
    });
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

export async function hasActiveConsent(userId: string, scope: ConsentScope): Promise<boolean> {
  const latest = await prisma.consent.findFirst({
    where: { userId, scope },
    orderBy: { createdAt: "desc" },
  });
  return !!latest && latest.granted && !latest.revokedAt;
}
