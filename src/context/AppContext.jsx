/* oxlint-disable react/only-export-components -- provider and hook intentionally share one public module */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  initialClients,
  initialSystems,
  initialSignatures,
  initialPublicContracts,
  initialKaringLedger,
  initialHotelInventory,
  initialReservePackages
} from "../data/mockData";
import { api, ApiError, authSession } from "../lib/api";

const AppContext = createContext(null);
const NotificationContext = createContext(null);

const DEFAULT_KARING_CONFIG = {
  serverIp: "",
  apiKey: "",
  autoBlockDays: 30,
  autoSyncMinutes: 15,
  enableAutoBlock: true
};

const DEFAULT_TIER_CONFIGS = [
  { id: "GOLD", name: "GOLD (Alta Emisión)", defaultLimit: 150000000, hotelDiscount: 25, reserveDiscount: 30 },
  { id: "SILVER", name: "SILVER (Estándar)", defaultLimit: 80000000, hotelDiscount: 15, reserveDiscount: 20 },
  { id: "BRONZE", name: "BRONZE (Ocasional)", defaultLimit: 30000000, hotelDiscount: 10, reserveDiscount: 10 },
  { id: "ESTATAL", name: "ESTATAL (Convenios)", defaultLimit: 500000000, hotelDiscount: 20, reserveDiscount: 25 }
];

const publicUser = (user) => {
  if (!user) return null;
  const { password: _password, passwordHash: _passwordHash, password_hash: _password_hash, ...safeUser } = user;
  return safeUser;
};

const unwrapEntity = (response, key) => response?.[key] || response;

const friendlyError = (error, fallback) => {
  if (error?.networkError) return error.message;
  if (error?.status >= 500) {
    return `${fallback} Verifica la conexión con PostgreSQL e inténtalo de nuevo.`;
  }
  return error?.message || fallback;
};

export const AppProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(() =>
    authSession.getToken() ? publicUser(authSession.getUser()) : null
  );
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(currentUser));

  const [clients, setClients] = useState(initialClients);
  const [systems, setSystems] = useState(initialSystems);
  const [signatures, setSignatures] = useState(initialSignatures);
  const [contracts, setContracts] = useState(initialPublicContracts);
  const [karingLedger, setKaringLedger] = useState(initialKaringLedger);
  const [hotelInventory, setHotelInventory] = useState(initialHotelInventory);
  const [reservePackages, setReservePackages] = useState(initialReservePackages);

  const [karingConfig, setKaringConfig] = useState(DEFAULT_KARING_CONFIG);
  const [tierConfigs, setTierConfigs] = useState(DEFAULT_TIER_CONFIGS);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientForModal, setSelectedClientForModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(currentUser));
  const [dataError, setDataError] = useState("");
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const toastSequence = useRef(0);
  const syncInFlight = useRef(false);

  const addToast = useCallback((type, message) => {
    if (!message) return;
    const id = `toast-${Date.now()}-${toastSequence.current++}`;
    setToasts((previous) => [{ id, type, message }, ...previous].slice(0, 5));
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const clearAuthenticatedState = useCallback(() => {
    authSession.clear();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsBootstrapping(false);
    setDataError("");
    setUsingFallbackData(false);
    setSelectedClientForModal(null);
    setUsers([]);
    setClients(initialClients);
    setSystems(initialSystems);
    setSignatures(initialSignatures);
    setContracts(initialPublicContracts);
    setKaringLedger(initialKaringLedger);
    setHotelInventory(initialHotelInventory);
    setReservePackages(initialReservePackages);
    setKaringConfig(DEFAULT_KARING_CONFIG);
    setTierConfigs(DEFAULT_TIER_CONFIGS);
    setActiveTab("dashboard");
    setSearchTerm("");
  }, []);

  const handleMutationError = useCallback(
    (error, fallbackMessage) => {
      const message = friendlyError(error, fallbackMessage);
      const isSessionError =
        error instanceof ApiError &&
        error.status === 401 &&
        error.data?.code !== "INVALID_CREDENTIALS";
      if (isSessionError) {
        clearAuthenticatedState();
        addToast("warning", "Tu sesión venció. Inicia sesión nuevamente.");
      } else {
        addToast("warning", message);
      }
      return { success: false, error: message };
    },
    [addToast, clearAuthenticatedState]
  );

  const applyBootstrap = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return;

    if (Array.isArray(payload.users)) setUsers(payload.users.map(publicUser));
    if (Array.isArray(payload.clients)) setClients(payload.clients);
    if (Array.isArray(payload.systems)) setSystems(payload.systems);
    if (Array.isArray(payload.signatures)) setSignatures(payload.signatures);
    if (Array.isArray(payload.contracts)) setContracts(payload.contracts);
    if (Array.isArray(payload.karingLedger)) setKaringLedger(payload.karingLedger);
    if (Array.isArray(payload.hotelInventory)) setHotelInventory(payload.hotelInventory);
    if (Array.isArray(payload.reservePackages)) setReservePackages(payload.reservePackages);

    const settings = payload.settings || {};
    const remoteKaringConfig = settings.karingConfig || payload.karingConfig;
    const remoteTierConfigs = settings.tierConfigs || payload.tierConfigs;
    if (remoteKaringConfig && typeof remoteKaringConfig === "object") {
      setKaringConfig((previous) => ({ ...previous, ...remoteKaringConfig }));
    }
    if (Array.isArray(remoteTierConfigs)) setTierConfigs(remoteTierConfigs);
  }, []);

  const loadRemoteData = useCallback(
    async (signal, { notify = true } = {}) => {
      setIsBootstrapping(true);
      setDataError("");

      try {
        const payload = await api.bootstrap(signal);
        applyBootstrap(payload);
        setUsingFallbackData(false);
        return { success: true, data: payload };
      } catch (error) {
        if (error?.status === -1) return { success: false, cancelled: true };
        if (error?.status === 401) {
          clearAuthenticatedState();
          if (notify) addToast("warning", "Tu sesión venció. Inicia sesión nuevamente.");
          return { success: false, error: "Sesión vencida." };
        }

        const message = friendlyError(error, "No fue posible cargar los datos del CRM.");
        setDataError(message);
        setUsingFallbackData(true);
        if (notify) addToast("warning", `${message} Se conservarán los datos locales disponibles.`);
        return { success: false, error: message };
      } finally {
        if (!signal?.aborted) setIsBootstrapping(false);
      }
    },
    [addToast, applyBootstrap, clearAuthenticatedState]
  );

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    loadRemoteData(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, loadRemoteData]);

  useEffect(() => {
    if (!selectedClientForModal) return;
    const currentClient = clients.find((client) => client.id === selectedClientForModal.id);
    if (!currentClient) {
      setSelectedClientForModal(null);
    } else if (currentClient !== selectedClientForModal) {
      setSelectedClientForModal(currentClient);
    }
  }, [clients, selectedClientForModal]);

  const login = useCallback(
    async (emailOrUser, password) => {
      const cleanInput = String(emailOrUser || "").trim().toLowerCase();
      if (!cleanInput || !password) {
        return { success: false, error: "Ingresa tu usuario y contraseña." };
      }

      try {
        const response = await api.login({ email: cleanInput, username: cleanInput, password });
        if (!response?.token || !response?.user) {
          throw new ApiError("La respuesta de autenticación no es válida.", { status: 502 });
        }

        const user = publicUser(response.user);
        authSession.set(response.token, user);
        setCurrentUser(user);
        setIsBootstrapping(true);
        setIsAuthenticated(true);
        setDataError("");
        addToast("success", `Sesión iniciada como ${user.name} [${user.roleLabel || user.role}].`);
        return { success: true, user };
      } catch (error) {
        const message = friendlyError(error, "No fue posible iniciar sesión.");
        return { success: false, error: message };
      }
    },
    [addToast]
  );

  const logout = useCallback(async () => {
    const logoutRequest = authSession.getToken() ? api.logout().catch(() => null) : Promise.resolve();
    clearAuthenticatedState();
    addToast("info", "Sesión cerrada correctamente.");
    await logoutRequest;
  }, [addToast, clearAuthenticatedState]);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!currentUser) return { success: false, error: "No hay sesión activa." };
      if (!newPassword || newPassword.length < 10) {
        return { success: false, error: "La nueva contraseña debe tener al menos 10 caracteres." };
      }
      if (currentPassword === newPassword) {
        return { success: false, error: "La nueva contraseña debe ser diferente de la actual." };
      }

      try {
        await api.changePassword({ currentPassword, newPassword });
        addToast("success", "Tu contraseña fue actualizada con éxito.");
        return { success: true };
      } catch (error) {
        return handleMutationError(error, "No fue posible actualizar la contraseña.");
      }
    },
    [addToast, currentUser, handleMutationError]
  );

  const isReadOnly = currentUser?.role === "READONLY";
  const isSuperadmin = currentUser?.role === "SUPERADMIN";
  const canManageClients = ["SUPERADMIN", "ADMIN"].includes(currentUser?.role);
  const canManageSystems = ["SUPERADMIN", "ADMIN"].includes(currentUser?.role);
  const canManageContracts = ["SUPERADMIN", "ADMIN"].includes(currentUser?.role);
  const canManageHospitality = ["SUPERADMIN", "ADMIN"].includes(currentUser?.role);
  const canManageSignatures = ["SUPERADMIN", "ADMIN", "COUNTER"].includes(currentUser?.role);
  const canSyncKaring = ["SUPERADMIN", "ADMIN", "FINANCE"].includes(currentUser?.role);
  const canManageSettings = isSuperadmin;
  const canManageUsers = isSuperadmin;

  const checkPermission = useCallback(
    (action = "modificar datos") => {
      if (!currentUser) {
        addToast("warning", "Debes iniciar sesión para realizar esta acción.");
        return false;
      }
      if (currentUser.role === "READONLY") {
        addToast("warning", `Acción denegada: tu rol (${currentUser.roleLabel}) no puede ${action}.`);
        return false;
      }
      return true;
    },
    [addToast, currentUser]
  );

  const saveUser = useCallback(
    async (userData) => {
      if (!canManageUsers) {
        const error = "Sólo un superadministrador puede gestionar usuarios.";
        addToast("warning", error);
        return { success: false, error };
      }
      const { id, ...payload } = userData;
      try {
        const response = id ? await api.update("users", id, payload) : await api.create("users", payload);
        const savedResponse = unwrapEntity(response, "user");
        const temporaryPassword = response?.temporaryPassword || savedResponse?.temporaryPassword;
        const savedUser = publicUser(savedResponse);
        delete savedUser.temporaryPassword;
        setUsers((previous) =>
          id
            ? previous.map((user) => (user.id === id ? savedUser : user))
            : [...previous, savedUser]
        );

        if (id === currentUser?.id) {
          setCurrentUser(savedUser);
          authSession.set(authSession.getToken(), savedUser);
        }

        addToast(id ? "info" : "success", `Usuario "${savedUser.name}" ${id ? "actualizado" : "creado"}.`);
        return { success: true, data: savedUser, temporaryPassword };
      } catch (error) {
        return handleMutationError(error, "No fue posible guardar el usuario.");
      }
    },
    [addToast, canManageUsers, currentUser, handleMutationError]
  );

  const deleteUser = useCallback(
    async (userId) => {
      if (!canManageUsers) {
        const error = "Sólo un superadministrador puede eliminar usuarios.";
        addToast("warning", error);
        return { success: false, error };
      }
      if (userId === currentUser?.id) {
        const error = "No puedes eliminar tu propio usuario activo.";
        addToast("warning", error);
        return { success: false, error };
      }

      try {
        await api.remove("users", userId);
        setUsers((previous) => previous.filter((user) => user.id !== userId));
        addToast("warning", "Usuario eliminado del sistema.");
        return { success: true };
      } catch (error) {
        return handleMutationError(error, "No fue posible eliminar el usuario.");
      }
    },
    [addToast, canManageUsers, currentUser, handleMutationError]
  );

  const saveSystem = useCallback(
    async (systemData) => {
      if (!canManageSystems) {
        const error = "Tu rol no permite parametrizar sistemas.";
        addToast("warning", error);
        return { success: false, error };
      }
      const { id, ...payload } = systemData;
      try {
        const response = id ? await api.update("systems", id, payload) : await api.create("systems", payload);
        const savedSystem = unwrapEntity(response, "system");
        setSystems((previous) =>
          id
            ? previous.map((system) => (system.id === id ? savedSystem : system))
            : [...previous, savedSystem]
        );
        addToast(id ? "info" : "success", `Sistema "${savedSystem.name}" guardado correctamente.`);
        return { success: true, data: savedSystem };
      } catch (error) {
        return handleMutationError(error, "No fue posible guardar el sistema.");
      }
    },
    [addToast, canManageSystems, handleMutationError]
  );

  const deleteSystem = useCallback(
    async (systemId) => {
      if (!canManageSystems) {
        const error = "Tu rol no permite eliminar sistemas.";
        addToast("warning", error);
        return { success: false, error };
      }
      try {
        const response = await api.remove("systems", systemId);
        setSystems((previous) => previous.filter((system) => system.id !== systemId));
        setSignatures((previous) => previous.filter((signature) => signature.systemId !== systemId));
        const suffix = response?.deletedSignatures
          ? ` También se eliminaron ${response.deletedSignatures} firmas asociadas.`
          : "";
        addToast("warning", `Sistema eliminado de la parametrización.${suffix}`);
        return { success: true };
      } catch (error) {
        return handleMutationError(error, "No fue posible eliminar el sistema.");
      }
    },
    [addToast, canManageSystems, handleMutationError]
  );

  const toggleSignatureStatus = useCallback(
    async (signatureId) => {
      if (!canManageSignatures) {
        const error = "Tu rol no permite cambiar el estado de firmas.";
        addToast("warning", error);
        return { success: false, error };
      }
      const signature = signatures.find((item) => item.id === signatureId);
      if (!signature) return { success: false, error: "La firma seleccionada ya no existe." };
      const status = signature.status === "ACTIVE" ? "SUSPENDED_OVERDUE" : "ACTIVE";

      try {
        const response = await api.setSignatureStatus(signatureId, status);
        const savedSignature = unwrapEntity(response, "signature") || { ...signature, status };
        setSignatures((previous) =>
          previous.map((item) => (item.id === signatureId ? { ...item, ...savedSignature, status } : item))
        );
        addToast(
          status === "ACTIVE" ? "success" : "warning",
          `Firma GDS ${signature.pcc} ${status === "ACTIVE" ? "habilitada" : "suspendida"}.`
        );
        return { success: true, data: savedSignature };
      } catch (error) {
        return handleMutationError(error, "No fue posible cambiar el estado de la firma.");
      }
    },
    [addToast, canManageSignatures, handleMutationError, signatures]
  );

  const saveClient = useCallback(
    async (clientData) => {
      if (!canManageClients) {
        const error = "Tu rol no permite guardar clientes.";
        addToast("warning", error);
        return { success: false, error };
      }
      const { id, ...payload } = clientData;
      try {
        const response = id ? await api.update("clients", id, payload) : await api.create("clients", payload);
        const savedClient = unwrapEntity(response, "client");
        setClients((previous) =>
          id
            ? previous.map((client) => (client.id === id ? savedClient : client))
            : [savedClient, ...previous]
        );
        addToast(id ? "info" : "success", `Cliente "${savedClient.name}" guardado correctamente.`);
        return { success: true, data: savedClient };
      } catch (error) {
        return handleMutationError(error, "No fue posible guardar el cliente.");
      }
    },
    [addToast, canManageClients, handleMutationError]
  );

  const addSignature = useCallback(
    async (signatureData) => {
      if (!canManageSignatures) {
        const error = "Tu rol no permite asignar firmas.";
        addToast("warning", error);
        return { success: false, error };
      }
      try {
        const response = await api.create("signatures", signatureData);
        const savedSignature = unwrapEntity(response, "signature");
        setSignatures((previous) => [savedSignature, ...previous]);
        addToast("success", `Firma GDS ${savedSignature.pcc} asignada exitosamente.`);
        return { success: true, data: savedSignature };
      } catch (error) {
        return handleMutationError(error, "No fue posible asignar la firma.");
      }
    },
    [addToast, canManageSignatures, handleMutationError]
  );

  const saveContract = useCallback(
    async (contractData) => {
      if (!canManageContracts) {
        const error = "Tu rol no permite guardar contratos.";
        addToast("warning", error);
        return { success: false, error };
      }
      const { id, ...payload } = contractData;
      try {
        const response = id ? await api.update("contracts", id, payload) : await api.create("contracts", payload);
        const savedContract = unwrapEntity(response, "contract");
        setContracts((previous) =>
          id
            ? previous.map((contract) => (contract.id === id ? savedContract : contract))
            : [savedContract, ...previous]
        );
        addToast(id ? "info" : "success", `Contrato "${savedContract.contractNumber}" guardado.`);
        return { success: true, data: savedContract };
      } catch (error) {
        return handleMutationError(error, "No fue posible guardar el contrato.");
      }
    },
    [addToast, canManageContracts, handleMutationError]
  );

  const saveSettings = useCallback(async () => {
    if (!canManageSettings) {
      const error = "Sólo un superadministrador puede cambiar la configuración de integración.";
      addToast("warning", error);
      return { success: false, error };
    }
    try {
      const response = await api.saveSettings({ karingConfig, tierConfigs });
      applyBootstrap({ settings: response?.settings || response });
      addToast("success", "Parámetros del sistema guardados correctamente.");
      return { success: true, data: response };
    } catch (error) {
      return handleMutationError(error, "No fue posible guardar la configuración.");
    }
  }, [addToast, applyBootstrap, canManageSettings, handleMutationError, karingConfig, tierConfigs]);

  const syncWithKaring = useCallback(async () => {
    if (syncInFlight.current) return { success: false, error: "La conciliación ya está en curso." };
    if (!canSyncKaring) {
      const error = "Tu rol no permite recalcular la cartera Karing.";
      addToast("warning", error);
      return { success: false, error };
    }

    syncInFlight.current = true;
    setIsSyncing(true);
    addToast("info", "Recalculando saldos desde las facturas registradas...");
    try {
      const response = await api.syncKaring();
      if (response?.clients || response?.karingLedger || response?.signatures) {
        applyBootstrap(response);
      } else {
        const refreshed = await api.bootstrap();
        applyBootstrap(refreshed);
      }
      addToast("success", "Cartera registrada conciliada correctamente.");
      return { success: true, data: response };
    } catch (error) {
      return handleMutationError(error, "No fue posible recalcular la cartera registrada.");
    } finally {
      syncInFlight.current = false;
      setIsSyncing(false);
    }
  }, [addToast, applyBootstrap, canSyncKaring, handleMutationError]);

  const retryDataLoad = useCallback(() => loadRemoteData(undefined), [loadRemoteData]);

  const value = useMemo(
    () => ({
      users,
      currentUser,
      isAuthenticated,
      isBootstrapping,
      dataError,
      usingFallbackData,
      retryDataLoad,
      login,
      logout,
      changePassword,
      saveUser,
      deleteUser,
      isReadOnly,
      isSuperadmin,
      canManageClients,
      canManageSystems,
      canManageContracts,
      canManageHospitality,
      canManageSignatures,
      canSyncKaring,
      canManageSettings,
      canManageUsers,
      checkPermission,
      clients,
      systems,
      signatures,
      contracts,
      karingLedger,
      hotelInventory,
      reservePackages,
      karingConfig,
      setKaringConfig,
      tierConfigs,
      setTierConfigs,
      saveSettings,
      activeTab,
      setActiveTab,
      searchTerm,
      setSearchTerm,
      selectedClientForModal,
      setSelectedClientForModal,
      addToast,
      toggleSignatureStatus,
      saveClient,
      addSignature,
      saveContract,
      saveSystem,
      deleteSystem,
      syncWithKaring,
      isSyncing
    }),
    [
      users,
      currentUser,
      isAuthenticated,
      isBootstrapping,
      dataError,
      usingFallbackData,
      retryDataLoad,
      login,
      logout,
      changePassword,
      saveUser,
      deleteUser,
      isReadOnly,
      isSuperadmin,
      canManageClients,
      canManageSystems,
      canManageContracts,
      canManageHospitality,
      canManageSignatures,
      canSyncKaring,
      canManageSettings,
      canManageUsers,
      checkPermission,
      clients,
      systems,
      signatures,
      contracts,
      karingLedger,
      hotelInventory,
      reservePackages,
      karingConfig,
      tierConfigs,
      saveSettings,
      activeTab,
      searchTerm,
      selectedClientForModal,
      addToast,
      toggleSignatureStatus,
      saveClient,
      addSignature,
      saveContract,
      saveSystem,
      deleteSystem,
      syncWithKaring,
      isSyncing
    ]
  );

  const notificationValue = useMemo(
    () => ({ toasts, removeToast }),
    [removeToast, toasts]
  );

  return (
    <AppContext.Provider value={value}>
      <NotificationContext.Provider value={notificationValue}>{children}</NotificationContext.Provider>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp debe usarse dentro de AppProvider.");
  return context;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications debe usarse dentro de AppProvider.");
  return context;
};
