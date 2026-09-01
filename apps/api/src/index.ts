import path from 'path';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { storageDevRouter } from './lib/storage';
import { startTrashPurgeScheduler } from './lib/trashPurge';
import { generalRateLimiter } from './middleware/rateLimiter';
import activitiesRouter from './routes/activities';
import authRouter from './routes/auth';
import filesRouter from './routes/files';
import foldersRouter from './routes/folders';
import linkSharesRouter from './routes/linkShares';
import recentRouter from './routes/recent';
import searchRouter from './routes/search';
import sharedRouter from './routes/shared';
import sharesRouter from './routes/shares';
import starsRouter from './routes/stars';
import trashRouter from './routes/trash';

const app: Application = express();
const PORT = process.env['PORT'] ?? 8080;

// Security & parsing middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'data:', 'blob:', 'http://localhost:8080', 'http://127.0.0.1:8080'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true, // required for httpOnly cookie exchange
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(generalRateLimiter);

// Health-check
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'orbit-api', phase: 4, mvp: true });
});

// Direct storage endpoints for dev local disk adapter
app.use('/storage-dev', storageDevRouter);

// Core API routes
app.use('/api/auth', authRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/files', filesRouter);
app.use('/api/shares', sharesRouter);
app.use('/api', linkSharesRouter); // Mounts /api/link-shares and /api/link/:token
app.use('/api/stars', starsRouter);
app.use('/api/search', searchRouter);
app.use('/api/recent', recentRouter);
app.use('/api/shared', sharedRouter);
app.use('/api/trash', trashRouter);
app.use('/api/activities', activitiesRouter);

// Global error handler middleware — ensures unexpected errors never crash Express
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('[orbit-api] Unhandled server error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred.',
    },
  });
});

// Start daily trash purge background job if not in test env
if (process.env['NODE_ENV'] !== 'test') {
  startTrashPurgeScheduler();
}

if (process.env['NODE_ENV'] !== 'test') {
  app.listen(PORT, () => {
    console.log(`[orbit-api] listening on http://localhost:${PORT}`);
  });
}

export default app;