import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { closeDatabase, databaseConfig } from "./db.js";
import { initializeDatabase } from "./initDb.js";

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);

function safeDatabaseName(value, variableName) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(value)) {
    throw new Error(
      `${variableName} solo puede contener letras, números y guion bajo, y debe comenzar por una letra.`
    );
  }
  return value;
}

function databaseNames() {
  if (databaseConfig.connectionString) {
    const url = new URL(databaseConfig.connectionString);
    const target = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return {
      target: safeDatabaseName(target || "planetour_db", "DATABASE_URL"),
      admin: safeDatabaseName(process.env.PGADMIN_DATABASE || "postgres", "PGADMIN_DATABASE")
    };
  }

  return {
    target: safeDatabaseName(databaseConfig.database, "PGDATABASE"),
    admin: safeDatabaseName(process.env.PGADMIN_DATABASE || "postgres", "PGADMIN_DATABASE")
  };
}

function adminConnectionConfig(adminDatabase) {
  if (databaseConfig.connectionString) {
    const url = new URL(databaseConfig.connectionString);
    url.pathname = `/${encodeURIComponent(adminDatabase)}`;
    return {
      connectionString: url.toString(),
      ssl: databaseConfig.ssl,
      connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
      application_name: "planetour-crm-setup"
    };
  }

  return {
    user: databaseConfig.user,
    host: databaseConfig.host,
    password: databaseConfig.password,
    port: databaseConfig.port,
    database: adminDatabase,
    ssl: databaseConfig.ssl,
    connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
    application_name: "planetour-crm-setup"
  };
}

export async function setupDatabase() {
  const names = databaseNames();
  const adminClient = new Client(adminConnectionConfig(names.admin));

  try {
    await adminClient.connect();
    const existing = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      names.target
    ]);

    if (existing.rowCount === 0) {
      // PostgreSQL identifiers cannot be query parameters. safeDatabaseName has
      // already restricted this value to a conservative identifier grammar.
      await adminClient.query(`CREATE DATABASE "${names.target}"`);
      console.log(`Base de datos '${names.target}' creada.`);
    } else {
      console.log(`Base de datos '${names.target}' disponible.`);
    }
  } finally {
    await adminClient.end().catch(() => undefined);
  }

  await initializeDatabase();
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  setupDatabase()
    .catch((error) => {
      console.error("No se pudo preparar PostgreSQL:", {
        code: error.code || "UNKNOWN",
        message:
          error.message ||
          "PostgreSQL no está disponible. Verifica el servicio y la configuración PG*."
      });
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}
