import { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { env } from "../env";
import { ApiError } from "../errors";
import { hashToken } from "../auth/session";

export type AuthedRequest = Request & { auth?: { memberId: string } };

type SessionRow = { member_id: string };

export async function requireSession(req: AuthedRequest, _res: Response, next: NextFunction) {
    try {
        const cookies: Record<string, string | undefined> = (req as unknown as { cookies?: Record<string, string | undefined> }).cookies ?? {};

        const token = cookies[env.SESSION_COOKIE_NAME];
        if (typeof token !== "string" || token.length === 0) {
            return next(new ApiError(401, "UNAUTHORISED", "Missing Session Cookie"));
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

        if (result.rows.length === 0) {
            return next(new ApiError(401, "UNAUTHORISED", "Invalid or Expired Session"));
        }

        req.auth = { memberId: result.rows[0]!.member_id };
        next();
    } catch (err) {
        return next(err);
    }
}