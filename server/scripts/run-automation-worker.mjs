import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { ensureAutomationCollections, executeAutomationRun } from "../lib/automation-engine.mjs";
import { createActionExecutor } from "../api/automation-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function runAutomationWorker(options = {}) {
  const now = normalizeNow(options.now);
  const limit = normalizeLimit(options.limit);
  const businessId = clean(options.businessId);
  const context = options.context || { root };
  const loader = options.loadBusinessStore || loadBusinessStore;
  const saver = options.saveBusinessStore || saveBusinessStore;
  const db = ensureAutomationCollections(await loader(context));
  const due = db.automationRuns
    .filter((run) => run.status === "waiting" && Date.parse(run.resumeAt || "") <= Date.parse(now))
    .filter((run) => !businessId || run.businessId === businessId)
    .filter((run) => db.automations.some((automation) => automation.id === run.automationId && automation.businessId === run.businessId && automation.status === "published"))
    .sort((a, b) => String(a.resumeAt).localeCompare(String(b.resumeAt)))
    .slice(0, limit);
  const results = [];
  for (const run of due) {
    const business = db.businesses.find((item) => item.id === run.businessId);
    if (!business) continue;
    const executor = options.actionExecutor || createActionExecutor(context, business);
    const updated = await executeAutomationRun(db, run.businessId, run.id, { now, actionExecutor: executor });
    results.push({ runId: run.id, automationId: run.automationId, status: updated.status, actionsExecuted: updated.actionsExecuted, error: updated.error || "" });
  }
  if (results.length) await saver(db, context, "automation-worker");
  return { ok: true, generatedAt: now, businessId, due: due.length, processed: results.length, saved: results.length > 0, results };
}

export function parseAutomationWorkerArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [flag, inlineValue] = argument.split("=", 2);
    if (!["--now", "--business", "--limit"].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (flag === "--now") result.now = normalizeNow(value);
    if (flag === "--business") result.businessId = clean(value);
    if (flag === "--limit") result.limit = normalizeLimit(value);
  }
  return result;
}

function normalizeNow(value) { const timestamp = Date.parse(value || new Date().toISOString()); if (!Number.isFinite(timestamp)) throw new Error("now must be a valid date"); return new Date(timestamp).toISOString(); }
function normalizeLimit(value) { if (value === undefined || value === null || value === "") return 100; const number = Number(value); if (!Number.isInteger(number) || number < 1 || number > 1000) throw new Error("limit must be an integer between 1 and 1000"); return number; }
function clean(value) { return String(value ?? "").trim(); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAutomationWorker(parseAutomationWorkerArgs(process.argv.slice(2)))
    .then((summary) => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
