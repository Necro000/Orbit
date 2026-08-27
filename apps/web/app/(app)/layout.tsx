import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { QueryProvider } from '@/components/providers/QueryProvider';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

/**
 * Server-side auth check for all protected (app) routes.
 * Reads the access cookie from the incoming request and calls GET /api/auth/me.
 * On 401, redirects to /login immediately — no client-side JS needed for the
 * initial auth guard.
 */
async function getSessionUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('orbit_access')?.value;

  if (!accessToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Cookie: `orbit_access=${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json() as { user: { id: string; name: string; email: string } };
    return data.user;
  } catch {
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <QueryProvider>
      {children}
    </QueryProvider>
  );
}
