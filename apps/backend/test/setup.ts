import path from "node:path";
import dotenv from "dotenv";
import { beforeAll } from "vitest";

dotenv.config({
  path: path.resolve(__dirname, "../../..", ".env"),
  override: true
});

beforeAll(() => {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (typeof testUrl !== "string" || testUrl.length === 0) {
    throw new Error("DATABASE_URL_TEST is missing. Add DATABASE_URL_TEST to the repo root .env");
  }

  process.env.DATABASE_URL = testUrl;
});
