import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const repoRoot = path.resolve(__dirname, "../../..");
const dotenvPath = path.join(repoRoot, ".env");
const dotenvTestPath = path.join(repoRoot, ".env.test");

const chosenEnvPath = fs.existsSync(dotenvPath) ? dotenvPath : dotenvTestPath;

dotenv.config({
  path: chosenEnvPath,
  override: true
});

const EnvSchema = z
  .object({
    PORT: z.coerce.number().default(3000),

    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_URL_TEST: z.string().min(1).optional(),

    SESSION_SECRET: z.string().min(16),
    SESSION_COOKIE_NAME: z.string().default("gs_session"),
    SESSION_TTL_DAYS: z.coerce.number().default(30)
  })
  .superRefine((val, ctx) => {
    if (!val.DATABASE_URL && !val.DATABASE_URL_TEST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message:
          "Missing database URL. Set DATABASE_URL in .env, or (if .env does not exist) set DATABASE_URL_TEST in .env.test."
      });
    }
  });

export const env = EnvSchema.parse(process.env);
