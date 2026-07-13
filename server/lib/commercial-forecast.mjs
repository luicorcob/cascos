export const FORECAST_STATUS_ORDER = Object.freeze([
  "new",
  "contacted",
  "waiting",
  "reserved",
  "won",
  "lost",
  "customer"
]);

export const FORECAST_PROBABILITIES = Object.freeze({
  new: 0.10,
  contacted: 0.25,
  waiting: 0.40,
  reserved: 0.60,
  won: 1,
  lost: 0,
  customer: 1
});

const OPEN_FORECAST_STATUSES = new Set(["new", "contacted", "waiting", "reserved"]);

/**
 * Builds a deterministic forecast snapshot from the CRM contacts available at
 * the end of the requested month. Contacts created after that month and soft
 * merged contacts are excluded. Historical values/statuses are not recreated:
 * the store does not retain enough information to do that safely.
 */
export function buildCommercialForecast(db, business, options = {}) {
  const now = validDate(options.now) || new Date();
  const month = normalizeForecastMonth(options.month, now);
  const monthEnd = endOfUtcMonth(month);
  const businessId = clean(business?.id);
  const contacts = (Array.isArray(db?.contacts) ? db.contacts : [])
    .filter((contact) => contact?.businessId === businessId)
    .filter((contact) => !contact?.merged)
    .filter((contact) => isAvailableByMonthEnd(contact, monthEnd));

  const rows = new Map(FORECAST_STATUS_ORDER.map((status) => [status, {
    status,
    count: 0,
    totalValueEstimate: 0,
    probability: FORECAST_PROBABILITIES[status],
    weightedValue: 0
  }]));

  contacts.forEach((contact) => {
    const status = normalizeForecastStatus(contact?.status, contact?.type);
    const row = rows.get(status);
    const value = normalizeEstimate(contact?.valueEstimate);

    row.count += 1;
    row.totalValueEstimate = roundMoney(row.totalValueEstimate + value);
    row.weightedValue = roundMoney(row.weightedValue + (value * row.probability));
  });

  const byStatus = FORECAST_STATUS_ORDER.map((status) => rows.get(status));
  const totalValueEstimate = sumMoney(byStatus.map((row) => row.totalValueEstimate));
  const weightedForecast = sumMoney(byStatus.map((row) => row.weightedValue));
  const openWeightedForecast = sumMoney(byStatus
    .filter((row) => OPEN_FORECAST_STATUSES.has(row.status))
    .map((row) => row.weightedValue));
  const closedWonValue = sumMoney(byStatus
    .filter((row) => row.status === "won" || row.status === "customer")
    .map((row) => row.totalValueEstimate));

  return {
    business: {
      id: businessId,
      name: clean(business?.name)
    },
    month,
    snapshotThrough: monthEnd.toISOString(),
    generatedAt: now.toISOString(),
    currency: normalizeCurrency(
      business?.currency
      || business?.content?.commerce?.currency
      || business?.content?.currency
    ),
    probabilities: { ...FORECAST_PROBABILITIES },
    contacts: contacts.length,
    totalValueEstimate,
    weightedForecast,
    openWeightedForecast,
    closedWonValue,
    byStatus
  };
}

export function normalizeForecastMonth(value, now = new Date()) {
  const fallback = validDate(now) || new Date();
  const month = clean(value) || `${fallback.getUTCFullYear()}-${String(fallback.getUTCMonth() + 1).padStart(2, "0")}`;

  if (!/^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(month)) {
    throw new RangeError("month must use YYYY-MM");
  }

  return month;
}

function endOfUtcMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0, 0) - 1);
}

function isAvailableByMonthEnd(contact, monthEnd) {
  const createdAt = validDate(contact?.createdAt);
  return !createdAt || createdAt.getTime() <= monthEnd.getTime();
}

function normalizeForecastStatus(value, type) {
  const status = clean(value).toLowerCase();

  if (FORECAST_STATUS_ORDER.includes(status)) {
    return status;
  }

  return clean(type).toLowerCase() === "customer" ? "customer" : "new";
}

function normalizeEstimate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? roundMoney(number) : 0;
}

function sumMoney(values) {
  return roundMoney(values.reduce((total, value) => total + Number(value || 0), 0));
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeCurrency(value) {
  const currency = clean(value).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "EUR";
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function clean(value) {
  return String(value || "").trim();
}
