import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { resetDb, closeDb } from "./db";
import { pool } from "../src/db";

type CreateRoomResponse = {
  room: { id: string; code: string; expiresAt: string };
  member: { id: string; role: "creator" | "member" };
};

type JoinRoomResponse = {
  room: { id: string; code: string; expiresAt: string };
  member: { id: string; role: "creator" | "member"; displayName: string | null };
  session?: { token: string };
};

type GetRoomResponse = {
  room: { id: string; code: string; createdAt: string | null; expiresAt: string };
  me: { memberId: string; role: "creator" | "member" };
  members: Array<{
    id: string;
    role: "creator" | "member";
    displayName: string | null;
    joinedAt: string | null;
    lastSeenAt: string | null;
  }>;
};

function assertCreateRoomBody(body: unknown): asserts body is CreateRoomResponse {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
  const rec = body as Record<string, unknown>;
  if (typeof rec.room !== "object" || rec.room === null) throw new Error("Missing room");
  if (typeof rec.member !== "object" || rec.member === null) throw new Error("Missing member");
}

function assertJoinRoomBody(body: unknown): asserts body is JoinRoomResponse {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
  const rec = body as Record<string, unknown>;
  if (typeof rec.room !== "object" || rec.room === null) throw new Error("Missing room");
  if (typeof rec.member !== "object" || rec.member === null) throw new Error("Missing member");
}

function assertGetRoomBody(body: unknown): asserts body is GetRoomResponse {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
  const rec = body as Record<string, unknown>;
  if (typeof rec.room !== "object" || rec.room === null) throw new Error("Missing room");
  if (typeof rec.me !== "object" || rec.me === null) throw new Error("Missing me");
  if (!Array.isArray(rec.members)) throw new Error("Missing members array");
}

function assertErrorBody(body: unknown): asserts body is { error?: { code: string } } {
  if (typeof body !== "object" || body === null) throw new Error("Expected object body");
}

describe("Rooms API", () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("POST /rooms creates a room + creator session cookie", async () => {
    const agent = request.agent(app);

    const res = await agent.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    assertCreateRoomBody(res.body);

    expect(typeof res.body.room.id).toBe("string");
    expect(typeof res.body.room.code).toBe("string");
    expect(res.body.member.role).toBe("creator");

    const setCookieHeader = res.headers["set-cookie"];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : typeof setCookieHeader === "string"
        ? [setCookieHeader]
        : [];

    expect(cookies.join(";")).toContain("gs_session=");
  });

  it("POST /rooms/join returns 404 for unknown code", async () => {
    const res = await request(app)
      .post("/rooms/join")
      .send({ code: "ABC234", displayName: "Ryan" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(404);
    assertErrorBody(res.body);
    expect(res.body?.error?.code).toBe("ROOM_NOT_FOUND");
  });

  it("POST /rooms/join joins an existing room and sets cookie", async () => {
    const creator = request.agent(app);
    const createRes = await creator.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");

    expect(createRes.status).toBe(201);
    assertCreateRoomBody(createRes.body);

    const code = createRes.body.room.code;

    const joiner = request.agent(app);
    const joinRes = await joiner
      .post("/rooms/join")
      .send({ code, displayName: "Ryan" })
      .set("Content-Type", "application/json");

    expect(joinRes.status).toBe(200);
    assertJoinRoomBody(joinRes.body);

    expect(joinRes.body.room.code).toBe(code);
    expect(joinRes.body.member.role).toBe("member");
    expect(joinRes.body.member.displayName).toBe("Ryan");

    const setCookieHeader = joinRes.headers["set-cookie"];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : typeof setCookieHeader === "string"
        ? [setCookieHeader]
        : [];

    expect(cookies.join(";")).toContain("gs_session=");
  });

  it("GET /rooms/:roomId requires session", async () => {
    const res = await request(app).get("/rooms/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(401);
    assertErrorBody(res.body);
    expect(res.body?.error?.code).toBe("UNAUTHORISED");
  });

  it("GET /rooms/:roomId returns room + member list for an authenticated member", async () => {
    const creator = request.agent(app);

    const createRes = await creator.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");

    expect(createRes.status).toBe(201);
    assertCreateRoomBody(createRes.body);

    const roomId = createRes.body.room.id;
    const code = createRes.body.room.code;

    // Join a second member
    const joiner = request.agent(app);
    const joinRes = await joiner
      .post("/rooms/join")
      .send({ code, displayName: "Ryan" })
      .set("Content-Type", "application/json");
    expect(joinRes.status).toBe(200);

    // Creator fetches room
    const res = await creator.get(`/rooms/${roomId}`);
    expect(res.status).toBe(200);
    assertGetRoomBody(res.body);

    expect(res.body.room.id).toBe(roomId);
    expect(res.body.room.code).toBe(code);
    expect(res.body.members.length).toBe(2);

    const roles = res.body.members.map((m) => m.role).sort();
    expect(roles).toEqual(["creator", "member"]);
  });

  it("GET /rooms/:roomId returns 410 when room expired", async () => {
    const creator = request.agent(app);

    const createRes = await creator.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");

    expect(createRes.status).toBe(201);
    assertCreateRoomBody(createRes.body);
    const roomId = createRes.body.room.id;

    // Force expire in DB
    await pool.query(`UPDATE rooms SET expires_at = now() - interval '1 minute' WHERE id = $1`, [roomId]);

    const res = await creator.get(`/rooms/${roomId}`);
    expect(res.status).toBe(410);
    assertErrorBody(res.body);
    expect(res.body?.error?.code).toBe("ROOM_GONE");
  });

  it("DELETE /rooms/:roomId requires creator role", async () => {
    const creator = request.agent(app);
    const createRes = await creator.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);
    assertCreateRoomBody(createRes.body);

    const roomId = createRes.body.room.id;
    const code = createRes.body.room.code;

    const joiner = request.agent(app);
    const joinRes = await joiner
      .post("/rooms/join")
      .send({ code, displayName: "Ryan" })
      .set("Content-Type", "application/json");
    expect(joinRes.status).toBe(200);

    const delRes = await joiner.delete(`/rooms/${roomId}`);
    expect(delRes.status).toBe(403);
    assertErrorBody(delRes.body);
    expect(delRes.body?.error?.code).toBe("FORBIDDEN");
  });

  it("DELETE /rooms/:roomId deletes room and revokes sessions", async () => {
    const creator = request.agent(app);
    const createRes = await creator.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");

    expect(createRes.status).toBe(201);
    assertCreateRoomBody(createRes.body);

    const roomId = createRes.body.room.id;
    const code = createRes.body.room.code;

    const joiner = request.agent(app);
    const joinRes = await joiner
      .post("/rooms/join")
      .send({ code, displayName: "Ryan" })
      .set("Content-Type", "application/json");
    expect(joinRes.status).toBe(200);

    const delRes = await creator.delete(`/rooms/${roomId}`);
    expect(delRes.status).toBe(204);

    // After deletion, room fetch should be 410 for creator
    const resCreator = await creator.get(`/rooms/${roomId}`);
    expect(resCreator.status).toBe(410);
    assertErrorBody(resCreator.body);
    expect(resCreator.body?.error?.code).toBe("ROOM_GONE");

    // Joiner session should now be revoked; should get 401 on protected endpoint
    const resJoiner = await joiner.get(`/rooms/${roomId}`);
    expect(resJoiner.status).toBe(401);
    assertErrorBody(resJoiner.body);
    expect(resJoiner.body?.error?.code).toBe("UNAUTHORISED");
  });

  it("POST /rooms/join returns 410 if room deleted", async () => {
    const creator = request.agent(app);
    const createRes = await creator.post("/rooms").send({ expiresInHours: 24 }).set("Content-Type", "application/json");
    expect(createRes.status).toBe(201);
    assertCreateRoomBody(createRes.body);

    const roomId = createRes.body.room.id;
    const code = createRes.body.room.code;

    const delRes = await creator.delete(`/rooms/${roomId}`);
    expect(delRes.status).toBe(204);

    const joinRes = await request(app)
      .post("/rooms/join")
      .send({ code, displayName: "Ryan" })
      .set("Content-Type", "application/json");

    expect(joinRes.status).toBe(410);
    assertErrorBody(joinRes.body);
    expect(joinRes.body?.error?.code).toBe("ROOM_GONE");
  });
});
