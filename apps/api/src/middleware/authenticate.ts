import type { NextFunction, Request, Response } from 'express';

import { ACCESS_COOKIE } from '../lib/cookies';
import { verifyAccessToken } from '../lib/tokens';

export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * authenticate — reads the access-token httpOnly cookie, verifies it, and
 * attaches `req.user.id` for downstream handlers.
 *
 * On failure it returns 401 immediately. It does NOT attempt to refresh —
 * that is the client's responsibility (see edge-case.md §1). The client
 * should call POST /api/auth/refresh and retry the original request.
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = cookies?.[ACCESS_COOKIE] || bearerToken || (req.query?.['token'] as string | undefined);

  if (!token) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({
      error: { code: 'TOKEN_EXPIRED', message: 'Access token expired or invalid.' },
    });
  }
}
