import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { closeDatabase, pool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultSystems = [
  ["SYS-AMADEUS", "Amadeus GDS", "GDS", "1A", "#6366f1"],
  ["SYS-SABRE", "Sabre Red 360", "GDS", "1S", "#0ea5e9"],
  ["SYS-KIU", "Kiu System Solutions", "GDS regional", "XX", "#10b981"],
  ["SYS-WINGO", "Wingo Direct B2B", "LCC Portal", "P5", "#f59e0b"],
  ["SYS-AVIANCA", "Avianca Direct / NDC", "NDC Channel", "AV", "#f43f5e"]
];

const defaultKaringConfig = {
  serverIp: "",
  apiKey: "",
  autoBlockDays: 30,
  autoSyncMinutes: 15,
  enableAutoBlock: true
};

const defaultTierConfigs = [
  {
    id: "GOLD",
    name: "GOLD (Alta Emisión)",
    defaultLimit: 150_000_000,
    hotelDiscount: 25,
    reserveDiscount: 30
  },
  {
    id: "SILVER",
    name: "SILVER (Estándar)",
    defaultLimit: 80_000_000,
    hotelDiscount: 15,
    reserveDiscount: 20
  },
  {
    id: "BRONZE",
    name: "BRONZE (Ocasional)",
    defaultLimit: 30_000_000,
    hotelDiscount: 10,
    reserveDiscount: 10
  },
  {
    id: "ESTATAL",
    name: "ESTATAL (Convenios)",
    defaultLimit: 500_000_000,
    hotelDiscount: 20,
    reserveDiscount: 25
  }
];

function bcryptRounds() {
  const rounds = Number.parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 14) {
    throw new Error("BCRYPT_ROUNDS debe ser un entero entre 10 y 14.");
  }
  return rounds;
}

function validateAdminPassword(password) {
  if (
    password.length < 10 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error(
      "ADMIN_PASSWORD debe tener entre 10 y 72 bytes e incluir letras y números."
    );
  }
}

async function seedAdmin(client) {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin").trim().toLowerCase();
  const existingAdmin = await client.query(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [adminEmail]
  );

  if (existingAdmin.rowCount > 0) return false;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn(
      "No se creó el usuario administrador: define ADMIN_PASSWORD y vuelve a ejecutar la inicialización."
    );
    return false;
  }

  validateAdminPassword(adminPassword);
  const passwordHash = await bcrypt.hash(adminPassword, bcryptRounds());
  await client.query(
    `INSERT INTO users
       (id, name, email, password_hash, role, role_label, status, department)
     VALUES ($1, $2, $3, $4, 'SUPERADMIN', 'Superadministrador', 'ACTIVE', $5)`,
    [
      `USR-${randomUUID()}`,
      process.env.ADMIN_NAME?.trim() || "Superadministrador Planetour",
      adminEmail,
      passwordHash,
      "Dirección General"
    ]
  );
  return true;
}

async function seedSystems(client) {
  const values = [];
  const placeholders = defaultSystems.map((system, rowIndex) => {
    const offset = rowIndex * system.length;
    values.push(...system);
    return `(${system.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`;
  });

  await client.query(
    `INSERT INTO gds_systems (id, name, category, code, color)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT DO NOTHING`,
    values
  );
}

async function seedSettings(client) {
  await client.query(
    `INSERT INTO system_settings (key, value)
     VALUES ('karingConfig', $1::jsonb), ('tierConfigs', $2::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(defaultKaringConfig), JSON.stringify(defaultTierConfigs)]
  );
}

export async function initializeDatabase() {
  const schemaSql = await readFile(path.join(__dirname, "schema.sql"), "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["planetour-crm-schema-v1"]);
    await client.query(schemaSql);

    const adminCreated = await seedAdmin(client);
    await seedSystems(client);
    await seedSettings(client);

    await client.query("COMMIT");
    console.log(
      adminCreated
        ? "Base de datos inicializada y usuario administrador creado."
        : "Base de datos inicializada correctamente."
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  initializeDatabase()
    .catch((error) => {
      console.error("No se pudo inicializar PostgreSQL:", {
        code: error.code || "UNKNOWN",
        message:
          error.message ||
          "PostgreSQL no está disponible. Verifica el servicio y la configuración PG*."
      });
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}
