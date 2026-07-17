import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { migrateLegacyPrivacyToConsent } from "../lib/consent-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const apply = process.argv.includes("--apply");
const context = { root };
const db = await loadBusinessStore(context);
const summary = migrateLegacyPrivacyToConsent(db);
if (apply && summary.eventsCreated) await saveBusinessStore(db, context, "privacy-to-consent-migration");
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...summary }, null, 2));
if (!apply) console.log("No se ha escrito ningun dato. Usa --apply para aplicar la migracion.");
