import { Router } from "express";
import { pool } from "../db";
import { ApiError } from "../errors";
import { asyncHandler } from "../utils/asyncHandler";
import type { AuthedRequest } from "../middleware/auth";
import { requireSession } from "../middleware/auth";
import { PutSteamIdentityBodySchema, type SteamIdentityResponse } from "../types/steam";

export const steamRouter = Router();

function requireMemberId(req: AuthedRequest): string {
    const memberId = req.auth?.memberId;
    if (!memberId) {
        throw new ApiError(401, "UNAUTHORISED", "Missing session");
    }
    return memberId;
}


steamRouter.put(
    "/steam/identity",
    requireSession,
    asyncHandler(async (req: AuthedRequest, res) => {
        const memberId = requireMemberId(req);
        const body = PutSteamIdentityBodySchema.parse(req.body);

        const result = await pool.query<{
            steamid64: string;
            verified: boolean;
            provider: "manual" | "openid";
        }>(
            `
            INSERT INTO steam_identities (member_id, steamid64, verified, provider, linked_at, updated_at)
            VALUES ($1, $2, FALSE, 'manual', now(), now())
            ON CONFLICT (member_id)
            DO UPDATE SET
                steamid64 = EXCLUDED.steamid64,
                verified = FALSE,
                provider = 'manual',
                updated_at = now()
            RETURNING steamid64, verified, provider
            `,
            [memberId, body.steamid64]
        );

        const row = result.rows[0];
        if (!row) throw new ApiError(500, "INTERNAL_ERROR", "Failed to upsert Steam identity");

        const response: SteamIdentityResponse = {
            steamid64: row.steamid64,
            verified: row.verified,
            provider: row.provider,
        };

        res.status(200).json(response);
    })
);


steamRouter.get(
    "/steam/identity",
    requireSession,
    asyncHandler(async (req: AuthedRequest, res) => {
        const memberId = requireMemberId(req);

        const result = await pool.query<{
            steamid64: string;
            verified: boolean;
            provider: "manual" | "openid";
        }>(
            `
            SELECT steamid64, verified, provider
            FROM steam_identities
            WHERE member_id = $1
            `,
            [memberId]
        );

        const row = result.rows[0];
        if (!row) {
            throw new ApiError(404, "STEAM_IDENTITY_NOT_FOUND", "No Steam identity linked for this member");
        }

        const response: SteamIdentityResponse = {
            steamid64: row.steamid64,
            verified: row.verified,
            provider: row.provider,
        };

        res.status(200).json(response);
    })
);