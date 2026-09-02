import React, { lazy, Suspense } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { Navbar } from "./components/layout/Navbar";
import { Sidebar } from "./components/layout/Sidebar";
import { LoginModal } from "./components/auth/LoginModal";
import { NotificationToast } from "./components/common/NotificationToast";
import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";

const ExecutiveDashboard = lazy(() =>
  import("./components/dashboard/ExecutiveDashboard").then((module) => ({ default: module.ExecutiveDashboard }))
);
const ClientsManager = lazy(() =>
  import("./components/clients/ClientsManager").then((module) => ({ default: module.ClientsManager }))
);
const SystemsSignaturesManager = lazy(() =>
  import("./components/systems/SystemsSignaturesManager").then((module) => ({
    default: module.SystemsSignaturesManager
  }))
);
const PublicContractsManager = lazy(() =>
  import("./components/contracts/PublicContractsManager").then((module) => ({
    default: module.PublicContractsManager
  }))
);
const HospitalityManager = lazy(() =>
  import("./components/hospitality/HospitalityManager").then((module) => ({ default: module.HospitalityManager }))
);
const KaringIntegrationPanel = lazy(() =>
  import("./components/karing/KaringIntegrationPanel").then((module) => ({
    default: module.KaringIntegrationPanel
  }))
);
const SettingsManager = lazy(() =>
  import("./components/settings/SettingsManager").then((module) => ({ default: module.SettingsManager }))
);

const MODULES = {
  dashboard: ExecutiveDashboard,
  clients: ClientsManager,
  systems: SystemsSignaturesManager,
  contracts: PublicContractsManager,
  hospitality: HospitalityManager,
  karing: KaringIntegrationPanel,
  settings: SettingsManager
};

const LoadingState = ({ message = "Cargando módulo..." }) => (
  <div className="min-h-64 flex flex-col items-center justify-center gap-3 text-gray-400" role="status">
    <LoaderCircle className="w-7 h-7 text-indigo-400 animate-spin" />
    <span className="text-xs font-semibold">{message}</span>
  </div>
);

const MainContent = () => {
  const { activeTab, isBootstrapping, dataError, usingFallbackData, retryDataLoad } = useApp();
  const ActiveModule = MODULES[activeTab] || ExecutiveDashboard;

  return (
    <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
      {dataError && (
        <div
          className="mb-4 p-3 rounded-xl bg-amber-950/50 border border-amber-500/30 text-amber-100 flex flex-col sm:flex-row sm:items-center gap-3"
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold">No se pudieron actualizar los datos del servidor.</p>
            <p className="text-[11px] text-amber-200/80">
              {dataError}{usingFallbackData ? " Se muestran los datos locales disponibles." : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={retryDataLoad}
            disabled={isBootstrapping}
            className="btn-secondary text-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBootstrapping ? "animate-spin" : ""}`} /> Reintentar
          </button>
        </div>
      )}

      {isBootstrapping ? (
        <LoadingState message="Cargando datos del CRM..." />
      ) : (
        <Suspense fallback={<LoadingState />}>
          <ActiveModule />
        </Suspense>
      )}
    </main>
  );
};

const AppContent = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-gray-100 font-sans">
        <LoginModal />
        <NotificationToast />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col font-sans">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <MainContent />
      </div>
      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
