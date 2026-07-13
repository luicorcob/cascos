import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { loadLocalEnv } from "../lib/load-env.mjs";
import {
  applyDailyLeadInactivityAutomation,
  normalizeAutomationNow,
  normalizeInactivityDays
} from "../lib/crm-automation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  proposals: [],
  messageTemplates: [],
  services: [],
  bookings: [],
  availability: [],
  bookingBlocks: [],
  bookingReminders: [],
  businessEvents: [],
  auditLog: []
};

export async function runCrmDailyAutomation(options = {}) {
  const now = normalizeAutomationNow(options.now);
  const thresholdDays = normalizeInactivityDays(options.thresholdDays);
  const context = {
    root: options.root || ROOT,
    ...(options.context || {})
  };
  const loader = options.loadBusinessStore || loadBusinessStore;
  const saver = options.saveBusinessStore || saveBusinessStore;
  const loaded = await loader(context, DEFAULT_DB);
  const db = normalizeStore(loaded);
  const summary = applyDailyLeadInactivityAutomation(db, {
    now,
    thresholdDays,
    businessId: options.businessId
  });
  const saved = summary.created > 0;

  if (saved) {
    await saver(db, context, "crm-daily-automation");
  }

  return {
    ok: true,
    saved,
    ...summary
  };
}

export function parseCrmAutomationArgs(args = []) {
  const values = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = String(args[index] || "");
    const [flag, inlineValue] = argument.split("=", 2);
    const nextValue = inlineValue === undefined ? args[index + 1] : inlineValue;

    if (flag === "--now") {
      values.now = requireArgumentValue(flag, nextValue);
      if (inlineValue === undefined) {
        index += 1;
      }
      continue;
    }
    if (flag === "--threshold-days") {
      values.thresholdDays = normalizeInactivityDays(requireArgumentValue(flag, nextValue));
      if (inlineValue === undefined) {
        index += 1;
      }
      continue;
    }
    if (flag === "--business") {
      values.businessId = requireArgumentValue(flag, nextValue);
      if (inlineValue === undefined) {
        index += 1;
      }
      continue;
    }
    if (argument) {
      throw new RangeError(`Unknown argument: ${argument}`);
    }
  }

  if (values.now !== undefined) {
    values.now = normalizeAutomationNow(values.now).toISOString();
  }
  return values;
}

function normalizeStore(value) {
  const db = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  db.version = Number(db.version || 1);
  db.businesses = array(db.businesses);
  db.contacts = array(db.contacts);
  db.activities = array(db.activities);
  db.proposals = array(db.proposals);
  db.messageTemplates = array(db.messageTemplates);
  db.services = array(db.services);
  db.bookings = array(db.bookings);
  db.availability = array(db.availability);
  db.bookingBlocks = array(db.bookingBlocks);
  db.bookingReminders = array(db.bookingReminders);
  db.businessEvents = array(db.businessEvents);
  db.auditLog = array(db.auditLog);
  return db;
}

function requireArgumentValue(flag, value) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.startsWith("--")) {
    throw new RangeError(`${flag} requires a value`);
  }
  return normalized;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  loadLocalEnv();

  runCrmDailyAutomation(parseCrmAutomationArgs(process.argv.slice(2)))
    .then((summary) => {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
      process.exitCode = 1;
    });
}
