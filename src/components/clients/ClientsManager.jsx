import React, { useDeferredValue, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  Users,
  UserCheck,
  CreditCard,
  Plus,
  Eye,
  Edit
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
  const { clients, searchTerm, setSelectedClientForModal, selectedClientForModal, canManageClients } = useApp();
  const [filterType, setFilterType] = useState("ALL"); // ALL | AGENCY | GOVERNMENT
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

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

              <button
                onClick={() => {
                  setClientToEdit(client);
                  setShowCreateModal(true);
                }}
                disabled={!canManageClients}
                className="btn-icon"
                title={!canManageClients ? "Tu rol no permite gestionar clientes" : "Editar datos"}
              >
                <Edit className="w-4 h-4 text-gray-300" />
              </button>
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
    </div>
  );
};
