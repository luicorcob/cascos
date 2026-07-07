import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { setBusinessClientPassword, toPortalAccessSummary } from "../lib/client-auth.mjs";
import { loadLocalEnv } from "../lib/load-env.mjs";

loadLocalEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [businessRef, password] = process.argv.slice(2);

async function main() {
  if (!businessRef || !password) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const db = await loadBusinessStore({ root });
  const business = findBusiness(db, businessRef);

  if (!business) {
    throw new Error(`Business not found: ${businessRef}`);
  }

  await setBusinessClientPassword(business, password);
  await saveBusinessStore(db, { root }, "client-password");

  const access = toPortalAccessSummary(business);
  console.log(`Client portal password updated for ${business.name} (${business.slug || business.id}).`);
  console.log(`Portal enabled: ${access.enabled}; password set: ${access.passwordSet}.`);
}

function findBusiness(db, ref) {
  const normalized = normalizeLookup(ref);
  return db.businesses.find((business) => (
    normalizeLookup(business.id) === normalized
      || normalizeLookup(business.slug) === normalized
      || normalizeLookup(business.name) === normalized
  ));
}

function normalizeLookup(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function printUsage() {
  console.log("Usage: node server/scripts/set-client-password.mjs <business-id-slug-or-name> <password>");
  console.log("Example: node server/scripts/set-client-password.mjs brasa-norte cliente1234");
}

main().catch((error) => {
  console.error(`Set client password failed: ${error.message}`);
  process.exit(1);
});
