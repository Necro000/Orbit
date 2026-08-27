-- Orbit Migration 002: Folders and Files tables
-- Architecture reference: architecture.md Section 4, edge-case.md Section 2-3

-- ============================================================================
-- Folders Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up folders by owner and parent
CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

-- Enforce unique folder name per parent folder per owner for active (non-deleted) folders
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_owner_parent_name
ON folders (owner_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name)
WHERE is_deleted = false;

-- ============================================================================
-- Files Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  version_id UUID,
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying files
CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
