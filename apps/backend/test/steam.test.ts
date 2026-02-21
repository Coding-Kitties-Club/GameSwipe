import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import * as steamApi from "../src/steam/steamApi";
import { createApp } from "../src/app";
import { resetDb, closeDb } from "./db";

vi.mock("../src/steam/steamApi", () => ({
  steamAccountExists: vi.fn(),
  fetchOwnedGames: vi.fn()
}));

type SteamIdentityResponse = {
  steamid64: string;
  verified: boolean;
  provider: "manual" | "openid";
};

type ErrorBody = { error?: { code?: string } };

type SyncLibraryResponse = {
  steamid64: string;
  gameCount: number;
  fetchedAt: string;
};

function assertSteamIdentityBody(body: unknown): asserts body is SteamIdentityResponse {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
  const rec = body as Record<string, unknown>;
  if (typeof rec.steamid64 !== "string") throw new Error("Missing steamid64");
  if (typeof rec.verified !== "boolean") throw new Error("Missing verified");
  if (rec.provider !== "manual" && rec.provider !== "openid") throw new Error("Invalid provider");
}

function assertErrorBody(body: unknown): asserts body is ErrorBody {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
}

function assertSyncLibraryBody(body: unknown): asserts body is SyncLibraryResponse {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
  const rec = body as Record<string, unknown>;
  if (typeof rec.steamid64 !== "string") throw new Error("Missing steamid64");
  if (typeof rec.gameCount !== "number") throw new Error("Missing gameCount");
  if (typeof rec.fetchedAt !== "string") throw new Error("Missing fetchedAt");
}

describe("Steam Identity API", () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
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
    expect(res.body.error?.code).toBe("UNAUTHORISED");
  });

  it("GET /steam/identity requires session", async () => {
    const res = await request(app).get("/steam/identity");

    expect(res.status).toBe(401);
    assertErrorBody(res.body);
    expect(res.body.error?.code).toBe("UNAUTHORISED");
  });

  it("PUT /steam/identity validates steamid64", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    const bad = await agent.put("/steam/identity").send({ steamid64: "abc" }).set("Content-Type", "application/json");

    expect(bad.status).toBe(400);
    assertErrorBody(bad.body);
    expect(bad.body.error?.code).toBe("INVALID_REQUEST");
  });

  it("PUT /steam/identity returns 404 if steam account does not exist", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    vi.mocked(steamApi.steamAccountExists).mockResolvedValue(false);

    const res = await agent
      .put("/steam/identity")
      .send({ steamid64: "76561198000000000" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(404);
    assertErrorBody(res.body);
    expect(res.body.error?.code).toBe("STEAM_ACCOUNT_NOT_FOUND");
  });

  it("PUT then GET returns linked identity (manual/unverified)", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    vi.mocked(steamApi.steamAccountExists).mockResolvedValue(true);

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

    vi.mocked(steamApi.steamAccountExists).mockResolvedValue(true);

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
    expect(res.body.error?.code).toBe("STEAM_IDENTITY_NOT_FOUND");
  });

  it("POST /steam/library/sync returns 404 if no identity linked", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    const res = await agent.post("/steam/library/sync");

    expect(res.status).toBe(404);
    assertErrorBody(res.body);
    expect(res.body.error?.code).toBe("STEAM_IDENTITY_NOT_FOUND");
  });

  it("POST /steam/library/sync returns 403 if games not visible", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    vi.mocked(steamApi.steamAccountExists).mockResolvedValue(true);

    const putRes = await agent
      .put("/steam/identity")
      .send({ steamid64: "76561198000000000" })
      .set("Content-Type", "application/json");
    expect(putRes.status).toBe(200);

    vi.mocked(steamApi.fetchOwnedGames).mockResolvedValue({
      gameCount: 0,
      games: []
    });

    const res = await agent.post("/steam/library/sync");

    expect(res.status).toBe(403);
    assertErrorBody(res.body);
    expect(res.body.error?.code).toBe("STEAM_GAMES_NOT_VISIBLE");
  });

  it("POST /steam/library/sync caches games when visible", async () => {
    const agent = request.agent(app);

    const createRes = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);

    vi.mocked(steamApi.steamAccountExists).mockResolvedValue(true);

    const putRes = await agent
      .put("/steam/identity")
      .send({ steamid64: "76561198000000000" })
      .set("Content-Type", "application/json");
    expect(putRes.status).toBe(200);

    vi.mocked(steamApi.fetchOwnedGames).mockResolvedValue({
      gameCount: 2,
      games: [
        { appid: 570, playtime_forever: 100 },
        { appid: 730, playtime_forever: 200 }
      ]
    });

    const res = await agent.post("/steam/library/sync");

    expect(res.status).toBe(200);
    assertSyncLibraryBody(res.body);
    expect(res.body.gameCount).toBe(2);
    expect(res.body.steamid64).toBe("76561198000000000");
    expect(typeof res.body.fetchedAt).toBe("string");
  });
});
