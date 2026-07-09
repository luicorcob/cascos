import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { backupJsonStore, cloneJson, readJsonStore, writeJsonStore } from "./json-store.mjs";

const DEFAULT_BUSINESS_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  services: [],
  bookings: [],
  availability: [],
  bookingBlocks: [],
  bookingReminders: [],
  businessEvents: [],
  auditLog: []
};

const META_TABLE = "locallift_business_meta";
const STORE_LOCK_KEY = "locallift_business_store";
const COLLECTIONS = [
  { key: "businesses", table: "locallift_businesses", businessScoped: false, slug: true },
  { key: "contacts", table: "locallift_contacts", businessScoped: true },
  { key: "activities", table: "locallift_activities", businessScoped: true },
  { key: "services", table: "locallift_services", businessScoped: true },
  { key: "bookings", table: "locallift_bookings", businessScoped: true },
  { key: "availability", table: "locallift_availability", businessScoped: true },
  { key: "bookingBlocks", table: "locallift_booking_blocks", businessScoped: true },
  { key: "bookingReminders", table: "locallift_booking_reminders", businessScoped: true },
  { key: "businessEvents", table: "locallift_business_events", businessScoped: true },
  { key: "auditLog", table: "locallift_audit_log", businessScoped: true }
];

let pgPoolPromise = null;
let postgresSchemaReady = false;

export function getBusinessStoreMode() {
  const requestedStore = clean(process.env.BUSINESS_STORE || process.env.BUSINESS_DB_DRIVER).toLowerCase();

  if (requestedStore === "postgres") {
    return "postgres";
  }

  return getPostgresConfig({ strict: false }) ? "postgres" : "json";
}

export function isPostgresBusinessStore() {
  return getBusinessStoreMode() === "postgres";
}

export async function loadBusinessStore(context, fallback = DEFAULT_BUSINESS_DB) {
  const initialDb = await loadInitialJsonDb(context.root, fallback);

  if (!isPostgresBusinessStore()) {
    const db = await readJsonStore(getBusinessDbPath(context.root), initialDb);
    return normalizeBusinessDb(db);
  }

  return loadPostgresBusinessStore(context, initialDb);
}

export async function saveBusinessStore(db, context, backupLabel = "business-store") {
  const nextDb = normalizeBusinessDb({
    ...db,
    updatedAt: new Date().toISOString()
  });

  if (!isPostgresBusinessStore()) {
    const dbPath = getBusinessDbPath(context.root);

    if (process.env.BUSINESS_DB_BACKUPS !== "false") {
      await backupJsonStore(dbPath, getBackupDir(context.root), backupLabel);
    }

    await writeJsonStore(dbPath, nextDb);
    return nextDb;
  }

  await replacePostgresBusinessStore(nextDb, backupLabel);
  return nextDb;
}

export async function readBusinessStoreHealth(context) {
  if (!isPostgresBusinessStore()) {
    return readJsonBusinessStoreHealth(context);
  }

  const startedAt = Date.now();

  try {
    const pool = await getPostgresPool();
    const client = await pool.connect();

    try {
      await ensurePostgresSchema(client);

      const serverInfo = await client.query("select current_database() as database_name, current_user as user_name");
      const counts = await loadPostgresCounts(client);
      const privilege = await client.query("select has_table_privilege(current_user, $1, 'INSERT,UPDATE,DELETE') as writable", [COLLECTIONS[0].table]);

      const writable = Boolean(privilege.rows[0]?.writable);

      return {
        ok: writable,
        mode: "postgres",
        latencyMs: Date.now() - startedAt,
        database: {
          target: describePostgresTarget(),
          name: serverInfo.rows[0]?.database_name || "",
          user: serverInfo.rows[0]?.user_name || "",
          readable: true,
          writable,
          error: ""
        },
        counts
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      ok: false,
      mode: "postgres",
      latencyMs: Date.now() - startedAt,
      database: {
        target: describePostgresTarget(),
        readable: false,
        writable: false,
        error: error.message
      },
      counts: emptyCounts()
    };
  }
}

export async function importBusinessStoreFromJson(context, sourcePath, label = "json-import") {
  const raw = await readFile(sourcePath, "utf8");
  const db = normalizeBusinessDb(JSON.parse(raw));
  await saveBusinessStore(db, context, label);
  return db;
}

export function getBusinessDbPath(root) {
  return process.env.BUSINESS_DB_FILE
    ? path.resolve(root, process.env.BUSINESS_DB_FILE)
    : path.join(root, "data", "business-db.json");
}

export function getBackupDir(root) {
  return process.env.BUSINESS_DB_BACKUP_DIR
    ? path.resolve(root, process.env.BUSINESS_DB_BACKUP_DIR)
    : path.join(root, "data", "backups");
}

async function loadPostgresBusinessStore(context, initialDb) {
  const pool = await getPostgresPool();
  const client = await pool.connect();

  try {
    await ensurePostgresSchema(client);

    const counts = await loadPostgresCounts(client);

    if (isStoreEmpty(counts) && shouldBootstrapPostgres() && hasData(initialDb)) {
      const seededDb = normalizeBusinessDb(initialDb);
      await replacePostgresBusinessStore(seededDb, "bootstrap-json", client);
      return seededDb;
    }

    const meta = await readPostgresMeta(client);
    const db = normalizeBusinessDb({
      version: Number(meta.version || initialDb.version || 1),
      updatedAt: meta.updatedAt || null
    });

    for (const collection of COLLECTIONS) {
      const result = await client.query(`select data from ${collection.table} order by position asc, id asc`);
      db[collection.key] = result.rows.map((row) => row.data).filter(Boolean);
    }

    return db;
  } finally {
    client.release();
  }
}

async function replacePostgresBusinessStore(db, backupLabel, existingClient = null) {
  const pool = existingClient ? null : await getPostgresPool();
  const client = existingClient || await pool.connect();
  const ownsTransaction = true;

  try {
    await ensurePostgresSchema(client);
    await client.query("begin");

    await client.query("select pg_advisory_xact_lock(hashtext($1))", [STORE_LOCK_KEY]);

    for (const collection of COLLECTIONS) {
      await client.query(`delete from ${collection.table}`);
    }

    for (const collection of COLLECTIONS) {
      const items = Array.isArray(db[collection.key]) ? db[collection.key] : [];

      for (const [index, item] of items.entries()) {
        const row = toPostgresRow(collection, item, index);
        await client.query(
          `insert into ${collection.table} (id, business_id, slug, data, position, created_at, updated_at, stored_at)
           values ($1, $2, $3, $4::jsonb, $5, $6, $7, now())`,
          [
            row.id,
            row.businessId,
            row.slug,
            JSON.stringify(row.data),
            row.position,
            row.createdAt,
            row.updatedAt
          ]
        );
      }
    }

    await writePostgresMeta(client, db, backupLabel);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});

    throw error;
  } finally {
    if (!existingClient) {
      client.release();
    }
  }
}

async function ensurePostgresSchema(client) {
  if (postgresSchemaReady) {
    return;
  }

  await client.query(`
    create table if not exists ${META_TABLE} (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);

  for (const collection of COLLECTIONS) {
    await client.query(`
      create table if not exists ${collection.table} (
        id text primary key,
        business_id text,
        slug text,
        data jsonb not null,
        position integer not null default 0,
        created_at timestamptz,
        updated_at timestamptz,
        stored_at timestamptz not null default now()
      )
    `);
    await client.query(`alter table ${collection.table} add column if not exists business_id text`);
    await client.query(`alter table ${collection.table} add column if not exists slug text`);
    await client.query(`alter table ${collection.table} add column if not exists created_at timestamptz`);
    await client.query(`alter table ${collection.table} add column if not exists updated_at timestamptz`);
    await client.query(`alter table ${collection.table} add column if not exists position integer not null default 0`);
    await client.query(`alter table ${collection.table} add column if not exists stored_at timestamptz not null default now()`);
    await client.query(`create index if not exists ${collection.table}_business_id_idx on ${collection.table} (business_id)`);
    await client.query(`create index if not exists ${collection.table}_updated_at_idx on ${collection.table} (updated_at)`);
  }

  await client.query(`
    create unique index if not exists locallift_businesses_slug_unique
    on locallift_businesses (slug)
    where slug is not null and slug <> ''
  `);

  postgresSchemaReady = true;
}

async function readPostgresMeta(client) {
  const result = await client.query(`select key, value from ${META_TABLE}`);
  return Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
}

async function writePostgresMeta(client, db, backupLabel) {
  const rows = {
    version: Number(db.version || 1),
    updatedAt: db.updatedAt || new Date().toISOString(),
    lastBackupLabel: backupLabel || "",
    lastStoredAt: new Date().toISOString()
  };

  for (const [key, value] of Object.entries(rows)) {
    await client.query(
      `insert into ${META_TABLE} (key, value, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  }
}

async function loadPostgresCounts(client) {
  const counts = emptyCounts();

  for (const collection of COLLECTIONS) {
    const result = await client.query(`select count(*)::int as count from ${collection.table}`);
    setCount(counts, collection.key, Number(result.rows[0]?.count || 0));
  }

  return counts;
}

async function getPostgresPool() {
  if (!pgPoolPromise) {
    pgPoolPromise = createPostgresPool();
  }

  return pgPoolPromise;
}

async function createPostgresPool() {
  const config = getPostgresConfig({ strict: true });

  try {
    const { Pool } = await import("pg");
    return new Pool(config);
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" || /Cannot find package 'pg'/.test(error.message)) {
      throw new Error("PostgreSQL store requires the pg package. Run npm install before using DATABASE_URL.");
    }

    throw error;
  }
}

function getPostgresConfig({ strict }) {
  const requestedStore = clean(process.env.BUSINESS_STORE || process.env.BUSINESS_DB_DRIVER).toLowerCase();
  const connectionString = clean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCALLIFT_DATABASE_URL);

  if (requestedStore === "json") {
    return null;
  }

  if (!connectionString) {
    if (strict && requestedStore === "postgres") {
      throw new Error("BUSINESS_STORE=postgres requires DATABASE_URL, POSTGRES_URL or LOCALLIFT_DATABASE_URL.");
    }

    return null;
  }

  return {
    connectionString,
    max: clampNumber(process.env.BUSINESS_DB_POOL_MAX || process.env.PGPOOL_MAX || 6, 1, 30),
    idleTimeoutMillis: clampNumber(process.env.BUSINESS_DB_IDLE_TIMEOUT_MS || 30000, 1000, 300000),
    connectionTimeoutMillis: clampNumber(process.env.BUSINESS_DB_CONNECT_TIMEOUT_MS || 10000, 1000, 60000),
    ssl: postgresSslConfig(connectionString)
  };
}

function postgresSslConfig(connectionString) {
  const sslMode = clean(process.env.PGSSLMODE || process.env.BUSINESS_DB_SSL || process.env.POSTGRES_SSL).toLowerCase();

  if (["disable", "false", "0", "off", "no"].includes(sslMode)) {
    return false;
  }

  if (["verify-full", "verify-ca"].includes(sslMode)) {
    return { rejectUnauthorized: true };
  }

  if (["require", "true", "1", "on", "yes", "no-verify"].includes(sslMode)) {
    return { rejectUnauthorized: false };
  }

  return isLocalPostgres(connectionString) ? false : { rejectUnauthorized: false };
}

function isLocalPostgres(connectionString) {
  try {
    const url = new URL(connectionString);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function describePostgresTarget() {
  const connectionString = clean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCALLIFT_DATABASE_URL);

  if (!connectionString) {
    return "";
  }

  try {
    const url = new URL(connectionString);
    return `${url.hostname}${url.pathname || ""}`;
  } catch {
    return "configured";
  }
}

function toPostgresRow(collection, item, index) {
  const data = isPlainObject(item) ? item : { value: item };
  const id = clean(data.id) || `${collection.key}_${index + 1}`;
  const businessId = collection.key === "businesses"
    ? clean(data.id)
    : clean(data.businessId || data.business_id);

  return {
    id,
    businessId,
    slug: collection.slug ? clean(data.slug) : null,
    data,
    position: index,
    createdAt: parseDateOrNull(data.createdAt || data.created_at),
    updatedAt: parseDateOrNull(data.updatedAt || data.updated_at || data.createdAt || data.created_at)
  };
}

async function loadInitialJsonDb(root, fallback) {
  const dbPath = getBusinessDbPath(root);

  try {
    return normalizeBusinessDb(JSON.parse(await readFile(dbPath, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const examplePath = path.join(root, "data", "business-db.example.json");

  try {
    return normalizeBusinessDb(JSON.parse(await readFile(examplePath, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return normalizeBusinessDb(fallback);
}

async function readJsonBusinessStoreHealth(context) {
  const startedAt = Date.now();
  const dbPath = getBusinessDbPath(context.root);
  const db = await readJsonHealthDb(dbPath);
  const checks = await buildJsonChecks(dbPath, db);

  return {
    ok: checks.databaseReadable && checks.databaseWritable,
    mode: "json",
    latencyMs: Date.now() - startedAt,
    database: {
      path: path.relative(context.root, dbPath),
      readable: checks.databaseReadable,
      writable: checks.databaseWritable,
      error: checks.error
    },
    counts: countBusinessDb(db)
  };
}

async function readJsonHealthDb(dbPath) {
  try {
    return normalizeBusinessDb(JSON.parse(await readFile(dbPath, "utf8")));
  } catch (error) {
    return {
      ...cloneJson(DEFAULT_BUSINESS_DB),
      error: error.message
    };
  }
}

async function buildJsonChecks(dbPath, db) {
  const checks = {
    databaseReadable: !db.error,
    databaseWritable: false,
    error: db.error || ""
  };

  try {
    await access(dbPath, constants.W_OK);
    checks.databaseWritable = true;
  } catch (error) {
    checks.error = checks.error || error.message;
  }

  return checks;
}

function normalizeBusinessDb(db) {
  const source = isPlainObject(db) ? db : {};
  const normalized = {
    ...cloneJson(DEFAULT_BUSINESS_DB),
    ...cloneJson(source)
  };

  normalized.version = Number(normalized.version || 1);
  normalized.updatedAt = normalized.updatedAt || null;

  for (const collection of COLLECTIONS) {
    normalized[collection.key] = Array.isArray(normalized[collection.key])
      ? normalized[collection.key]
      : [];
  }

  return normalized;
}

function countBusinessDb(db) {
  const normalized = normalizeBusinessDb(db);
  const counts = emptyCounts();

  for (const collection of COLLECTIONS) {
    setCount(counts, collection.key, normalized[collection.key].length);
  }

  return counts;
}

function emptyCounts() {
  return {
    businesses: 0,
    contacts: 0,
    activities: 0,
    services: 0,
    bookings: 0,
    availability: 0,
    bookingBlocks: 0,
    bookingReminders: 0,
    businessEvents: 0,
    events: 0,
    auditLog: 0
  };
}

function setCount(counts, key, value) {
  counts[key] = value;

  if (key === "businessEvents") {
    counts.events = value;
  }
}

function isStoreEmpty(counts) {
  return Object.values(counts).every((count) => Number(count || 0) === 0);
}

function hasData(db) {
  return COLLECTIONS.some((collection) => Array.isArray(db[collection.key]) && db[collection.key].length > 0);
}

function shouldBootstrapPostgres() {
  const value = clean(process.env.BUSINESS_DB_BOOTSTRAP_FROM_JSON).toLowerCase();

  if (["true", "1", "yes", "on"].includes(value)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(value)) {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

function parseDateOrNull(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function clean(value) {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
