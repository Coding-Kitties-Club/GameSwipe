import { Pool } from "pg";
import { env } from "./env";

const shouldUseSsl =
  process.env.PGSSLMODE === "require" ||
  process.env.DATABASE_URL?.includes("sslmode=require") ||
  process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
});