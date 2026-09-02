import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { X, UserCheck, CreditCard, Building, AlertCircle, LoaderCircle } from "lucide-react";

const EMPTY_CLIENT = {
  name: "",
  type: "AGENCY",
  nit: "",
  iataCode: "",
  tier: "GOLD",
  city: "Bogotá D.C.",
  address: "",
  phone: "",
  creditLimit: 50000000,
  owner: { name: "", document: "", phone: "", email: "", notes: "" },
  accountsPayable: {
    name: "",
    role: "Tesorero / Cartera",
    phone: "",
    whatsapp: "",
    email: "",
    paymentDays: "Viernes"
  },
  operationalCounter: { name: "", role: "Counter Principal", phone: "", email: "" }
};

const createInitialData = (client) => ({
  ...EMPTY_CLIENT,
  ...client,
  owner: { ...EMPTY_CLIENT.owner, ...client?.owner },
  accountsPayable: { ...EMPTY_CLIENT.accountsPayable, ...client?.accountsPayable },
  operationalCounter: { ...EMPTY_CLIENT.operationalCounter, ...client?.operationalCounter }
});

export const ClientFormModal = ({ clientToEdit, onClose }) => {
  const { saveClient } = useApp();

  const [formData, setFormData] = useState(() => createInitialData(clientToEdit));
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const creditLimit = Number(formData.creditLimit);
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      setErrorMsg("El cupo de crédito debe ser un valor válido mayor o igual a cero.");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);
    try {
      const result = await saveClient({
        ...formData,
        name: formData.name.trim(),
        nit: formData.nit.trim(),
        creditLimit
      });
      if (result.success) {
        onClose();
      } else {
        setErrorMsg(result.error || "No fue posible guardar el cliente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-3xl p-6 space-y-6" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" />
            {clientToEdit ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente / Agencia"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar formulario de cliente"
            className="w-8 h-8 rounded-lg bg-slate-800 text-gray-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Business Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              1. Datos de la Empresa / Entidad
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group sm:col-span-2">
                <label className="form-label">Razón Social / Nombre Comercial *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Viajes Express Colombia S.A.S."
                  className="form-input"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Cliente</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="form-select"
                  disabled={isSubmitting}
                >
                  <option value="AGENCY">Agencia de Viajes (Minorista)</option>
                  <option value="GOVERNMENT">Entidad Pública (Alcaldía / Gobernación)</option>
                  <option value="CORPORATE">Corporativo Directo</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">NIT / RUT *</label>
                <input
                  type="text"
                  value={formData.nit}
                  onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                  placeholder="Ej: 900.123.456-7"
                  className="form-input font-mono"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Código IATA / Pseudo Office</label>
                <input
                  type="text"
                  value={formData.iataCode}
                  onChange={(e) => setFormData({ ...formData, iataCode: e.target.value })}
                  placeholder="Ej: 76-54321"
                  className="form-input font-mono"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Categoría / Tier</label>
                <select
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                  className="form-select"
                  disabled={isSubmitting}
                >
                  <option value="GOLD">GOLD (Alta Emisión)</option>
                  <option value="SILVER">SILVER (Estándar)</option>
                  <option value="BRONZE">BRONZE (Ocasional)</option>
                  <option value="ESTATAL">ESTATAL (Convenio Público)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ciudad Principal</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cupo de Crédito COP</label>
                <input
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                  className="form-input font-bold text-emerald-400"
                  min={0}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Datos del Dueño */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/30 space-y-3">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" /> 2. Datos del Dueño / Representante Legal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group sm:col-span-2">
                <label className="form-label">Nombre Completo del Dueño *</label>
                <input
                  type="text"
                  value={formData.owner?.name}
                  onChange={(e) =>
                    setFormData({ ...formData, owner: { ...formData.owner, name: e.target.value } })
                  }
                  placeholder="Ej: Carlos Eduardo Mendoza"
                  className="form-input"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Documento C.C.</label>
                <input
                  type="text"
                  value={formData.owner?.document}
                  onChange={(e) =>
                    setFormData({ ...formData, owner: { ...formData.owner, document: e.target.value } })
                  }
                  placeholder="CC 79.845.120"
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono Directo Dueño</label>
                <input
                  type="text"
                  value={formData.owner?.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, owner: { ...formData.owner, phone: e.target.value } })
                  }
                  placeholder="+57 310 892 4410"
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group sm:col-span-2">
                <label className="form-label">Correo Electrónico Personal/Directo</label>
                <input
                  type="email"
                  value={formData.owner?.email}
                  onChange={(e) =>
                    setFormData({ ...formData, owner: { ...formData.owner, email: e.target.value } })
                  }
                  placeholder="carlos.mendoza@viajesexpress.co"
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Encargado de Pagar */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-3">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4" /> 3. Datos del Encargado de Pagar / Tesorería
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Encargado de Pagos *</label>
                <input
                  type="text"
                  value={formData.accountsPayable?.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accountsPayable: { ...formData.accountsPayable, name: e.target.value }
                    })
                  }
                  placeholder="Ej: Laura Ximena Torres"
                  className="form-input"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono / Celular Cobranzas</label>
                <input
                  type="text"
                  value={formData.accountsPayable?.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accountsPayable: { ...formData.accountsPayable, phone: e.target.value }
                    })
                  }
                  placeholder="+57 (601) 745-9008"
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp Directo Pagos</label>
                <input
                  type="text"
                  value={formData.accountsPayable?.whatsapp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accountsPayable: { ...formData.accountsPayable, whatsapp: e.target.value }
                    })
                  }
                  placeholder="+57 315 443 8901"
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Correo de Facturación</label>
                <input
                  type="email"
                  value={formData.accountsPayable?.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accountsPayable: { ...formData.accountsPayable, email: e.target.value }
                    })
                  }
                  placeholder="pagos@viajesexpress.co"
                  className="form-input"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="btn-secondary text-xs disabled:opacity-60">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary text-xs font-bold disabled:opacity-60">
              {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Guardando..." : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
