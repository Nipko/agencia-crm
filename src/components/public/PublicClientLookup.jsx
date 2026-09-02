import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AtSign,
  Building2,
  CheckCircle2,
  Hash,
  KeyRound,
  LoaderCircle,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";

const MIN_QUERY_LENGTH = 3;
const REQUEST_TIMEOUT_MS = 10000;

const MATCHED_FIELD_LABELS = {
  name: "Nombre",
  type: "Tipo de cliente",
  nit: "NIT",
  iatacode: "Código IATA",
  city: "Ciudad",
  address: "Dirección",
  phone: "Teléfono",
  owner: "Propietario / responsable",
  accountspayable: "Contacto de pagos",
  operationalcounter: "Contacto operativo",
  signatures: "Firmas GDS",
  "owner.name": "Nombre del propietario",
  "owner.phone": "Teléfono del propietario",
  "owner.email": "Correo del propietario",
  "accountspayable.name": "Contacto de pagos",
  "accountspayable.phone": "Teléfono del contacto de pagos",
  "accountspayable.email": "Correo del contacto de pagos",
  "operationalcounter.name": "Contacto operativo",
  "operationalcounter.phone": "Teléfono del contacto operativo",
  "operationalcounter.email": "Correo del contacto operativo",
  "signatures.pcc": "PCC",
  "signatures.agentname": "Nombre del agente",
  "signatures.agentsign": "Firma del agente",
  "signatures.systemname": "Sistema",
  "signatures.systemcode": "Código del sistema",
};

const asText = (value) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const firstText = (...values) => {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
};

const normalizeLookupQuery = (value) =>
  asText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const getContact = (value) => {
  if (!value) return null;

  if (typeof value === "string" || typeof value === "number") {
    return { name: asText(value), phone: "", email: "" };
  }

  if (typeof value !== "object" || Array.isArray(value)) return null;

  const contact = {
    name: firstText(value.name, value.fullName, value.nombre),
    phone: firstText(
      value.phone,
      value.cellPhone,
      value.mobile,
      value.telephone,
      value.telefono,
      value.celular,
    ),
    email: firstText(value.email, value.mail, value.correo),
  };

  return contact.name || contact.phone || contact.email ? contact : null;
};

const getMatchedFields = (value) => {
  const fields = Array.isArray(value) ? value : value ? [value] : [];

  return fields
    .map((field) => asText(field))
    .filter(Boolean)
    .map((field) => {
      const normalized = field.toLowerCase().replaceAll("_", "");
      return (
        MATCHED_FIELD_LABELS[normalized] ||
        field
          .replaceAll("_", " ")
          .replaceAll(".", " · ")
          .replace(/^./, (character) => character.toUpperCase())
      );
    });
};

const getClientTypeLabel = (type) => {
  const normalizedType = asText(type).toUpperCase();
  if (normalizedType === "AGENCY") return "Agencia";
  if (normalizedType === "GOVERNMENT") return "Entidad pública";
  return asText(type) || "Cliente";
};

const getSignatureStatus = (status) => {
  const normalizedStatus = asText(status).toUpperCase();
  if (["ACTIVE", "ACTIVA", "ENABLED"].includes(normalizedStatus)) {
    return { className: "badge-emerald", label: "Activa" };
  }
  if (["SUSPENDED_OVERDUE", "SUSPENDED", "SUSPENDIDA"].includes(normalizedStatus)) {
    return { className: "badge-rose", label: "Suspendida por mora" };
  }
  if (["INACTIVE", "INACTIVA", "DISABLED"].includes(normalizedStatus)) {
    return { className: "badge-rose", label: "Inactiva" };
  }
  return { className: "badge-indigo", label: asText(status) || "Sin estado" };
};

const ContactCard = ({ label, contact }) => {
  if (!contact) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">
        <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      {contact.name && <p className="text-sm font-bold text-white">{contact.name}</p>}
      <div className="mt-1.5 space-y-1 text-xs text-gray-300">
        {contact.phone && (
          <p className="flex min-w-0 items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
            <span className="break-all">{contact.phone}</span>
          </p>
        )}
        {contact.email && (
          <p className="flex min-w-0 items-center gap-1.5">
            <AtSign className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
            <span className="break-all">{contact.email}</span>
          </p>
        )}
      </div>
    </div>
  );
};

const SignatureCard = ({ signature }) => {
  const safeSignature =
    signature && typeof signature === "object" && !Array.isArray(signature) ? signature : {};
  const status = getSignatureStatus(safeSignature.status);
  const systemName = asText(safeSignature.systemName);
  const systemCode = asText(safeSignature.systemCode);
  const pcc = asText(safeSignature.pcc);
  const agentName = asText(safeSignature.agentName);
  const agentSign = asText(safeSignature.agentSign);

  return (
    <li className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-extrabold text-sky-200">
            <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {agentSign || pcc || "Firma sin código"}
          </p>
          {(systemName || systemCode) && (
            <p className="mt-1 text-[11px] text-gray-400">
              {[systemName, systemCode].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span className={`badge ${status.className} text-[9px]`}>{status.label}</span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">PCC</dt>
          <dd className="mt-0.5 break-words font-semibold text-gray-200">{pcc || "No registrado"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Agente</dt>
          <dd className="mt-0.5 break-words font-semibold text-gray-200">
            {agentName || "No registrado"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Firma</dt>
          <dd className="mt-0.5 break-words font-mono font-semibold text-orange-200">
            {agentSign || "No registrada"}
          </dd>
        </div>
      </dl>
    </li>
  );
};

const ClientResult = ({ client, index }) => {
  const safeClient = client && typeof client === "object" && !Array.isArray(client) ? client : {};
  const clientName = asText(safeClient.name) || "Cliente sin nombre registrado";
  const signatures = Array.isArray(safeClient.signatures) ? safeClient.signatures : [];
  const matchedFields = getMatchedFields(safeClient.matchedFields);
  const contacts = [
    { label: "Propietario / responsable", value: getContact(safeClient.owner) },
    { label: "Contacto de pagos", value: getContact(safeClient.accountsPayable) },
    { label: "Contacto operativo", value: getContact(safeClient.operationalCounter) },
  ].filter(({ value }) => value);
  const clientKey = asText(safeClient.id) || `resultado-${index}`;
  const nit = asText(safeClient.nit);
  const iataCode = asText(safeClient.iataCode);
  const city = asText(safeClient.city);
  const address = asText(safeClient.address);
  const phone = asText(safeClient.phone);

  return (
    <li className="glass-panel overflow-hidden" aria-labelledby={`client-result-${index}`}>
      <article>
        <header className="border-b border-white/10 bg-slate-900/55 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <span className="badge badge-orange text-[9px]">
                {getClientTypeLabel(safeClient.type)}
              </span>
              <h2
                id={`client-result-${index}`}
                className="mt-2 break-words text-lg font-extrabold text-white sm:text-xl"
              >
                {clientName}
              </h2>
              {(nit || iataCode) && (
                <p className="mt-1 text-xs text-gray-400">
                  {[nit && `NIT ${nit}`, iataCode && `IATA ${iataCode}`].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>

            {matchedFields.length > 0 && (
              <div className="sm:max-w-[55%] sm:text-right">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Coincidencia encontrada en
                </p>
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {matchedFields.map((field, fieldIndex) => (
                    <span key={`${clientKey}-match-${fieldIndex}`} className="badge badge-sky text-[9px] normal-case">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 space-y-5">
            <section aria-label={`Identificación de ${clientName}`}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white">
                <Building2 className="h-4 w-4 text-orange-400" aria-hidden="true" />
                Identificación y ubicación
              </h3>
              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                {nit && (
                  <div className="rounded-lg border border-white/5 bg-slate-950/40 p-2.5">
                    <dt className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500">
                      <Hash className="h-3 w-3" aria-hidden="true" /> NIT
                    </dt>
                    <dd className="mt-1 break-words font-semibold text-gray-200">{nit}</dd>
                  </div>
                )}
                {iataCode && (
                  <div className="rounded-lg border border-white/5 bg-slate-950/40 p-2.5">
                    <dt className="text-[10px] font-bold uppercase text-gray-500">Código IATA</dt>
                    <dd className="mt-1 break-words font-mono font-semibold text-gray-200">{iataCode}</dd>
                  </div>
                )}
                {city && (
                  <div className="rounded-lg border border-white/5 bg-slate-950/40 p-2.5">
                    <dt className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500">
                      <MapPin className="h-3 w-3" aria-hidden="true" /> Ciudad
                    </dt>
                    <dd className="mt-1 break-words font-semibold text-gray-200">{city}</dd>
                  </div>
                )}
                {phone && (
                  <div className="rounded-lg border border-white/5 bg-slate-950/40 p-2.5">
                    <dt className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500">
                      <Phone className="h-3 w-3" aria-hidden="true" /> Teléfono principal
                    </dt>
                    <dd className="mt-1 break-all font-semibold text-gray-200">{phone}</dd>
                  </div>
                )}
                {address && (
                  <div className="rounded-lg border border-white/5 bg-slate-950/40 p-2.5 sm:col-span-2">
                    <dt className="text-[10px] font-bold uppercase text-gray-500">Dirección</dt>
                    <dd className="mt-1 break-words font-semibold text-gray-200">{address}</dd>
                  </div>
                )}
              </dl>
              {!nit && !iataCode && !city && !phone && !address && (
                <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-gray-500">
                  No hay más datos de identificación disponibles.
                </p>
              )}
            </section>

            <section aria-label={`Contactos de ${clientName}`}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white">
                <UserRound className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                Contactos relacionados
              </h3>
              {contacts.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {contacts.map(({ label, value }) => (
                    <ContactCard key={label} label={label} contact={value} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-gray-500">
                  No hay contactos relacionados registrados.
                </p>
              )}
            </section>
          </div>

          <section className="min-w-0" aria-label={`Firmas de ${clientName}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
                <KeyRound className="h-4 w-4 text-sky-400" aria-hidden="true" />
                Firmas relacionadas
              </h3>
              <span className="badge badge-indigo text-[9px]">
                {signatures.length} {signatures.length === 1 ? "firma" : "firmas"}
              </span>
            </div>
            {signatures.length > 0 ? (
              <ul className="space-y-2" aria-label={`Listado de firmas de ${clientName}`}>
                {signatures.map((signature, signatureIndex) => (
                  <SignatureCard
                    key={`${clientKey}-signature-${asText(signature?.id) || signatureIndex}`}
                    signature={signature}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-sky-500/20 bg-sky-950/10 p-5 text-center">
                <KeyRound className="mx-auto h-6 w-6 text-gray-600" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-gray-400">
                  Este cliente no tiene firmas relacionadas registradas.
                </p>
              </div>
            )}
          </section>
        </div>
      </article>
    </li>
  );
};

export const PublicClientLookup = () => {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const requestRef = useRef(null);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const clearSearch = () => {
    const activeRequest = requestRef.current;
    requestRef.current = null;
    activeRequest?.abort();
    setQuery("");
    setSearchedQuery("");
    setResults([]);
    setError("");
    setHasSearched(false);
    setIsLoading(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedQuery = query.trim();
    if (normalizeLookupQuery(normalizedQuery).length < MIN_QUERY_LENGTH) {
      setError(`Escribe al menos ${MIN_QUERY_LENGTH} letras o números para realizar la búsqueda.`);
      setResults([]);
      setHasSearched(false);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let didTimeout = false;
    const timeoutId = globalThis.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setError("");
    setResults([]);
    setSearchedQuery(normalizedQuery);
    setHasSearched(false);
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/public/client-lookup?q=${encodeURIComponent(normalizedQuery)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );

      let payload;
      try {
        payload = await response.json();
      } catch {
        if (response.status >= 500) {
          throw new Error("No se pudo conectar con el servidor. Verifica que la API y PostgreSQL estén activos.");
        }
        throw new Error("El servidor devolvió una respuesta que no se pudo interpretar.");
      }

      if (!response.ok) {
        const serverMessage = firstText(payload?.message, payload?.error);
        throw new Error(serverMessage || "No fue posible completar la consulta.");
      }

      if (!Array.isArray(payload?.results)) {
        throw new Error("La respuesta de consulta no tiene el formato esperado.");
      }

      if (requestRef.current !== controller) return;

      setResults(payload.results);
      setHasSearched(true);
    } catch (requestError) {
      if (requestRef.current !== controller) return;

      if (didTimeout) {
        setError("La consulta tardó demasiado. Verifica tu conexión e inténtalo de nuevo.");
      } else if (requestError?.name !== "AbortError") {
        setError(requestError instanceof Error ? requestError.message : "Ocurrió un error inesperado.");
      }
    } finally {
      globalThis.clearTimeout(timeoutId);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const trimmedQueryLength = query.trim().length;
  const isQueryTooShort = trimmedQueryLength > 0 && normalizeLookupQuery(query).length < MIN_QUERY_LENGTH;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <section className="glass-panel overflow-hidden" aria-labelledby="public-client-lookup-title">
        <div className="border-b border-white/10 bg-slate-900/65 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="badge badge-orange">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Consulta operativa
            </span>
            <h1
              id="public-client-lookup-title"
              className="mt-3 text-2xl font-extrabold text-white sm:text-3xl"
            >
              Identifica un cliente o una agencia
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              Busca por nombre, negocio, NIT, teléfono, correo, ciudad, PCC o firma de agente. La
              consulta muestra únicamente información de identificación y soporte.
            </p>
          </div>

          <form
            className="mx-auto mt-6 max-w-3xl"
            role="search"
            noValidate
            onSubmit={handleSubmit}
          >
            <label htmlFor="public-client-query" className="form-label">
              Dato del cliente, agencia o firma
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                  aria-hidden="true"
                />
                <input
                  id="public-client-query"
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (error) setError("");
                  }}
                  className="form-input pl-10 pr-3"
                  placeholder="Ej. Agencia Sol, 900123456, 3001234567 o firma ABC1"
                  aria-describedby="public-client-query-help public-client-search-status"
                  aria-invalid={isQueryTooShort || Boolean(error)}
                  autoComplete="off"
                  maxLength={120}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                className="btn-primary shrink-0 sm:min-w-32"
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="h-4 w-4" aria-hidden="true" />
                )}
                {isLoading ? "Buscando…" : "Buscar"}
              </button>
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={clearSearch}
                disabled={!query && !searchedQuery && !isLoading}
                aria-label="Limpiar búsqueda y resultados"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Limpiar
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px]">
              <p id="public-client-query-help" className="text-gray-500">
                Escribe al menos {MIN_QUERY_LENGTH} letras o números y presiona Buscar.
              </p>
              <p className={isQueryTooShort ? "font-semibold text-amber-300" : "text-gray-600"}>
                {trimmedQueryLength}/120 caracteres
              </p>
            </div>
          </form>
        </div>
      </section>

      <div id="public-client-search-status" className="mt-5" aria-live="polite" aria-atomic="true">
        {error && (
          <div
            className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/35 p-4 text-sm text-rose-100"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
            <div>
              <p className="font-bold">No se pudo realizar la búsqueda</p>
              <p className="mt-0.5 text-xs text-rose-200/80">{error}</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="glass-panel flex items-center justify-center gap-3 p-8" role="status">
            <LoaderCircle className="h-6 w-6 animate-spin text-orange-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-white">Consultando el directorio…</p>
              <p className="mt-0.5 text-xs text-gray-500">Buscando “{searchedQuery}”</p>
            </div>
          </div>
        )}

        {!isLoading && !error && hasSearched && results.length === 0 && (
          <div className="glass-panel p-8 text-center" role="status">
            <Building2 className="mx-auto h-8 w-8 text-gray-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-gray-200">No encontramos coincidencias</p>
            <p className="mx-auto mt-1 max-w-xl text-xs text-gray-500">
              Revisa el dato “{searchedQuery}” o intenta con el nombre, NIT, teléfono, correo, PCC
              o firma del agente.
            </p>
          </div>
        )}
      </div>

      {!isLoading && !error && results.length > 0 && (
        <section className="mt-5" aria-labelledby="public-client-results-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="public-client-results-title" className="text-base font-extrabold text-white">
                {results.length} {results.length === 1 ? "resultado encontrado" : "resultados encontrados"}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">Consulta: “{searchedQuery}”</p>
            </div>
            <p className="text-[11px] font-semibold text-gray-500">Sin información financiera</p>
          </div>
          <ul className="space-y-4" aria-label="Resultados de clientes y agencias">
            {results.map((client, index) => (
              <ClientResult
                key={`${asText(client?.id) || "client"}-${index}`}
                client={client}
                index={index}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
};

export default PublicClientLookup;
