import "server-only";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NASA_FIRMS_MAP_KEY: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{32}$/, "must be a 32-character NASA FIRMS MAP_KEY"),
  BLOCKCHAIN_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "must be a valid EVM contract address"),
  // Dev-only: guards the /api/admin/refresh endpoint.
  // Must never use NEXT_PUBLIC_ prefix.
  ADMIN_REFRESH_TOKEN: z.string().min(8).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsedEnv.data;
