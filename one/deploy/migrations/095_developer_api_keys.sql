CREATE TABLE auth_usr.developer_api_keys (
    user_id TEXT PRIMARY KEY REFERENCES auth_usr.users(id) ON DELETE CASCADE,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    suffix TEXT NOT NULL CHECK (length(suffix) = 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
