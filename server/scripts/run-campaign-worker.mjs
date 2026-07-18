import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { ensureCampaignCollections, processCampaignBatch } from "../lib/campaign-model.mjs";
import { createCampaignSendExecutor } from "../api/campaign-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function runCampaignWorker(options = {}) {
  const now = normalizeNow(options.now);
  const limit = normalizeLimit(options.limit);
  const businessId = clean(options.businessId);
  const context = options.context || { root };
  const loader = options.loadBusinessStore || loadBusinessStore;
  const saver = options.saveBusinessStore || saveBusinessStore;
  const db = ensureCampaignCollections(await loader(context));
  const due = db.campaigns
    .filter((campaign) => ["scheduled", "running"].includes(campaign.status))
    .filter((campaign) => Date.parse(campaign.nextProcessAt || campaign.scheduledAt || "") <= Date.parse(now))
    .filter((campaign) => !businessId || campaign.businessId === businessId)
    .sort((left, right) => String(left.nextProcessAt || left.scheduledAt).localeCompare(String(right.nextProcessAt || right.scheduledAt)))
    .slice(0, limit);
  const results = [];
  for (const campaign of due) {
    const business = db.businesses.find((item) => item.id === campaign.businessId);
    if (!business) continue;
    const sendExecutor = options.sendExecutor || createCampaignSendExecutor(context, business);
    const result = await processCampaignBatch(db, business.id, campaign.id, { now, sendExecutor });
    results.push({ campaignId: campaign.id, status: result.campaign.status, processed: result.processed, remaining: result.remaining || 0, waitingForQuietHours: Boolean(result.waitingForQuietHours), nextProcessAt: result.nextProcessAt || result.campaign.nextProcessAt || "" });
  }
  if (results.length) await saver(db, context, "campaign-worker");
  return { ok: true, generatedAt: now, businessId, due: due.length, processedCampaigns: results.length, saved: results.length > 0, results };
}

export function parseCampaignWorkerArgs(argv) {
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
  runCampaignWorker(parseCampaignWorkerArgs(process.argv.slice(2)))
    .then((summary) => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
