import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { backfillBusinessAssociations } from "../lib/relationship-migration.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const apply = process.argv.includes("--apply");
const context = { root };
const db = await loadBusinessStore(context);
const summary = backfillBusinessAssociations(db);

if (apply && summary.created) {
  await saveBusinessStore(db, context, "business-associations-migration");
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...summary }, null, 2));
if (!apply) console.log("No se ha escrito ningun dato. Usa --apply para aplicar la migracion.");
