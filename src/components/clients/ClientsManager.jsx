import React, { useDeferredValue, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  Users,
  UserCheck,
  CreditCard,
  Plus,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  LoaderCircle,
  FileSpreadsheet
} from "lucide-react";
import { ClientDetailModal } from "./ClientDetailModal";
import { ClientFormModal } from "./ClientFormModal";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

const normalizeSearch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export const ClientsManager = () => {
  const {
    clients,
    signatures = [],
    contracts = [],
    searchTerm,
    setSelectedClientForModal,
    selectedClientForModal,
    canManageClients,
    deleteClient,
    addToast
  } = useApp();
  const [filterType, setFilterType] = useState("ALL"); // ALL | AGENCY | GOVERNMENT
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const handleExportExcel = async () => {
    const dataToExport = filteredClients.length > 0 ? filteredClients : clients;
    if (!dataToExport || dataToExport.length === 0) {
      addToast?.("warning", "No hay agencias disponibles para exportar.");
      return;
    }

    try {
      setIsExporting(true);
      const { exportAgenciesToExcel } = await import("../../utils/exportAgenciesExcel");
      const isFiltered = dataToExport.length < clients.length;
      const result = await exportAgenciesToExcel({
        clients: dataToExport,
        signatures,
        contracts
      });
      addToast?.(
        "success",
        `Archivo Excel generado exitosamente: ${result.fileName} (${result.count} ${
          isFiltered ? "agencias filtradas" : "agencias registradas"
        }).`
      );
    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      addToast?.("error", error?.message || "Ocurrió un error al generar el documento Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const clientCounts = useMemo(
    () =>
      clients.reduce((counts, client) => {
        counts[client.type] = (counts[client.type] || 0) + 1;
        return counts;
      }, {}),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const query = normalizeSearch(deferredSearchTerm);
    return clients.filter((client) => {
      if (filterType !== "ALL" && client.type !== filterType) return false;
      if (!query) return true;
      return [
        client.name,
        client.nit,
        client.iataCode,
        client.city,
        client.owner?.name,
        client.accountsPayable?.name
      ].some((value) => normalizeSearch(value).includes(query));
    });
  }, [clients, deferredSearchTerm, filterType]);

  const formatCOP = (value) => copFormatter.format(Number(value) || 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" /> Directorio de Agencias & Clientes
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Gestión completa de agencias minoristas, convenios con alcaldías/gobernaciones y contactos responsables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportExcel}
            disabled={isExporting || clients.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm shadow-emerald-950/20 hover:border-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title={`Descargar ${filteredClients.length} ${
              filteredClients.length === 1 ? "agencia" : "agencias"
            } en formato Excel oficial (.xlsx)`}
          >
            {isExporting ? (
              <LoaderCircle className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            )}
            <span>
              {isExporting
                ? "Generando..."
                : `Descargar Excel (${filteredClients.length})`}
            </span>
          </button>

          <button
            onClick={() => {
              setClientToEdit(null);
              setShowCreateModal(true);
            }}
            disabled={!canManageClients}
            title={!canManageClients ? "Tu rol no permite gestionar clientes" : undefined}
            className="btn-primary text-xs font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Registrar Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Filter Tabs & Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-panel p-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === "ALL"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-gray-400 hover:text-white bg-slate-900/60"
            }`}
          >
            Todos ({clients.length})
          </button>

          <button
            onClick={() => setFilterType("AGENCY")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === "AGENCY"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-gray-400 hover:text-white bg-slate-900/60"
            }`}
          >
            Agencias Minoristas ({clientCounts.AGENCY || 0})
          </button>

          <button
            onClick={() => setFilterType("GOVERNMENT")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === "GOVERNMENT"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "text-gray-400 hover:text-white bg-slate-900/60"
            }`}
          >
            Alcaldías / Gobernaciones ({clientCounts.GOVERNMENT || 0})
          </button>
        </div>
      </div>

      {/* Grid of Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="glass-panel p-5 space-y-4 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Header card info */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge text-[10px] ${
                        client.type === "GOVERNMENT"
                          ? "badge-amber"
                          : client.status === "ACTIVE"
                          ? "badge-emerald"
                          : "badge-rose"
                      }`}
                    >
                      {client.type === "GOVERNMENT" ? "Entidad Pública" : client.status}
                    </span>
                    <span className="badge badge-indigo text-[10px]">{client.tier}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1.5 line-clamp-1">{client.name}</h3>
                  <p className="text-[11px] text-gray-400">NIT: {client.nit} • IATA: {client.iataCode}</p>
                </div>
              </div>

              {/* Dueño & Encargado de Pagar info */}
              <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                {/* Dueño */}
                <div className="p-2.5 rounded-lg bg-slate-900/70 border border-white/5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Dueño:
                  </div>
                  <div className="font-bold text-white text-xs mt-0.5">{client.owner?.name}</div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                    <span>{client.owner?.phone}</span>
                  </div>
                </div>

                {/* Encargado de Pagar */}
                <div className="p-2.5 rounded-lg bg-slate-900/70 border border-emerald-500/20">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Encargado de Pagar:
                  </div>
                  <div className="font-bold text-white text-xs mt-0.5">{client.accountsPayable?.name}</div>
                  <div className="text-[11px] text-gray-400 flex items-center justify-between mt-0.5">
                    <span>{client.accountsPayable?.phone}</span>
                    <span className="text-emerald-300 font-semibold">{client.accountsPayable?.paymentDays}</span>
                  </div>
                </div>
              </div>

              {/* Financial Balance */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-400 text-[11px]">Cupo Autorizado:</span>
                  <div className="font-bold text-emerald-400">{formatCOP(client.creditLimit)}</div>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-[11px]">Saldo Karing:</span>
                  <div className="font-extrabold text-white">{formatCOP(client.karingBalance)}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-2">
              <button
                onClick={() => setSelectedClientForModal(client)}
                className="btn-secondary text-xs flex-1 justify-center py-2"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" /> Ficha 360° & Firmas
              </button>

              {canManageClients && (
                <>
                  <button
                    onClick={() => {
                      setClientToEdit(client);
                      setShowCreateModal(true);
                    }}
                    className="btn-secondary text-xs py-2 px-2.5 flex items-center gap-1 text-indigo-300 hover:text-white"
                    title="Actualizar datos de la agencia"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Actualizar</span>
                  </button>

                  <button
                    onClick={() => setClientToDelete(client)}
                    className="btn-danger text-xs py-2 px-2.5 flex items-center gap-1"
                    title="Eliminar agencia del sistema"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="glass-panel p-10 text-center" role="status">
          <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-300">No se encontraron clientes</p>
          <p className="text-xs text-gray-500 mt-1">
            {searchTerm ? "Prueba con otro término de búsqueda o cambia el filtro." : "Aún no hay clientes registrados."}
          </p>
        </div>
      )}

      {/* Modals */}
      {selectedClientForModal && (
        <ClientDetailModal
          client={selectedClientForModal}
          onClose={() => setSelectedClientForModal(null)}
          onEditClient={(client) => {
            setSelectedClientForModal(null);
            setClientToEdit(client);
            setShowCreateModal(true);
          }}
          onDeleteClient={(client) => {
            setSelectedClientForModal(null);
            setClientToDelete(client);
          }}
        />
      )}

      {showCreateModal && (
        <ClientFormModal
          clientToEdit={clientToEdit}
          onClose={() => {
            setShowCreateModal(false);
            setClientToEdit(null);
          }}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      {clientToDelete && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">¿Eliminar esta agencia?</h3>
                <p className="text-xs text-gray-400">Acción exclusiva para administradores</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5 text-xs">
              <p className="text-gray-300">
                Estás a punto de eliminar permanentemente a:
              </p>
              <p className="text-sm font-bold text-white">{clientToDelete.name}</p>
              <p className="text-gray-400 font-mono text-[11px]">NIT: {clientToDelete.nit}</p>
              <div className="pt-2 border-t border-white/5 text-amber-400/90 text-[11px] flex items-start gap-1.5">
                <span className="shrink-0 font-bold">⚠️</span>
                <span>
                  Se eliminarán también sus firmas GDS asignadas, contratos estatales y registros contables vinculados.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                disabled={isDeleting}
                className="btn-secondary text-xs disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isDeleting) return;
                  setIsDeleting(true);
                  try {
                    const res = await deleteClient(clientToDelete.id);
                    if (res?.success) {
                      setClientToDelete(null);
                    }
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="btn-danger text-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {isDeleting ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isDeleting ? "Eliminando..." : "Sí, eliminar agencia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
