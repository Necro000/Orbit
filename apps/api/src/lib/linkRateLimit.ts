interface RateLimitEntry {
  attempts: number[];
}

const store = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkLinkPasswordRateLimit(
  token: string,
  clientIp: string,
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const key = `${token}:${clientIp}`;
  const now = Date.now();
  const entry = store.get(key) ?? { attempts: [] };

  // Filter attempts older than the window
  entry.attempts = entry.attempts.filter((ts) => now - ts < WINDOW_MS);

  if (entry.attempts.length >= MAX_ATTEMPTS) {
    const oldest = entry.attempts[0] ?? now;
    const retryAfterSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return {
    allowed: true,
    remaining: MAX_ATTEMPTS - entry.attempts.length,
    retryAfterSeconds: 0,
  };
}

export function recordLinkPasswordFailure(token: string, clientIp: string): void {
  const key = `${token}:${clientIp}`;
  const now = Date.now();
  const entry = store.get(key) ?? { attempts: [] };
  entry.attempts = entry.attempts.filter((ts) => now - ts < WINDOW_MS);
  entry.attempts.push(now);
  store.set(key, entry);
}

export function clearLinkPasswordFailures(token: string, clientIp: string): void {
  const key = `${token}:${clientIp}`;
  store.delete(key);
}
