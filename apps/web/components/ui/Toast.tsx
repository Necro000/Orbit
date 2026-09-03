'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextType {
  toast: (options: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((options: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { ...options, id };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-2xl border backdrop-blur-xl animate-toast-in transition-all duration-300 ${
              t.type === 'error'
                ? 'bg-red-950/95 border-red-500/50 text-red-100 shadow-red-950/60 ring-1 ring-red-500/20'
                : t.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/60 ring-1 ring-emerald-500/20'
                : 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/60 ring-1 ring-white/10'
            }`}
          >
            <div className="flex items-center gap-3 text-sm font-medium">
              <span className="text-base flex-shrink-0">{t.type === 'error' ? '⚠️' : t.type === 'success' ? '✓' : 'ℹ️'}</span>
              <span className="leading-snug">{t.message}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {t.actionLabel && t.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    t.onAction?.();
                    removeToast(t.id);
                  }}
                  className="text-xs font-semibold px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md transition"
                >
                  {t.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white text-xs p-1 rounded-md hover:bg-white/10 transition-colors"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (opts) => {
        console.log(`[Toast ${opts.type}]`, opts.message);
      },
    };
  }
  return ctx;
}
