import { redirect } from 'next/navigation';

/**
 * Root route — redirects to /drive (protected).
 * The (app)/layout.tsx will redirect to /login if unauthenticated.
 */
export default function RootPage() {
  redirect('/drive');
}
