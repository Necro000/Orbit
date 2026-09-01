-- Orbit Migration: 004_trash_and_activity.sql
-- Description: Creates activities table for audit logging.

CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(32) NOT NULL,
    resource_type VARCHAR(10) NOT NULL CHECK (resource_type IN ('file', 'folder')),
    resource_id UUID NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(actor_id);
