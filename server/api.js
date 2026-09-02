import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import {
  createSession,
  requireAuth,
  requireKaringWrite,
  requireSignatureWrite,
  requireSuperadmin,
  requireWritable,
  revokeToken,
  revokeUserSessions,
  tokenFromRequest,
  updateUserSessions
} from "./auth.js";
import {
  HttpError,
  arrayField,
  assertHasUpdates,
  assertPassword,
  asyncRoute,
  booleanField,
  colorField,
  dateField,
  ensureObject,
  enumField,
  idParameter,
  identifierField,
  integerField,
  jsonObjectField,
  numberField,
  stringField,
  urlField
} from "./validation.js";

export const apiRouter = express.Router();

const ROLES = ["SUPERADMIN", "ADMIN", "COUNTER", "FINANCE", "READONLY"];
const USER_STATUSES = ["ACTIVE", "INACTIVE"];
const CLIENT_TYPES = ["AGENCY", "GOVERNMENT", "CORPORATE"];
const CLIENT_TIERS = ["GOLD", "SILVER", "BRONZE", "ESTATAL"];
const CLIENT_STATUSES = ["ACTIVE", "WARNING", "BLOCKED", "INACTIVE"];
const SIGNATURE_STATUSES = ["ACTIVE", "SUSPENDED_OVERDUE", "INACTIVE"];

const roleLabels = {
  SUPERADMIN: "Superadministrador",
  ADMIN: "Administrador de Operaciones",
  COUNTER: "Counter / Emisiones GDS",
  FINANCE: "Tesorería & Cartera",
  READONLY: "Solo Consulta / Lectura"
};

const USER_FIELDS = `
  id, name, email, role, role_label AS "roleLabel", status, department,
  avatar_color AS "avatarColor", created_at AS "createdAt"`;

const CLIENT_FIELDS = `
  id, name, type, nit, iata_code AS "iataCode", tier, status, city, address, phone,
  credit_limit AS "creditLimit", karing_balance AS "karingBalance",
  overdue_days AS "overdueDays", owner_json AS "owner",
  accounts_payable_json AS "accountsPayable",
  operational_counter_json AS "operationalCounter", created_at AS "createdAt"`;

const QUALIFIED_CLIENT_FIELDS = `
  c.id, c.name, c.type, c.nit, c.iata_code AS "iataCode", c.tier, c.status,
  c.city, c.address, c.phone, c.credit_limit AS "creditLimit",
  c.karing_balance AS "karingBalance", c.overdue_days AS "overdueDays",
  c.owner_json AS "owner", c.accounts_payable_json AS "accountsPayable",
  c.operational_counter_json AS "operationalCounter", c.created_at AS "createdAt"`;

const SYSTEM_FIELDS = `
  id, name, category, code, color, created_at AS "createdAt"`;

const SIGNATURE_FIELDS = `
  id, pcc, system_id AS "systemId", client_id AS "clientId",
  agent_name AS "agentName", agent_sign AS "agentSign", duty_code AS "dutyCode",
  permissions, status, issued_month_amount AS "issuedMonthAmount",
  created_date AS "createdDate", created_at AS "createdAt"`;

const CONTRACT_FIELDS = `
  id, client_id AS "clientId", contract_number AS "contractNumber",
  secop_url AS "secopUrl", object, total_amount AS "totalAmount",
  executed_amount AS "executedAmount", pending_billing AS "pendingBilling",
  start_date AS "startDate", end_date AS "endDate", stage,
  insurance_policy_status AS "insurancePolicyStatus",
  insurance_policy_number AS "insurancePolicyNumber",
  insurance_expiry AS "insuranceExpiry", milestone, created_at AS "createdAt"`;

const LEDGER_FIELDS = `
  id, client_id AS "clientId", invoice_number AS "invoiceNumber",
  issue_date AS "issueDate", due_date AS "dueDate", amount, status, notes,
  created_at AS "createdAt"`;

const HOTEL_FIELDS = `
  id, room_type AS "roomType", category, rack_rate AS "rackRate",
  b2b_agency_rate AS "b2bAgencyRate", capacity, status,
  current_guest_or_agency AS "currentGuestOrAgency"`;

const PACKAGE_FIELDS = `
  id, title, duration, public_price AS "publicPrice", b2b_price AS "b2bPrice",
  includes, daily_capacity_limit AS "dailyCapacityLimit",
  current_booked_today AS "currentBookedToday"`;

const BOOTSTRAP_SQL = `
  SELECT
    COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM
      (SELECT ${USER_FIELDS} FROM users WHERE $1::boolean ORDER BY created_at, id) item), '[]'::jsonb) AS users,
    COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM
      (SELECT ${CLIENT_FIELDS} FROM clients ORDER BY created_at DESC, id) item), '[]'::jsonb) AS clients,
    COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM
      (SELECT ${SYSTEM_FIELDS} FROM gds_systems ORDER BY name, id) item), '[]'::jsonb) AS systems,
    COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM
      (SELECT ${SIGNATURE_FIELDS} FROM signatures ORDER BY created_at DESC, id) item), '[]'::jsonb) AS signatures,
    COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM
      (SELECT ${CONTRACT_FIELDS} FROM public_contracts ORDER BY created_at DESC, id) item), '[]'::jsonb) AS contracts,
    COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM
      (SELECT ${LEDGER_FIELDS} FROM karing_ledger ORDER BY due_date, id) item), '[]'::jsonb) AS "karingLedger",
    COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM
      (SELECT ${HOTEL_FIELDS} FROM hotel_inventory ORDER BY room_type, id) item), '[]'::jsonb) AS "hotelInventory",
    COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM
      (SELECT ${PACKAGE_FIELDS} FROM reserve_packages ORDER BY title, id) item), '[]'::jsonb) AS "reservePackages",
    COALESCE((SELECT jsonb_object_agg(key, value) FROM system_settings), '{}'::jsonb) AS settings`;

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_MAX_ATTEMPTS = 5;
const publicLookupAttempts = new Map();
const PUBLIC_LOOKUP_WINDOW_MS = 60 * 1_000;
const PUBLIC_LOOKUP_MAX_REQUESTS = 30;
let dummyHashPromise;

function noStore(_request, response, next) {
  response.set("Cache-Control", "no-store");
  next();
}

function generatedId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function missingResource(resource) {
  return new HttpError(404, `${resource} no encontrado.`, "NOT_FOUND");
}

function updateStatement(table, id, updates, returningFields) {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  assertHasUpdates(updates);
  const values = entries.map(([, value]) => value);
  values.push(id);
  const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
  return {
    text: `UPDATE ${table} SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING ${returningFields}`,
    values
  };
}

function normalizeSettings(rawSettings = {}, { includeInfrastructure = false } = {}) {
  const rawKaring = rawSettings.karingConfig || {};
  const safeRules = {
    autoBlockDays: Number.isInteger(rawKaring.autoBlockDays) ? rawKaring.autoBlockDays : 30,
    autoSyncMinutes: Number.isInteger(rawKaring.autoSyncMinutes) ? rawKaring.autoSyncMinutes : 15,
    enableAutoBlock: rawKaring.enableAutoBlock !== false
  };
  return {
    karingConfig: {
      ...safeRules,
      ...(includeInfrastructure && {
        serverIp: typeof rawKaring.serverIp === "string" ? rawKaring.serverIp : "",
        apiKey: "",
        apiKeyConfigured: Boolean(rawKaring.apiKey)
      })
    },
    tierConfigs: Array.isArray(rawSettings.tierConfigs) ? rawSettings.tierConfigs : []
  };
}

async function loadSettings(client = pool, includeInfrastructure = false) {
  const result = await client.query(
    "SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) AS settings FROM system_settings"
  );
  return normalizeSettings(result.rows[0].settings, { includeInfrastructure });
}

function purgeLoginAttempts(now = Date.now()) {
  for (const [key, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(key);
  }
}

function loginAttemptKey(request, identifier) {
  return `${request.ip}|${identifier}`;
}

function assertLoginAllowed(request, identifier, response) {
  purgeLoginAttempts();
  const attempt = loginAttempts.get(loginAttemptKey(request, identifier));
  if (!attempt || attempt.count < LOGIN_MAX_ATTEMPTS) return;

  const retryAfterSeconds = Math.max(1, Math.ceil((attempt.resetAt - Date.now()) / 1_000));
  response.set("Retry-After", String(retryAfterSeconds));
  throw new HttpError(
    429,
    "Demasiados intentos de acceso. Intenta de nuevo más tarde.",
    "LOGIN_RATE_LIMITED"
  );
}

function recordLoginFailure(request, identifier) {
  const key = loginAttemptKey(request, identifier);
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    current.count += 1;
  }
}

function clearLoginFailures(request, identifier) {
  loginAttempts.delete(loginAttemptKey(request, identifier));
}

function consumePublicLookupQuota(request, response) {
  const now = Date.now();
  const key = request.ip;
  const current = publicLookupAttempts.get(key);

  if (!current || current.resetAt <= now) {
    publicLookupAttempts.set(key, { count: 1, resetAt: now + PUBLIC_LOOKUP_WINDOW_MS });
    return;
  }

  if (current.count >= PUBLIC_LOOKUP_MAX_REQUESTS) {
    response.set("Retry-After", String(Math.max(1, Math.ceil((current.resetAt - now) / 1_000))));
    throw new HttpError(
      429,
      "Se alcanzó el límite temporal de búsquedas.",
      "PUBLIC_LOOKUP_RATE_LIMITED"
    );
  }
  current.count += 1;

  if (publicLookupAttempts.size > 1_000) {
    for (const [attemptKey, attempt] of publicLookupAttempts) {
      if (attempt.resetAt <= now) publicLookupAttempts.delete(attemptKey);
    }
  }
}

function dummyPasswordHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash(randomBytes(24).toString("base64url"), 12);
  }
  return dummyHashPromise;
}

function parseLoginBody(request) {
  const body = ensureObject(request.body);
  const rawIdentifier = body.email ?? body.username ?? body.identifier;
  const identifier = identifierField({ identifier: rawIdentifier }, "identifier", { required: true });
  if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 128) {
    throw new HttpError(400, "Las credenciales no son válidas.", "INVALID_CREDENTIALS");
  }
  return { identifier, password: body.password };
}

function userUpdates(body, { create = false } = {}) {
  ensureObject(body);
  const role = enumField(body, "role", ROLES, { required: create });
  const roleLabel = stringField(body, "roleLabel", { max: 100 });
  return {
    name: stringField(body, "name", { required: create, min: 2, max: 150 }),
    email: identifierField(body, "email", { required: create, max: 150 }),
    role,
    role_label: roleLabel ?? (role ? roleLabels[role] : undefined),
    status: enumField(body, "status", USER_STATUSES),
    department: stringField(body, "department", { max: 100, allowNull: true }),
    avatar_color: colorField(body, "avatarColor")
  };
}

function clientUpdates(body, { create = false } = {}) {
  ensureObject(body);
  return {
    name: stringField(body, "name", { required: create, min: 2, max: 200 }),
    type: enumField(body, "type", CLIENT_TYPES, { required: create }),
    nit: stringField(body, "nit", { required: create, min: 3, max: 50 }),
    iata_code: stringField(body, "iataCode", { max: 50, allowNull: true }),
    tier: enumField(body, "tier", CLIENT_TIERS),
    status: enumField(body, "status", CLIENT_STATUSES),
    city: stringField(body, "city", { max: 100, allowNull: true }),
    address: stringField(body, "address", { max: 255, allowNull: true }),
    phone: stringField(body, "phone", { max: 50, allowNull: true }),
    credit_limit: numberField(body, "creditLimit", { min: 0, max: 999_999_999_999 }),
    owner_json: jsonObjectField(body, "owner"),
    accounts_payable_json: jsonObjectField(body, "accountsPayable"),
    operational_counter_json: jsonObjectField(body, "operationalCounter")
  };
}

function systemUpdates(body, { create = false } = {}) {
  ensureObject(body);
  return {
    name: stringField(body, "name", { required: create, min: 2, max: 100 }),
    category: stringField(body, "category", { required: create, min: 2, max: 50 }),
    code: stringField(body, "code", {
      required: create,
      min: 1,
      max: 20,
      normalize: (value) => value.toUpperCase()
    }),
    color: colorField(body, "color")
  };
}

function contractUpdates(body, { create = false } = {}) {
  ensureObject(body);
  return {
    client_id: stringField(body, "clientId", { required: create, min: 1, max: 50 }),
    contract_number: stringField(body, "contractNumber", {
      required: create,
      min: 2,
      max: 100
    }),
    secop_url: urlField(body, "secopUrl"),
    object: stringField(body, "object", { required: create, min: 5, max: 10_000 }),
    total_amount: numberField(body, "totalAmount", {
      required: create,
      min: 0,
      max: 999_999_999_999
    }),
    executed_amount: numberField(body, "executedAmount", { min: 0, max: 999_999_999_999 }),
    pending_billing: numberField(body, "pendingBilling", { min: 0, max: 999_999_999_999 }),
    start_date: dateField(body, "startDate"),
    end_date: dateField(body, "endDate"),
    stage: stringField(body, "stage", { max: 50 }),
    insurance_policy_status: stringField(body, "insurancePolicyStatus", { max: 50 }),
    insurance_policy_number: stringField(body, "insurancePolicyNumber", {
      max: 100,
      allowNull: true
    }),
    insurance_expiry: dateField(body, "insuranceExpiry"),
    milestone: stringField(body, "milestone", { max: 5_000, allowNull: true })
  };
}

function validateTierConfigs(rawTierConfigs) {
  const items = arrayField({ tierConfigs: rawTierConfigs }, "tierConfigs", { required: true, max: 20 });
  const seenIds = new Set();
  return items.map((rawItem, index) => {
    const item = ensureObject(rawItem, `tierConfigs[${index}]`);
    const id = enumField(item, "id", CLIENT_TIERS, { required: true });
    if (seenIds.has(id)) {
      throw new HttpError(400, `El tier '${id}' está repetido.`, "VALIDATION_ERROR");
    }
    seenIds.add(id);
    return {
      id,
      name: stringField(item, "name", { required: true, min: 2, max: 100 }),
      defaultLimit: numberField(item, "defaultLimit", {
        required: true,
        min: 0,
        max: 999_999_999_999
      }),
      hotelDiscount: numberField(item, "hotelDiscount", { required: true, min: 0, max: 100 }),
      reserveDiscount: numberField(item, "reserveDiscount", { required: true, min: 0, max: 100 })
    };
  });
}

apiRouter.get(
  "/health",
  asyncRoute(async (_request, response) => {
    response.set("Cache-Control", "no-store");
    try {
      await pool.query("SELECT 1");
      response.json({ status: "ok", api: "ok", database: "ok" });
    } catch {
      response.status(503).json({ status: "degraded", api: "ok", database: "unavailable" });
    }
  })
);

apiRouter.use("/auth", noStore);

apiRouter.post(
  "/auth/login",
  asyncRoute(async (request, response) => {
    const { identifier, password } = parseLoginBody(request);
    assertLoginAllowed(request, identifier, response);

    const result = await pool.query(
      `SELECT ${USER_FIELDS}, password_hash AS "passwordHash"
       FROM users
       WHERE LOWER(email) = $1 OR LOWER(id) = $1
       LIMIT 1`,
      [identifier]
    );
    const user = result.rows[0];
    const validHash = user && /^\$2[aby]\$\d{2}\$/.test(user.passwordHash);
    const passwordMatches = validHash
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, await dummyPasswordHash());

    if (!user || !passwordMatches || user.status !== "ACTIVE") {
      recordLoginFailure(request, identifier);
      throw new HttpError(401, "Usuario o contraseña inválidos.", "INVALID_CREDENTIALS");
    }

    clearLoginFailures(request, identifier);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    const session = createSession(safeUser);
    response.json({ success: true, ...session, user: safeUser });
  })
);

apiRouter.post("/auth/logout", requireAuth, (request, response) => {
  revokeToken(tokenFromRequest(request));
  response.json({ success: true });
});

apiRouter.put(
  "/auth/password",
  requireAuth,
  asyncRoute(async (request, response) => {
    const body = ensureObject(request.body);
    if (typeof body.currentPassword !== "string" || body.currentPassword.length > 128) {
      throw new HttpError(400, "La contraseña actual no es válida.", "VALIDATION_ERROR");
    }
    const newPassword = assertPassword(body.newPassword);
    if (body.currentPassword === newPassword) {
      throw new HttpError(400, "La nueva contraseña debe ser diferente.", "WEAK_PASSWORD");
    }

    const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [
      request.auth.user.id
    ]);
    const passwordHash = result.rows[0]?.password_hash;
    const validHash = typeof passwordHash === "string" && /^\$2[aby]\$\d{2}\$/.test(passwordHash);
    if (!validHash || !(await bcrypt.compare(body.currentPassword, passwordHash))) {
      throw new HttpError(401, "La contraseña actual es incorrecta.", "INVALID_CREDENTIALS");
    }

    const rounds = Number.parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
    const nextHash = await bcrypt.hash(newPassword, Number.isInteger(rounds) ? rounds : 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      nextHash,
      request.auth.user.id
    ]);
    revokeUserSessions(request.auth.user.id, request.auth.digest);
    response.json({ success: true });
  })
);

apiRouter.get(
  "/public/client-lookup",
  noStore,
  asyncRoute(async (request, response) => {
    consumePublicLookupQuota(request, response);
    const query = stringField({ q: request.query.q }, "q", { required: true, min: 3, max: 120 });
    const normalizedQuery = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

    if (normalizedQuery.length < 3) {
      throw new HttpError(400, "La búsqueda debe incluir al menos 3 letras o números.", "VALIDATION_ERROR");
    }

    const result = await pool.query(
      `WITH signature_matches AS (
         SELECT
           signature.client_id,
           BOOL_OR(STRPOS(planetour_normalize_search(signature.pcc), $1) > 0) AS pcc_match,
           BOOL_OR(STRPOS(planetour_normalize_search(signature.agent_name), $1) > 0) AS agent_name_match,
           BOOL_OR(STRPOS(planetour_normalize_search(signature.agent_sign), $1) > 0) AS agent_sign_match,
           BOOL_OR(STRPOS(planetour_normalize_search(system.name), $1) > 0) AS system_name_match,
           BOOL_OR(STRPOS(planetour_normalize_search(system.code), $1) > 0) AS system_code_match
         FROM signatures signature
         JOIN gds_systems system ON system.id = signature.system_id
         WHERE STRPOS(planetour_normalize_search(signature.pcc), $1) > 0
            OR STRPOS(planetour_normalize_search(signature.agent_name), $1) > 0
            OR STRPOS(planetour_normalize_search(signature.agent_sign), $1) > 0
            OR STRPOS(planetour_normalize_search(system.name), $1) > 0
            OR STRPOS(planetour_normalize_search(system.code), $1) > 0
         GROUP BY signature.client_id
       ), matched_clients AS (
         SELECT
           c.*,
           array_remove(ARRAY[
             CASE WHEN STRPOS(planetour_normalize_search(c.name), $1) > 0 THEN 'name' END,
             CASE WHEN STRPOS(planetour_normalize_search(c.type), $1) > 0 THEN 'type' END,
             CASE WHEN STRPOS(planetour_normalize_search(c.nit), $1) > 0 THEN 'nit' END,
             CASE WHEN STRPOS(planetour_normalize_search(c.iata_code), $1) > 0 THEN 'iataCode' END,
             CASE WHEN STRPOS(planetour_normalize_search(c.city), $1) > 0 THEN 'city' END,
             CASE WHEN STRPOS(planetour_normalize_search(c.address), $1) > 0 THEN 'address' END,
             CASE WHEN STRPOS(planetour_normalize_search(c.phone), $1) > 0 THEN 'phone' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.owner_json ->> 'name', c.owner_json ->> 'nombre', '')
             ), $1) > 0 THEN 'owner.name' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.owner_json ->> 'email', c.owner_json ->> 'correo', '')
             ), $1) > 0 THEN 'owner.email' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.owner_json ->> 'phone', c.owner_json ->> 'telefono',
                        c.owner_json ->> 'cell', c.owner_json ->> 'celular',
                        c.owner_json ->> 'whatsapp', '')
             ), $1) > 0 THEN 'owner.phone' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.accounts_payable_json ->> 'name', c.accounts_payable_json ->> 'nombre', '')
             ), $1) > 0 THEN 'accountsPayable.name' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.accounts_payable_json ->> 'email', c.accounts_payable_json ->> 'correo', '')
             ), $1) > 0 THEN 'accountsPayable.email' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.accounts_payable_json ->> 'phone', c.accounts_payable_json ->> 'telefono',
                        c.accounts_payable_json ->> 'cell', c.accounts_payable_json ->> 'celular',
                        c.accounts_payable_json ->> 'whatsapp', '')
             ), $1) > 0 THEN 'accountsPayable.phone' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.operational_counter_json ->> 'name', c.operational_counter_json ->> 'nombre', '')
             ), $1) > 0 THEN 'operationalCounter.name' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.operational_counter_json ->> 'email', c.operational_counter_json ->> 'correo', '')
             ), $1) > 0 THEN 'operationalCounter.email' END,
             CASE WHEN STRPOS(planetour_normalize_search(
               COALESCE(c.operational_counter_json ->> 'phone', c.operational_counter_json ->> 'telefono',
                        c.operational_counter_json ->> 'cell', c.operational_counter_json ->> 'celular',
                        c.operational_counter_json ->> 'whatsapp', '')
             ), $1) > 0 THEN 'operationalCounter.phone' END,
             CASE WHEN signature_match.pcc_match THEN 'signatures.pcc' END,
             CASE WHEN signature_match.agent_name_match THEN 'signatures.agentName' END,
             CASE WHEN signature_match.agent_sign_match THEN 'signatures.agentSign' END,
             CASE WHEN signature_match.system_name_match THEN 'signatures.systemName' END,
             CASE WHEN signature_match.system_code_match THEN 'signatures.systemCode' END
           ], NULL) AS matched_fields
         FROM clients c
         LEFT JOIN signature_matches signature_match ON signature_match.client_id = c.id
         WHERE STRPOS(planetour_normalize_search(
           c.name || ' ' || c.type || ' ' || c.nit || ' ' || COALESCE(c.iata_code, '') || ' ' ||
           COALESCE(c.city, '') || ' ' || COALESCE(c.address, '') || ' ' || COALESCE(c.phone, '') || ' ' ||
           COALESCE(c.owner_json ->> 'name', c.owner_json ->> 'nombre', '') || ' ' ||
           COALESCE(c.owner_json ->> 'email', c.owner_json ->> 'correo', '') || ' ' ||
           COALESCE(c.owner_json ->> 'phone', c.owner_json ->> 'telefono',
                    c.owner_json ->> 'cell', c.owner_json ->> 'celular',
                    c.owner_json ->> 'whatsapp', '') || ' ' ||
           COALESCE(c.accounts_payable_json ->> 'name', c.accounts_payable_json ->> 'nombre', '') || ' ' ||
           COALESCE(c.accounts_payable_json ->> 'email', c.accounts_payable_json ->> 'correo', '') || ' ' ||
           COALESCE(c.accounts_payable_json ->> 'phone', c.accounts_payable_json ->> 'telefono',
                    c.accounts_payable_json ->> 'cell', c.accounts_payable_json ->> 'celular',
                    c.accounts_payable_json ->> 'whatsapp', '') || ' ' ||
           COALESCE(c.operational_counter_json ->> 'name', c.operational_counter_json ->> 'nombre', '') || ' ' ||
           COALESCE(c.operational_counter_json ->> 'email', c.operational_counter_json ->> 'correo', '') || ' ' ||
           COALESCE(c.operational_counter_json ->> 'phone', c.operational_counter_json ->> 'telefono',
                    c.operational_counter_json ->> 'cell', c.operational_counter_json ->> 'celular',
                    c.operational_counter_json ->> 'whatsapp', '')
         ), $1) > 0
         OR signature_match.client_id IS NOT NULL
         ORDER BY
           CASE
             WHEN planetour_normalize_search(c.name) = $1 THEN 0
             WHEN STRPOS(planetour_normalize_search(c.name), $1) = 1 THEN 1
             ELSE 2
           END,
           c.name,
           c.id
         LIMIT 12
       ), signature_data AS (
         SELECT
           signature.client_id,
           jsonb_agg(jsonb_build_object(
             'id', signature.id,
             'pcc', signature.pcc,
             'agentName', signature.agent_name,
             'agentSign', signature.agent_sign,
             'status', signature.status,
             'systemId', system.id,
             'systemName', system.name,
             'systemCode', system.code
           ) ORDER BY system.name, signature.pcc) AS signatures
         FROM signatures signature
         JOIN gds_systems system ON system.id = signature.system_id
         JOIN matched_clients client ON client.id = signature.client_id
         GROUP BY signature.client_id
       )
       SELECT
         client.id,
         client.name,
         client.type,
         client.nit,
         client.iata_code AS "iataCode",
         client.city,
         client.address,
         client.phone,
         jsonb_strip_nulls(jsonb_build_object(
           'name', COALESCE(client.owner_json ->> 'name', client.owner_json ->> 'nombre'),
           'email', COALESCE(client.owner_json ->> 'email', client.owner_json ->> 'correo'),
           'phone', COALESCE(client.owner_json ->> 'phone', client.owner_json ->> 'telefono',
                             client.owner_json ->> 'cell', client.owner_json ->> 'celular',
                             client.owner_json ->> 'whatsapp')
         )) AS owner,
         jsonb_strip_nulls(jsonb_build_object(
           'name', COALESCE(client.accounts_payable_json ->> 'name', client.accounts_payable_json ->> 'nombre'),
           'email', COALESCE(client.accounts_payable_json ->> 'email', client.accounts_payable_json ->> 'correo'),
           'phone', COALESCE(client.accounts_payable_json ->> 'phone', client.accounts_payable_json ->> 'telefono',
                             client.accounts_payable_json ->> 'cell', client.accounts_payable_json ->> 'celular',
                             client.accounts_payable_json ->> 'whatsapp')
         )) AS "accountsPayable",
         jsonb_strip_nulls(jsonb_build_object(
           'name', COALESCE(client.operational_counter_json ->> 'name', client.operational_counter_json ->> 'nombre'),
           'email', COALESCE(client.operational_counter_json ->> 'email', client.operational_counter_json ->> 'correo'),
           'phone', COALESCE(client.operational_counter_json ->> 'phone', client.operational_counter_json ->> 'telefono',
                             client.operational_counter_json ->> 'cell', client.operational_counter_json ->> 'celular',
                             client.operational_counter_json ->> 'whatsapp')
         )) AS "operationalCounter",
         COALESCE(signature_data.signatures, '[]'::jsonb) AS signatures,
         client.matched_fields AS "matchedFields"
       FROM matched_clients client
       LEFT JOIN signature_data ON signature_data.client_id = client.id
       ORDER BY
         CASE
           WHEN planetour_normalize_search(client.name) = $1 THEN 0
           WHEN STRPOS(planetour_normalize_search(client.name), $1) = 1 THEN 1
           ELSE 2
         END,
         client.name,
         client.id`,
      [normalizedQuery]
    );

    response.json({ results: result.rows });
  })
);

apiRouter.use(noStore, requireAuth);

apiRouter.get(
  "/bootstrap",
  noStore,
  asyncRoute(async (request, response) => {
    const result = await pool.query(BOOTSTRAP_SQL, [request.auth.user.role === "SUPERADMIN"]);
    const payload = result.rows[0];
    if (request.auth.user.role !== "SUPERADMIN") payload.users = [];
    payload.settings = normalizeSettings(payload.settings, {
      includeInfrastructure: request.auth.user.role === "SUPERADMIN"
    });
    response.json(payload);
  })
);

apiRouter.get(
  "/users",
  requireSuperadmin,
  asyncRoute(async (_request, response) => {
    const result = await pool.query(`SELECT ${USER_FIELDS} FROM users ORDER BY created_at, id`);
    response.json(result.rows);
  })
);

apiRouter.post(
  "/users",
  requireSuperadmin,
  asyncRoute(async (request, response) => {
    const updates = userUpdates(request.body, { create: true });
    const suppliedPassword = request.body.password;
    let temporaryPassword;
    let password;
    if (suppliedPassword === undefined || suppliedPassword === "") {
      temporaryPassword = `Tmp9-${randomBytes(15).toString("base64url")}`;
      password = temporaryPassword;
    } else {
      password = assertPassword(suppliedPassword, "password");
    }

    const rounds = Number.parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
    const passwordHash = await bcrypt.hash(password, Number.isInteger(rounds) ? rounds : 12);
    const result = await pool.query(
      `INSERT INTO users
         (id, name, email, password_hash, role, role_label, status, department, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${USER_FIELDS}`,
      [
        generatedId("USR"),
        updates.name,
        updates.email,
        passwordHash,
        updates.role,
        updates.role_label,
        updates.status || "ACTIVE",
        updates.department ?? null,
        updates.avatar_color || "#6366f1"
      ]
    );

    response.status(201).json({ ...result.rows[0], ...(temporaryPassword && { temporaryPassword }) });
  })
);

apiRouter.put(
  "/users/:id",
  requireSuperadmin,
  asyncRoute(async (request, response) => {
    const id = idParameter(request.params.id);
    const updates = userUpdates(request.body);
    assertHasUpdates(updates);
    const client = await pool.connect();
    let updatedUser;

    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT role, status FROM users WHERE id = $1 FOR UPDATE", [id]);
      if (existing.rowCount === 0) throw missingResource("Usuario");

      const current = existing.rows[0];
      const nextRole = updates.role ?? current.role;
      const nextStatus = updates.status ?? current.status;
      if (current.role === "SUPERADMIN" && current.status === "ACTIVE" &&
          (nextRole !== "SUPERADMIN" || nextStatus !== "ACTIVE")) {
        const remaining = await client.query(
          "SELECT COUNT(*)::int AS count FROM users WHERE role = 'SUPERADMIN' AND status = 'ACTIVE' AND id <> $1",
          [id]
        );
        if (remaining.rows[0].count === 0) {
          throw new HttpError(
            409,
            "Debe permanecer al menos un superadministrador activo.",
            "LAST_SUPERADMIN"
          );
        }
      }

      const result = await client.query(updateStatement("users", id, updates, USER_FIELDS));
      updatedUser = result.rows[0];
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    updateUserSessions(updatedUser);
    response.json(updatedUser);
  })
);

apiRouter.delete(
  "/users/:id",
  requireSuperadmin,
  asyncRoute(async (request, response) => {
    const id = idParameter(request.params.id);
    if (request.auth.user.id === id) {
      throw new HttpError(409, "No puedes eliminar tu propia sesión activa.", "SELF_DELETE");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT role, status FROM users WHERE id = $1 FOR UPDATE", [id]);
      if (existing.rowCount === 0) throw missingResource("Usuario");
      if (existing.rows[0].role === "SUPERADMIN" && existing.rows[0].status === "ACTIVE") {
        const remaining = await client.query(
          "SELECT COUNT(*)::int AS count FROM users WHERE role = 'SUPERADMIN' AND status = 'ACTIVE' AND id <> $1",
          [id]
        );
        if (remaining.rows[0].count === 0) {
          throw new HttpError(
            409,
            "Debe permanecer al menos un superadministrador activo.",
            "LAST_SUPERADMIN"
          );
        }
      }
      await client.query("DELETE FROM users WHERE id = $1", [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    revokeUserSessions(id);
    response.json({ success: true });
  })
);

apiRouter.get(
  "/clients",
  asyncRoute(async (_request, response) => {
    const result = await pool.query(`SELECT ${CLIENT_FIELDS} FROM clients ORDER BY created_at DESC, id`);
    response.json(result.rows);
  })
);

apiRouter.post(
  "/clients",
  requireWritable,
  asyncRoute(async (request, response) => {
    const updates = clientUpdates(request.body, { create: true });
    const result = await pool.query(
      `INSERT INTO clients
         (id, name, type, nit, iata_code, tier, status, city, address, phone,
          credit_limit, owner_json, accounts_payable_json, operational_counter_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING ${CLIENT_FIELDS}`,
      [
        generatedId("CLI"), updates.name, updates.type, updates.nit,
        updates.iata_code ?? null, updates.tier || "GOLD", updates.status || "ACTIVE",
        updates.city ?? null, updates.address ?? null, updates.phone ?? null,
        updates.credit_limit ?? 0, updates.owner_json ?? null,
        updates.accounts_payable_json ?? null, updates.operational_counter_json ?? null
      ]
    );
    response.status(201).json(result.rows[0]);
  })
);

apiRouter.put(
  "/clients/:id",
  requireWritable,
  asyncRoute(async (request, response) => {
    const id = idParameter(request.params.id);
    const updates = clientUpdates(request.body);
    const result = await pool.query(updateStatement("clients", id, updates, CLIENT_FIELDS));
    if (result.rowCount === 0) throw missingResource("Cliente");
    response.json(result.rows[0]);
  })
);

apiRouter.get(
  "/systems",
  asyncRoute(async (_request, response) => {
    const result = await pool.query(`SELECT ${SYSTEM_FIELDS} FROM gds_systems ORDER BY name, id`);
    response.json(result.rows);
  })
);

apiRouter.post(
  "/systems",
  requireWritable,
  asyncRoute(async (request, response) => {
    const updates = systemUpdates(request.body, { create: true });
    const result = await pool.query(
      `INSERT INTO gds_systems (id, name, category, code, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SYSTEM_FIELDS}`,
      [generatedId("SYS"), updates.name, updates.category, updates.code, updates.color || "#6366f1"]
    );
    response.status(201).json(result.rows[0]);
  })
);

apiRouter.put(
  "/systems/:id",
  requireWritable,
  asyncRoute(async (request, response) => {
    const id = idParameter(request.params.id);
    const updates = systemUpdates(request.body);
    const result = await pool.query(updateStatement("gds_systems", id, updates, SYSTEM_FIELDS));
    if (result.rowCount === 0) throw missingResource("Sistema");
    response.json(result.rows[0]);
  })
);

apiRouter.delete(
  "/systems/:id",
  requireWritable,
  asyncRoute(async (request, response) => {
    const id = idParameter(request.params.id);
    const client = await pool.connect();
    let deletedSignatures = 0;
    try {
      await client.query("BEGIN");
      const count = await client.query(
        "SELECT COUNT(*)::int AS count FROM signatures WHERE system_id = $1",
        [id]
      );
      const deleted = await client.query("DELETE FROM gds_systems WHERE id = $1 RETURNING id", [id]);
      if (deleted.rowCount === 0) throw missingResource("Sistema");
      deletedSignatures = count.rows[0].count;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    response.json({ success: true, deletedSignatures });
  })
);

apiRouter.get(
  "/signatures",
  asyncRoute(async (_request, response) => {
    const result = await pool.query(
      `SELECT ${SIGNATURE_FIELDS} FROM signatures ORDER BY created_at DESC, id`
    );
    response.json(result.rows);
  })
);

apiRouter.post(
  "/signatures",
  requireSignatureWrite,
  asyncRoute(async (request, response) => {
    const body = ensureObject(request.body);
    const values = {
      pcc: stringField(body, "pcc", { required: true, min: 1, max: 50 }),
      systemId: stringField(body, "systemId", { required: true, min: 1, max: 50 }),
      clientId: stringField(body, "clientId", { required: true, min: 1, max: 50 }),
      agentName: stringField(body, "agentName", { required: true, min: 2, max: 150 }),
      agentSign: stringField(body, "agentSign", { max: 50, allowNull: true }),
      dutyCode: stringField(body, "dutyCode", { max: 20 }),
      permissions: stringField(body, "permissions", { max: 150, allowNull: true })
    };
    const result = await pool.query(
      `INSERT INTO signatures
         (id, pcc, system_id, client_id, agent_name, agent_sign, duty_code, permissions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SIGNATURE_FIELDS}`,
      [
        generatedId("SIG"), values.pcc, values.systemId, values.clientId, values.agentName,
        values.agentSign ?? null, values.dutyCode || "SU", values.permissions ?? null
      ]
    );
    response.status(201).json(result.rows[0]);
  })
);

apiRouter.patch(
  "/signatures/:id/status",
  requireSignatureWrite,
  asyncRoute(async (request, response) => {
    const id = idParameter(request.params.id);
    const body = ensureObject(request.body);
    const status = enumField(body, "status", SIGNATURE_STATUSES, { required: true });
    const result = await pool.query(
      `UPDATE signatures SET status = $1 WHERE id = $2 RETURNING ${SIGNATURE_FIELDS}`,
      [status, id]
    );
    if (result.rowCount === 0) throw missingResource("Firma GDS");
    response.json(result.rows[0]);
  })
);

apiRouter.get(
  "/contracts",
  asyncRoute(async (_request, response) => {
    const result = await pool.query(
      `SELECT ${CONTRACT_FIELDS} FROM public_contracts ORDER BY created_at DESC, id`
    );
    response.json(result.rows);
  })
);

apiRouter.post(
  "/contracts",
  requireWritable,
  asyncRoute(async (request, response) => {
    const updates = contractUpdates(request.body, { create: true });
    if (updates.start_date && updates.end_date && updates.end_date < updates.start_date) {
      throw new HttpError(400, "La fecha final no puede ser anterior a la fecha inicial.", "VALIDATION_ERROR");
    }
    const result = await pool.query(
      `INSERT INTO public_contracts
         (id, client_id, contract_number, secop_url, object, total_amount,
          executed_amount, pending_billing, start_date, end_date, stage,
          insurance_policy_status, insurance_policy_number, insurance_expiry, milestone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING ${CONTRACT_FIELDS}`,
      [
        generatedId("CON"), updates.client_id, updates.contract_number, updates.secop_url ?? null,
        updates.object, updates.total_amount, updates.executed_amount ?? 0,
        updates.pending_billing ?? 0, updates.start_date ?? null, updates.end_date ?? null,
        updates.stage || "EN_EJECUCION", updates.insurance_policy_status || "VIGENTE",
        updates.insurance_policy_number ?? null, updates.insurance_expiry ?? null,
        updates.milestone ?? null
      ]
    );
    response.status(201).json(result.rows[0]);
  })
);

apiRouter.put(
  "/contracts/:id",
  requireWritable,
  asyncRoute(async (request, response) => {
    const id = idParameter(request.params.id);
    const updates = contractUpdates(request.body);
    if (updates.start_date && updates.end_date && updates.end_date < updates.start_date) {
      throw new HttpError(400, "La fecha final no puede ser anterior a la fecha inicial.", "VALIDATION_ERROR");
    }
    const result = await pool.query(
      updateStatement("public_contracts", id, updates, CONTRACT_FIELDS)
    );
    if (result.rowCount === 0) throw missingResource("Contrato");
    response.json(result.rows[0]);
  })
);

apiRouter.delete(
  "/contracts/:id",
  requireWritable,
  asyncRoute(async (request, response) => {
    const id = idParameter(request.params.id);
    const result = await pool.query("DELETE FROM public_contracts WHERE id = $1 RETURNING id", [id]);
    if (result.rowCount === 0) throw missingResource("Contrato");
    response.json({ success: true });
  })
);

apiRouter.get(
  "/karing-ledger",
  asyncRoute(async (_request, response) => {
    const result = await pool.query(
      `SELECT ${LEDGER_FIELDS} FROM karing_ledger ORDER BY due_date, id`
    );
    response.json(result.rows);
  })
);

apiRouter.get(
  "/hotel-inventory",
  asyncRoute(async (_request, response) => {
    const result = await pool.query(
      `SELECT ${HOTEL_FIELDS} FROM hotel_inventory ORDER BY room_type, id`
    );
    response.json(result.rows);
  })
);

apiRouter.get(
  "/reserve-packages",
  asyncRoute(async (_request, response) => {
    const result = await pool.query(
      `SELECT ${PACKAGE_FIELDS} FROM reserve_packages ORDER BY title, id`
    );
    response.json(result.rows);
  })
);

apiRouter.get(
  "/settings",
  requireSuperadmin,
  noStore,
  asyncRoute(async (_request, response) => {
    response.json(await loadSettings(pool, true));
  })
);

apiRouter.put(
  "/settings",
  requireSuperadmin,
  noStore,
  asyncRoute(async (request, response) => {
    const body = ensureObject(request.body);
    const rawKaringConfig = body.karingConfig;
    const rawTierConfigs = body.tierConfigs;
    if (rawKaringConfig === undefined && rawTierConfigs === undefined) {
      throw new HttpError(400, "No se enviaron ajustes para actualizar.", "VALIDATION_ERROR");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (rawKaringConfig !== undefined) {
        const config = ensureObject(rawKaringConfig, "karingConfig");
        const existingResult = await client.query(
          "SELECT value FROM system_settings WHERE key = 'karingConfig' FOR UPDATE"
        );
        const existing = existingResult.rows[0]?.value || {};
        const apiKey = stringField(config, "apiKey", { max: 500, allowNull: true });
        const nextConfig = {
          ...existing,
          ...Object.fromEntries(
            Object.entries({
              serverIp: stringField(config, "serverIp", { max: 255 }),
              autoBlockDays: integerField(config, "autoBlockDays", { min: 0, max: 365 }),
              autoSyncMinutes: integerField(config, "autoSyncMinutes", { min: 1, max: 1_440 }),
              enableAutoBlock: booleanField(config, "enableAutoBlock")
            }).filter(([, value]) => value !== undefined)
          )
        };
        if (apiKey === null) nextConfig.apiKey = "";
        if (apiKey) nextConfig.apiKey = apiKey;

        await client.query(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ('karingConfig', $1::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [JSON.stringify(nextConfig)]
        );
      }

      if (rawTierConfigs !== undefined) {
        const tierConfigs = validateTierConfigs(rawTierConfigs);
        await client.query(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ('tierConfigs', $1::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [JSON.stringify(tierConfigs)]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    response.json(await loadSettings(pool, true));
  })
);

apiRouter.post(
  "/karing/sync",
  requireKaringWrite,
  noStore,
  asyncRoute(async (_request, response) => {
    const client = await pool.connect();
    let clients;
    try {
      await client.query("BEGIN");
      const configResult = await client.query(
        "SELECT value FROM system_settings WHERE key = 'karingConfig'"
      );
      const config = configResult.rows[0]?.value || {};
      const autoBlockDays = Number.isInteger(config.autoBlockDays) ? config.autoBlockDays : 30;
      const enableAutoBlock = config.enableAutoBlock !== false;

      const result = await client.query(
        `WITH ledger_totals AS (
           SELECT
             c.id,
             COALESCE(SUM(l.amount) FILTER (
               WHERE UPPER(COALESCE(l.status, '')) NOT IN ('PAID', 'PAGADA', 'CANCELLED', 'ANULADA')
             ), 0) AS balance,
             COALESCE(MAX(CASE
               WHEN l.due_date < CURRENT_DATE
                AND UPPER(COALESCE(l.status, '')) NOT IN ('PAID', 'PAGADA', 'CANCELLED', 'ANULADA')
               THEN CURRENT_DATE - l.due_date
               ELSE 0
             END), 0) AS overdue_days
           FROM clients c
           LEFT JOIN karing_ledger l ON l.client_id = c.id
           GROUP BY c.id
         ), updated AS (
           UPDATE clients c
           SET
             karing_balance = totals.balance,
             overdue_days = totals.overdue_days,
             status = CASE
               WHEN c.status = 'INACTIVE' THEN 'INACTIVE'
               WHEN totals.overdue_days = 0 THEN 'ACTIVE'
               WHEN $1::boolean AND totals.overdue_days > $2::integer THEN 'BLOCKED'
               ELSE 'WARNING'
             END
           FROM ledger_totals totals
           WHERE c.id = totals.id
           RETURNING ${QUALIFIED_CLIENT_FIELDS}
         )
         SELECT * FROM updated ORDER BY "createdAt" DESC, id`,
        [enableAutoBlock, autoBlockDays]
      );
      clients = result.rows;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    response.json({ success: true, updated: clients.length, clients });
  })
);
