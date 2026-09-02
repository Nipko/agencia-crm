import React, { useEffect } from "react";
import { useNotifications } from "../../context/AppContext";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";

const ToastItem = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => onDismiss(toast.id), toast.type === "warning" ? 8000 : 5000);
    return () => globalThis.clearTimeout(timeoutId);
  }, [onDismiss, toast.id, toast.type]);

  return (
    <div
          className={`flex items-start gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-md border border-white/10 transition-all duration-300 animate-slide-in ${
            toast.type === "warning"
              ? "bg-amber-950/80 text-amber-200 border-amber-500/30"
              : toast.type === "success"
              ? "bg-emerald-950/80 text-emerald-200 border-emerald-500/30"
              : "bg-indigo-950/80 text-indigo-200 border-indigo-500/30"
          }`}
          style={{
            background:
              toast.type === "warning"
                ? "rgba(69, 26, 3, 0.9)"
                : toast.type === "success"
                ? "rgba(6, 78, 59, 0.9)"
                : "rgba(30, 27, 75, 0.9)"
          }}
          role={toast.type === "warning" ? "alert" : "status"}
        >
          <div className="mt-0.5 shrink-0">
            {toast.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-400" />}
            {toast.type === "info" && <Info className="w-5 h-5 text-indigo-400" />}
          </div>

          <div className="flex-1 text-xs leading-relaxed font-medium">
            {toast.message}
          </div>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar notificación"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
    </div>
  );
};

export const NotificationToast = () => {
  const { toasts, removeToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-[calc(100%-2.5rem)]"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
};
