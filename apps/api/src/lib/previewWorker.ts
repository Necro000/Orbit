import { Queue, Worker, type Job } from 'bullmq';
import sharp from 'sharp';

import { storage } from './storage';
import { pruneOldVersions } from './versionDb';

export interface PreviewJob {
  fileId: string;
  storageKey: string;
  mimeType: string;
  name: string;
}

export interface PruneJob {
  fileId: string;
  keepCount?: number;
}

type MaintenanceJobData =
  | ({ type: 'generate-preview' } & PreviewJob)
  | ({ type: 'prune-versions' } & PruneJob);

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
const QUEUE_NAME = 'file-maintenance';

/**
 * PDF Renderer Environment Detection (Worker Startup Check)
 * Checked ONCE at worker startup. If no tool is available, logs a single warning
 * and disables PDF preview generation for this environment to prevent repeated errors.
 */
let isPdfRendererAvailable = false;
function checkPdfRendererSupport(): boolean {
  try {
    if (sharp.format['pdf']?.input?.file || sharp.format['pdf']?.input?.buffer) {
      return true;
    }
  } catch {
    // Ignore detection error
  }
  return false;
}

isPdfRendererAvailable = checkPdfRendererSupport();
if (!isPdfRendererAvailable) {
  console.warn(
    '[previewWorker] PDF preview generation tool is not available in this environment. PDF thumbnails will be skipped (fallback to file-type icon).',
  );
}

/**
 * Redis Availability & Retry Policy:
 * - If Redis is unreachable when enqueuing a job, the enqueue operation catches
 *   the connection error with a non-fatal warning so HTTP upload completion never hangs or fails.
 * - When Redis is connected and healthy, BullMQ persists jobs in Redis and retries failed jobs
 *   up to 3 times with exponential backoff (1s initial delay) before failing.
 */
let maintenanceQueue: Queue<MaintenanceJobData> | null = null;
let maintenanceWorker: Worker<MaintenanceJobData> | null = null;

try {
  const connectionUrl = new URL(REDIS_URL);
  const isTls = connectionUrl.protocol === 'rediss:';
  const connection = {
    host: connectionUrl.hostname || '127.0.0.1',
    port: Number(connectionUrl.port || 6379),
    username: connectionUrl.username ? decodeURIComponent(connectionUrl.username) : undefined,
    password: connectionUrl.password ? decodeURIComponent(connectionUrl.password) : undefined,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 1000, 3000);
    },
  };

  maintenanceQueue = new Queue<MaintenanceJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  maintenanceQueue.on('error', (err) => {
    console.warn('[maintenanceQueue] Queue connection issue (non-fatal):', err.message);
  });

  maintenanceWorker = new Worker<MaintenanceJobData>(
    QUEUE_NAME,
    async (job: Job<MaintenanceJobData>) => {
      if (job.data.type === 'generate-preview') {
        await processPreviewJob(job.data);
      } else if (job.data.type === 'prune-versions') {
        await pruneOldVersions(job.data.fileId, job.data.keepCount);
      }
    },
    {
      connection,
      concurrency: 4,
    },
  );

  maintenanceWorker.on('failed', (job, err) => {
    console.error(`[maintenanceWorker] Job ${job?.id} failed:`, err.message);
  });

  maintenanceWorker.on('error', (err) => {
    console.warn('[maintenanceWorker] Worker connection issue (non-fatal):', err.message);
  });
} catch (err) {
  console.warn('[maintenanceWorker] Redis/BullMQ initialization skipped (non-fatal):', err);
}

/**
 * Core image/PDF thumbnail processing logic.
 */
export async function processPreviewJob(job: PreviewJob): Promise<void> {
  const { fileId, storageKey, mimeType } = job;

  if (mimeType.startsWith('image/')) {
    const rawBuffer = await storage.getObject(storageKey);
    const thumbnailBuffer = await sharp(rawBuffer)
      .resize(200, 200, { fit: 'cover', withoutEnlargement: false })
      .jpeg({ quality: 80 })
      .toBuffer();

    const previewStorageKey = `previews/${storageKey}.jpg`;
    await storage.saveObjectDirect(previewStorageKey, thumbnailBuffer, 'image/jpeg');
    return;
  }

  if (mimeType === 'application/pdf') {
    if (!isPdfRendererAvailable) {
      return;
    }
    try {
      const rawBuffer = await storage.getObject(storageKey);
      const thumbnailBuffer = await sharp(rawBuffer, { page: 0 })
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      const previewStorageKey = `previews/${storageKey}.jpg`;
      await storage.saveObjectDirect(previewStorageKey, thumbnailBuffer, 'image/jpeg');
    } catch (err) {
      console.warn(`[previewWorker] Failed to render PDF thumbnail for ${fileId}:`, err);
    }
  }
}

/**
 * Enqueue preview generation into BullMQ.
 */
export function enqueuePreviewGeneration(job: PreviewJob): void {
  void (async () => {
    try {
      if (maintenanceQueue) {
        await maintenanceQueue.add(
          'generate-preview',
          { type: 'generate-preview', ...job },
          { jobId: `preview-${job.fileId}-${Date.now()}` },
        );
      } else {
        await processPreviewJob(job);
      }
    } catch (err) {
      try {
        await processPreviewJob(job);
      } catch (fallbackErr) {
        console.warn(`[previewWorker] Background preview generation failed for ${job.fileId} (non-fatal):`, fallbackErr);
      }
    }
  })();
}

/**
 * Enqueue version retention pruning into BullMQ worker.
 * Runs asynchronously in background — never blocks upload-complete request path.
 */
export function enqueueVersionPruning(job: PruneJob): void {
  void (async () => {
    try {
      if (maintenanceQueue) {
        await maintenanceQueue.add(
          'prune-versions',
          { type: 'prune-versions', ...job },
          { jobId: `prune-${job.fileId}-${Date.now()}` },
        );
      } else {
        await pruneOldVersions(job.fileId, job.keepCount);
      }
    } catch (err) {
      try {
        await pruneOldVersions(job.fileId, job.keepCount);
      } catch (fallbackErr) {
        console.warn(`[previewWorker] Version pruning failed for ${job.fileId} (non-fatal):`, fallbackErr);
      }
    }
  })();
}
