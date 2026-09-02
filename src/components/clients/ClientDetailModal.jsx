import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  X,
  UserCheck,
  CreditCard,
  Phone,
  Mail,
  Cpu,
  Receipt,
  FileText,
  Lock,
  Unlock,
  Plus,
  MapPin,
  MessageSquare,
  AlertCircle,
  LoaderCircle
} from "lucide-react";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export const ClientDetailModal = ({ client, onClose }) => {
  const {
    signatures,
    toggleSignatureStatus,
    karingLedger,
    contracts,
    systems,
    addSignature,
    canManageSignatures,
    karingConfig
  } = useApp();
  const [activeTab, setActiveTab] = useState("contacts"); // 'contacts' | 'signatures' | 'karing' | 'contracts'
  const [showAddSigModal, setShowAddSigModal] = useState(false);

  // New signature form state
  const [newPcc, setNewPcc] = useState("");
  const [newSystemId, setNewSystemId] = useState(systems[0]?.id || "");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentSign, setNewAgentSign] = useState("");
  const [newPermissions, setNewPermissions] = useState("Emisión Total");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSignatures, setPendingSignatures] = useState(() => new Set());

  const clientId = client?.id;
  const clientSignatures = useMemo(
    () => signatures.filter((signature) => signature.clientId === clientId),
    [clientId, signatures]
  );
  const clientInvoices = useMemo(
    () => karingLedger.filter((invoice) => invoice.clientId === clientId),
    [clientId, karingLedger]
  );
  const clientContracts = useMemo(
    () => contracts.filter((contract) => contract.clientId === clientId),
    [clientId, contracts]
  );
  const systemsById = useMemo(() => new Map(systems.map((system) => [system.id, system])), [systems]);

  useEffect(() => {
    if (systems.length > 0 && !systems.some((system) => system.id === newSystemId)) {
      setNewSystemId(systems[0].id);
    }
  }, [newSystemId, systems]);

  if (!client) return null;

  const formatCOP = (value) => copFormatter.format(Number(value) || 0);
  const autoBlockDays = Number(karingConfig.autoBlockDays) || 30;

  const handleAddSignatureSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newSystemId) {
      setFormError("Primero debes parametrizar al menos un sistema GDS.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    try {
      const result = await addSignature({
        pcc: newPcc.trim().toUpperCase(),
        systemId: newSystemId,
        clientId: client.id,
        agentName: newAgentName.trim(),
        agentSign: newAgentSign.trim().toUpperCase() || "0000XX",
        dutyCode: "SU",
        permissions: newPermissions.trim()
      });

      if (result.success) {
        setNewPcc("");
        setNewAgentName("");
        setNewAgentSign("");
        setShowAddSigModal(false);
      } else {
        setFormError(result.error || "No fue posible asignar la firma.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSignature = async (signatureId) => {
    if (pendingSignatures.has(signatureId)) return;
    setPendingSignatures((previous) => new Set(previous).add(signatureId));
    try {
      await toggleSignatureStatus(signatureId);
    } finally {
      setPendingSignatures((previous) => {
        const next = new Set(previous);
        next.delete(signatureId);
        return next;
      });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-4xl p-6 space-y-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{client.name}</h2>
              <span
                className={`badge ${
                  client.type === "GOVERNMENT"
                    ? "badge-amber"
                    : client.status === "ACTIVE"
                    ? "badge-emerald"
                    : "badge-rose"
                }`}
              >
                {client.type === "GOVERNMENT" ? "Entidad Pública" : client.status}
              </span>
              <span className="badge badge-indigo">{client.tier}</span>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-3">
              <span>NIT: {client.nit}</span>
              <span>•</span>
              <span>IATA / Ref: {client.iataCode}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-indigo-400" /> {client.city}
              </span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Highlights Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/80 border border-white/5">
          <div>
            <div className="text-[11px] text-gray-400">Cupo de Crédito Autorizado</div>
            <div className="text-base font-extrabold text-emerald-400">{formatCOP(client.creditLimit)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-400">Saldo Cartera Karing</div>
            <div className="text-base font-extrabold text-white">{formatCOP(client.karingBalance)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-400">Días en Mora</div>
            <div
              className={`text-base font-extrabold ${
                client.overdueDays > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {client.overdueDays} Días{" "}
              {karingConfig.enableAutoBlock !== false && client.overdueDays > autoBlockDays
                ? "⚠️ (Supera regla de bloqueo)"
                : ""}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "contacts"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <UserCheck className="w-4 h-4" /> Contactos del Cliente (Dueño / Pagos)
          </button>

          <button
            onClick={() => setActiveTab("signatures")}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "signatures"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Cpu className="w-4 h-4" /> Firmas GDS por Sistema ({clientSignatures.length})
          </button>

          <button
            onClick={() => setActiveTab("karing")}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "karing"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Receipt className="w-4 h-4" /> Estado de Cuenta Karing
          </button>

          {clientContracts.length > 0 && (
            <button
              onClick={() => setActiveTab("contracts")}
              className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "contracts"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4" /> Contrato Estatal ({clientContracts.length})
            </button>
          )}
        </div>

        {/* TAB 1: CONTACT PERSONNEL (DUEÑO & ENCARGADO DE PAGAR) */}
        {activeTab === "contacts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card Dueño */}
            <div className="glass-card space-y-3 border-l-4 border-l-indigo-500">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" /> Datos del Dueño / Rep. Legal
                </span>
                <span className="badge badge-indigo text-[10px]">Titular Principal</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-400">Nombre Completo:</span>
                  <p className="text-sm font-bold text-white mt-0.5">{client.owner?.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-400">Identificación:</span>
                    <p className="font-semibold text-gray-200">{client.owner?.document}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Teléfono Directo:</span>
                    <p className="font-semibold text-gray-200 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-indigo-400" /> {client.owner?.phone}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Correo Electrónico:</span>
                  <p className="font-semibold text-indigo-300 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {client.owner?.email}
                  </p>
                </div>
                {client.owner?.notes && (
                  <div className="p-2 rounded bg-slate-900/60 text-[11px] text-gray-300 italic border border-white/5">
                    "{client.owner.notes}"
                  </div>
                )}
              </div>
            </div>

            {/* Card Encargado de Pagar / Tesorería */}
            <div className="glass-card space-y-3 border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" /> Encargado de Pagos / Tesorería
                </span>
                <span className="badge badge-emerald text-[10px]">Facturación</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-400">Encargado de Pagar:</span>
                  <p className="text-sm font-bold text-white mt-0.5">{client.accountsPayable?.name}</p>
                  <p className="text-[11px] text-gray-400">{client.accountsPayable?.role}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-400">Teléfono Cobranzas:</span>
                    <p className="font-semibold text-gray-200 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" /> {client.accountsPayable?.phone}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">WhatsApp Pagos:</span>
                    <p className="font-semibold text-emerald-300 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-400" /> {client.accountsPayable?.whatsapp}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400">Correo de Facturación:</span>
                  <p className="font-semibold text-emerald-300">{client.accountsPayable?.email}</p>
                </div>

                <div className="p-2 rounded bg-slate-900/60 text-[11px] text-emerald-200 border border-emerald-500/20">
                  🗓️ Días / Horarios de Pago: <strong>{client.accountsPayable?.paymentDays}</strong>
                </div>
              </div>
            </div>

            {/* Card Counter Operativo */}
            <div className="glass-card space-y-3 border-l-4 border-l-sky-500 md:col-span-2">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" /> Encargado Operativo / Emisiones
                </span>
                <span className="badge badge-sky text-[10px]">GDS Desk</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-gray-400">Nombre Counter:</span>
                  <p className="font-bold text-white mt-0.5">{client.operationalCounter?.name}</p>
                </div>
                <div>
                  <span className="text-gray-400">Teléfono Emisiones:</span>
                  <p className="font-semibold text-gray-200">{client.operationalCounter?.phone}</p>
                </div>
                <div>
                  <span className="text-gray-400">Correo Operativo:</span>
                  <p className="font-semibold text-sky-300">{client.operationalCounter?.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FIRMAS POR SISTEMA GDS */}
        {activeTab === "signatures" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Firmas y Pseudónimos Asignados</h3>
                <p className="text-xs text-gray-400">
                  Control por sistema GDS (Amadeus, Sabre, Kiu, Wingo, NDC).
                </p>
              </div>

              <button
                onClick={() => setShowAddSigModal(true)}
                disabled={!canManageSignatures || systems.length === 0}
                className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" /> Asignar Nueva Firma
              </button>
            </div>

            {clientSignatures.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-white/5 text-gray-400 text-xs">
                No hay firmas GDS registradas para esta agencia. Haz clic en "Asignar Nueva Firma".
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clientSignatures.map((sig) => {
                  const sysObj = systemsById.get(sig.systemId);
                  const isSuspended = sig.status !== "ACTIVE";
                  const isPending = pendingSignatures.has(sig.id);

                  return (
                    <div
                      key={sig.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isSuspended
                          ? "bg-rose-950/20 border-rose-500/40"
                          : "bg-slate-900/70 border-white/10 hover:border-indigo-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
                          style={{
                            backgroundColor: `${sysObj?.color || "#6366f1"}20`,
                            color: sysObj?.color || "#6366f1",
                            border: `1px solid ${sysObj?.color || "#6366f1"}40`
                          }}
                        >
                          {sysObj?.name || sig.systemId}
                        </span>

                        <button
                          onClick={() => handleToggleSignature(sig.id)}
                          disabled={isPending || !canManageSignatures}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            isSuspended
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                          }`}
                        >
                          {isPending ? (
                            <>
                              <LoaderCircle className="w-3 h-3 animate-spin" /> Actualizando...
                            </>
                          ) : isSuspended ? (
                            <>
                              <Unlock className="w-3 h-3" /> Habilitar
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" /> Suspender
                            </>
                          )}
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-gray-400">PCC / Sign ID:</span>
                          <span className="font-mono text-sm font-black text-white">{sig.pcc}</span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-gray-400">Agente Asignado:</span>
                          <span className="font-semibold text-gray-200">{sig.agentName}</span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-gray-400">Permisos:</span>
                          <span className="text-indigo-300 font-medium">{sig.permissions}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal Inline Form: Add Signature */}
            {showAddSigModal && (
              <form onSubmit={handleAddSignatureSubmit} className="p-4 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-4">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Formulario de Asignación de Firma GDS
                </h4>

                {formError && (
                  <div
                    className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2"
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Sistema GDS</label>
                    <select
                      value={newSystemId}
                      onChange={(e) => setNewSystemId(e.target.value)}
                      className="form-select"
                      disabled={isSubmitting}
                    >
                      {systems.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">PCC / Sign ID / Pseudónimo</label>
                    <input
                      type="text"
                      value={newPcc}
                      onChange={(e) => setNewPcc(e.target.value)}
                      placeholder="Ej: BOG1A9900 o SAB-442"
                      className="form-input font-mono"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nombre del Agente Responsable</label>
                    <input
                      type="text"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      placeholder="Ej: Sofía Martínez"
                      className="form-input"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nivel de Permisos</label>
                    <input
                      type="text"
                      value={newPermissions}
                      onChange={(e) => setNewPermissions(e.target.value)}
                      placeholder="Ej: Emisión Total, Solo Reserva, Cotización"
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSigModal(false)}
                    disabled={isSubmitting}
                    className="btn-secondary text-xs"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn-primary text-xs disabled:opacity-60">
                    {isSubmitting && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                    {isSubmitting ? "Guardando..." : "Guardar Firma"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: KARING ACCOUNTING LEDGER */}
        {activeTab === "karing" && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Estado de Cuenta Integrado desde Karing ERP</h3>

            {clientInvoices.length === 0 ? (
              <div className="p-6 text-center bg-slate-900/50 rounded-xl text-xs text-gray-400">
                Sin facturas pendientes registradas en la cartera Karing.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Factura No.</th>
                      <th>Fecha Emisión</th>
                      <th>Vencimiento</th>
                      <th>Monto COP</th>
                      <th>Estado Karing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="font-mono font-bold text-indigo-300">{inv.invoiceNumber}</td>
                        <td className="text-gray-300">{inv.issueDate}</td>
                        <td className="text-gray-300">{inv.dueDate}</td>
                        <td className="font-bold text-white">{formatCOP(inv.amount)}</td>
                        <td>
                          <span
                            className={`badge ${
                              inv.status.startsWith("OVERDUE") ? "badge-rose" : "badge-emerald"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
