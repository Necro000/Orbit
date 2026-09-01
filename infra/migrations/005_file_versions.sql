-- Orbit Migration 005: File Versions table and backfill
-- Architecture reference: architecture.md Section 4, Section 12; edge-case.md Section 9

-- ============================================================================
-- 1. File Versions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  storage_key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_file_version_number UNIQUE (file_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_created_at ON file_versions(created_at DESC);

-- ============================================================================
-- 2. Backfill Existing Files (Pre-Phase 5)
-- Every existing file without a version_id gets version 1 in file_versions,
-- and files.version_id is updated to point to that row.
-- ============================================================================
WITH inserted_versions AS (
  INSERT INTO file_versions (file_id, version_number, storage_key, size_bytes, checksum, created_at)
  SELECT
    id AS file_id,
    1 AS version_number,
    storage_key,
    size_bytes,
    checksum,
    created_at
  FROM files
  WHERE version_id IS NULL AND status = 'ready'
  ON CONFLICT (file_id, version_number) DO NOTHING
  RETURNING id, file_id
)
UPDATE files f
SET version_id = iv.id
FROM inserted_versions iv
WHERE f.id = iv.file_id;

-- Fallback update for any pre-existing rows where version 1 already existed in file_versions
UPDATE files f
SET version_id = v.id
FROM file_versions v
WHERE f.id = v.file_id AND v.version_number = 1 AND f.version_id IS NULL;

-- ============================================================================
-- 3. Foreign Key Constraint for files.version_id
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_files_version_id'
  ) THEN
    ALTER TABLE files
    ADD CONSTRAINT fk_files_version_id
    FOREIGN KEY (version_id)
    REFERENCES file_versions(id)
    ON DELETE SET NULL;
  END IF;
END $$;
