const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const TOKEN_KEY = "planetour.crm.token";
const USER_KEY = "planetour.crm.user";

const getStorage = () => (typeof window === "undefined" ? null : window.sessionStorage);

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, networkError = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.networkError = networkError;
  }
}

export const authSession = {
  getToken() {
    return getStorage()?.getItem(TOKEN_KEY) || "";
  },
  getUser() {
    const value = getStorage()?.getItem(USER_KEY);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      getStorage()?.removeItem(USER_KEY);
      return null;
    }
  },
  set(token, user) {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    const storage = getStorage();
    storage?.removeItem(TOKEN_KEY);
    storage?.removeItem(USER_KEY);
  }
};

const parseResponse = async (response) => {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
};

export const apiRequest = async (path, options = {}) => {
  const { method = "GET", body, signal, timeoutMs = 12000 } = options;
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  const token = authSession.getToken();
  const headers = {
    Accept: "application/json",
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  try {
    const response = await fetch(`${API_BASE_URL}/${path.replace(/^\/+/, "")}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const data = await parseResponse(response);

    if (!response.ok) {
      const message = data?.error || data?.message || `La solicitud falló (${response.status}).`;
      throw new ApiError(message, { status: response.status, data });
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) {
      throw new ApiError("Solicitud cancelada.", { status: -1 });
    }

    const timedOut = error?.name === "AbortError";
    throw new ApiError(
      timedOut
        ? "El servidor tardó demasiado en responder. Verifica que PostgreSQL y la API estén activos."
        : "No se pudo conectar con la API. Verifica que el servidor y PostgreSQL estén activos.",
      { networkError: true }
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
};

export const api = {
  login: (credentials) => apiRequest("auth/login", { method: "POST", body: credentials }),
  logout: () => apiRequest("auth/logout", { method: "POST", timeoutMs: 5000 }),
  changePassword: (passwords) => apiRequest("auth/password", { method: "PUT", body: passwords }),
  bootstrap: (signal) => apiRequest("bootstrap", { signal }),
  create: (resource, data) => apiRequest(resource, { method: "POST", body: data }),
  update: (resource, id, data) =>
    apiRequest(`${resource}/${encodeURIComponent(id)}`, { method: "PUT", body: data }),
  remove: (resource, id) =>
    apiRequest(`${resource}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  setSignatureStatus: (id, status) =>
    apiRequest(`signatures/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status }
    }),
  saveSettings: (settings) => apiRequest("settings", { method: "PUT", body: settings }),
  syncKaring: () => apiRequest("karing/sync", { method: "POST" })
};
