import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';

dotenv.config();

const app: Application = express();
const PORT = process.env['PORT'] ?? 8080;

// Security & parsing middleware
app.use(helmet());
app.use(cors({ origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000' }));
app.use(express.json());

// Health-check — Phase 0 only
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'orbit-api', phase: 0 });
});

app.listen(PORT, () => {
  console.log(`[orbit-api] listening on http://localhost:${PORT}`);
});

export default app;