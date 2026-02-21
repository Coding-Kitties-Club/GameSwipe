import path from "node:path";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { beforeAll } from "vitest";
import { env } from "../src/env";

dotenv.config({
  path: path.resolve(__dirname, "../../..", ".env"),
  override: true,
});

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

async function runSqlMigrations(): Promise<void> {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No .sql migrations found in ${MIGRATIONS_DIR}`);
  }

  const { pool } = await import("../src/db");

  for (const filename of files) {
    const sqlPath = path.join(MIGRATIONS_DIR, filename);
    const sql = await fs.readFile(sqlPath, "utf8");

    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      throw new Error(`Failed applying migration ${filename}: ${(err as Error).message}`);
    }
  }
}

beforeAll(async () => {
  const testUrl = env.DATABASE_URL_TEST;
  if (typeof testUrl !== "string" || testUrl.length === 0) {
    throw new Error("DATABASE_URL_TEST is missing. Add DATABASE_URL_TEST to the repo root .env");
  }

  process.env.DATABASE_URL = testUrl;

  await runSqlMigrations();
});