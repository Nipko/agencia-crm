import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { apiRouter } from "./api.js";
import { checkDatabaseConnection, closeDatabase, pool } from "./db.js";
import { initializeDatabase } from "./initDb.js";
import { HttpError, asyncRoute } from "./validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDirectory = path.resolve(__dirname, "..", "dist");
const spaEntry = path.join(distDirectory, "index.html");

function portFromEnvironment() {
  const port = Number.parseInt(process.env.PORT || "4000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT debe ser un entero entre 1 y 65535.");
  }
  return port;
}

function hostFromEnvironment() {
  const host = (process.env.HOST || "127.0.0.1").trim();
  if (!host || host.length > 253 || /[^a-zA-Z0-9.:[\]-]/.test(host)) {
    throw new Error("HOST debe ser una dirección IP o un nombre de host válido.");
  }
  return host;
}

function allowedOrigins() {
  const configured = process.env.CORS_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(
    configured?.length
      ? configured
      : [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:4000",
          "http://127.0.0.1:4000"
        ]
  );
}

const corsOrigins = allowedOrigins();
const baseCorsOptions = {
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
  maxAge: 600
};

function isSameOrigin(request, origin) {
  if (!origin) return true;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.protocol === `${request.protocol}:` && parsedOrigin.host === request.get("host");
  } catch {
    return false;
  }
}

function corsOptionsForRequest(request, callback) {
  const origin = request.get("origin");
  if (!origin || isSameOrigin(request, origin) || corsOrigins.has(origin)) {
    return callback(null, { ...baseCorsOptions, origin: Boolean(origin) });
  }
  return callback(new HttpError(403, "Origen no permitido por CORS.", "CORS_DENIED"));
}

export const app = express();
app.disable("x-powered-by");

app.use((request, response, next) => {
  const suppliedRequestId = request.get("x-request-id");
  request.id =
    suppliedRequestId && /^[A-Za-z0-9_-]{1,64}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  response.set({
    "X-Request-Id": request.id,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'"
    ].join("; ")
  });
  next();
});

app.use(express.json({ limit: "256kb", strict: true }));

const healthHandler = asyncRoute(async (_request, response) => {
  response.set("Cache-Control", "no-store");
  try {
    await checkDatabaseConnection();
    response.json({ status: "ok", api: "ok", database: "ok" });
  } catch {
    response.status(503).json({ status: "degraded", api: "ok", database: "unavailable" });
  }
});

app.get("/health", healthHandler);
app.use("/api", cors(corsOptionsForRequest), apiRouter);
app.use("/api", (request, response) => {
  response.status(404).json({
    error: "Endpoint no encontrado.",
    code: "NOT_FOUND",
    requestId: request.id
  });
});

const serveStatic = process.env.SERVE_STATIC !== "false" && fs.existsSync(spaEntry);
if (serveStatic) {
  app.use(
    express.static(distDirectory, {
      index: false,
      etag: true,
      lastModified: true,
      maxAge: "1h",
      setHeaders(response, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    })
  );

  app.use((request, response, next) => {
    if (request.method !== "GET" || !request.accepts("html")) return next();
    response.set("Cache-Control", "no-cache");
    response.sendFile(spaEntry);
  });
}

app.use((request, response) => {
  response.status(404).json({
    error: "Recurso no encontrado.",
    code: "NOT_FOUND",
    requestId: request.id
  });
});

function normalizedError(error) {
  if (error instanceof HttpError) return error;
  if (error?.type === "entity.parse.failed") {
    return new HttpError(400, "El cuerpo JSON no es válido.", "INVALID_JSON");
  }
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return new HttpError(413, "El cuerpo de la solicitud es demasiado grande.", "PAYLOAD_TOO_LARGE");
  }

  switch (error?.code) {
    case "23505":
      return new HttpError(409, "Ya existe un registro con esos datos únicos.", "DUPLICATE_RECORD");
    case "23503":
      return new HttpError(
        409,
        "La operación hace referencia a un registro inexistente o que todavía está en uso.",
        "RELATED_RECORD"
      );
    case "23502":
    case "23514":
    case "22P02":
    case "22003":
    case "22007":
      return new HttpError(400, "Los datos no cumplen las reglas requeridas.", "INVALID_DATA");
    case "42P01":
      return new HttpError(
        503,
        "La base de datos no está inicializada.",
        "DATABASE_NOT_INITIALIZED"
      );
    case "ECONNREFUSED":
    case "ECONNRESET":
    case "ENOTFOUND":
    case "EAI_AGAIN":
    case "ETIMEDOUT":
    case "57P01":
    case "57P02":
    case "57P03":
      return new HttpError(503, "PostgreSQL no está disponible.", "DATABASE_UNAVAILABLE");
    case "57014":
      return new HttpError(503, "PostgreSQL excedió el tiempo máximo de respuesta.", "DATABASE_TIMEOUT");
    default:
      if (typeof error?.code === "string" && error.code.startsWith("08")) {
        return new HttpError(503, "PostgreSQL no está disponible.", "DATABASE_UNAVAILABLE");
      }
      return new HttpError(500, "Ocurrió un error interno.", "INTERNAL_ERROR");
  }
}

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  const publicError = normalizedError(error);

  if (publicError.status >= 500) {
    console.error("Error procesando solicitud:", {
      requestId: request.id,
      method: request.method,
      path: request.path,
      code: error.code || publicError.code,
      message: error.message
    });
  }

  response.status(publicError.status).json({
    error: publicError.message,
    code: publicError.code,
    requestId: request.id,
    ...(publicError.details && { details: publicError.details })
  });
});

let httpServer;
let shutdownPromise;

export async function startServer() {
  if (httpServer) return httpServer;

  await initializeDatabase();
  const port = portFromEnvironment();
  const host = hostFromEnvironment();
  httpServer = await new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    const handleError = (error) => reject(error);
    server.once("error", handleError);
    server.once("listening", () => {
      server.removeListener("error", handleError);
      resolve(server);
    });
  });

  const displayedHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  console.log(
    `Planetour CRM disponible en http://${displayedHost}:${port}${serveStatic ? " (API + aplicación)" : " (API)"}.`
  );
  return httpServer;
}

export function shutdown(signal = "shutdown") {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.log(`Cerrando Planetour CRM (${signal})...`);
    if (httpServer) {
      await new Promise((resolve) => {
        const forceClose = setTimeout(() => {
          httpServer.closeAllConnections?.();
          resolve();
        }, 10_000);
        forceClose.unref();
        httpServer.close(() => {
          clearTimeout(forceClose);
          resolve();
        });
      });
    }
    await closeDatabase();
  })();
  return shutdownPromise;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      shutdown(signal)
        .catch((error) => console.error("Error durante el cierre:", error.message))
        .finally(() => {
          process.exitCode = 0;
        });
    });
  }

  startServer().catch(async (error) => {
    const message =
      error.message ||
      (["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"].includes(error.code)
        ? "PostgreSQL no está disponible. Verifica el servicio y la configuración PG*."
        : "Error de inicio sin detalle adicional.");
    console.error("No se pudo iniciar Planetour CRM:", {
      code: error.code || "UNKNOWN",
      message
    });
    process.exitCode = 1;
    await closeDatabase().catch(() => undefined);
  });
}

export { pool };
