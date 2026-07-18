import assert from "node:assert/strict";
import {
  answerMetricQuery,
  buildIntelligenceCenter,
  buildMetricDictionary,
  buildPredictions,
  confirmCopilotAction,
  createCopilotDraft,
  upsertAnalyticsFunnel,
  upsertBusinessGoal,
  upsertPredictionSettings
} from "../lib/intelligence-model.mjs";

const businessId = "biz_intelligence_model";
const now = "2026-07-18T10:00:00.000Z";
const db = {
  businesses: [{ id: businessId, name: "Intelligence Bistro" }],
  contacts: [
    { id: "contact_a", businessId, name: "Ana", email: "ana@example.com", source: "google", createdAt: "2026-01-02T10:00:00.000Z" },
    { id: "contact_b", businessId, name: "Beto", email: "beto@example.com", source: "campaign", createdAt: "2026-02-03T10:00:00.000Z" },
    { id: "contact_c", businessId, name: "Carla", email: "carla@example.com", source: "referral", createdAt: "2026-03-03T10:00:00.000Z" }
  ],
  pipelines: [{
    id: "pipeline_sales",
    businessId,
    name: "Ventas",
    stages: [
      { id: "qualified", name: "Cualificada", probability: 30 },
      { id: "won", name: "Ganada", probability: 100 },
      { id: "lost", name: "Perdida", probability: 0 }
    ]
  }],
  deals: [
    { id: "deal_a", businessId, contactId: "contact_a", pipelineId: "pipeline_sales", stageId: "qualified", status: "won", createdAt: "2026-01-03T10:00:00.000Z" },
    { id: "deal_b", businessId, contactId: "contact_b", pipelineId: "pipeline_sales", stageId: "qualified", status: "won", createdAt: "2026-02-04T10:00:00.000Z" },
    { id: "deal_c", businessId, contactId: "contact_c", pipelineId: "pipeline_sales", stageId: "qualified", status: "lost", createdAt: "2026-03-04T10:00:00.000Z" }
  ],
  proposals: [
    { id: "proposal_a", businessId, contactId: "contact_a", status: "accepted", createdAt: "2026-01-04T10:00:00.000Z", acceptedAt: "2026-01-05T10:00:00.000Z" },
    { id: "proposal_b", businessId, contactId: "contact_b", status: "accepted", createdAt: "2026-02-05T10:00:00.000Z", acceptedAt: "2026-02-06T10:00:00.000Z" }
  ],
  bookings: [
    { id: "booking_a1", businessId, contactId: "contact_a", customerName: "Ana", serviceName: "Cena", status: "completed", startsAt: "2026-01-10T20:00:00.000Z", endsAt: "2026-01-10T21:30:00.000Z", partySize: 2 },
    { id: "booking_a2", businessId, contactId: "contact_a", customerName: "Ana", serviceName: "Cena", status: "completed", startsAt: "2026-02-10T20:00:00.000Z", endsAt: "2026-02-10T21:40:00.000Z", partySize: 2 },
    { id: "booking_b1", businessId, contactId: "contact_b", customerName: "Beto", serviceName: "Menu", status: "completed", startsAt: "2026-02-12T13:00:00.000Z", endsAt: "2026-02-12T14:30:00.000Z", partySize: 4 },
    { id: "booking_b2", businessId, contactId: "contact_b", customerName: "Beto", serviceName: "Menu", status: "confirmed", startsAt: "2026-07-18T13:00:00.000Z", endsAt: "2026-07-18T14:30:00.000Z", partySize: 6, depositRequired: true, depositStatus: "pending" },
    { id: "booking_c1", businessId, contactId: "contact_c", customerName: "Carla", serviceName: "Cena", status: "no-show", startsAt: "2026-04-01T20:00:00.000Z", endsAt: "2026-04-01T21:30:00.000Z", partySize: 2 }
  ],
  moneyRecords: [
    { id: "money_a", businessId, contactId: "contact_a", customerName: "Ana", status: "paid", total: 120, paidAmount: 120, currency: "EUR", dealId: "deal_a", createdAt: "2026-01-11T10:00:00.000Z" },
    { id: "money_b", businessId, contactId: "contact_b", customerName: "Beto", status: "paid", total: 200, paidAmount: 200, currency: "EUR", dealId: "deal_b", createdAt: "2026-02-13T10:00:00.000Z" }
  ],
  tasks: [{ id: "task_overdue", businessId, title: "Llamar a Carla", status: "open", dueAt: "2026-07-17T09:00:00.000Z" }],
  communicationThreads: [{ id: "thread_a", businessId, contactId: "contact_a", subject: "Reserva Ana", updatedAt: "2026-07-18T09:00:00.000Z" }],
  communicationMessages: [
    { id: "message_a1", businessId, threadId: "thread_a", body: "¿Tenéis mesa esta noche?", occurredAt: "2026-07-18T08:55:00.000Z" },
    { id: "message_a2", businessId, threadId: "thread_a", body: "Necesitamos confirmar alergias.", occurredAt: "2026-07-18T09:00:00.000Z" }
  ],
  bookingResources: [{ id: "capacity_main", businessId, name: "Aforo", type: "capacity", capacity: 20, active: true }],
  hospitalityInventory: [{ id: "stock_fish", businessId, name: "Pescado", unit: "kg", currentStock: 1, minStock: 2, active: true }],
  hospitalityExperiences: [],
  hospitalityShifts: [],
  invoices: [],
  hospitalityInvoices: [],
  payments: [],
  campaigns: [{ id: "campaign_a", businessId, name: "Reactivación", metrics: { attributedRevenue: 80 } }]
};

const funnel = upsertAnalyticsFunnel(db, businessId, {
  name: "Venta a visita",
  steps: [
    { id: "contact", label: "Contacto", entity: "contact" },
    { id: "deal", label: "Oportunidad", entity: "deal" },
    { id: "proposal", label: "Propuesta aceptada", entity: "proposal", statuses: ["accepted"] },
    { id: "booking", label: "Visita", entity: "booking", statuses: ["completed"] },
    { id: "money", label: "Cobro", entity: "money", statuses: ["paid"] }
  ]
}, null, now);
assert.equal(funnel.steps.length, 5);
upsertBusinessGoal(db, businessId, {
  name: "Ingresos julio",
  metricKey: "revenue.total",
  target: 500,
  scope: "business",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31"
}, null, now);
upsertBusinessGoal(db, businessId, {
  name: "Visitas de equipo",
  metricKey: "bookings.completed",
  target: 3,
  scope: "team",
  scopeId: "team_floor",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31"
}, null, now);
upsertPredictionSettings(db, businessId, { enabled: true, minSampleSize: 2, churnDays: 90 }, now);

const metrics = buildMetricDictionary(db, businessId, now);
assert.equal(metrics["revenue.total"].value, 320);
assert.equal(metrics["customers.repeat"].value, 1);
assert.equal(metrics["tasks.overdue"].sourceUrl, "?tab=today&queue=overdue");
const center = buildIntelligenceCenter(db, businessId, { now });
assert.equal(center.analytics.funnels[0].steps.length, 5);
assert.equal(center.analytics.funnels[0].steps[0].contacts, 3);
assert.ok(center.analytics.funnels[0].steps[1].medianTransitionHours >= 24);
assert.equal(center.analytics.cohorts.summary.repeated, 1);
assert.equal(center.analytics.revenue.total, 320);
assert.ok(center.analytics.revenue.byChannel.some((item) => item.key === "google"));
assert.equal(center.analytics.goals.length, 2);
assert.equal(center.analytics.goals[0].progressPercent, 64);
assert.ok(center.analytics.metrics.every((item) => item.description && item.sourceUrl && item.sourceCollection));

const predictions = buildPredictions(db, businessId, now);
const qualified = predictions.closeProbability.find((item) => item.stageId === "qualified");
assert.equal(qualified.modelUsed, "calibrated");
assert.equal(qualified.sampleSize, 3);
assert.notEqual(qualified.calibratedProbability, qualified.baselineProbability);
assert.ok(predictions.noShow.find((item) => item.bookingId === "booking_b2").factors.length >= 4);
assert.ok(predictions.churn.some((item) => item.contactId === "contact_a" && item.factors.length >= 3));
assert.ok(predictions.stock.some((item) => item.inventoryItemId === "stock_fish" && item.factors.length === 4));
assert.match(predictions.comparison.explanation, /muestra mínima/);
upsertPredictionSettings(db, businessId, { enabled: false, minSampleSize: 2 }, now);
assert.equal(buildPredictions(db, businessId, now).comparison.baselineOnly, true);

const revenueQuery = answerMetricQuery(db, businessId, "¿Cuántos ingresos tenemos?", now);
assert.equal(revenueQuery.answered, true);
assert.equal(revenueQuery.metric.key, "revenue.total");
assert.ok(revenueQuery.citations[0].sourceUrl);
assert.equal(answerMetricQuery(db, businessId, "¿Qué tiempo hará?", now).answered, false);

assert.ok(center.copilot.brief.priorities.some((item) => item.title === "Tareas vencidas" && item.citations[0].sourceId === "task_overdue"));
assert.ok(center.copilot.conversationSummaries[0].citations.some((item) => item.sourceId === "message_a2"));
assert.equal(center.copilot.suggestedDrafts[0].suggestedAction, "send");
assert.deepEqual(center.copilot.safety.requiresConfirmation.sort(), ["change_permissions", "charge", "delete", "publish", "send"].sort());

const draft = createCopilotDraft(db, businessId, {
  type: "response",
  title: "Responder alergias",
  content: "Gracias. Confirmamos las alergias antes de cerrar la reserva.",
  targetType: "conversation",
  targetId: "thread_a",
  suggestedAction: "send",
  citations: [{ sourceType: "message", sourceId: "message_a2", label: "Alergias", sourceUrl: "?tab=messages&message=message_a2" }]
}, { id: "manager_1" }, now);
assert.equal(draft.status, "draft");
assert.throws(() => confirmCopilotAction(db, businessId, { draftId: draft.id, action: "send", confirm: false }, { id: "manager_1" }, now), /Explicit confirmation/);
const confirmed = confirmCopilotAction(db, businessId, {
  draftId: draft.id,
  action: "send",
  confirm: true,
  confirmationText: "Confirmo el envío",
  idempotencyKey: "confirm-draft-1"
}, { type: "businessUser", id: "manager_1" }, now);
assert.equal(confirmed.event.actorId, "manager_1");
assert.equal(confirmed.event.automated, false);
assert.equal(confirmCopilotAction(db, businessId, { draftId: draft.id, action: "send", confirm: true, idempotencyKey: "confirm-draft-1" }, { id: "manager_1" }, now).duplicate, true);

console.log("Intelligence model checks passed: configurable funnels and conversion times, cohorts, attributed revenue, scoped goals, metric dictionary drilldowns, calibrated-vs-baseline predictions, visible risk factors, cited briefs/summaries, draft-only copilot, natural-language metrics and explicit confirmation.");
