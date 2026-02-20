import { Router, type Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { ApiError } from "../errors";
import { generateRoomCode } from "../utils/roomCode";
import { env } from "../env";
import { newSessionToken, hashToken } from "../auth/session";
import { requireSession, type AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import type { PoolClient } from "pg";

export const roomsRouter = Router();

const CreateRoomSchema = z.object({
    expiresInHours: z.number().int().positive().max(168).optional()
});

const JoinRoomSchema = z.object({
    code: z.string().min(3).max(32),
    displayName: z.string().min(1).max(48).optional()
});

function setSessionCookie(res: Response, token: string): void {
    res.cookie(env.SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    });
}

type RoomRow = {
    id: string;
    code: string;
    expires_at: string;
    deleted_at: string | null;
};

type MemberRole = "creator" | "member";

type MemberRow = {
    id: string;
    role: MemberRole;
    display_name: string | null;
};

type SessionInsertRow = {
    id: string;
};

function isPgErrorWithCode(err: unknown): err is { code: string } {
    if (typeof err !== "object" || err === null) return false;
    const rec = err as Record<string, unknown>;
    return typeof rec.code === "string";
}

async function createSession(client: PoolClient, memberId: string): Promise<string> {
    const token = newSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await client.query<SessionInsertRow>(
        `
    INSERT INTO member_sessions (member_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
        [memberId, tokenHash, expiresAt.toISOString()]
    );

    const row = result.rows[0];
    if (!row) {
        throw new ApiError(500, "INTERNAL_ERROR", "Session insert did not return a row");
    }

    return token;
}

roomsRouter.post("/rooms", asyncHandler(async (req, res) => {
    const body = CreateRoomSchema.parse(req.body ?? {});
    const hours = body.expiresInHours ?? 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        let roomRow: Pick<RoomRow, "id" | "code" | "expires_at"> | null = null;

        for (let attempt = 0; attempt < 8; attempt++) {
            const code = generateRoomCode(6);

            try {
                const insertedRoom = await client.query<Pick<RoomRow, "id" | "code" | "expires_at">>(
                    `
                    INSERT INTO rooms (code, expires_at)
                    VALUES ($1, $2)
                    RETURNING id, code, expires_at
                    `,
                    [code, expiresAt.toISOString()]
                );

                const row = insertedRoom.rows[0];
                if (!row) {
                    throw new ApiError(500, "INTERNAL_ERROR", "Room insert did not return a row");
                }

                roomRow = row;
                break;
            } catch (e: unknown) {
                // Room code collision
                if (isPgErrorWithCode(e) && e.code === "23505") continue;
                throw e;
            }
        }

        if (!roomRow) {
            throw new ApiError(500, "INTERNAL_ERROR", "Failed to allocate unique room code");
        }

        const insertedMember = await client.query<Pick<MemberRow, "id" | "role">>(
            `
            INSERT INTO members (room_id, role)
            VALUES ($1, 'creator')
            RETURNING id, role
            `,
            [roomRow.id]
        );

        const memberRow = insertedMember.rows[0];
        if (!memberRow) {
            throw new ApiError(500, "INTERNAL_ERROR", "Member insert did not return a row");
        }

        const token = await createSession(client, memberRow.id);
        setSessionCookie(res, token);

        await client.query("COMMIT");

        res.status(201).json({
            room: {
                id: roomRow.id,
                code: roomRow.code,
                expiresAt: roomRow.expires_at,
            },
            member: {
                id: memberRow.id,
                role: memberRow.role,
            },
        });
    } catch (e: unknown) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // ignore rollback errors
        }
        throw e;
    } finally {
        client.release();
    }
})
);

roomsRouter.post(
    "/rooms/join",
    asyncHandler(async (req, res) => {
        const body = JoinRoomSchema.parse(req.body ?? {});
        const code = body.code.toUpperCase();

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            const roomResult = await client.query<RoomRow>(
                `
                SELECT id, code, expires_at, deleted_at
                FROM rooms
                WHERE code = $1
                `,
                [code]
            );

            const roomRow = roomResult.rows[0];
            if (!roomRow) {
                throw new ApiError(404, "ROOM_NOT_FOUND", "Room code not found");
            }

            if (roomRow.deleted_at !== null) {
                throw new ApiError(410, "ROOM_GONE", "Room has been deleted");
            }

            if (new Date(roomRow.expires_at).getTime() <= Date.now()) {
                throw new ApiError(410, "ROOM_GONE", "Room has expired");
            }

            const memberInsert = await client.query<MemberRow>(
                `
                INSERT INTO members (room_id, role, display_name)
                VALUES ($1, 'member', $2)
                RETURNING id, role, display_name
                `,
                [roomRow.id, body.displayName ?? null]
            );

            const memberRow = memberInsert.rows[0];
            if (!memberRow) {
                throw new ApiError(500, "INTERNAL_ERROR", "Member insert did not return a row");
            }

            const token = await createSession(client, memberRow.id);
            setSessionCookie(res, token);

            await client.query("COMMIT");

            res.json({
                room: {
                    id: roomRow.id,
                    code: roomRow.code,
                    expiresAt: roomRow.expires_at,
                },
                member: {
                    id: memberRow.id,
                    role: memberRow.role,
                    displayName: memberRow.display_name,
                },
                session: {
                    token,
                },
            });
        } catch (e: unknown) {
            try {
                await client.query("ROLLBACK");
            } catch {
                // ignore rollback errors
            }
            throw e;
        } finally {
            client.release();
        }
    })
);

roomsRouter.get(
    "/rooms/:roomId",
    requireSession,
    asyncHandler(async (_req: AuthedRequest, _res) => {
        throw new ApiError(501, "INTERNAL_ERROR", "Not implemented yet: GET /rooms/:roomId");
    })
);