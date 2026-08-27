import type { Response } from 'express';

const IS_PROD = process.env['NODE_ENV'] === 'production';

const BASE_COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  path: '/',
};

export const ACCESS_COOKIE = 'orbit_access';
export const REFRESH_COOKIE = 'orbit_refresh';

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...BASE_COOKIE_OPTS,
    maxAge: 15 * 60 * 1000, // 15 min in ms
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...BASE_COOKIE_OPTS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/auth', // restrict refresh cookie to auth routes only
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...BASE_COOKIE_OPTS });
  res.clearCookie(REFRESH_COOKIE, { ...BASE_COOKIE_OPTS, path: '/api/auth' });
}
