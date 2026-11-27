import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-sky-400 shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-800/80 bg-emerald-950/90 text-emerald-100',
    warning: 'border-amber-800/80 bg-amber-950/90 text-amber-100',
    error: 'border-rose-800/80 bg-rose-950/90 text-rose-100',
    info: 'border-sky-800/80 bg-sky-950/90 text-sky-100',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-3.5 rounded-xl border shadow-soc-elevated flex items-start justify-between gap-3 text-xs transition-all ${
            borderColors[toast.type]
          }`}
        >
          <div className="flex items-start gap-2.5">
            {icons[toast.type]}
            <div>
              <div className="font-semibold">{toast.title}</div>
              {toast.message && <div className="text-[11px] opacity-80 mt-0.5">{toast.message}</div>}
            </div>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="opacity-70 hover:opacity-100 p-0.5 rounded transition-opacity"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
