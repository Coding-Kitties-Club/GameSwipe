import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: path.resolve(__dirname, "../../..", ".env"),
  override: true
});

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  SESSION_COOKIE_NAME: z.string().default("gs_session"),
  SESSION_TTL_DAYS: z.coerce.number().default(30)
});

export const env = EnvSchema.parse(process.env);