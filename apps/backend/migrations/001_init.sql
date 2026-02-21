CREATE extension IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('creator', 'member')),
    display_name TEXT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_members_room_id ON members(room_id);

CREATE TABLE IF NOT EXISTS member_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON member_sessions(member_id);

CREATE TABLE IF NOT EXISTS steam_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    steamid64 TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'openid')),
    openid_claimed_id TEXT NULL,
    openid_nonce TEXT NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_verified_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_steam_identities_member_id ON steam_identities(member_id);