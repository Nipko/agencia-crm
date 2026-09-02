import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { KeyRound, X, CheckCircle2, AlertTriangle, LoaderCircle } from "lucide-react";

export const ChangePasswordModal = ({ onClose }) => {
  const { changePassword } = useApp();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!successMsg) return undefined;
    const timeoutId = globalThis.setTimeout(onClose, 1200);
    return () => globalThis.clearTimeout(timeoutId);
  }, [onClose, successMsg]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("Las nuevas contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (!result.success) {
        setErrorMsg(result.error || "No fue posible actualizar la contraseña.");
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccessMsg("¡Contraseña actualizada con éxito!");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-md p-6 space-y-6" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-400" /> Cambiar Mi Contraseña
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cambio de contraseña"
            className="w-8 h-8 rounded-lg bg-slate-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div
            className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-2"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label htmlFor="current-password" className="form-label">Contraseña Actual *</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="form-input text-xs font-mono"
              required
              autoComplete="current-password"
              disabled={isSubmitting || Boolean(successMsg)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-password" className="form-label">Nueva Contraseña *</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 10 caracteres"
              className="form-input text-xs font-mono"
              required
              minLength={10}
              autoComplete="new-password"
              disabled={isSubmitting || Boolean(successMsg)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password" className="form-label">Confirmar Nueva Contraseña *</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva contraseña"
              className="form-input text-xs font-mono"
              required
              minLength={10}
              autoComplete="new-password"
              disabled={isSubmitting || Boolean(successMsg)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(successMsg)}
              className="btn-primary text-xs font-bold disabled:opacity-60"
            >
              {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
