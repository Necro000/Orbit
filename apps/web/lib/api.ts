/**
 * Base API client.
 *
 * Handles the 401 → refresh → retry once pattern described in edge-case.md §1.
 * All fetch calls in the app should go through this helper (or a hook that uses it).
 */

const API_BASE = typeof window === 'undefined'
  ? (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080')
  : '';

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

function flushPending() {
  pendingRequests.forEach((resolve) => resolve());
  pendingRequests = [];
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  _retry = true,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (res.status === 401 && _retry) {
    // Queue concurrent requests while refresh is in flight
    if (isRefreshing) {
      await new Promise<void>((resolve) => pendingRequests.push(resolve));
      return apiFetch<T>(path, init, false);
    }

    isRefreshing = true;
    const refreshed = await tryRefresh();
    isRefreshing = false;
    flushPending();

    if (refreshed) {
      return apiFetch<T>(path, init, false);
    }
    // Refresh also failed — propagate 401 so protected-route logic can redirect
  }

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = res.statusText;
    try {
      const body = await res.json() as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, code, message);
  }

  return res.json() as Promise<T>;
}
