import type { Request, RequestHandler } from "express";
import { pool } from "../db";
import { env } from "../env";
import { ApiError } from "../errors";
import { hashToken } from "../auth/session";

export type AuthedRequest = Request & { auth?: { memberId: string } };

type SessionRow = { member_id: string };

export const requireSession: RequestHandler = (req, _res, next) => {
    void (async () => {
        const cookies: Record<string, string | undefined> = (req as unknown as { cookies?: Record<string, string | undefined> }).cookies ?? {};
        const token = cookies[env.SESSION_COOKIE_NAME];

        if (typeof token !== "string" || token.length === 0) {
            throw new ApiError(401, "UNAUTHORISED", "Missing session cookie");
        }

        const tokenHash = hashToken(token);

        const result = await pool.query<SessionRow>(
            `
            SELECT member_id
            FROM member_sessions
            WHERE token_hash = $1
                AND revoked_at IS NULL
                AND expires_at > now()
            `,
            [tokenHash]
        );

        const row = result.rows[0];
        if (!row) {
            throw new ApiError(401, "UNAUTHORISED", "Invalid or expired session");
        }

        (req as AuthedRequest).auth = { memberId: row.member_id };
    })().then(() => next()).catch(next);
};