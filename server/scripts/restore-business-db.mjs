import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPostgresBusinessStore, loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { backupJsonStore, readJsonStore, writeJsonStore } from "../lib/json-store.mjs";
import { loadLocalEnv } from "../lib/load-env.mjs";

loadLocalEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const positional = args.filter((arg) => !arg.startsWith("--"));

async function main() {
  if (!confirm || positional.length < 1 || positional.length > 2) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const sourcePath = resolveFromRoot(positional[0]);
  const restoreToPostgres = isPostgresBusinessStore() && !positional[1];
  const targetPath = restoreToPostgres ? null : positional[1] ? resolveFromRoot(positional[1]) : getDbPath();

  if (!restoreToPostgres && sourcePath === targetPath) {
    throw new Error("Backup source and database target must be different files.");
  }

  const restoredDb = await readAndValidateBackup(sourcePath);

  if (restoreToPostgres) {
    const preRestoreBackup = await backupCurrentPostgresStore();
    await saveBusinessStore(restoredDb, { root }, "postgres-restore");

    const verifiedDb = await loadBusinessStore({ root }, {});
    validateDatabase(verifiedDb, "Restored PostgreSQL database");

    console.log(`Restored PostgreSQL business store from ${displayPath(sourcePath)}.`);
    console.log(`Businesses: ${verifiedDb.businesses.length}; contacts: ${count(verifiedDb.contacts)}; bookings: ${count(verifiedDb.bookings)}.`);
    console.log(`Pre-restore backup: ${displayPath(preRestoreBackup)}`);
    return;
  }

  const preRestoreBackup = await backupJsonStore(targetPath, getBackupDir(), "pre-restore");

  await writeJsonStore(targetPath, restoredDb);

  const verifiedDb = await readJsonStore(targetPath, {});
  validateDatabase(verifiedDb, "Restored database");

  console.log(`Restored ${displayPath(targetPath)} from ${displayPath(sourcePath)}.`);
  console.log(`Businesses: ${verifiedDb.businesses.length}; contacts: ${count(verifiedDb.contacts)}; bookings: ${count(verifiedDb.bookings)}.`);
  console.log(preRestoreBackup
    ? `Pre-restore backup: ${displayPath(preRestoreBackup)}`
    : "Pre-restore backup: not created because the target did not exist.");
}

async function readAndValidateBackup(filePath) {
  const raw = await readFile(filePath, "utf8");
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Backup is not valid JSON: ${displayPath(filePath)}`);
  }

  validateDatabase(data, "Backup");
  return data;
}

function validateDatabase(data, label) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  if (!Array.isArray(data.businesses)) {
    throw new Error(`${label} must contain a businesses array.`);
  }

  const optionalArrays = [
    "contacts",
    "activities",
    "services",
    "bookings",
    "availability",
    "bookingBlocks",
    "bookingReminders",
    "businessEvents",
    "auditLog"
  ];

  optionalArrays.forEach((key) => {
    if (key in data && !Array.isArray(data[key])) {
      throw new Error(`${label} field ${key} must be an array.`);
    }
  });
}

function getDbPath() {
  return process.env.BUSINESS_DB_FILE
    ? resolveFromRoot(process.env.BUSINESS_DB_FILE)
    : path.join(root, "data", "business-db.json");
}

function getBackupDir() {
  return process.env.BUSINESS_DB_BACKUP_DIR
    ? resolveFromRoot(process.env.BUSINESS_DB_BACKUP_DIR)
    : path.join(root, "data", "backups");
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

function printUsage() {
  console.log("Usage: npm run restore:businesses -- <backup-file> [target-file] --confirm");
  console.log("Stop the backend before restoring. With DATABASE_URL it restores PostgreSQL unless [target-file] is passed.");
  console.log("The command validates JSON and creates a pre-restore backup.");
}

async function backupCurrentPostgresStore() {
  const currentDb = await loadBusinessStore({ root }, {});
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(getBackupDir(), `business-db.${timestamp}.pre-postgres-restore.json`);

  validateDatabase(currentDb, "Current PostgreSQL database");
  await writeJsonStore(backupPath, currentDb);
  return backupPath;
}

main().catch((error) => {
  console.error(`Restore failed: ${error.message}`);
  process.exit(1);
});
