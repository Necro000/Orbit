import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction, IRouter } from 'express';
import { Router } from 'express';

import { db } from '../db';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '../lib/cookies';
import {
  REFRESH_TTL_SECONDS_EXPORT as REFRESH_TTL,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/tokens';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import { LoginSchema, RegisterSchema } from '../schemas/auth';

const router: IRouter = Router();
const BCRYPT_ROUNDS = 12;

interface UserRow {
  id: string;
  email: string;
  name: string;
  image_url: string | null;
  created_at: Date;
  password_hash?: string | null;
}

interface TokenRow {
  id: string;
  token_hash: string;
  revoked: boolean;
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', (req: Request, res: Response, next: NextFunction): void => {
  void (async () => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: firstIssue?.message ?? 'Invalid input.' },
      });
      return;
    }

    const { email, name, password } = parsed.data;

    const existing = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({
        error: { code: 'DUPLICATE_EMAIL', message: 'An account with this email already exists.' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await db.query<UserRow>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, image_url, created_at`,
      [email, name, passwordHash],
    );
    const user = result.rows[0];
    if (!user) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'User creation failed.' } });
      return;
    }

    const family = randomUUID();
    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id, family);
    const refreshHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, family, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + $4::interval)`,
      [user.id, family, refreshHash, `${REFRESH_TTL} seconds`],
    );

    setAuthCookies(res, { accessToken, refreshToken });
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at },
    });
  })().catch(next);
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', (req: Request, res: Response, next: NextFunction): void => {
  void (async () => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: firstIssue?.message ?? 'Invalid input.' },
      });
      return;
    }

    const { email, password } = parsed.data;

    const result = await db.query<UserRow>(
      'SELECT id, email, name, image_url, password_hash, created_at FROM users WHERE email = $1',
      [email],
    );

    const user = result.rows[0];
    const hash = user?.password_hash ?? '$2b$12$invalidhashpadding000000000000000000000000000000000000';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }

    const family = randomUUID();
    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id, family);
    const refreshHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, family, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + $4::interval)`,
      [user.id, family, refreshHash, `${REFRESH_TTL} seconds`],
    );

    setAuthCookies(res, { accessToken, refreshToken });
    res.status(200).json({
      user: { id: user.id, email: user.email, name: user.name, imageUrl: user.image_url },
    });
  })().catch(next);
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', (req: Request, res: Response, next: NextFunction): void => {
  void (async () => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const rawRefreshToken = cookies?.[REFRESH_COOKIE];
    if (!rawRefreshToken) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No refresh token.' } });
      return;
    }

    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      clearAuthCookies(res);
      res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'Refresh token expired.' } });
      return;
    }

    const familyTokens = await db.query<TokenRow>(
      `SELECT id, token_hash, revoked FROM refresh_tokens
       WHERE user_id = $1 AND family = $2 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [payload.sub, payload.family],
    );

    const hasRevoked = familyTokens.rows.some((t) => t.revoked);
    if (hasRevoked) {
      await db.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND family = $2',
        [payload.sub, payload.family],
      );
      clearAuthCookies(res);
      res.status(401).json({ error: { code: 'SESSION_COMPROMISED', message: 'Session revoked. Please log in again.' } });
      return;
    }

    let matchedId: string | null = null;
    for (const row of familyTokens.rows) {
      const matches = await bcrypt.compare(rawRefreshToken, row.token_hash);
      if (matches) { matchedId = row.id; break; }
    }

    if (!matchedId) {
      await db.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND family = $2',
        [payload.sub, payload.family],
      );
      clearAuthCookies(res);
      res.status(401).json({ error: { code: 'SESSION_COMPROMISED', message: 'Session revoked.' } });
      return;
    }

    await db.query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [matchedId]);

    const newAccessToken = signAccessToken(payload.sub);
    const newRefreshToken = signRefreshToken(payload.sub, payload.family);
    const newHash = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, family, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + $4::interval)`,
      [payload.sub, payload.family, newHash, `${REFRESH_TTL} seconds`],
    );

    setAuthCookies(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
    res.status(200).json({ ok: true });
  })().catch(next);
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticate, (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  void (async () => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const rawRefreshToken = cookies?.[REFRESH_COOKIE];

    if (rawRefreshToken) {
      try {
        const payload = verifyRefreshToken(rawRefreshToken);
        await db.query(
          'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND family = $2',
          [payload.sub, payload.family],
        );
      } catch {
        // Token already expired — still clear cookies
      }
    }

    clearAuthCookies(res);
    res.status(200).json({ ok: true });
  })().catch(next);
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  void (async () => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }

    const result = await db.query<UserRow & { storage_used_bytes?: string | number }>(
      `SELECT u.id, u.email, u.name, u.image_url, u.created_at,
              COALESCE((SELECT SUM(size_bytes) FROM files WHERE owner_id = u.id AND is_deleted = false AND status = 'ready'), 0) AS storage_used_bytes
       FROM users u
       WHERE u.id = $1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
      return;
    }

    const storageUsedBytes = Number(user.storage_used_bytes ?? 0);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.image_url,
        createdAt: user.created_at,
        storageUsedBytes,
      },
    });
  })().catch(next);
});

export default router;
