import fs from "node:fs";
import path from "node:path";
import { beforeAll } from "vitest";
import { loadTestEnvPreferDotenv } from "./loadEnv";

const loaded = loadTestEnvPreferDotenv();

beforeAll(() => {
  if (loaded.used === ".env.test") {
    const tmpDir = path.resolve(process.cwd(), ".tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
  }
});
