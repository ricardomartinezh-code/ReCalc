CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  salt TEXT,
  university_slug TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'password',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_university_slug_idx
  ON users (university_slug);

CREATE TABLE IF NOT EXISTS admin_config (
  slug TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
