import { env } from "../env";
import { ApiError } from "../errors";

type PlayerSummary = {
  steamid: string;
  personaname?: string;
};

type PlayerSummariesResponse = {
  response?: { players?: PlayerSummary[] };
};

type OwnedGame = {
  appid: number;
  playtime_forever?: number;
};

type OwnedGamesResponse = {
  response?: {
    game_count?: number;
    games?: OwnedGame[];
  };
};

function requireSteamKey(): string {
  const key = env.STEAM_WEB_API_KEY;
  if (typeof key !== "string" || key.length === 0) {
    throw new ApiError(500, "INTERNAL_ERROR", "STEAM_WEB_API_KEY is not configured");
  }
  return key;
}

export async function steamAccountExists(steamid64: string): Promise<boolean> {
  const key = requireSteamKey();

  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
  url.searchParams.set("key", key);
  url.searchParams.set("steamids", steamid64);

  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(502, "STEAM_UPSTREAM_ERROR", `Steam API error (${res.status})`);
  }

  const data = (await res.json()) as PlayerSummariesResponse;
  const players = data.response?.players ?? [];
  return players.some((p) => p.steamid === steamid64);
}

export async function fetchOwnedGames(steamid64: string): Promise<{ gameCount: number; games: OwnedGame[] }> {
  const key = requireSteamKey();

  const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
  url.searchParams.set("key", key);
  url.searchParams.set("steamid", steamid64);
  url.searchParams.set("include_appinfo", "0");
  url.searchParams.set("include_played_free_games", "1");

  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(502, "STEAM_UPSTREAM_ERROR", `Steam API error (${res.status})`);
  }

  const data = (await res.json()) as OwnedGamesResponse;
  const games = data.response?.games ?? [];
  const gameCount = typeof data.response?.game_count === "number" ? data.response.game_count : games.length;

  return { gameCount, games };
}
