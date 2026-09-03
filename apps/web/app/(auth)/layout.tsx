import { QueryProvider } from '@/components/providers/QueryProvider';
import { ToastProvider } from '@/components/ui/Toast';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ToastProvider>
        <div className="auth-layout">
          {children}
        </div>
      </ToastProvider>
    </QueryProvider>
  );
}
