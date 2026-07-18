import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCustomer360, buildCustomer360Detail } from "../lib/customer-360.mjs";
import { seedCustomer360Fixture } from "./customer-360-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const db = JSON.parse(await readFile(path.join(root, "data", "business-db.example.json"), "utf8"));
const businessId = "biz_demo_brasa_norte";
const now = "2026-07-17T12:00:00.000Z";
const ids = seedCustomer360Fixture(db, { businessId, now });
const result = buildCustomer360(db, businessId, { now, limit: 500, timelineLimit: 12 });
const vip = result.customers.find((item) => item.contact.id === ids.vip);
const risk = result.customers.find((item) => item.contact.id === ids.risk);

assert.ok(vip, "VIP customer must be included");
assert.ok(risk, "at-risk customer must be included");
assert.equal(vip.metrics.completedVisits, 6);
assert.equal(vip.metrics.totalSpent, 1210);
assert.equal(vip.finance.outstandingBalance, 0);
assert.equal(vip.rfm.frequency, 4);
assert.equal(vip.rfm.recency, 5);
assert.equal(vip.rfm.monetary, 5);
assert.ok(vip.segments.includes("vip"));
assert.ok(vip.segments.includes("recurring"));
assert.ok(vip.segments.includes("marketing_reachable"));
assert.ok(vip.segments.includes("manual_embajadores"));
assert.deepEqual(vip.consent.marketingChannels, ["email"]);
assert.equal(vip.nextBestAction.type, "follow_proposal");
assert.ok(vip.timeline.some((item) => item.type === "booking"));
assert.ok(vip.timeline.some((item) => item.type === "conversation"));

assert.equal(risk.metrics.completedVisits, 2);
assert.equal(risk.metrics.noShows, 1);
assert.equal(risk.metrics.totalSpent, 300);
assert.equal(risk.finance.outstandingBalance, 250);
assert.equal(risk.finance.overdueBalance, 250);
assert.ok(risk.risk.score >= 70);
assert.ok(risk.segments.includes("at_risk"));
assert.ok(risk.segments.includes("open_balance"));
assert.equal(risk.nextBestAction.type, "collect_payment");

assert.ok(result.summary.revenue >= 1510);
assert.ok(result.summary.estimatedLtv > result.summary.revenue);
assert.ok(result.segments.find((segment) => segment.id === "vip")?.count >= 1);
assert.equal(result.segments.find((segment) => segment.id === "manual_embajadores")?.sample[0].name, "Clara VIP 360");
const vipOnly = buildCustomer360(db, businessId, { now, segment: "vip" });
assert.ok(vipOnly.customers.every((profile) => profile.segments.includes("vip")));
const detail = buildCustomer360Detail(db, businessId, ids.vip, { now, timelineLimit: 40 });
assert.equal(detail.customer.contact.name, "Clara VIP 360");
assert.ok(detail.customer.timeline.length >= vip.timeline.length);

console.log("Customer 360 model checks passed: unified records, revenue, RFM, risk, consent, segments and next best action.");
