import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  Cpu,
  Lock,
  Unlock,
  Plus,
  CheckCircle2,
  UserCheck,
  CreditCard,
  ShieldAlert,
  AlertCircle,
  LoaderCircle
} from "lucide-react";

const normalizeSearch = (value) => String(value || "").trim().toLowerCase();

export const SystemsSignaturesManager = () => {
  const { systems, signatures, clients, toggleSignatureStatus, addSignature, searchTerm, canManageSignatures } = useApp();
  const [selectedSystemFilter, setSelectedSystemFilter] = useState("ALL");
  const [showAddSigModal, setShowAddSigModal] = useState(false);

  // New Signature Form State
  const [newClientId, setNewClientId] = useState(clients[0]?.id || "");
  const [newSystemId, setNewSystemId] = useState(systems[0]?.id || "");
  const [newPcc, setNewPcc] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentSign, setNewAgentSign] = useState("");
  const [newPermissions, setNewPermissions] = useState("Emisión Total");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSignatures, setPendingSignatures] = useState(() => new Set());
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const systemsById = useMemo(() => new Map(systems.map((system) => [system.id, system])), [systems]);
  const signatureCounts = useMemo(
    () =>
      signatures.reduce((counts, signature) => {
        counts[signature.systemId] = (counts[signature.systemId] || 0) + 1;
        return counts;
      }, {}),
    [signatures]
  );

  const filteredSignatures = useMemo(() => {
    const query = normalizeSearch(deferredSearchTerm);
    return signatures.filter((signature) => {
      if (selectedSystemFilter !== "ALL" && signature.systemId !== selectedSystemFilter) return false;
      if (!query) return true;
      const client = clientsById.get(signature.clientId);
      return [signature.pcc, signature.agentName, signature.agentSign, client?.name, client?.nit].some((value) =>
        normalizeSearch(value).includes(query)
      );
    });
  }, [clientsById, deferredSearchTerm, selectedSystemFilter, signatures]);

  useEffect(() => {
    if (clients.length > 0 && !clientsById.has(newClientId)) setNewClientId(clients[0].id);
    if (systems.length > 0 && !systemsById.has(newSystemId)) setNewSystemId(systems[0].id);
  }, [clients, clientsById, newClientId, newSystemId, systems, systemsById]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newClientId || !newSystemId) {
      setFormError("Debes tener al menos un cliente y un sistema GDS registrados.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    try {
      const result = await addSignature({
        pcc: newPcc.trim().toUpperCase(),
        systemId: newSystemId,
        clientId: newClientId,
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
        setFormError(result.error || "No fue posible guardar la firma.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (signatureId) => {
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
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-sky-400" /> Control de Sistemas & Firmas GDS
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Inventario de pseudónimos, PCCs e identificadores de firma asignados a cada agencia por sistema.
          </p>
        </div>

        <button
          onClick={() => setShowAddSigModal(true)}
          disabled={!canManageSignatures || clients.length === 0 || systems.length === 0}
          title={clients.length === 0 ? "Registra un cliente antes de asignar firmas" : undefined}
          className="btn-primary text-xs font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Asignar Firma / PCC
        </button>
      </div>

      {/* Systems Filter Bar */}
      <div className="glass-panel p-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedSystemFilter("ALL")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            selectedSystemFilter === "ALL"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-gray-400 hover:text-white bg-slate-900/60"
          }`}
        >
          Todos los Sistemas ({signatures.length})
        </button>

        {systems.map((sys) => {
          const count = signatureCounts[sys.id] || 0;
          const isSelected = selectedSystemFilter === sys.id;
          return (
            <button
              key={sys.id}
              onClick={() => setSelectedSystemFilter(sys.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isSelected
                  ? "bg-slate-800 text-white border border-indigo-500/50 shadow-md"
                  : "text-gray-400 hover:text-white bg-slate-900/60 border border-white/5"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sys.color }}></span>
              {sys.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Signatures Table / Cards View */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Sistema GDS</th>
                <th>PCC / Pseudónimo</th>
                <th>Agencia Cliente</th>
                <th>Datos Contacto (Dueño / Pagos)</th>
                <th>Agente Asignado</th>
                <th>Permisos</th>
                <th>Estado Firma</th>
                <th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignatures.map((sig) => {
                const client = clientsById.get(sig.clientId);
                const sysObj = systemsById.get(sig.systemId);
                const isSuspended = sig.status !== "ACTIVE";
                const isPending = pendingSignatures.has(sig.id);

                return (
                  <tr key={sig.id} className={isSuspended ? "bg-rose-950/10" : ""}>
                    {/* System Badge */}
                    <td>
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase"
                        style={{
                          backgroundColor: `${sysObj?.color || "#6366f1"}20`,
                          color: sysObj?.color || "#6366f1",
                          border: `1px solid ${sysObj?.color || "#6366f1"}40`
                        }}
                      >
                        {sysObj?.name || sig.systemId}
                      </span>
                    </td>

                    {/* PCC */}
                    <td>
                      <div className="font-mono font-black text-sm text-white">{sig.pcc}</div>
                      <div className="text-[10px] text-gray-500 font-mono">Sign: {sig.agentSign}</div>
                    </td>

                    {/* Client Name */}
                    <td>
                      <div className="font-bold text-white text-xs">{client?.name || sig.clientId}</div>
                      <div className="text-[11px] text-gray-400">
                        NIT: {client?.nit} • IATA: {client?.iataCode}
                      </div>
                    </td>

                    {/* Contacts info */}
                    <td>
                      <div className="text-[11px] space-y-0.5">
                        <div className="text-gray-300 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-indigo-400" />
                          <span className="font-semibold">{client?.owner?.name}</span>
                        </div>
                        <div className="text-gray-400 flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-emerald-400" />
                          <span>Paga: {client?.accountsPayable?.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Agent Name */}
                    <td>
                      <div className="text-xs font-semibold text-gray-200">{sig.agentName}</div>
                      <div className="text-[10px] text-gray-500">Duty Code: {sig.dutyCode}</div>
                    </td>

                    {/* Permissions */}
                    <td>
                      <span className="text-xs text-indigo-300 font-medium">{sig.permissions}</span>
                    </td>

                    {/* Status */}
                    <td>
                      {isSuspended ? (
                        <span className="badge badge-rose text-[10px] flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Suspendida (Mora)
                        </span>
                      ) : (
                        <span className="badge badge-emerald text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Operativa
                        </span>
                      )}
                    </td>

                    {/* Action Toggle */}
                    <td className="text-right">
                      <button
                        onClick={() => handleToggleStatus(sig.id)}
                        disabled={isPending || !canManageSignatures}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                          isSuspended
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                        }`}
                      >
                        {isPending ? (
                          <>
                            <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> Actualizando
                          </>
                        ) : isSuspended ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" /> Habilitar
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" /> Suspender
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredSignatures.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-gray-500">
                    No hay firmas que coincidan con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Signature Modal */}
      {showAddSigModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xl p-6 space-y-6" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Asignar Firma GDS a Agencia
              </h2>
              <button
                type="button"
                onClick={() => setShowAddSigModal(false)}
                disabled={isSubmitting}
                aria-label="Cerrar formulario de firma"
                className="w-8 h-8 rounded-lg bg-slate-800 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Seleccionar Agencia Cliente</label>
                <select
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  className="form-select"
                  disabled={isSubmitting}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (NIT: {c.nit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="form-label">PCC / Sign ID *</label>
                  <input
                    type="text"
                    value={newPcc}
                    onChange={(e) => setNewPcc(e.target.value)}
                    placeholder="Ej: BOG1A9988"
                    className="form-input font-mono"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Nombre de Agente *</label>
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="Ej: Andrés Ruiz"
                    className="form-input"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sign ID Interno</label>
                  <input
                    type="text"
                    value={newAgentSign}
                    onChange={(e) => setNewAgentSign(e.target.value)}
                    placeholder="Ej: 9821AR"
                    className="form-input font-mono"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nivel de Permisos</label>
                <input
                  type="text"
                  value={newPermissions}
                  onChange={(e) => setNewPermissions(e.target.value)}
                  placeholder="Ej: Emisión Total & Void"
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddSigModal(false)}
                  disabled={isSubmitting}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary text-xs font-bold disabled:opacity-60">
                  {isSubmitting && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmitting ? "Guardando..." : "Guardar Firma"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
