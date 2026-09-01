import { db } from '../db';

export type ActivityAction =
  | 'upload'
  | 'upload_version'
  | 'revert_version'
  | 'rename'
  | 'delete'
  | 'restore'
  | 'move'
  | 'share'
  | 'download';

export interface ActivityRecord {
  id: string;
  actor_id: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  action: ActivityAction;
  resource_type: 'file' | 'folder';
  resource_id: string;
  context: Record<string, unknown>;
  created_at: Date;
}

/**
 * logActivity — Appends an audit event to the activities table.
 * Asynchronous, non-blocking on failure.
 */
export async function logActivity(
  actorId: string | null,
  action: ActivityAction,
  resourceType: 'file' | 'folder',
  resourceId: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.query(
      'INSERT INTO activities (actor_id, action, resource_type, resource_id, context) VALUES ($1, $2, $3, $4, $5)',
      [actorId, action, resourceType, resourceId, JSON.stringify(context)],
    );
  } catch (err) {
    // Log error to stderr without failing parent request
    console.error('Failed to record activity log:', err);
  }
}

/**
 * getActivityForItem — Returns chronological activity log for a specific file or folder.
 */
export async function getActivityForItem(
  resourceType: 'file' | 'folder',
  resourceId: string,
  limit = 20,
): Promise<ActivityRecord[]> {
  const query = `
    SELECT a.id, a.actor_id, u.name as actor_name, u.email as actor_email,
           a.action, a.resource_type, a.resource_id, a.context, a.created_at
    FROM activities a
    LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.resource_type = $1 AND a.resource_id = $2
    ORDER BY a.created_at DESC
    LIMIT $3;
  `;
  const result = await db.query<ActivityRecord>(query, [resourceType, resourceId, limit]);
  return result.rows;
}
