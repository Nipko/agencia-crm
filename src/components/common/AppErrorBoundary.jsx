import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Error inesperado en la interfaz de Planetour CRM:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center p-6">
        <section className="glass-panel max-w-lg w-full p-8 text-center space-y-4" role="alert">
          <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-rose-950 text-rose-300 border border-rose-800">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h1 className="text-xl">No pudimos mostrar esta pantalla</h1>
            <p className="text-sm text-slate-400">
              Recarga la aplicación. Si el problema continúa, revisa el estado de la API y PostgreSQL.
            </p>
          </div>
          <button type="button" className="btn-primary mx-auto" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Recargar aplicación
          </button>
        </section>
      </main>
    );
  }
}
