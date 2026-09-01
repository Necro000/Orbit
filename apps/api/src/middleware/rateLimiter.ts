import type { Response, NextFunction } from 'express';

import type { AuthenticatedRequest } from './authenticate';

interface WindowEntry {
  count: number;
  resetAt: number;
}

function createSlidingLimiter(maxRequests: number, windowMs: number, customMessage: string) {
  const hits = new Map<string, WindowEntry>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = req.user?.id ?? 'anon';
    const key = `${userId}:${ip}`;
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
