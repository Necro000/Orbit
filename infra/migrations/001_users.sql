-- Migration: 001_users
-- Creates the users table (architecture.md §4) and refresh_tokens table
-- for session management (httpOnly cookie + rotation per architecture.md §6).
-- Run with: psql $DATABASE_URL -f infra/migrations/001_users.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ────────────────────────────────────────────────────
-- users
-- id        : UUID PK, auto-generated
-- email     : unique, case-insensitive stored as lowercase
-- name      : display name
-- image_url : nullable profile picture URL
-- password_hash: bcrypt-hashed password (nullable to allow OAuth users later)
-- created_at: immutable timestamp
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  image_url     TEXT,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- ────────────────────────────────────────────────────
-- refresh_tokens
-- Tracks active refresh token families per session.
-- family    : random UUID grouping tokens for one login session
-- token_hash: bcrypt hash of the raw refresh token
-- revoked   : true = compromised/logged-out (replay protection per edge-case.md §1)
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family      UUID NOT NULL,
  token_hash  TEXT NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens (family);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx   ON refresh_tokens (user_id);
