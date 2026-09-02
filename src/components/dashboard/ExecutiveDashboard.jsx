import React, { useMemo } from "react";
import { useApp } from "../../context/AppContext";
import {
  Users,
  Cpu,
  Receipt,
  FileText,
  Building2,
  Trees,
  BedDouble,
  ExternalLink,
  ShieldAlert,
  Zap
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from "recharts";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export const ExecutiveDashboard = () => {
  const {
    clients,
    signatures,
    contracts,
    karingLedger,
    systems,
    hotelInventory,
    reservePackages,
    karingConfig,
    setActiveTab,
    setSelectedClientForModal
  } = useApp();

  const metrics = useMemo(() => {
    const clientMetrics = clients.reduce(
      (result, client) => {
        if (client.status === "ACTIVE") result.active += 1;
        if (["WARNING", "BLOCKED"].includes(client.status)) result.warning += 1;
        result.karingBalance += Number(client.karingBalance) || 0;
        return result;
      },
      { active: 0, warning: 0, karingBalance: 0 }
    );

    const signatureMetrics = signatures.reduce(
      (result, signature) => {
        if (signature.status === "ACTIVE") result.active += 1;
        if (signature.status === "SUSPENDED_OVERDUE") result.suspended += 1;
        result.bySystem[signature.systemId] = (result.bySystem[signature.systemId] || 0) + 1;
        return result;
      },
      { active: 0, suspended: 0, bySystem: {} }
    );

    const contractMetrics = contracts.reduce(
      (result, contract) => {
        result.total += Number(contract.totalAmount) || 0;
        result.executed += Number(contract.executedAmount) || 0;
        return result;
      },
      { total: 0, executed: 0 }
    );

    return {
      activeClientsCount: clientMetrics.active,
      warningClientsCount: clientMetrics.warning,
      totalKaringBalance: clientMetrics.karingBalance,
      activeSignaturesCount: signatureMetrics.active,
      suspendedSignaturesCount: signatureMetrics.suspended,
      totalOverdueBalance: karingLedger.reduce(
        (total, invoice) =>
          String(invoice.status || "").startsWith("OVERDUE") ? total + (Number(invoice.amount) || 0) : total,
        0
      ),
      totalContractsBudget: contractMetrics.total,
      totalExecutedBudget: contractMetrics.executed,
      systemChartData: systems.map((system) => ({
        id: system.id,
        name: system.name,
        count: signatureMetrics.bySystem[system.id] || 0,
        color: system.color || "#6366f1"
      }))
    };
  }, [clients, contracts, karingLedger, signatures, systems]);

  const availableRooms = useMemo(
    () => hotelInventory.filter((room) => room.status === "AVAILABLE").length,
    [hotelInventory]
  );
  const bookedVisitors = useMemo(
    () => reservePackages.reduce((total, item) => total + (Number(item.currentBookedToday) || 0), 0),
    [reservePackages]
  );
  const riskClients = useMemo(
    () => clients.filter((client) => client.status !== "ACTIVE"),
    [clients]
  );
  const formatCOP = (value) => copFormatter.format(Number(value) || 0);

  const {
    activeClientsCount,
    warningClientsCount,
    totalKaringBalance,
    activeSignaturesCount,
    suspendedSignaturesCount,
    totalOverdueBalance,
    totalContractsBudget,
    totalExecutedBudget,
    systemChartData
  } = metrics;
  const totalSignaturesCount = signatures.length;

  return (
    <div className="space-y-6 pb-8">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            Panel de Control Consolidador <Zap className="w-6 h-6 text-amber-400" />
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Supervisión integral de clientes, firmas GDS, convenios de estado y cartera Karing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("clients")}
            className="btn-primary text-xs font-bold"
          >
            <Users className="w-4 h-4" /> Ver Todas las Agencias
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Clients */}
        <div
          onClick={() => setActiveTab("clients")}
          className="glass-panel p-4 cursor-pointer hover:border-indigo-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Total Agencias & Entidades</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{clients.length}</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-emerald-400 font-bold">{activeClientsCount} Activas</span>
              {warningClientsCount > 0 && (
                <span className="text-rose-400 font-bold">• {warningClientsCount} Mora</span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Agencias Minoristas + Alcaldías/Gobernaciones</p>
        </div>

        {/* Card 2: Signatures GDS */}
        <div
          onClick={() => setActiveTab("systems")}
          className="glass-panel p-4 cursor-pointer hover:border-sky-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Firmas & PCCs en Sistemas</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{totalSignaturesCount}</span>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-emerald-400 font-bold">{activeSignaturesCount} Operativas</span>
              {suspendedSignaturesCount > 0 && (
                <span className="text-amber-400 font-bold">• {suspendedSignaturesCount} Suspendidas</span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Amadeus, Sabre, Kiu, Wingo & Avianca</p>
        </div>

        {/* Card 3: Cartera Karing */}
        <div
          onClick={() => setActiveTab("karing")}
          className="glass-panel p-4 cursor-pointer hover:border-emerald-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Cartera Karing ERP</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-extrabold text-white">{formatCOP(totalKaringBalance)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Mora Vencida &gt; 30d:</span>
            <span className="text-rose-400 font-bold">{formatCOP(totalOverdueBalance)}</span>
          </div>
        </div>

        {/* Card 4: Contratos Estatales */}
        <div
          onClick={() => setActiveTab("contracts")}
          className="glass-panel p-4 cursor-pointer hover:border-amber-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Convenios de Estado</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-extrabold text-white">{formatCOP(totalExecutedBudget)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Presupuesto Adjudicado:</span>
            <span className="text-gray-300 font-semibold">{formatCOP(totalContractsBudget)}</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Risk Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Systems Signature Allocation */}
        <div className="glass-panel p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" /> Distribución de Firmas por Sistema GDS
              </h3>
              <p className="text-xs text-gray-400">Firmas activas asignadas a las agencias consolidadas</p>
            </div>
            <button
              onClick={() => setActiveTab("systems")}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Gestionar Firmas <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={systemChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {systemChartData.map((entry, index) => (
                    <Cell key={entry.id || `system-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Alerts & Action Panel */}
        <div className="glass-panel p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> Control de Riesgo & Suspensión
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Agencias con bloqueo automático por mora Karing</p>
          </div>

          <div className="space-y-3">
            {riskClients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedClientForModal(c);
                    setActiveTab("clients");
                  }}
                  className="p-3 rounded-xl bg-slate-900/90 border border-rose-500/30 hover:border-rose-500 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                      {c.name}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      Mora: <span className="text-rose-400 font-bold">{c.overdueDays} días</span> • Saldo:{" "}
                      <span className="text-white font-semibold">{formatCOP(c.karingBalance)}</span>
                    </div>
                  </div>
                  <span className="badge badge-rose text-[10px]">
                    {c.status === "BLOCKED" ? "Bloqueado" : "Suspendido"}
                  </span>
                </div>
              ))}
            {riskClients.length === 0 && (
              <div className="p-5 rounded-xl bg-slate-900/60 border border-white/5 text-center text-xs text-gray-500">
                No hay agencias con alertas de cartera.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
            <span>Regla Karing:</span>
            <span className="text-amber-300 font-semibold">
              {karingConfig.enableAutoBlock === false
                ? "Bloqueo automático desactivado"
                : `Bloqueo automático > ${Number(karingConfig.autoBlockDays) || 30} días`}
            </span>
          </div>
        </div>
      </div>

      {/* Hospitality & Government Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Widget 1: Hotel & Reserva Status */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Trees className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Hotel & Reserva Natural Planetour</h3>
                <p className="text-xs text-gray-400">Tarifas especiales B2B para agencias conectadas</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("hospitality")}
              className="text-xs text-emerald-400 font-bold hover:underline"
            >
              Ver Tarifas B2B →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="glass-card flex items-center gap-3">
              <BedDouble className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <div className="text-[11px] text-gray-400">Ocupación Hotel</div>
                <div className="text-sm font-bold text-white">
                  {hotelInventory.length > 0 ? `${availableRooms} de ${hotelInventory.length} disponibles` : "Sin inventario"}
                </div>
              </div>
            </div>

            <div className="glass-card flex items-center gap-3">
              <Trees className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[11px] text-gray-400">Reserva Eco-Tours</div>
                <div className="text-sm font-bold text-white">{bookedVisitors} visitantes hoy</div>
              </div>
            </div>
          </div>
        </div>

        {/* Widget 2: Public Sector Active Contracts */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Convenios Estatales en Ejecución</h3>
                <p className="text-xs text-gray-400">Seguimiento de licitaciones y SECOP</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("contracts")}
              className="text-xs text-amber-400 font-bold hover:underline"
            >
              Ver Licitaciones →
            </button>
          </div>

          <div className="space-y-2">
            {contracts.map((con) => (
              <div key={con.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white">{con.contractNumber}</span>
                  <p className="text-[11px] text-gray-400 truncate max-w-xs">{con.object}</p>
                </div>
                <span className="badge badge-amber text-[10px]">{con.insurancePolicyStatus}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
