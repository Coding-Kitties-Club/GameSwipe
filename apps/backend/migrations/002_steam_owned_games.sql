CREATE TABLE IF NOT EXISTS steam_owned_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  steamid64 TEXT NOT NULL,
  game_count INTEGER NOT NULL DEFAULT 0,
  games JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_steam_owned_games_member_id ON steam_owned_games(member_id);