import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  Building2,
  Plus,
  ExternalLink,
  Calendar,
  AlertCircle,
  LoaderCircle
} from "lucide-react";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

const toDateInput = (date) => date.toISOString().slice(0, 10);

const safeExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

export const PublicContractsManager = () => {
  const { contracts, clients, saveContract, canManageContracts } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const governmentClients = useMemo(() => clients.filter((client) => client.type === "GOVERNMENT"), [clients]);
  const eligibleClients = governmentClients.length > 0 ? governmentClients : clients;
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const initialEndDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return toDateInput(date);
  }, []);

  // Form State
  const [clientId, setClientId] = useState(eligibleClients[0]?.id || "");
  const [contractNumber, setContractNumber] = useState("");
  const [secopUrl, setSecopUrl] = useState("");
  const [object, setObject] = useState("");
  const [totalAmount, setTotalAmount] = useState(300000000);
  const [startDate, setStartDate] = useState(() => toDateInput(new Date()));
  const [endDate, setEndDate] = useState(initialEndDate);
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState(initialEndDate);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (eligibleClients.length > 0 && !eligibleClients.some((client) => client.id === clientId)) {
      setClientId(eligibleClients[0].id);
    }
  }, [clientId, eligibleClients]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!clientId) {
      setFormError("Registra una entidad cliente antes de crear el contrato.");
      return;
    }
    if (endDate < startDate) {
      setFormError("La fecha final no puede ser anterior a la fecha de inicio.");
      return;
    }
    if (!Number.isFinite(Number(totalAmount)) || Number(totalAmount) <= 0) {
      setFormError("El valor total del contrato debe ser mayor que cero.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    try {
      const result = await saveContract({
        clientId,
        contractNumber: contractNumber.trim(),
        secopUrl: secopUrl.trim() || "https://community.secop.gov.co",
        object: object.trim(),
        totalAmount: Number(totalAmount),
        startDate,
        endDate,
        stage: "EN_EJECUCION",
        insurancePolicyStatus: "VIGENTE",
        insurancePolicyNumber: insurancePolicyNumber.trim() || "SIN-ASIGNAR",
        insuranceExpiry,
        milestone: "Registro inicial de contrato."
      });

      if (result.success) {
        setContractNumber("");
        setObject("");
        setSecopUrl("");
        setInsurancePolicyNumber("");
        setShowAddModal(false);
      } else {
        setFormError(result.error || "No fue posible guardar el contrato.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCOP = (value) => copFormatter.format(Number(value) || 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-amber-400" /> Contratación Pública (Alcaldías & Gobernaciones)
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Gestión de licitaciones, convenios estatales, ejecuciones presupuestales y pólizas de cumplimiento SECOP.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          disabled={!canManageContracts || eligibleClients.length === 0}
          className="btn-primary text-xs font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Registrar Nuevo Contrato Estatal
        </button>
      </div>

      {/* Contracts Pipeline / Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {contracts.map((con) => {
          const client = clientsById.get(con.clientId);
          const totalAmountValue = Number(con.totalAmount) || 0;
          const executedAmountValue = Number(con.executedAmount) || 0;
          const executionPercentage = totalAmountValue > 0
            ? Math.min(100, Math.max(0, Math.round((executedAmountValue / totalAmountValue) * 100)))
            : 0;
          const secopLink = safeExternalUrl(con.secopUrl);

          return (
            <div
              key={con.id}
              className="glass-panel p-5 space-y-4 hover:border-amber-500/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="badge badge-amber text-[10px]">{con.stage}</span>
                    <h3 className="text-base font-bold text-white mt-1.5">{con.contractNumber}</h3>
                    <p className="text-xs font-semibold text-amber-300">{client?.name || con.clientId}</p>
                  </div>

                  {secopLink ? (
                    <a
                      href={secopLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-sky-400 font-bold bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20 hover:bg-sky-500/20"
                    >
                      SECOP <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-500">Sin enlace SECOP</span>
                  )}
                </div>

                {/* Object */}
                <p className="text-xs text-gray-300 bg-slate-900/60 p-3 rounded-xl border border-white/5 leading-relaxed">
                  {con.object}
                </p>

                {/* Execution Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Ejecución Presupuestal:</span>
                    <span className="font-bold text-white">
                      {formatCOP(con.executedAmount)} de {formatCOP(con.totalAmount)} ({executionPercentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                      style={{ width: `${executionPercentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Insurance Policy info */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 text-[11px]">Póliza de Cumplimiento:</span>
                    <div className="font-semibold text-gray-200 mt-0.5">{con.insurancePolicyNumber}</div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px]">Vencimiento Póliza:</span>
                    <div className="font-bold text-amber-300 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5" /> {con.insuranceExpiry}
                    </div>
                  </div>
                </div>

                {/* Contact responsible */}
                <div className="text-xs text-gray-400 flex items-center justify-between pt-1">
                  <span>Supervisor Estatal:</span>
                  <span className="text-gray-200 font-semibold">{client?.operationalCounter?.name}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {contracts.length === 0 && (
        <div className="glass-panel p-10 text-center" role="status">
          <Building2 className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-300">No hay contratos estatales registrados</p>
          <p className="text-xs text-gray-500 mt-1">Los nuevos convenios aparecerán aquí después de guardarlos.</p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xl p-6 space-y-6" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" /> Registrar Contrato / Convenio Estatal
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={isSubmitting}
                aria-label="Cerrar formulario de contrato"
                className="w-8 h-8 rounded-lg bg-slate-800 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Entidad Estatal / Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="form-select"
                  disabled={isSubmitting}
                >
                  {eligibleClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Número de Contrato / Convenio *</label>
                  <input
                    type="text"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Ej: LP-500-2026"
                  className="form-input font-mono"
                  required
                  disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Valor Total Contratado (COP) *</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                  className="form-input font-bold text-amber-400"
                  required
                  min={1}
                  disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Objeto del Contrato *</label>
                <textarea
                  value={object}
                  onChange={(e) => setObject(e.target.value)}
                  rows={3}
                  placeholder="Suministro de tiquetes aéreos y logística institucional..."
                  className="form-textarea"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Enlace público SECOP</label>
                <input
                  type="url"
                  value={secopUrl}
                  onChange={(e) => setSecopUrl(e.target.value)}
                  placeholder="https://community.secop.gov.co/..."
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Fecha de inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="form-input"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de finalización</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="form-input"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Número de Póliza</label>
                  <input
                    type="text"
                    value={insurancePolicyNumber}
                    onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                    placeholder="Ej: SURAMERICANA-POL-9912"
                    className="form-input"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vencimiento Póliza</label>
                  <input
                    type="date"
                    value={insuranceExpiry}
                    onChange={(e) => setInsuranceExpiry(e.target.value)}
                    className="form-input"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary text-xs font-bold disabled:opacity-60">
                  {isSubmitting && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmitting ? "Guardando..." : "Guardar Contrato"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
