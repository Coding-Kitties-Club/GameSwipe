import { Router, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { ApiError } from "../errors";
import { generateRoomCode } from "../utils/roomCode";
import { env } from "../env";
import { newSessionToken, hashToken } from "../auth/session";
import { requireSession, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

export const roomsRouter = Router();

const CreateRoomSchema = z.object({
    expiresInHours: z.number().int().positive().max(168).optional()
});

const JoinRoomsSchema = z.object({
    code: z.string().min(3).max(32),
    displayName: z.string().min(1).max(48).optional()
});

function setSessionCookie(res: Response, token: string) {
    res.cookie(env.SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    });
}

async function createSession(memberId: string) {
    const token = newSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
        `INSERT INTO member_sessions (member_id, token_hash, expires_at) values ($1, $2, $3)`,
        [memberId, tokenHash, expiresAt.toISOString()]
    );

    return token;
}

type RoomRow = { id: string; code: string; expires_at: string };

function isPgErrorWithCode(err: unknown): err is { code: string } {
    if (typeof err !== "object" || err === null) return false;

    const rec = err as Record<string, unknown>;
    return typeof rec.code === "string";
}


roomsRouter.post("/rooms", asyncHandler(async (req, res) => {
    const body = CreateRoomSchema.parse(req.body ?? {});
    const hours = body.expiresInHours ?? 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    await pool.query("begin");
    try {
        let roomRow: RoomRow | null = null;

        for (let i = 0; i < 8; i++) {
            const code = generateRoomCode(6);
            try {
                const r = await pool.query<{ id: string; code: string; expires_at: string }>(
                    `INSERT INTO rooms (code, expires_at)
             VALUES ($1, $2)
             RETURNING id, code, expires_at`,
                    [code, expiresAt.toISOString()]
                );
                roomRow = r.rows[0]!;
                break;
            } catch (e: unknown) {
                if (isPgErrorWithCode(e) && e.code === "23505") continue;
                throw e;
            }
        }

        if (!roomRow) {
            throw new ApiError(500, "INTERNAL_ERROR", "Failed to allocate unique room code");
        }

        const member = await pool.query<{ id: string; role: "creator" | "member" }>(
            `INSERT INTO members (room_id, role)
         VALUES ($1, 'creator')
         RETURNING id, role`,
            [roomRow.id]
        );

        const token = await createSession(member.rows[0]!.id);
        setSessionCookie(res, token);

        await pool.query("commit");

        res.status(201).json({
            room: {
                id: roomRow.id,
                code: roomRow.code,
                expiresAt: roomRow.expires_at,
            },
            member: {
                id: member.rows[0]?.id,
                role: member.rows[0]?.role,
            },
        });
    } catch (e) {
        await pool.query("rollback");
        throw e;
    }
})
);