import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "./validation.js";

const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1_000;
const sessions = new Map();

function sessionTtl() {
  const configured = Number.parseInt(process.env.SESSION_TTL_MINUTES || "", 10);
  if (!Number.isInteger(configured) || configured < 15 || configured > 10_080) {
    return DEFAULT_SESSION_TTL_MS;
  }
  return configured * 60 * 1_000;
}

function digestToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function purgeExpiredSessions(now = Date.now()) {
  for (const [digest, session] of sessions) {
    if (session.expiresAtMs <= now) sessions.delete(digest);
  }
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: user.roleLabel ?? user.role_label,
    status: user.status,
    department: user.department,
    avatarColor: user.avatarColor ?? user.avatar_color
  };
}

export function createSession(user) {
  purgeExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const expiresAtMs = Date.now() + sessionTtl();
  sessions.set(digestToken(token), {
    user: publicUser(user),
    expiresAtMs
  });

  return { token, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function revokeToken(token) {
  if (typeof token === "string" && token) sessions.delete(digestToken(token));
}

export function revokeUserSessions(userId, exceptDigest) {
  for (const [digest, session] of sessions) {
    if (session.user.id === userId && digest !== exceptDigest) sessions.delete(digest);
  }
}

export function updateUserSessions(user) {
  const normalizedUser = publicUser(user);
  for (const [digest, session] of sessions) {
    if (session.user.id !== normalizedUser.id) continue;
    if (normalizedUser.status !== "ACTIVE") {
      sessions.delete(digest);
    } else {
      session.user = normalizedUser;
    }
  }
}

export function revokeAllSessions() {
  sessions.clear();
}

function bearerToken(request) {
  const authorization = request.get("authorization");
  if (!authorization) return null;
  const match = /^Bearer\s+([A-Za-z0-9_-]{43})$/.exec(authorization);
  return match?.[1] || null;
}

export function requireAuth(request, _response, next) {
  const token = bearerToken(request);
  if (!token) {
    return next(new HttpError(401, "Se requiere una sesión válida.", "AUTH_REQUIRED"));
  }

  purgeExpiredSessions();
  const digest = digestToken(token);
  const session = sessions.get(digest);
  if (!session) {
    return next(new HttpError(401, "La sesión es inválida o expiró.", "INVALID_SESSION"));
  }

  request.auth = { token, digest, user: session.user, expiresAtMs: session.expiresAtMs };
  next();
}

export function requireWritable(request, _response, next) {
  if (!["SUPERADMIN", "ADMIN"].includes(request.auth.user.role)) {
    return next(
      new HttpError(
        403,
        "Esta operación requiere rol SUPERADMIN o ADMIN.",
        "INSUFFICIENT_ROLE"
      )
    );
  }
  next();
}

export function requireSignatureWrite(request, _response, next) {
  if (!["SUPERADMIN", "ADMIN", "COUNTER"].includes(request.auth.user.role)) {
    return next(
      new HttpError(
        403,
        "La gestión de firmas requiere rol SUPERADMIN, ADMIN o COUNTER.",
        "INSUFFICIENT_ROLE"
      )
    );
  }
  next();
}

export function requireKaringWrite(request, _response, next) {
  if (!["SUPERADMIN", "ADMIN", "FINANCE"].includes(request.auth.user.role)) {
    return next(
      new HttpError(
        403,
        "La sincronización de cartera requiere rol SUPERADMIN, ADMIN o FINANCE.",
        "INSUFFICIENT_ROLE"
      )
    );
  }
  next();
}

export function requireSuperadmin(request, _response, next) {
  if (request.auth.user.role !== "SUPERADMIN") {
    return next(
      new HttpError(403, "Esta operación requiere rol SUPERADMIN.", "INSUFFICIENT_ROLE")
    );
  }
  next();
}

export function tokenFromRequest(request) {
  return bearerToken(request);
}
