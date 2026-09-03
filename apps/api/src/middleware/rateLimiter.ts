import type { Response, NextFunction } from 'express';

import type { AuthenticatedRequest } from './authenticate';

interface WindowEntry {
  count: number;
  resetAt: number;
}

function extractRateLimitKey(req: AuthenticatedRequest): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const body = req.body as unknown;
  let identifier = req.user?.id ?? 'anon';

  if (typeof body === 'object' && body !== null && 'email' in body) {
    const rawEmail = (body as Record<string, unknown>)['email'];
    if (typeof rawEmail === 'string' && rawEmail.trim().length > 0) {
      identifier = rawEmail.trim().toLowerCase();
    }
  }

  return `${identifier}:${ip}`;
}

function createSlidingLimiter(maxRequests: number, windowMs: number, customMessage: string) {
  const hits = new Map<string, WindowEntry>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = extractRateLimitKey(req);
    const now = Date.now();

    const record = hits.get(key);
    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: customMessage,
        },
      });
      return;
    }

    record.count += 1;
    next();
  };
}

export const generalRateLimiter = createSlidingLimiter(
  100,
  5 * 60 * 1000,
  'Too many requests. Please slow down.',
);

export const uploadInitRateLimiter = createSlidingLimiter(
  30,
  5 * 60 * 1000,
  'Too many upload initialization requests. Please wait a few minutes before trying again.',
);

export const authRateLimiter = createSlidingLimiter(
  5,
  15 * 60 * 1000,
  'Too many login attempts. Please wait 15 minutes before trying again.',
);
