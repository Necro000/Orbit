-- Orbit Migration: 003_shares_and_search.sql
-- Description: Creates shares (per-user ACL), link_shares (public links), and stars tables with indexes.

-- 1. Shares table (per-user ACL)
CREATE TABLE IF NOT EXISTS shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(10) NOT NULL CHECK (resource_type IN ('file', 'folder')),
    resource_id UUID NOT NULL,
    grantee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('viewer', 'editor')),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shares_resource_grantee UNIQUE (resource_type, resource_id, grantee_user_id)
);

-- 2. Link Shares table (public links with optional password and expiry)
CREATE TABLE IF NOT EXISTS link_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(10) NOT NULL CHECK (resource_type IN ('file', 'folder')),
    resource_id UUID NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    role VARCHAR(10) NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer')),
    password_hash TEXT NULL,
    expires_at TIMESTAMPTZ NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Stars table (composite PK for starred items)
CREATE TABLE IF NOT EXISTS stars (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(10) NOT NULL CHECK (resource_type IN ('file', 'folder')),
    resource_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, resource_type, resource_id)
);

-- 4. Key Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_shares_resource ON shares(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_shares_grantee ON shares(grantee_user_id);
CREATE INDEX IF NOT EXISTS idx_link_shares_token ON link_shares(token);
CREATE INDEX IF NOT EXISTS idx_stars_user ON stars(user_id);
