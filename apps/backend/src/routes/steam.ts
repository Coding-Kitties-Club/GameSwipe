import { Router } from "express";
import { pool } from "../db";
import { ApiError } from "../errors";
import { asyncHandler } from "../utils/asyncHandler";
import type { AuthedRequest } from "../middleware/auth";
import { requireSession } from "../middleware/auth";
import { PutSteamIdentityBodySchema, SteamIdentityRow, type SteamIdentityResponse } from "../types/steam";
import { ZodError } from "zod";
import { fetchOwnedGames, steamAccountExists } from "../steam/steamApi";

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
    try {
      const body = PutSteamIdentityBodySchema.parse(req.body);

      const exists = await steamAccountExists(body.steamid64);
      if (!exists) {
        throw new ApiError(404, "STEAM_ACCOUNT_NOT_FOUND", "Steam account not found for this steamid64");
      }

      const result = await pool.query<SteamIdentityRow>(
        `
        INSERT INTO steam_identities (member_id, steamid64, verified, provider, linked_at, updated_at, last_verified_at)
        VALUES ($1, $2, FALSE, 'manual', now(), now(), now())
        ON CONFLICT (member_id)
        DO UPDATE SET
          steamid64 = EXCLUDED.steamid64,
          verified = FALSE,
          provider = 'manual',
          updated_at = now(),
          last_verified_at = now()
        RETURNING steamid64, verified, provider
        `,
        [memberId, body.steamid64]
      );

      const row = result.rows[0];
      if (!row) throw new ApiError(500, "INTERNAL_ERROR", "Failed to upsert Steam identity");

      const response: SteamIdentityResponse = {
        steamid64: row.steamid64,
        verified: row.verified,
        provider: row.provider
      };

      res.status(200).json(response);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        throw new ApiError(400, "INVALID_REQUEST", "Invalid request body", err.errors);
      }
      throw err;
    }
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
      provider: row.provider
    };

    res.status(200).json(response);
  })
);

steamRouter.post(
  "/steam/library/sync",
  requireSession,
  asyncHandler(async (req: AuthedRequest, res) => {
    const memberId = requireMemberId(req);

    const identityRes = await pool.query<{ steamid64: string }>(
      `
      SELECT steamid64
      FROM steam_identities
      WHERE member_id = $1
      `,
      [memberId]
    );

    const identity = identityRes.rows[0];
    if (!identity) {
      throw new ApiError(404, "STEAM_IDENTITY_NOT_FOUND", "No Steam identity linked");
    }

    const { gameCount, games } = await fetchOwnedGames(identity.steamid64);

    if (!games || games.length === 0) {
      throw new ApiError(
        403,
        "STEAM_GAMES_NOT_VISIBLE",
        "Could not read owned games. Ensure Steam profile + game details are public."
      );
    }

    const upsert = await pool.query<{ steamid64: string; game_count: number; fetched_at: string }>(
      `
      INSERT INTO steam_owned_games (member_id, steamid64, game_count, games, fetched_at, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, now(), now())
      ON CONFLICT (member_id)
      DO UPDATE SET
        steamid64 = EXCLUDED.steamid64,
        game_count = EXCLUDED.game_count,
        games = EXCLUDED.games,
        fetched_at = now(),
        updated_at = now()
      RETURNING steamid64, game_count, fetched_at
      `,
      [memberId, identity.steamid64, gameCount, JSON.stringify(games)]
    );

    const row = upsert.rows[0];
    if (!row) throw new ApiError(500, "INTERNAL_ERROR", "Failed to cache owned games");

    res.status(200).json({
      steamid64: row.steamid64,
      gameCount: row.game_count,
      fetchedAt: row.fetched_at
    });
  })
);
