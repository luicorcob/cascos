import assert from "node:assert/strict";
import { appendConsentEvent } from "../lib/consent-model.mjs";
import {
  LIFECYCLE_CAMPAIGN_TEMPLATES,
  createCampaign,
  getCampaign,
  previewCampaign,
  processCampaignBatch,
  recordCampaignConversion,
  recordCampaignDelivery,
  recordCampaignResponse,
  recordCampaignUnsubscribe,
  scheduleCampaign,
  setCampaignStatus,
  updateCampaign
} from "../lib/campaign-model.mjs";
import { runCampaignWorker } from "./run-campaign-worker.mjs";

const businessId = "biz_campaign_test";
const now = "2026-07-17T10:00:00.000Z";
const contacts = [
  contact("eligible", "Ada Elegible", "ada@example.com"),
  contact("missing", "Bruno Sin Email", ""),
  contact("no-consent", "Carla Sin Permiso", "carla@example.com"),
  { ...contact("excluded", "Diego Excluido", "diego@example.com"), tags: ["blocked"] },
  contact("frequency", "Eva Frecuencia", "eva@example.com")
];
const db = {
  businesses: [{ id: businessId, slug: "campaign-test", name: "Campaign Test", settings: { timezone: "Europe/Madrid" } }],
  contacts,
  consentEvents: [], campaigns: [], campaignRecipients: [], campaignEvents: [], auditLog: [],
  activities: [], accounts: [], associations: [], pipelines: [], deals: [], tasks: [], proposals: [], projects: [], projectTasks: [], subscriptions: [], invoices: [], payments: [], documents: [], teamMembers: [], hospitalityInvoices: [], communicationThreads: [], communicationMessages: [], bookings: [], services: []
};

for (const id of ["eligible", "missing", "excluded", "frequency"]) grant(db, id, "email", "marketing");
db.campaignRecipients.push({ id: "previous_frequency", businessId, campaignId: "previous", contactId: "frequency", channel: "email", purpose: "marketing", status: "sent", sentAt: "2026-07-16T10:00:00.000Z", attributedRevenue: 0, updatedAt: "2026-07-16T10:00:00.000Z" });

assert.equal(LIFECYCLE_CAMPAIGN_TEMPLATES.length, 4);
const created = createCampaign(db, businessId, {
  name: "Reactivacion magistral", channel: "email", purpose: "marketing", subject: "Hola {{contact.name}}", body: "Vuelve, {{contact.name}}", variants: [{ key: "A", name: "Control", weight: 50, subject: "A {{contact.name}}", body: "Mensaje A" }, { key: "B", name: "Reto", weight: 50, subject: "B {{contact.name}}", body: "Mensaje B" }], contactIds: contacts.map((item) => item.id), exclusions: { tags: ["blocked"] }, quietHours: { enabled: false }, frequencyCapDays: 7, batchSize: 2
}, now);
assert.equal(created.status, "draft");
assert.equal(created.revision, 1);

const edited = updateCampaign(db, businessId, created.id, { segmentKey: "marketing_reachable", body: "Tenemos novedades, {{contact.name}}" }, now);
assert.equal(edited.audience.type, "segment", "Changing to a segment must discard the previous static list");
updateCampaign(db, businessId, created.id, { contactIds: contacts.map((item) => item.id) }, now);

const preview = previewCampaign(db, businessId, created.id, { now });
assert.equal(preview.total, 5);
assert.equal(preview.eligible.length, 1);
assert.match(preview.sample[0].rendered.subject, /^[AB] Ada Elegible$/);
assert.ok(["A", "B"].includes(preview.sample[0].rendered.variantKey));
assert.equal(preview.blockedReasons.missing_email, 1);
assert.equal(preview.blockedReasons.no_grant, 1);
assert.equal(preview.blockedReasons.excluded_tag, 1);
assert.equal(preview.blockedReasons.frequency_cap, 1);

const scheduled = scheduleCampaign(db, businessId, created.id, { scheduledAt: now }, now);
assert.equal(scheduled.campaign.metrics.queued, 1);
assert.equal(scheduled.campaign.metrics.blocked, 4);
const processed = await processCampaignBatch(db, businessId, created.id, { now, sendExecutor: async () => ({ providerMessageId: "provider_campaign_1", messageId: "message_campaign_1", deliveryStatus: "sent" }) });
assert.equal(processed.processed, 1);
assert.equal(processed.campaign.status, "completed");
assert.equal(processed.campaign.metrics.sent, 1);
assert.equal(processed.campaign.metrics.variants.length, 1);

recordCampaignDelivery(db, businessId, "provider_campaign_1", "delivered", "2026-07-17T10:01:00.000Z");
recordCampaignResponse(db, businessId, "eligible", "2026-07-17T10:02:00.000Z");
recordCampaignConversion(db, businessId, "eligible", { type: "booking", revenue: 149.9 }, "2026-07-17T10:03:00.000Z");
let attributed = getCampaign(db, businessId, created.id);
assert.equal(attributed.metrics.delivered, 1);
assert.equal(attributed.metrics.responded, 1);
assert.equal(attributed.metrics.converted, 1);
assert.equal(attributed.metrics.attributedRevenue, 149.9);
recordCampaignUnsubscribe(db, businessId, "eligible", { reason: "withdrawn" }, "2026-07-17T10:04:00.000Z");
attributed = getCampaign(db, businessId, created.id);
assert.equal(attributed.metrics.unsubscribed, 1);
assert.ok(attributed.events.some((event) => event.type === "recipient.unsubscribed"));

const quiet = createCampaign(db, businessId, { templateKey: "welcome", name: "Bienvenida programada", channel: "email", contactIds: ["eligible"], quietHours: { enabled: true, start: "12:00", end: "20:00", days: [5] }, timezone: "UTC", frequencyCapDays: 0 }, now);
scheduleCampaign(db, businessId, quiet.id, {}, now);
const waiting = await processCampaignBatch(db, businessId, quiet.id, { now, sendExecutor: async () => { throw new Error("Must not send during quiet hours"); } });
assert.equal(waiting.waitingForQuietHours, true);
assert.equal(waiting.nextProcessAt, "2026-07-17T12:00:00.000Z");
setCampaignStatus(db, businessId, quiet.id, "paused", now);
assert.equal(setCampaignStatus(db, businessId, quiet.id, "scheduled", now).status, "scheduled");

let saved = false;
const worker = await runCampaignWorker({
  now: "2026-07-17T12:00:00.000Z", businessId,
  loadBusinessStore: async () => db,
  saveBusinessStore: async () => { saved = true; },
  sendExecutor: async () => ({ providerMessageId: "provider_worker", messageId: "message_worker", deliveryStatus: "sent" })
});
assert.equal(worker.processedCampaigns, 1);
assert.equal(saved, true);
assert.equal(getCampaign(db, businessId, quiet.id).status, "completed");
assert.ok(db.auditLog.some((item) => item.type === "campaign.scheduled"));
console.log("Campaign model checks passed: templates, revisions, audiences, consent, exclusions, frequency caps, snapshots, quiet hours, batches, attribution, unsubscribe and worker processing.");

function contact(id, name, email) { return { id, businessId, name, email, phone: `+34600000${id.length}`, status: "cliente", tags: [], merged: false, createdAt: "2026-07-01T10:00:00.000Z", updatedAt: now }; }
function grant(store, contactId, channel, purpose) { appendConsentEvent(store, { businessId, contactId, channel, purpose, action: "granted", lawfulBasis: "consent", source: "test", occurredAt: "2026-07-01T10:00:00.000Z" }); }
