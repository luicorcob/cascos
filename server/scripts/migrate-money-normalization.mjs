import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { reconcileMoneyRecords } from "../lib/money-model.mjs";

const apply = process.argv.includes("--apply");
const context = { root: process.cwd() };
const db = await loadBusinessStore(context);
const working = apply ? db : structuredClone(db);
const results = [];
for (const business of working.businesses || []) results.push({ businessId: business.id, ...reconcileMoneyRecords(working, business.id).summary });
if (apply) await saveBusinessStore(working, context, "money-normalization-migration");
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", results }, null, 2));
