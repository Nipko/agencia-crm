import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const { Pool, types } = pg;

// PostgreSQL returns NUMERIC values as strings by default. The monetary columns in
// this application are constrained to a range that can be represented safely by
// the frontend as Number values, so normalize them at the driver boundary.
types.setTypeParser(1700, (value) => Number.parseFloat(value));

function integerFromEnv(name, fallback, { min, max }) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}.`);
  }

  return value;
}

function booleanFromEnv(name, fallback = false) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;
  return ["1", "true", "yes", "on"].includes(rawValue.trim().toLowerCase());
}

const connectionString = process.env.DATABASE_URL?.trim();
const password = process.env.PGPASSWORD;

if (!connectionString && !password) {
  throw new Error(
    "Falta la configuración de PostgreSQL: define DATABASE_URL o PGPASSWORD en el entorno."
  );
}

const commonOptions = {
  application_name: "planetour-crm",
  max: integerFromEnv("PGPOOL_MAX", 10, { min: 1, max: 50 }),
  idleTimeoutMillis: integerFromEnv("PG_IDLE_TIMEOUT_MS", 30_000, {
    min: 1_000,
    max: 300_000
  }),
  connectionTimeoutMillis: integerFromEnv("PG_CONNECT_TIMEOUT_MS", 5_000, {
    min: 500,
    max: 60_000
  }),
  statement_timeout: integerFromEnv("PG_STATEMENT_TIMEOUT_MS", 15_000, {
    min: 1_000,
    max: 120_000
  }),
  query_timeout: integerFromEnv("PG_QUERY_TIMEOUT_MS", 20_000, {
    min: 1_000,
    max: 180_000
  }),
  keepAlive: true
};

const ssl = booleanFromEnv("PGSSL")
  ? { rejectUnauthorized: booleanFromEnv("PGSSL_REJECT_UNAUTHORIZED", true) }
  : undefined;

export const databaseConfig = connectionString
  ? { connectionString, ...commonOptions, ssl }
  : {
      user: process.env.PGUSER || "postgres",
      host: process.env.PGHOST || "127.0.0.1",
      database: process.env.PGDATABASE || "planetour_db",
      password,
      port: integerFromEnv("PGPORT", 5432, { min: 1, max: 65_535 }),
      ...commonOptions,
      ssl
    };

export const pool = new Pool(databaseConfig);

pool.on("error", (error) => {
  console.error("Error inesperado en una conexión PostgreSQL inactiva:", {
    code: error.code || "UNKNOWN",
    message: error.message
  });
});

export async function checkDatabaseConnection() {
  await pool.query("SELECT 1");
}

let closePromise;

export function closeDatabase() {
  if (!closePromise) closePromise = pool.end();
  return closePromise;
}
