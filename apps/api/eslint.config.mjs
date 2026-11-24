import { config as baseConfig } from "@repo/eslint-config/base";

export default [
  ...baseConfig,
  {
    files: ["**/*.ts"],
    rules: {},
  },
  { ignores: ["dist/**", "storage/**", "prisma/migrations/**"] },
];
