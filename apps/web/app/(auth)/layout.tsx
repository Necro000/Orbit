import { QueryProvider } from '@/components/providers/QueryProvider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="auth-layout">
        {children}
      </div>
    </QueryProvider>
  );
}
