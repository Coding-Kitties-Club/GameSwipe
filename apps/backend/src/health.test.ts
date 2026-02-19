import request from "supertest";
import express from "express";
import cors from "cors";
import { describe, expect, it } from "vitest";

function makeApp() {
  const app = express();
  app.use(cors());
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe("FET /health", () => {
  it("returns 200 with ok=true", async () => {
    const app = makeApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
