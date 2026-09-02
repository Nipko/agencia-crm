import React, { lazy, Suspense, useState } from "react";
import { useApp } from "../../context/AppContext";
import { Lock, LogIn, AlertCircle, LoaderCircle, Building2, ArrowLeft } from "lucide-react";

const logoPlanetour = "/logo_planetour.png";

const PublicClientLookup = lazy(() =>
  import("../public/PublicClientLookup").then((module) => ({ default: module.PublicClientLookup }))
);

export const LoginModal = () => {
  const { login } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPublicLookup, setShowPublicLookup] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg("");
    setIsSubmitting(true);
    try {
      const result = await login(username, password);
      if (!result.success) {
        setErrorMsg(result.error || "No fue posible iniciar sesión.");
      }
    } catch {
      setErrorMsg("Ocurrió un error inesperado al iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showPublicLookup) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <img src={logoPlanetour} alt="Planetour" className="h-9 w-auto rounded-lg bg-white px-2 py-1" />
            <button type="button" onClick={() => setShowPublicLookup(false)} className="btn-secondary text-xs">
              <ArrowLeft className="h-4 w-4" /> Iniciar sesión
            </button>
          </div>
        </header>
        <Suspense
          fallback={(
            <div className="flex min-h-64 items-center justify-center gap-2 text-xs font-semibold text-gray-400" role="status">
              <LoaderCircle className="h-5 w-5 animate-spin text-orange-400" /> Cargando consulta...
            </div>
          )}
        >
          <PublicClientLookup />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-800 rounded-2xl animate-modalPop">
        {/* Official Planetour Logo Header */}
        <div className="text-center space-y-3">
          <div className="bg-white px-5 py-3 rounded-2xl shadow-md inline-block border border-slate-200">
            <img src={logoPlanetour} alt="Planetour Logo" className="h-12 w-auto object-contain mx-auto" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">CRM CONSOLIDADOR</h1>
            <p className="text-xs text-gray-400 font-medium">Servidor Local PostgreSQL & Control de Emisiones</p>
          </div>
        </div>

        {errorMsg && (
          <div
            className="p-3 rounded-xl bg-rose-950 border border-rose-600 text-rose-200 text-xs font-semibold flex items-center gap-2"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="form-group">
            <label htmlFor="login-username" className="form-label">Usuario / Email</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              placeholder="Ingresa tu usuario"
              className="form-input text-xs font-mono"
              required
              autoComplete="username"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              placeholder="••••••••••••"
              className="form-input text-xs font-mono"
              required
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full justify-center py-3 text-sm font-bold shadow-lg disabled:opacity-60 disabled:cursor-wait"
          >
            {isSubmitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {isSubmitting ? "Verificando..." : "Iniciar Sesión"}
          </button>
        </form>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">o</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={() => {
            setPassword("");
            setErrorMsg("");
            setShowPublicLookup(true);
          }}
          className="btn-secondary w-full justify-center py-3 text-xs font-bold"
        >
          <Building2 className="h-4 w-4 text-orange-400" /> Identificar agencia sin iniciar sesión
        </button>

        <div className="pt-2 text-center">
          <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" /> Sesión protegida; usa HTTPS al acceder desde otra máquina.
          </p>
        </div>
      </div>
    </div>
  );
};
