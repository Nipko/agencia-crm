import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  Settings,
  Cpu,
  Receipt,
  Sliders,
  Plus,
  Trash2,
  Edit,
  Save,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  Lock,
  Shield,
  AlertCircle,
  LoaderCircle,
  Copy
} from "lucide-react";

export const SettingsManager = () => {
  const {
    systems,
    saveSystem,
    deleteSystem,
    karingConfig,
    setKaringConfig,
    tierConfigs,
    saveSettings,
    users,
    saveUser,
    deleteUser,
    currentUser,
    canManageSettings,
    canManageSystems,
    canManageUsers,
    addToast
  } = useApp();

  const [activeTab, setActiveTab] = useState("users"); // 'users' | 'systems' | 'karing' | 'tiers'

  // Modal / Form state for Systems
  const [showSystemModal, setShowSystemModal] = useState(false);
  const [editingSystem, setEditingSystem] = useState(null);
  const [sysName, setSysName] = useState("");
  const [sysCategory, setSysCategory] = useState("GDS");
  const [sysCode, setSysCode] = useState("");
  const [sysColor, setSysColor] = useState("#6366f1");

  // Modal / Form state for Users
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [usrName, setUsrName] = useState("");
  const [usrEmail, setUsrEmail] = useState("");
  const [usrPassword, setUsrPassword] = useState("");
  const [usrRole, setUsrRole] = useState("COUNTER");
  const [usrDepartment, setUsrDepartment] = useState("Emisiones GDS");
  const [formError, setFormError] = useState("");
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [isSubmittingSystem, setIsSubmittingSystem] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [temporaryCredentials, setTemporaryCredentials] = useState(null);

  const openNewUserModal = () => {
    setEditingUser(null);
    setUsrName("");
    setUsrEmail("");
    setUsrPassword("");
    setUsrRole("COUNTER");
    setUsrDepartment("Emisiones GDS");
    setFormError("");
    setShowUserModal(true);
  };

  const openEditUserModal = (usr) => {
    setEditingUser(usr);
    setUsrName(usr.name);
    setUsrEmail(usr.email);
    setUsrPassword("");
    setUsrRole(usr.role);
    setUsrDepartment(usr.department);
    setFormError("");
    setShowUserModal(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingUser) return;
    if (usrPassword && usrPassword.length < 10) {
      setFormError("La contraseña temporal debe tener al menos 10 caracteres.");
      return;
    }

    const roleLabels = {
      SUPERADMIN: "Superadministrador",
      ADMIN: "Administrador de Operaciones",
      COUNTER: "Counter / Emisiones GDS",
      FINANCE: "Tesorería & Cartera",
      READONLY: "Solo Consulta / Lectura"
    };

    setFormError("");
    setIsSubmittingUser(true);
    try {
      const result = await saveUser({
        id: editingUser?.id,
        name: usrName.trim(),
        email: usrEmail.trim().toLowerCase(),
        ...(editingUser || !usrPassword ? {} : { password: usrPassword }),
        role: usrRole,
        roleLabel: roleLabels[usrRole] || usrRole,
        department: usrDepartment.trim(),
        status: "ACTIVE"
      });

      if (result.success) {
        if (result.temporaryPassword) {
          setTemporaryCredentials({ email: usrEmail.trim().toLowerCase(), password: result.temporaryPassword });
        }
        setShowUserModal(false);
      } else {
        setFormError(result.error || "No fue posible guardar el usuario.");
      }
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const openNewSystemModal = () => {
    setEditingSystem(null);
    setSysName("");
    setSysCategory("GDS");
    setSysCode("");
    setSysColor("#6366f1");
    setFormError("");
    setShowSystemModal(true);
  };

  const openEditSystemModal = (sys) => {
    setEditingSystem(sys);
    setSysName(sys.name);
    setSysCategory(sys.category);
    setSysCode(sys.code);
    setSysColor(sys.color || "#6366f1");
    setFormError("");
    setShowSystemModal(true);
  };

  const handleSystemSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingSystem) return;

    setFormError("");
    setIsSubmittingSystem(true);
    try {
      const result = await saveSystem({
        id: editingSystem?.id,
        name: sysName.trim(),
        category: sysCategory,
        code: sysCode.trim().toUpperCase(),
        color: sysColor
      });

      if (result.success) {
        setShowSystemModal(false);
      } else {
        setFormError(result.error || "No fue posible guardar el sistema.");
      }
    } finally {
      setIsSubmittingSystem(false);
    }
  };

  const handleKaringSave = async (e) => {
    e.preventDefault();
    if (isSavingSettings) return;
    setIsSavingSettings(true);
    await saveSettings();
    setIsSavingSettings(false);
  };

  const handleDeleteUser = async (user) => {
    if (!globalThis.confirm(`¿Eliminar al usuario "${user.name}"? Esta acción no se puede deshacer.`)) return;
    setPendingDeleteId(user.id);
    await deleteUser(user.id);
    setPendingDeleteId("");
  };

  const handleDeleteSystem = async (system) => {
    if (!globalThis.confirm(`¿Eliminar el sistema "${system.name}"?`)) return;
    setPendingDeleteId(system.id);
    await deleteSystem(system.id);
    setPendingDeleteId("");
  };

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryCredentials.password);
      addToast("success", "Contraseña temporal copiada al portapapeles.");
    } catch {
      addToast("warning", "No fue posible copiarla automáticamente. Selecciona el texto manualmente.");
    }
  };

  const formatCOP = (val) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-400" /> Parametrización y Control de Usuarios
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Administración centralizada de usuarios, roles de acceso, sistemas GDS y reglas de cartera Karing.
          </p>
        </div>

        {activeTab === "users" && (
          <button
            onClick={openNewUserModal}
            disabled={!canManageUsers}
            className="btn-primary text-xs font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Crear Usuario del Sistema
          </button>
        )}

        {activeTab === "systems" && (
          <button
            onClick={openNewSystemModal}
            disabled={!canManageSystems}
            className="btn-primary text-xs font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Agregar Nuevo Sistema
          </button>
        )}
      </div>

      {temporaryCredentials && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-100 flex flex-col sm:flex-row sm:items-center gap-3" role="status">
          <div className="flex-1">
            <p className="text-xs font-bold">Contraseña temporal creada para {temporaryCredentials.email}</p>
            <p className="font-mono text-sm mt-1 select-all">{temporaryCredentials.password}</p>
            <p className="text-[11px] text-amber-200/70 mt-1">Cópiala ahora y pide al usuario cambiarla al ingresar.</p>
          </div>
          <button type="button" onClick={copyTemporaryPassword} className="btn-secondary text-xs">
            <Copy className="w-3.5 h-3.5" /> Copiar
          </button>
          <button type="button" onClick={() => setTemporaryCredentials(null)} className="text-xs text-amber-200 hover:text-white">
            Ocultar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-3 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "users"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "text-gray-400 hover:text-white bg-slate-900/60"
          }`}
        >
          <UserCheck className="w-4 h-4" /> Usuarios & Roles ({users.length})
        </button>

        <button
          onClick={() => setActiveTab("systems")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "systems"
              ? "bg-sky-600 text-white shadow-lg shadow-sky-500/20"
              : "text-gray-400 hover:text-white bg-slate-900/60"
          }`}
        >
          <Cpu className="w-4 h-4" /> Sistemas & Canales GDS ({systems.length})
        </button>

        {canManageSettings && (
          <button
            onClick={() => setActiveTab("karing")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "karing"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                : "text-gray-400 hover:text-white bg-slate-900/60"
            }`}
          >
            <Receipt className="w-4 h-4" /> Reglas & API Karing ERP
          </button>
        )}

        <button
          onClick={() => setActiveTab("tiers")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "tiers"
              ? "bg-amber-600 text-white shadow-lg shadow-amber-500/20"
              : "text-gray-400 hover:text-white bg-slate-900/60"
          }`}
        >
          <Sliders className="w-4 h-4" /> Tiers y Descuentos B2B
        </button>
      </div>

      {/* TAB 1: USERS & ROLES */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="glass-panel p-5 overflow-x-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" /> Usuarios Registrados en Planetour
                </h3>
                <p className="text-xs text-gray-400">
                  Control de privilegios y permisos por rol de usuario.
                </p>
              </div>
            </div>

            <table className="custom-table">
              <thead>
                <tr>
                  <th>Usuario / Email</th>
                  <th>Rol de Acceso</th>
                  <th>Departamento</th>
                  <th>Permisos de Modificación</th>
                  <th>Estado</th>
                  <th className="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.map((usr) => (
                  <tr key={usr.id}>
                    <td>
                      <div className="font-bold text-white text-xs">{usr.name}</div>
                      <div className="text-[11px] text-indigo-300">{usr.email}</div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          usr.role === "SUPERADMIN"
                            ? "badge-indigo"
                            : usr.role === "ADMIN"
                            ? "badge-sky"
                            : usr.role === "FINANCE"
                            ? "badge-amber"
                            : usr.role === "COUNTER"
                            ? "badge-emerald"
                            : "badge-purple"
                        }`}
                      >
                        {usr.roleLabel}
                      </span>
                    </td>
                    <td className="text-gray-300 text-xs">{usr.department}</td>
                    <td>
                      {usr.role === "READONLY" ? (
                        <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Solo Lectura
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Lectura & Escritura
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-emerald text-[10px]">Activo</span>
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        onClick={() => openEditUserModal(usr)}
                        disabled={!canManageUsers || pendingDeleteId === usr.id}
                        className="btn-secondary text-xs py-1 px-2.5"
                      >
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </button>

                      {usr.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(usr)}
                          disabled={!canManageUsers || pendingDeleteId === usr.id}
                          className="btn-danger text-xs py-1 px-2.5 disabled:opacity-50"
                        >
                          {pendingDeleteId === usr.id ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Matrix of Role Capabilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="glass-card space-y-2 border-l-4 border-l-indigo-500">
              <div className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                👑 Superadministrador (SUPERADMIN)
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Acceso irrestricto a todos los módulos: creación/edición de clientes, firmas GDS, licitaciones, backend Karing ERP y parametrización de usuarios.
              </p>
            </div>

            <div className="glass-card space-y-2 border-l-4 border-l-sky-500">
              <div className="text-xs font-bold text-sky-400 flex items-center gap-1">
                🏢 Administrador de Operaciones (ADMIN)
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Gestión total de clientes, sistemas, firmas GDS, convenios de estado y reservas. Sin acceso a gestión de usuarios ni configuración sensible.
              </p>
            </div>

            <div className="glass-card space-y-2 border-l-4 border-l-emerald-500">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                🖥️ Counter / Emisiones GDS (COUNTER)
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Consulta de agencias y gestión operativa de firmas GDS. Sin acceso a clientes, sistemas, contratos ni configuración.
              </p>
            </div>

            <div className="glass-card space-y-2 border-l-4 border-l-amber-500">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                💰 Tesorería & Cartera (FINANCE)
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Conciliación de facturas registradas, recálculo de cartera y análisis de mora en PostgreSQL.
              </p>
            </div>

            <div className="glass-card space-y-2 border-l-4 border-l-purple-500 sm:col-span-2 lg:col-span-2">
              <div className="text-xs font-bold text-purple-400 flex items-center gap-1">
                👁️ Solo Consulta / Lectura (READONLY)
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Rol de auditoría interna/externa. Permite navegar visualmente por todos los tableros y consultar información sin capacidad de modificar, crear o eliminar registros.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SISTEMAS GDS */}
      {activeTab === "systems" && (
        <div className="glass-panel overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Catálogo de Sistemas de Emisión Parametrizados</h3>
              <p className="text-xs text-gray-400">
                Define los GDS, portales NDC o LCC disponibles para asociar firmas a las agencias.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {systems.map((sys) => (
              <div
                key={sys.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-white/10 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
                      style={{
                        backgroundColor: `${sys.color || "#6366f1"}20`,
                        color: sys.color || "#6366f1",
                        border: `1px solid ${sys.color || "#6366f1"}40`
                      }}
                    >
                      {sys.category}
                    </span>
                    <span className="font-mono text-xs font-bold text-gray-400">Código: {sys.code}</span>
                  </div>

                  <h4 className="text-base font-bold text-white mt-1">{sys.name}</h4>
                  <p className="text-[11px] text-gray-500 font-mono">ID: {sys.id}</p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2 mt-4">
                  <button
                    onClick={() => openEditSystemModal(sys)}
                    disabled={!canManageSystems || pendingDeleteId === sys.id}
                    className="btn-secondary text-xs py-1 px-2.5"
                  >
                    <Edit className="w-3.5 h-3.5" /> Editar
                  </button>

                  <button
                    onClick={() => handleDeleteSystem(sys)}
                    disabled={!canManageSystems || pendingDeleteId === sys.id}
                    className="btn-danger text-xs py-1 px-2.5 disabled:opacity-50"
                  >
                    {pendingDeleteId === sys.id ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REGLAS KARING ERP */}
      {activeTab === "karing" && canManageSettings && (
        <form onSubmit={handleKaringSave} className="glass-panel p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Parámetros del Servidor & Reglas de Bloqueo Karing
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Reserva los datos para una futura integración externa y configura las políticas automáticas de suspensión. El recálculo actual usa las facturas guardadas en PostgreSQL.
            </p>
          </div>

          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Dirección IP / Host Servidor Karing ERP</label>
              <input
                type="text"
                value={karingConfig.serverIp}
                onChange={(e) => setKaringConfig({ ...karingConfig, serverIp: e.target.value })}
                className="form-input font-mono text-emerald-300"
                required
                disabled={isSavingSettings || !canManageSettings}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Clave de Seguridad / Token API</label>
              <input
                type="password"
                value={karingConfig.apiKey}
                onChange={(e) => setKaringConfig({ ...karingConfig, apiKey: e.target.value })}
                className="form-input font-mono"
                placeholder="Dejar vacío para conservar la clave actual"
                autoComplete="off"
                disabled={isSavingSettings || !canManageSettings}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Días Máximos de Mora para Bloqueo</label>
                <input
                  type="number"
                  value={karingConfig.autoBlockDays}
                  onChange={(e) =>
                    setKaringConfig({ ...karingConfig, autoBlockDays: Number(e.target.value) })
                  }
                  className="form-input font-bold text-amber-400"
                  required
                  min={0}
                  disabled={isSavingSettings || !canManageSettings}
                />
                <span className="text-[11px] text-gray-400">
                  Si una agencia excede estos días, sus firmas GDS pasarán a estado Suspendido.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Frecuencia Sync Automática (Minutos)</label>
                <input
                  type="number"
                  value={karingConfig.autoSyncMinutes}
                  onChange={(e) =>
                    setKaringConfig({ ...karingConfig, autoSyncMinutes: Number(e.target.value) })
                  }
                  className="form-input"
                  required
                  min={1}
                  disabled={isSavingSettings || !canManageSettings}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button type="submit" disabled={isSavingSettings || !canManageSettings} className="btn-primary text-xs font-bold disabled:opacity-50">
              {isSavingSettings ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingSettings ? "Guardando..." : "Guardar Parámetros Karing"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: TIERS Y DESCUENTOS B2B */}
      {activeTab === "tiers" && (
        <div className="glass-panel p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" /> Parámetros por Categoría / Tier de Agencia
            </h3>
            <p className="text-xs text-gray-400">
              Cupos sugeridos y porcentajes de descuento predeterminados para el Hotel & Reserva Natural.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tierConfigs.map((tier) => (
              <div key={tier.id} className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="font-extrabold text-sm text-white">{tier.name}</span>
                  <span className="badge badge-amber text-[10px]">{tier.id}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Cupo Sugerido:</span>
                    <div className="font-bold text-emerald-400 mt-0.5">{formatCOP(tier.defaultLimit)}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Desc. Hotel Planetour:</span>
                    <div className="font-bold text-indigo-300 mt-0.5">{tier.hotelDiscount}% OFF</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Desc. Reserva Natural:</span>
                    <div className="font-bold text-emerald-300 mt-0.5">{tier.reserveDiscount}% OFF</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Modal Form */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-6 space-y-6" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                {editingUser ? "Editar Usuario" : "Crear Usuario del Sistema"}
              </h2>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                disabled={isSubmittingUser}
                aria-label="Cerrar formulario de usuario"
                className="w-8 h-8 rounded-lg bg-slate-800 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input
                  type="text"
                  value={usrName}
                  onChange={(e) => setUsrName(e.target.value)}
                  placeholder="Ej: Patricia Morales"
                  className="form-input"
                  required
                  disabled={isSubmittingUser}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Correo Electrónico *</label>
                <input
                  type="email"
                  value={usrEmail}
                  onChange={(e) => setUsrEmail(e.target.value)}
                  placeholder="patricia.morales@planetour.com"
                  className="form-input"
                  required
                  disabled={isSubmittingUser}
                />
              </div>

              {!editingUser && (
                <div className="form-group">
                  <label className="form-label">Contraseña temporal (opcional)</label>
                  <input
                    type="password"
                    value={usrPassword}
                    onChange={(e) => setUsrPassword(e.target.value)}
                    placeholder="Vacío para generar una segura"
                    className="form-input"
                    minLength={10}
                    autoComplete="new-password"
                    disabled={isSubmittingUser}
                  />
                  <span className="text-[11px] text-gray-500">Si la dejas vacía, el servidor generará una contraseña temporal segura.</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Rol de Sistema *</label>
                <select
                  value={usrRole}
                  onChange={(e) => setUsrRole(e.target.value)}
                  className="form-select"
                  disabled={isSubmittingUser}
                >
                  {canManageUsers && <option value="SUPERADMIN">Superadministrador (Acceso Total)</option>}
                  <option value="ADMIN">Administrador de Operaciones</option>
                  <option value="COUNTER">Counter / Emisiones GDS</option>
                  <option value="FINANCE">Tesorería & Cartera Karing</option>
                  <option value="READONLY">Solo Consulta / Lectura</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Departamento / Área</label>
                <input
                  type="text"
                  value={usrDepartment}
                  onChange={(e) => setUsrDepartment(e.target.value)}
                  placeholder="Ej: Mesa GDS Desk"
                  className="form-input"
                  disabled={isSubmittingUser}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  disabled={isSubmittingUser}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmittingUser} className="btn-primary text-xs font-bold disabled:opacity-60">
                  {isSubmittingUser && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmittingUser ? "Guardando..." : "Guardar Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* System Modal Form */}
      {showSystemModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-6 space-y-6" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                {editingSystem ? "Editar Sistema GDS" : "Parametrizar Nuevo Sistema"}
              </h2>
              <button
                type="button"
                onClick={() => setShowSystemModal(false)}
                disabled={isSubmittingSystem}
                aria-label="Cerrar formulario de sistema"
                className="w-8 h-8 rounded-lg bg-slate-800 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSystemSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Nombre del Sistema *</label>
                <input
                  type="text"
                  value={sysName}
                  onChange={(e) => setSysName(e.target.value)}
                  placeholder="Ej: Copa Connect NDC"
                  className="form-input"
                  required
                  disabled={isSubmittingSystem}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Código IATA/Abrev *</label>
                  <input
                    type="text"
                    value={sysCode}
                    onChange={(e) => setSysCode(e.target.value)}
                    placeholder="Ej: CM"
                    className="form-input font-mono"
                    required
                    disabled={isSubmittingSystem}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    value={sysCategory}
                    onChange={(e) => setSysCategory(e.target.value)}
                    className="form-select"
                    disabled={isSubmittingSystem}
                  >
                    <option value="GDS">GDS Global</option>
                    <option value="NDC Channel">Canal NDC</option>
                    <option value="LCC Portal">Portal Low-Cost</option>
                    <option value="Consolidación Directa">Consolidación Directa</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Color Distintivo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={sysColor}
                    onChange={(e) => setSysColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                    disabled={isSubmittingSystem}
                  />
                  <span className="font-mono text-xs text-gray-300">{sysColor}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSystemModal(false)}
                  disabled={isSubmittingSystem}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmittingSystem} className="btn-primary text-xs font-bold disabled:opacity-60">
                  {isSubmittingSystem && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmittingSystem ? "Guardando..." : "Guardar Sistema"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
