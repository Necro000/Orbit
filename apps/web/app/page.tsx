import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Root route — redirects directly to /drive if authenticated, or /login if unauthenticated.
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('orbit_access')?.value;

  if (accessToken) {
    redirect('/drive');
  } else {
    redirect('/login');
  }
}
