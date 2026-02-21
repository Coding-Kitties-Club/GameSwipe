import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { resetDb, closeDb } from "./db";

type SteamIdentityResponse = {
  steamid64: string;
  verified: boolean;
  provider: "manual" | "openid";
};

function assertSteamIdentityBody(body: unknown): asserts body is SteamIdentityResponse {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
  const rec = body as Record<string, unknown>;
  if (typeof rec.steamid64 !== "string") throw new Error("Missing steamid64");
  if (typeof rec.verified !== "boolean") throw new Error("Missing verified");
  if (rec.provider !== "manual" && rec.provider !== "openid") throw new Error("Invalid provider");
}

function assertErrorBody(body: unknown): asserts body is { error?: { code: string } } {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
}

describe("Steam Identity API", () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("PUT /steam/identity requires session", async () => {
    const res = await request(app)
      .put("/steam/identity")
      .send({ steamid64: "76561198000000000" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
    assertErrorBody(res.body);
    expect(res.body?.error?.code).toBe("UNAUTHORISED");
  });

  it("GET /steam/identity requires session", async () => {
    const res = await request(app).get("/steam/identity");
    expect(res.status).toBe(401);
    assertErrorBody(res.body);
    expect(res.body?.error?.code).toBe("UNAUTHORISED");
  });

  it("PUT /steam/identity validates steamid64", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    const bad = await agent.put("/steam/identity").send({ steamid64: "abc" }).set("Content-Type", "application/json");

    expect(bad.status).toBe(400);
    assertErrorBody(bad.body);
  });

  it("PUT then GET returns linked identity (manual/unverified)", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    const putRes = await agent
      .put("/steam/identity")
      .send({ steamid64: "76561198000000000" })
      .set("Content-Type", "application/json");

    expect(putRes.status).toBe(200);
    assertSteamIdentityBody(putRes.body);
    expect(putRes.body).toEqual({
      steamid64: "76561198000000000",
      verified: false,
      provider: "manual"
    });

    const getRes = await agent.get("/steam/identity");
    expect(getRes.status).toBe(200);
    assertSteamIdentityBody(getRes.body);
    expect(getRes.body).toEqual({
      steamid64: "76561198000000000",
      verified: false,
      provider: "manual"
    });
  });

  it("PUT /steam/identity upserts (updates steamid64)", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    const first = await agent
      .put("/steam/identity")
      .send({ steamid64: "76561198000000000" })
      .set("Content-Type", "application/json");
    expect(first.status).toBe(200);

    const second = await agent
      .put("/steam/identity")
      .send({ steamid64: "76561198000000001" })
      .set("Content-Type", "application/json");
    expect(second.status).toBe(200);
    assertSteamIdentityBody(second.body);
    expect(second.body.steamid64).toBe("76561198000000001");
    expect(second.body.verified).toBe(false);
    expect(second.body.provider).toBe("manual");

    const getRes = await agent.get("/steam/identity");
    expect(getRes.status).toBe(200);
    assertSteamIdentityBody(getRes.body);
    expect(getRes.body.steamid64).toBe("76561198000000001");
  });

  it("GET /steam/identity returns 404 if none linked", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    const res = await agent.get("/steam/identity");
    expect(res.status).toBe(404);
    assertErrorBody(res.body);
    expect(res.body?.error?.code).toBe("STEAM_IDENTITY_NOT_FOUND");
  });
});
