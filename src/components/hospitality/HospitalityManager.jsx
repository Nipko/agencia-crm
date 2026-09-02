import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  BedDouble,
  Trees,
  Calendar
} from "lucide-react";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export const HospitalityManager = () => {
  const { hotelInventory, reservePackages, clients, addToast, canManageHospitality } = useApp();
  const [tab, setTab] = useState("hotel"); // 'hotel' | 'reserve'
  const [selectedAgencyForBooking, setSelectedAgencyForBooking] = useState(clients[0]?.id || "");
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  useEffect(() => {
    if (clients.length > 0 && !clientsById.has(selectedAgencyForBooking)) {
      setSelectedAgencyForBooking(clients[0].id);
    }
  }, [clients, clientsById, selectedAgencyForBooking]);

  const formatCOP = (value) => copFormatter.format(Number(value) || 0);

  const handleBookRoom = (roomType) => {
    if (!canManageHospitality) {
      addToast("warning", "Tu rol no permite gestionar reservas de hospitalidad.");
      return;
    }
    const agencyObj = clientsById.get(selectedAgencyForBooking);
    if (!agencyObj) {
      addToast("warning", "Selecciona una agencia antes de solicitar la reserva.");
      return;
    }
    addToast(
      "info",
      `Solicitud B2B de ${roomType} preparada para ${agencyObj.name}. Confírmala con la mesa de operaciones.`
    );
  };

  const handleBookPackage = (packageTitle) => {
    if (!canManageHospitality) {
      addToast("warning", "Tu rol no permite gestionar reservas de hospitalidad.");
      return;
    }
    const agencyObj = clientsById.get(selectedAgencyForBooking);
    if (!agencyObj) {
      addToast("warning", "Selecciona una agencia antes de solicitar la reserva.");
      return;
    }
    addToast("info", `Solicitud para "${packageTitle}" preparada para ${agencyObj.name}.`);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <BedDouble className="w-6 h-6 text-emerald-400" /> Unidades: Hotel & Reserva Natural Planetour
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Tarifario especial B2B para agencias consolidadas, disponibilidad de cabañas y pasadías ecológicos.
          </p>
        </div>

        {/* Agency Picker for B2B Rates */}
        <div className="flex items-center gap-2 bg-slate-900 border border-white/10 p-2 rounded-xl text-xs">
          <span className="text-gray-400">Cotizar para:</span>
          <select
            value={selectedAgencyForBooking}
            onChange={(e) => setSelectedAgencyForBooking(e.target.value)}
            className="bg-slate-800 text-white border border-white/10 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none"
            disabled={clients.length === 0}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.tier})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-3 text-xs font-semibold">
        <button
          onClick={() => setTab("hotel")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            tab === "hotel"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "text-gray-400 hover:text-white bg-slate-900/60"
          }`}
        >
          <BedDouble className="w-4 h-4" /> Hotel Planetour (Cabañas & Suites)
        </button>

        <button
          onClick={() => setTab("reserve")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            tab === "reserve"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              : "text-gray-400 hover:text-white bg-slate-900/60"
          }`}
        >
          <Trees className="w-4 h-4" /> Reserva Natural (Tours & Pasadías)
        </button>
      </div>

      {/* TAB 1: HOTEL PLANETOUR */}
      {tab === "hotel" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {hotelInventory.map((room) => (
            <div key={room.id} className="glass-panel p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="badge badge-sky text-[10px]">{room.category}</span>
                  <span
                    className={`badge text-[10px] ${
                      room.status === "AVAILABLE"
                        ? "badge-emerald"
                        : room.status === "OCCUPIED"
                        ? "badge-rose"
                        : "badge-amber"
                    }`}
                  >
                    {room.status === "AVAILABLE"
                      ? "Disponible"
                      : room.status === "OCCUPIED"
                      ? "Ocupada"
                      : "Reservada"}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">{room.roomType}</h3>
                <p className="text-xs text-gray-400">Capacidad: {room.capacity}</p>

                {/* Rate Comparison Box */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Tarifa Rack (Público):</span>
                    <span className="line-through text-gray-500">{formatCOP(room.rackRate)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5">
                    <span className="text-emerald-400 font-bold">Tarifa Especial Agencia B2B:</span>
                    <span className="text-sm font-extrabold text-emerald-400">{formatCOP(room.b2bAgencyRate)}</span>
                  </div>
                </div>

                {room.currentGuestOrAgency !== "-" && (
                  <div className="text-[11px] text-gray-400 italic">
                    Ocupado por: <span className="text-gray-200 font-semibold">{room.currentGuestOrAgency}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleBookRoom(room.roomType)}
                disabled={room.status !== "AVAILABLE" || clients.length === 0 || !canManageHospitality}
                className="btn-primary text-xs w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar className="w-3.5 h-3.5" /> Reservar con Descuento B2B
              </button>
            </div>
          ))}
          {hotelInventory.length === 0 && (
            <div className="glass-panel p-10 text-center text-xs text-gray-500 md:col-span-3">
              No hay inventario de hotel disponible.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RESERVA NATURAL */}
      {tab === "reserve" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reservePackages.map((pkg) => (
            <div key={pkg.id} className="glass-panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="badge badge-emerald text-[10px]">Paquete Ecológico</span>
                <span className="text-xs text-gray-400">{pkg.duration}</span>
              </div>

              <h3 className="text-base font-bold text-white">{pkg.title}</h3>
              <p className="text-xs text-gray-300 bg-slate-900/60 p-3 rounded-xl border border-white/5 leading-relaxed">
                Incluye: {pkg.includes}
              </p>

              {/* Price */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-400">Tarifa Pública: {formatCOP(pkg.publicPrice)}</div>
                  <div className="text-sm font-extrabold text-emerald-400">
                    Tarifa B2B Agencia: {formatCOP(pkg.b2bPrice)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-gray-400">Capacidad Diaria:</div>
                  <div className="text-xs font-bold text-white">
                    {pkg.currentBookedToday} / {pkg.dailyCapacityLimit} cupos hoy
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleBookPackage(pkg.title)}
                disabled={pkg.currentBookedToday >= pkg.dailyCapacityLimit || clients.length === 0 || !canManageHospitality}
                className="btn-primary text-xs w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trees className="w-3.5 h-3.5" /> Reservar Grupo de Agencia / Entidad
              </button>
            </div>
          ))}
          {reservePackages.length === 0 && (
            <div className="glass-panel p-10 text-center text-xs text-gray-500 md:col-span-2">
              No hay paquetes de reserva disponibles.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
