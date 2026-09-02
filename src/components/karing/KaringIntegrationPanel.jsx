import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  Receipt,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Lock
} from "lucide-react";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export const KaringIntegrationPanel = () => {
  const {
    karingLedger,
    clients,
    syncWithKaring,
    addToast,
    isSyncing,
    usingFallbackData,
    canSyncKaring,
    karingConfig
  } = useApp();
  const [selectedAgencyForValidation, setSelectedAgencyForValidation] = useState(clients[0]?.id || "");
  const [validationResult, setValidationResult] = useState(null);
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  useEffect(() => {
    if (clients.length > 0 && !clientsById.has(selectedAgencyForValidation)) {
      setSelectedAgencyForValidation(clients[0].id);
      setValidationResult(null);
    }
  }, [clients, clientsById, selectedAgencyForValidation]);

  const formatCOP = (value) => copFormatter.format(Number(value) || 0);
  const autoBlockDays = Number(karingConfig.autoBlockDays) || 30;

  const handleValidatePreEmission = () => {
    const client = clientsById.get(selectedAgencyForValidation);
    if (!client) {
      addToast("warning", "Selecciona una agencia para realizar la validación.");
      return;
    }

    if (karingConfig.enableAutoBlock !== false && client.overdueDays > autoBlockDays) {
      setValidationResult({
        approved: false,
        reason: `DENEGADO: La agencia "${client.name}" presenta factura vencida por ${client.overdueDays} días en Karing. Firmas GDS suspendidas.`,
        client
      });
      addToast("warning", `Validación Karing: Emisión DENEGADA para ${client.name}.`);
    } else {
      setValidationResult({
        approved: true,
        reason: `APROBADO: Estado de cartera al día en Karing. Cupo disponible: ${formatCOP(
          client.creditLimit - client.karingBalance
        )}. Emisión habilitada en firmas GDS.`,
        client
      });
      addToast("success", `Validación Karing: Emisión APROBADA para ${client.name}.`);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-400" /> Cartera Karing Registrada
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Conciliación de facturas almacenadas en PostgreSQL y reglas de bloqueo de emisión. La conexión con una API externa requiere integración adicional.
          </p>
        </div>

        <button
          onClick={syncWithKaring}
          disabled={isSyncing || !canSyncKaring}
          className="btn-primary text-xs font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Recalculando..." : "Recalcular Cartera Ahora"}
        </button>
      </div>

      {/* Integration Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400">Fuente de la Cartera</div>
            <div className={`text-sm font-bold ${usingFallbackData ? "text-amber-300" : "text-white"}`}>
              {usingFallbackData ? "Sin conexión al servidor" : "PostgreSQL local"}
            </div>
            <div className="text-[10px] text-emerald-400">Facturas registradas en la base de datos</div>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400">Facturas en Auditoría</div>
            <div className="text-sm font-bold text-white">{karingLedger.length} Documentos</div>
            <div className="text-[10px] text-indigo-300">Conciliación directa por NIT</div>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400">Regla de Emisión</div>
            <div className="text-sm font-bold text-amber-300">
              {karingConfig.enableAutoBlock === false ? "Bloqueo automático desactivado" : `Bloqueo Aut. > ${autoBlockDays}d Mora`}
            </div>
            <div className="text-[10px] text-gray-400">Protección de cartera Planetour</div>
          </div>
        </div>
      </div>

      {/* Simulator Tool: Pre-Emission Validation */}
      <div className="glass-panel p-5 space-y-4 border-l-4 border-l-indigo-500">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" /> Simulador de Validación Pre-Emisión GDS
          </h3>
          <p className="text-xs text-gray-400">
            Valida si la cartera registrada autoriza a la mesa de control emitir un tiquete.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={selectedAgencyForValidation}
            onChange={(e) => {
              setSelectedAgencyForValidation(e.target.value);
              setValidationResult(null);
            }}
            className="form-select flex-1"
            disabled={clients.length === 0}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (NIT: {c.nit}) — Mora: {c.overdueDays} días
              </option>
            ))}
          </select>

          <button
            onClick={handleValidatePreEmission}
            disabled={clients.length === 0}
            className="btn-primary text-xs shrink-0 font-bold disabled:opacity-50"
          >
            Validar Estado Karing
          </button>
        </div>

        {validationResult && (
          <div
            className={`p-4 rounded-xl border text-xs font-semibold space-y-1 ${
              validationResult.approved
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/40 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-extrabold">
              {validationResult.approved ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> EMISIÓN AUTORIZADA
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-400" /> EMISIÓN BLOQUEADA POR MORA
                </>
              )}
            </div>
            <p className="leading-relaxed">{validationResult.reason}</p>
          </div>
        )}
      </div>

      {/* Invoices Ledger Table */}
      <div className="glass-panel space-y-4 p-5">
        <h3 className="text-sm font-bold text-white">Libro de Facturas Registradas en Karing ERP</h3>

        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Factura Karing</th>
                <th>Agencia / Cliente</th>
                <th>Fecha Emisión</th>
                <th>Vencimiento</th>
                <th>Monto COP</th>
                <th>Estado Cartera</th>
                <th>Notas / Detalle</th>
              </tr>
            </thead>
            <tbody>
              {karingLedger.map((inv) => {
                const client = clientsById.get(inv.clientId);
                const isOverdue = String(inv.status || "").startsWith("OVERDUE");

                return (
                  <tr key={inv.id} className={isOverdue ? "bg-rose-950/10" : ""}>
                    <td className="font-mono font-bold text-indigo-300">{inv.invoiceNumber}</td>
                    <td>
                      <div className="font-bold text-white text-xs">{client?.name || inv.clientId}</div>
                      <div className="text-[10px] text-gray-400">NIT: {client?.nit}</div>
                    </td>
                    <td className="text-gray-300">{inv.issueDate}</td>
                    <td className="text-gray-300">{inv.dueDate}</td>
                    <td className="font-extrabold text-white">{formatCOP(inv.amount)}</td>
                    <td>
                      <span className={`badge ${isOverdue ? "badge-rose" : "badge-emerald"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400 max-w-xs">{inv.notes}</td>
                  </tr>
                );
              })}
              {karingLedger.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-gray-500">
                    No hay facturas de Karing disponibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
