import { z } from "zod";

export const SteamId64Schema = z.string().regex(/^\d{17}$/, "steamid64 must be a 17-digit string");

export const PutSteamIdentityBodySchema = z.object({
  steamid64: SteamId64Schema
});

export type PutSteamIdentityBody = z.infer<typeof PutSteamIdentityBodySchema>;

export const SyncSteamLibraryResponseSchema = z.object({
  steamid64: SteamId64Schema,
  gameCount: z.number().int().nonnegative(),
  fetchedAt: z.string()
});

export type SyncSteamLibraryResponse = z.infer<typeof SyncSteamLibraryResponseSchema>;

export type SteamIdentityResponse = {
  steamid64: string;
  verified: boolean;
  provider: "manual" | "openid";
};

export type SteamIdentityRow = SteamIdentityResponse;
