import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';

import { storageDevRouter } from './lib/storage';
import authRouter from './routes/auth';
import filesRouter from './routes/files';
import foldersRouter from './routes/folders';

dotenv.config();

const app: Application = express();
const PORT = process.env['PORT'] ?? 8080;

// Security & parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true, // required for httpOnly cookie exchange
  }),
);
app.use(express.json());
app.use(cookieParser());

// Health-check
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'orbit-api', phase: 2 });
});

// Direct storage endpoints for dev local disk adapter
app.use('/storage-dev', storageDevRouter);

// Core API routes
app.use('/api/auth', authRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/files', filesRouter);

app.listen(PORT, () => {
  console.log(`[orbit-api] listening on http://localhost:${PORT}`);
});

export default app;