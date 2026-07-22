import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadLocalEnv } from "../lib/load-env.mjs";

loadLocalEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationPaths = [
  path.join(root, "supabase", "migrations", "202607220001_zone_discovery.sql"),
  path.join(root, "supabase", "migrations", "202607220002_zone_source_wikipedia.sql")
];
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCALLIFT_DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to migrate Descubre tu zona.");
}

const client = new pg.Client({ connectionString, ssl: postgresSsl(connectionString) });

try {
  await client.connect();
  for (const migrationPath of migrationPaths) {
    await client.query(await readFile(migrationPath, "utf8"));
  }
  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'zone_points_of_interest',
        'business_connections',
        'zone_discovery_settings',
        'zone_discovery_events'
      )
    order by table_name
  `);
  console.log(`Descubre tu zona: ${result.rows.length}/4 tables ready.`);
} finally {
  await client.end().catch(() => {});
}

function postgresSsl(value) {
  const mode = String(process.env.PGSSLMODE || "").trim().toLowerCase();
  if (["disable", "false", "off", "0"].includes(mode)) return false;
  try {
    const host = new URL(value).hostname;
    if (["localhost", "127.0.0.1", "::1"].includes(host)) return false;
  } catch {}
  return { rejectUnauthorized: false };
}
