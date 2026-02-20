import fs from "node:fs";
import path from "node:path";
import { config as dotenvConfig } from "dotenv";

export function loadTestEnvPreferDotenv() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const dotenvPath = path.join(repoRoot, ".env");
  const dotenvTestPath = path.join(repoRoot, ".env.test");

  if (fs.existsSync(dotenvPath)) {
    dotenvConfig({ path: dotenvPath, override: false });
    return { used: ".env" as const, path: dotenvPath };
  }

  dotenvConfig({ path: dotenvTestPath, override: false });
  return { used: ".env.test" as const, path: dotenvTestPath };
}
