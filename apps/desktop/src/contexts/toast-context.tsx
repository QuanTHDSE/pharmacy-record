import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ToastContext } from './toast-store';
import type { ToastTone } from './toast-store';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((items) => [...items, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const Icon =
            toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${
                toast.tone === 'error'
                  ? 'border-rose-200 text-rose-800'
                  : toast.tone === 'info'
                    ? 'border-sky-200 text-sky-800'
                    : 'border-emerald-200 text-emerald-800'
              }`}
              role="status"
            >
              <Icon className="mt-0.5 size-5 shrink-0" />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                aria-label="Đóng thông báo"
                className="rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"
                onClick={() => dismiss(toast.id)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
