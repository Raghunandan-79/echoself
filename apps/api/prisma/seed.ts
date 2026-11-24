import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@echoself.local";
  const passwordHash = await argon2.hash("DemoPass123!", { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo User", passwordHash },
  });
  console.log(`Seeded demo user: ${email} / DemoPass123!`);
}

main().finally(() => prisma.$disconnect());
