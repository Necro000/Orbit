import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';

import authRouter from './routes/auth';

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
  res.json({ status: 'ok', app: 'orbit-api', phase: 1 });
});

// Auth routes
app.use('/api/auth', authRouter);

app.listen(PORT, () => {
  console.log(`[orbit-api] listening on http://localhost:${PORT}`);
});

export default app;