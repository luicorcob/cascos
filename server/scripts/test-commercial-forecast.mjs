import assert from "node:assert/strict";
import {
  FORECAST_PROBABILITIES,
  buildCommercialForecast,
  normalizeForecastMonth
} from "../lib/commercial-forecast.mjs";

const business = {
  id: "biz_a",
  name: "Negocio A",
  content: { commerce: { currency: "gbp" } }
};
const db = {
  contacts: [
    contact("new", 100),
    contact("contacted", 200),
    contact("waiting", 300),
    contact("reserved", 400),
    contact("won", 500),
    contact("lost", 600),
    contact("customer", 700, { type: "customer" }),
    contact("new", -20),
    contact("new", "invalid"),
    contact("new", 999, { businessId: "biz_b" }),
    contact("new", 999, { merged: true }),
    contact("new", 999, { createdAt: "2026-08-01T00:00:00.000Z" })
  ]
};

const report = buildCommercialForecast(db, business, {
  month: "2026-07",
  now: new Date("2026-07-13T10:00:00.000Z")
});

assert.equal(report.month, "2026-07");
assert.equal(report.currency, "GBP");
assert.equal(report.contacts, 9);
assert.equal(report.totalValueEstimate, 2800);
assert.equal(report.weightedForecast, 1620);
assert.equal(report.openWeightedForecast, 420);
assert.equal(report.closedWonValue, 1200);
assert.deepEqual(report.probabilities, FORECAST_PROBABILITIES);
assert.deepEqual(report.byStatus.map((row) => row.count), [3, 1, 1, 1, 1, 1, 1]);
assert.deepEqual(report.byStatus.map((row) => row.weightedValue), [10, 50, 120, 240, 500, 0, 700]);

assert.equal(normalizeForecastMonth("", new Date("2026-01-15T00:00:00.000Z")), "2026-01");
assert.throws(() => normalizeForecastMonth("2026-13"), /YYYY-MM/);
assert.throws(() => normalizeForecastMonth("07-2026"), /YYYY-MM/);
assert.throws(() => normalizeForecastMonth("0000-07"), /YYYY-MM/);

console.log("Commercial forecast tests passed.");

function contact(status, valueEstimate, overrides = {}) {
  return {
    id: `contact_${status}_${Math.random().toString(36).slice(2)}`,
    businessId: "biz_a",
    type: "lead",
    status,
    valueEstimate,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}
