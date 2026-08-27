/**
 * Auth route integration tests — Phase 1
 */

import cookieParser from 'cookie-parser';
import express from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env['JWT_SECRET'] = 'test-access-secret-32-chars-long!!';
process.env['REFRESH_SECRET'] = 'test-refresh-secret-32-chars-long!';
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['NODE_ENV'] = 'test';

const mockDbQuery = vi.fn();

vi.mock('../db', () => ({
  db: {
    query: (...args: unknown[]) => mockDbQuery(...args) as unknown,
  },
}));

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
describe('Auth Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    mockDbQuery.mockReset();
    const authRouter = (await import('./auth')).default;
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRouter);
  });

  function extractCookie(res: supertest.Response, name: string): string | undefined {
    const cookies = res.headers['set-cookie'] as string[] | string | undefined;
    if (!cookies) return undefined;
    const arr = Array.isArray(cookies) ? cookies : [cookies];
    const found = arr.find((c) => c.startsWith(`${name}=`));
    return found?.split(';')[0]?.split('=')[1];
  }

  describe('POST /api/auth/register', () => {
    it('registers a new user and sets auth cookies (happy path)', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'user-uuid-1',
            email: 'alice@example.com',
            name: 'Alice',
            image_url: null,
            created_at: new Date('2025-01-01'),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ email: 'alice@example.com', name: 'Alice', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ email: 'alice@example.com', name: 'Alice' });
      expect(extractCookie(res, 'orbit_access')).toBeDefined();
    });

    it('rejects registration with an invalid email', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', name: 'Bob', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects registration with a too-short password', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ email: 'carol@example.com', name: 'Carol', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 DUPLICATE_EMAIL when email already exists', async () => {
      mockDbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'existing-id' }] });

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ email: 'duplicate@example.com', name: 'Dup', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials and sets auth cookies (happy path)', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 4);

      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 'user-uuid-1',
            email: 'alice@example.com',
            name: 'Alice',
            image_url: null,
            password_hash: passwordHash,
            created_at: new Date('2025-01-01'),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: 'alice@example.com' });
      expect(extractCookie(res, 'orbit_access')).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('correct-password', 4);

      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-uuid-1',
          email: 'alice@example.com',
          name: 'Alice',
          image_url: null,
          password_hash: passwordHash,
          created_at: new Date('2025-01-01'),
        }],
      });

      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for unknown email', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates refresh token and issues fresh access token (happy path)', async () => {
      const bcrypt = await import('bcryptjs');
      const { signRefreshToken } = await import('../lib/tokens');
      const refreshToken = signRefreshToken('user-uuid-1', 'family-uuid-1');
      const tokenHash = await bcrypt.hash(refreshToken, 4);

      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'token-1', token_hash: tokenHash, revoked: false }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`orbit_refresh=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(extractCookie(res, 'orbit_access')).toBeDefined();
      expect(extractCookie(res, 'orbit_refresh')).toBeDefined();
    });

    it('revokes session family when a revoked token is reused (compromise/replay detection)', async () => {
      const { signRefreshToken } = await import('../lib/tokens');
      const refreshToken = signRefreshToken('user-uuid-1', 'family-uuid-1');

      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'token-1', token_hash: 'hash-1', revoked: true }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`orbit_refresh=${refreshToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_COMPROMISED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears auth cookies (happy path)', async () => {
      const { signAccessToken, signRefreshToken } = await import('../lib/tokens');
      const accessToken = signAccessToken('user-uuid-1');
      const refreshToken = signRefreshToken('user-uuid-1', 'family-uuid-1');

      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .post('/api/auth/logout')
        .set('Cookie', [`orbit_access=${accessToken}`, `orbit_refresh=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const setCookieHeader = res.headers['set-cookie'] as string[] | undefined;
      expect(setCookieHeader?.some((c) => c.includes('orbit_access=;'))).toBe(true);
    });

    it('returns 401 if not authenticated', async () => {
      const res = await supertest(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user when authenticated', async () => {
      const { signAccessToken } = await import('../lib/tokens');
      const accessToken = signAccessToken('user-uuid-1');

      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          id: 'user-uuid-1',
          email: 'alice@example.com',
          name: 'Alice',
          image_url: null,
          created_at: new Date('2025-01-01'),
        }],
      });

      const res = await supertest(app)
        .get('/api/auth/me')
        .set('Cookie', [`orbit_access=${accessToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alice@example.com');
    });

    it('returns 401 when no cookie is present', async () => {
      const res = await supertest(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Edge cases', () => {
    it('returns TOKEN_EXPIRED for an expired JWT', async () => {
      const jwt = await import('jsonwebtoken');
      const expiredToken = jwt.sign(
        { sub: 'user-uuid-1', type: 'access' },
        process.env['JWT_SECRET']!,
        { expiresIn: -1 },
      );

      const res = await supertest(app)
        .get('/api/auth/me')
        .set('Cookie', [`orbit_access=${expiredToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });
});
