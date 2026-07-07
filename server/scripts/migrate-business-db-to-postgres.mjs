import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getBusinessDbPath,
  importBusinessStoreFromJson,
  isPostgresBusinessStore,
  loadBusinessStore
} from "../lib/business-store.mjs";
import { loadLocalEnv } from "../lib/load-env.mjs";

loadLocalEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = process.argv[2] ? resolveFromRoot(process.argv[2]) : getBusinessDbPath(root);

async function main() {
  if (!isPostgresBusinessStore()) {
    throw new Error("Set DATABASE_URL or BUSINESS_STORE=postgres before running this migration.");
  }

  const db = await importBusinessStoreFromJson({ root }, sourcePath, "postgres-migration");
  const verified = await loadBusinessStore({ root }, db);

  console.log(`Migrated ${displayPath(sourcePath)} into PostgreSQL.`);
  console.log(`Businesses: ${verified.businesses.length}; contacts: ${count(verified.contacts)}; bookings: ${count(verified.bookings)}.`);
}

function resolveFromRoot(value) {
  return path.resolve(root, String(value || "").trim());
}

function displayPath(value) {
  const relative = path.relative(root, value);
  return relative && !relative.startsWith("..") ? relative : value;
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

main().catch((error) => {
  console.error(`PostgreSQL migration failed: ${error.message}`);
  process.exit(1);
});
