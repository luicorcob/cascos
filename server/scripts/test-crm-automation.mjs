import assert from "node:assert/strict";
import {
  applyAcceptedProposalAutomation,
  applyDailyLeadInactivityAutomation,
  applyNewLeadAutomation,
  applyPublishedDemoAutomation,
  buildCompletedBookingReviewSuggestion,
  isHumanCrmActivity,
  normalizeAutomationNow,
  normalizeInactivityDays,
  preferredContactActionType
} from "../lib/crm-automation.mjs";
import {
  parseCrmAutomationArgs,
  runCrmDailyAutomation
} from "./run-crm-daily-automation.mjs";

const NOW = new Date("2026-07-13T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

testOptionsAndActivityClassification();
testNewLeadAutomation();
testPublishedDemoAutomation();
testAcceptedProposalAutomation();
testDailyInactivityAutomation();
testReviewSuggestionBuilder();
await testDailyRunner();

console.log("CRM automation tests passed");

function testOptionsAndActivityClassification() {
  assert.equal(preferredContactActionType({ phone: "+34 600 000 000", email: "a@example.com" }), "whatsapp");
  assert.equal(preferredContactActionType({ email: "a@example.com" }), "email");
  assert.equal(preferredContactActionType({}), "llamada");
  assert.equal(normalizeInactivityDays(undefined), 7);
  assert.equal(normalizeInactivityDays("14"), 14);
  assert.throws(() => normalizeInactivityDays(0), /between 1 and 3650/);
  assert.throws(() => normalizeInactivityDays("7.5"), /between 1 and 3650/);
  assert.equal(normalizeAutomationNow(NOW).toISOString(), NOW.toISOString());
  assert.throws(() => normalizeAutomationNow("not-a-date"), /valid date/);

  assert.equal(isHumanCrmActivity(activity("note", "dashboard", { note: "Llamada realizada" })), true);
  assert.equal(isHumanCrmActivity(activity("contact.status_changed", "crm-proposals")), true);
  assert.equal(isHumanCrmActivity(activity("next_action.completed", "dashboard")), true);
  assert.equal(isHumanCrmActivity(activity("contact.created", "manual", { note: "Alta" })), false);
  assert.equal(isHumanCrmActivity(activity("booking.updated", "dashboard", { note: "Reserva" })), false);
  assert.equal(isHumanCrmActivity(activity("note", "crm-automation", { note: "Automática" })), false);
  assert.equal(isHumanCrmActivity(activity("note", "dashboard", { metadata: { automated: true }, note: "Automática" })), false);
  assert.equal(isHumanCrmActivity(activity("unknown", "dashboard")), false);
  assert.equal(isHumanCrmActivity(activity("unknown", "dashboard", { title: "Actividad manual" })), true);
}

function testNewLeadAutomation() {
  const store = {
    contacts: [
      contact("lead_phone", "biz_a", { phone: "+34 600 111 222", email: "phone@example.com", lastInteractionAt: "2026-07-12T08:00:00.000Z" }),
      contact("lead_email", "biz_a", { email: "email@example.com" }),
      contact("lead_fallback", "biz_a"),
      contact("lead_manual", "biz_a", {
        nextAction: manualAction("reunion", "2026-07-14T09:00:00.000Z")
      }),
      contact("lead_contacted", "biz_a", { status: "contacted" }),
      contact("customer_new", "biz_a", { type: "customer", status: "new" }),
      contact("lead_merged", "biz_a", { merged: true }),
      contact("lead_phone", "biz_b", { phone: "+34 699 000 000" })
    ],
    activities: [
      crmActivity("spoof_other_tenant", "biz_b", "lead_email", "automation.created", NOW.toISOString(), "crm-automation", {
        metadata: { automated: true, automationKey: "new-lead-response:biz_a:lead_email" }
      }),
      crmActivity("spoof_other_contact", "biz_a", "lead_phone", "automation.created", NOW.toISOString(), "crm-automation", {
        metadata: { automated: true, automationKey: "new-lead-response:biz_a:lead_email" }
      })
    ]
  };
  const phoneLastInteraction = store.contacts[0].lastInteractionAt;
  const manualSnapshot = JSON.stringify(store.contacts[3].nextAction);
  const phone = applyNewLeadAutomation(store, store.contacts[0], { now: NOW });
  const email = applyNewLeadAutomation(store, store.contacts[1], { now: NOW });
  const fallback = applyNewLeadAutomation(store, store.contacts[2], { now: NOW });

  assert.equal(phone.applied, true);
  assert.equal(phone.nextAction.type, "whatsapp");
  assert.equal(email.nextAction.type, "email");
  assert.equal(email.applied, true, "A forged key from another tenant/contact must not block automation");
  assert.equal(fallback.nextAction.type, "llamada");
  assert.equal(phone.nextAction.dueDate, NOW.toISOString());
  assert.equal(phone.nextAction.status, "pendiente");
  assert.equal(phone.nextAction.note, "Responder hoy");
  assert.equal(store.contacts[0].lastInteractionAt, phoneLastInteraction, "Automation must not impersonate human interaction");
  assert.ok(store.activities.every((item) => item.metadata.automated === true));
  assert.ok(store.activities.every((item) => !isHumanCrmActivity(item)));

  assert.equal(applyNewLeadAutomation(store, store.contacts[3], { now: NOW }).reason, "existing-next-action");
  assert.equal(JSON.stringify(store.contacts[3].nextAction), manualSnapshot, "Manual actions must be preserved byte-for-byte");
  assert.equal(applyNewLeadAutomation(store, store.contacts[4], { now: NOW }).reason, "not-new-lead");
  assert.equal(applyNewLeadAutomation(store, store.contacts[5], { now: NOW }).reason, "not-new-lead");
  assert.equal(applyNewLeadAutomation(store, store.contacts[6], { now: NOW }).reason, "contact-not-found");
  assert.equal(applyNewLeadAutomation(store, { id: "missing", businessId: "biz_a" }, { now: NOW }).reason, "contact-not-found");

  const activitiesAfterFirstPass = store.activities.length;
  assert.equal(applyNewLeadAutomation(store, store.contacts[0], { now: NOW }).reason, "existing-next-action");
  store.contacts[0].nextAction = null;
  assert.equal(applyNewLeadAutomation(store, store.contacts[0], { now: NOW }).reason, "already-applied");
  assert.equal(store.contacts[0].nextAction, null, "A completed or cleared automatic action must not be recreated by replay");
  assert.equal(store.activities.length, activitiesAfterFirstPass);

  const deterministicStore = { contacts: [contact("lead_phone", "biz_a", { phone: "+34 600 111 222", email: "phone@example.com", lastInteractionAt: phoneLastInteraction })], activities: [] };
  const deterministic = applyNewLeadAutomation(deterministicStore, deterministicStore.contacts[0], { now: NOW });
  assert.deepEqual(deterministic.nextAction, phone.nextAction);
  assert.deepEqual(deterministic.activity, phone.activity);
}

function testPublishedDemoAutomation() {
  const manual = manualAction("enviar_propuesta", "2026-07-20T09:00:00.000Z");
  const store = {
    contacts: [
      contact("demo_contact", "biz_a", { email: "demo@example.com", status: "contacted", lastInteractionAt: "2026-07-10T08:00:00.000Z" }),
      contact("manual_contact", "biz_a", { nextAction: manual }),
      contact("demo_contact", "biz_b", { phone: "+34 611 222 333" })
    ],
    activities: []
  };
  const linkedDemo = {
    businessId: "biz_a",
    contactId: "demo_contact",
    demo: {
      id: "demo_001",
      url: "https://demos.example.test/demo_001/",
      createdAt: "2026-07-12T10:00:00.000Z"
    }
  };
  const interactionBefore = store.contacts[0].lastInteractionAt;
  const result = applyPublishedDemoAutomation(store, linkedDemo, { now: NOW });

  assert.equal(result.applied, true);
  assert.equal(result.nextAction.type, "email");
  assert.equal(result.nextAction.dueDate, "2026-07-14T10:00:00.000Z", "The deadline must be anchored to publication time");
  assert.equal(result.nextAction.note, "Seguimiento de demo publicada en 48h");
  assert.equal(result.activity.metadata.demoId, "demo_001");
  assert.equal(store.contacts[0].lastInteractionAt, interactionBefore);

  assert.equal(applyPublishedDemoAutomation(store, {
    businessId: "biz_a",
    email: "demo@example.com",
    demo: { id: "demo_unlinked" }
  }, { now: NOW }).reason, "explicit-contact-link-required", "Email matching must never replace explicit linkage");
  assert.equal(applyPublishedDemoAutomation(store, {
    businessId: "biz_missing",
    contactId: "demo_contact",
    demo: { id: "demo_cross_tenant" }
  }, { now: NOW }).reason, "contact-not-found");

  const manualSnapshot = JSON.stringify(store.contacts[1].nextAction);
  assert.equal(applyPublishedDemoAutomation(store, {
    businessId: "biz_a",
    contactId: "manual_contact",
    id: "demo_manual"
  }, { now: NOW }).reason, "existing-next-action");
  assert.equal(JSON.stringify(store.contacts[1].nextAction), manualSnapshot);

  const activityCount = store.activities.length;
  assert.equal(applyPublishedDemoAutomation(store, linkedDemo, { now: NOW }).reason, "existing-next-action");
  store.contacts[0].nextAction = null;
  assert.equal(applyPublishedDemoAutomation(store, linkedDemo, { now: NOW }).reason, "already-applied");
  assert.equal(store.activities.length, activityCount);

  const fallbackDateStore = { contacts: [contact("fallback_date", "biz_a")], activities: [] };
  const fallbackDate = applyPublishedDemoAutomation(fallbackDateStore, {
    businessId: "biz_a",
    contactId: "fallback_date",
    id: "demo_fallback_date",
    publishedAt: "invalid"
  }, { now: NOW });
  assert.equal(fallbackDate.nextAction.dueDate, "2026-07-15T08:00:00.000Z");
}

function testAcceptedProposalAutomation() {
  const store = {
    contacts: [
      contact("proposal_contact", "biz_a", {
        status: "lost",
        lostReason: "precio",
        score: 0,
        scoreLabel: "perdido",
        lastInteractionAt: "2026-07-01T08:00:00.000Z"
      }),
      contact("already_customer", "biz_a", { type: "customer", status: "customer", score: 0, scoreLabel: "perdido" }),
      contact("merged_contact", "biz_a", { merged: true }),
      contact("proposal_contact", "biz_b", { status: "waiting" })
    ],
    activities: []
  };
  const proposal = {
    id: "proposal_accepted",
    businessId: "biz_a",
    contactId: "proposal_contact",
    status: "aceptada"
  };
  const result = applyAcceptedProposalAutomation(store, proposal, { now: NOW });
  const converted = store.contacts[0];

  assert.equal(result.applied, true);
  assert.equal(result.reason, "converted");
  assert.equal(converted.status, "customer");
  assert.equal(converted.type, "lead", "Conversion follows the current API and changes status, not the contact data type");
  assert.equal(converted.lostReason, "");
  assert.equal(converted.lastInteractionAt, NOW.toISOString());
  assert.equal(converted.updatedAt, NOW.toISOString());
  assert.notEqual(converted.scoreLabel, "perdido", "Accepted conversion must recalculate the stale lost score label");
  assert.equal(result.activity.metadata.proposalId, proposal.id);
  assert.equal(store.activities.length, 1);

  assert.equal(applyAcceptedProposalAutomation(store, proposal, { now: NOW }).reason, "already-customer");
  assert.equal(store.activities.length, 1);
  converted.status = "waiting";
  const reconciled = applyAcceptedProposalAutomation(store, proposal, { now: NOW });
  assert.equal(reconciled.applied, true);
  assert.equal(reconciled.reason, "reconciled");
  assert.equal(converted.status, "customer");
  assert.equal(store.activities.length, 1, "Reconciliation must reuse the deterministic activity");

  assert.equal(applyAcceptedProposalAutomation(store, { ...proposal, id: "draft", status: "enviada" }, { now: NOW }).reason, "proposal-not-accepted");
  assert.equal(applyAcceptedProposalAutomation(store, { ...proposal, id: "wrong_tenant", businessId: "missing" }, { now: NOW }).reason, "contact-not-found");
  assert.equal(applyAcceptedProposalAutomation(store, { ...proposal, id: "merged", contactId: "merged_contact" }, { now: NOW }).reason, "contact-not-found");
  const alreadyCustomerSnapshot = JSON.stringify(store.contacts[1]);
  assert.equal(applyAcceptedProposalAutomation(store, { ...proposal, id: "customer", contactId: "already_customer" }, { now: NOW }).reason, "already-customer");
  assert.equal(JSON.stringify(store.contacts[1]), alreadyCustomerSnapshot, "An already-customer result must be a true no-op");
}

function testDailyInactivityAutomation() {
  const store = inactivityFixture();
  const preserved = new Map(store.contacts.map((item) => [
    `${item.businessId}:${item.id}`,
    {
      hasLastInteractionAt: Object.prototype.hasOwnProperty.call(item, "lastInteractionAt"),
      lastInteractionAt: item.lastInteractionAt,
      hasScoreLabel: Object.prototype.hasOwnProperty.call(item, "scoreLabel"),
      scoreLabel: item.scoreLabel
    }
  ]));
  const summary = applyDailyLeadInactivityAutomation(store, { now: NOW });

  assert.equal(summary.scanned, 15);
  assert.equal(summary.created, 7);
  assert.deepEqual(summary.skipped, {
    notOpenLead: 3,
    existingNextAction: 1,
    invalidCreatedAt: 2,
    recentHumanActivity: 2,
    alreadyApplied: 0
  });
  assert.deepEqual(summary.changes.map((item) => item.contactId), [
    "auto_recent",
    "booking_activity",
    "created_activity",
    "exact_seven",
    "future_human",
    "human_old",
    "other_tenant"
  ]);
  assert.ok(summary.changes.every((item) => item.nextAction.dueDate === NOW.toISOString()));
  assert.equal(findContact(store, "exact_seven").nextAction.type, "whatsapp");
  assert.equal(findContact(store, "auto_recent").nextAction.type, "email");
  assert.equal(findContact(store, "human_old").nextAction.type, "llamada");

  store.contacts.forEach((item) => {
    const before = preserved.get(`${item.businessId}:${item.id}`);
    assert.equal(Object.prototype.hasOwnProperty.call(item, "lastInteractionAt"), before.hasLastInteractionAt, `${item.id}: lastInteractionAt presence changed`);
    assert.equal(item.lastInteractionAt, before.lastInteractionAt, `${item.id}: lastInteractionAt changed`);
    assert.equal(Object.prototype.hasOwnProperty.call(item, "scoreLabel"), before.hasScoreLabel, `${item.id}: scoreLabel presence changed`);
    assert.equal(item.scoreLabel, before.scoreLabel, `${item.id}: scoreLabel changed`);
  });
  const generatedActivities = store.activities.filter((item) => item.type === "automation.review_scheduled");
  assert.equal(generatedActivities.length, 7);
  assert.ok(generatedActivities.every((item) => item.metadata.automated && !isHumanCrmActivity(item)));
  assert.equal(new Set(generatedActivities.map((item) => item.id)).size, generatedActivities.length);

  const secondPass = applyDailyLeadInactivityAutomation(store, { now: NOW });
  assert.equal(secondPass.created, 0);
  assert.equal(store.activities.filter((item) => item.type === "automation.review_scheduled").length, 7);

  findContact(store, "exact_seven").nextAction = null;
  const clearedReplay = applyDailyLeadInactivityAutomation(store, { now: NOW });
  assert.equal(clearedReplay.created, 0);
  assert.equal(clearedReplay.skipped.alreadyApplied, 1);
  assert.equal(findContact(store, "exact_seven").nextAction, null, "Replay must respect a cleared automated review");

  store.activities.push({
    id: "human_after_first_cycle",
    businessId: "biz_a",
    contactId: "exact_seven",
    type: "note",
    source: "dashboard",
    note: "Contacto humano posterior",
    createdAt: new Date(NOW.getTime() + DAY_MS).toISOString()
  });
  const nextCycleNow = new Date(NOW.getTime() + 9 * DAY_MS);
  const nextCycle = applyDailyLeadInactivityAutomation(store, {
    now: nextCycleNow,
    businessId: "biz_a"
  });
  assert.ok(nextCycle.changes.some((item) => item.contactId === "exact_seven"), "A new human-interaction anchor must permit a later inactivity cycle");

  const scopedStore = inactivityFixture();
  const scoped = applyDailyLeadInactivityAutomation(scopedStore, { now: NOW, businessId: "biz_a" });
  assert.equal(scoped.businessId, "biz_a");
  assert.equal(scoped.created, 6);
  assert.equal(findContact(scopedStore, "other_tenant", "biz_b").nextAction, null);

  const customThresholdStore = {
    contacts: [contact("threshold_contact", "biz_a", { createdAt: isoDaysBefore(9) })],
    activities: []
  };
  assert.equal(applyDailyLeadInactivityAutomation(customThresholdStore, { now: NOW, thresholdDays: 10 }).created, 0);
}

function testReviewSuggestionBuilder() {
  const store = {
    businesses: [{
      id: "biz_a",
      name: "Alpha",
      integrations: { google: { reviewUrl: "https://example.test/review/alpha" } }
    }, {
      id: "biz_b",
      name: "Beta",
      reviewUrl: "https://example.test/review/beta"
    }],
    contacts: [
      contact("other_tenant_contact", "biz_b", { email: "shared@example.com", phone: "+34 699 999 999" }),
      contact("booking_contact", "biz_a", { name: "Cliente Alpha", email: "shared@example.com", phone: "+34 600 123 456" })
    ],
    bookings: []
  };
  const booking = {
    id: "booking_completed",
    businessId: "biz_a",
    contactId: "booking_contact",
    serviceName: "Consulta premium",
    customerName: "Nombre de reserva",
    email: "shared@example.com",
    status: "completed",
    startsAt: "2026-07-12T08:00:00.000Z",
    endsAt: "2026-07-12T09:00:00.000Z",
    updatedAt: "2026-07-12T09:05:00.000Z"
  };
  const snapshot = JSON.stringify(store);
  const bookingSnapshot = JSON.stringify(booking);
  const suggestion = buildCompletedBookingReviewSuggestion(store, booking, { now: NOW });

  assert.equal(suggestion.id, "review:booking_completed");
  assert.equal(suggestion.type, "review.suggested");
  assert.equal(suggestion.businessId, "biz_a");
  assert.equal(suggestion.contactId, "booking_contact");
  assert.equal(suggestion.date, booking.updatedAt);
  assert.equal(suggestion.reviewUrl, "https://example.test/review/alpha");
  assert.equal(suggestion.recommendedActionType, "whatsapp");
  assert.equal(suggestion.suggestedNextAction.type, "whatsapp");
  assert.equal(suggestion.suggestedNextAction.dueDate, NOW.toISOString());
  assert.equal(suggestion.contact.name, "Cliente Alpha");
  assert.equal(JSON.stringify(store), snapshot, "Suggestion builder must never persist a collection or mutate the store");
  assert.equal(JSON.stringify(booking), bookingSnapshot, "Suggestion builder must not mutate the booking");
  assert.equal(Object.prototype.hasOwnProperty.call(store, "reviewSuggestions"), false);

  const emailSuggestion = buildCompletedBookingReviewSuggestion(store, {
    ...booking,
    id: "booking_email",
    contactId: "",
    phone: ""
  }, { now: NOW });
  assert.equal(emailSuggestion.contactId, "booking_contact");
  assert.equal(emailSuggestion.recommendedActionType, "whatsapp", "Matched contact data can provide the preferred channel");

  const tenantBSuggestion = buildCompletedBookingReviewSuggestion(store, {
    ...booking,
    id: "booking_beta",
    businessId: "biz_b",
    contactId: "",
    phone: "",
    updatedAt: "2026-07-12T09:10:00.000Z"
  }, { now: NOW });
  assert.equal(tenantBSuggestion.contactId, "other_tenant_contact");
  assert.equal(tenantBSuggestion.reviewUrl, "https://example.test/review/beta");

  assert.equal(buildCompletedBookingReviewSuggestion(store, { ...booking, status: "confirmed" }, { now: NOW }), null);
  assert.equal(buildCompletedBookingReviewSuggestion(store, { ...booking, updatedAt: "2026-07-14T09:00:00.000Z" }, { now: NOW }), null);
  assert.equal(buildCompletedBookingReviewSuggestion(store, { ...booking, updatedAt: "invalid", endsAt: "", startsAt: "" }, { now: NOW }), null);

  const withoutId = { ...booking, id: "", contactId: "", email: "anonymous@example.com" };
  assert.deepEqual(
    buildCompletedBookingReviewSuggestion(store, withoutId, { now: NOW }),
    buildCompletedBookingReviewSuggestion(store, withoutId, { now: NOW }),
    "Suggestion IDs and content must be deterministic"
  );
}

async function testDailyRunner() {
  const store = {
    businesses: [{ id: "biz_a", slug: "alpha" }],
    contacts: [
      contact("runner_stale_a", "biz_a", { createdAt: isoDaysBefore(8) }),
      contact("runner_stale_b", "biz_a", { status: "waiting", createdAt: isoDaysBefore(12) })
    ],
    activities: []
  };
  let loads = 0;
  let saves = 0;
  let savedReference = null;
  let savedLabel = "";
  const dependencies = {
    loadBusinessStore: async (context, fallback) => {
      loads += 1;
      assert.ok(context.root);
      assert.ok(Array.isArray(fallback.contacts));
      return store;
    },
    saveBusinessStore: async (db, context, label) => {
      saves += 1;
      savedReference = db;
      savedLabel = label;
      assert.ok(context.root);
      return db;
    }
  };
  const first = await runCrmDailyAutomation({ now: NOW, ...dependencies });

  assert.equal(loads, 1, "Runner must load the store exactly once");
  assert.equal(saves, 1, "Runner must persist all changes in one save");
  assert.equal(savedReference, store);
  assert.equal(savedLabel, "crm-daily-automation");
  assert.equal(first.ok, true);
  assert.equal(first.saved, true);
  assert.equal(first.created, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first, "Runner summary must be JSON serializable");

  const second = await runCrmDailyAutomation({ now: NOW, ...dependencies });
  assert.equal(loads, 2, "Each run performs one load");
  assert.equal(saves, 1, "An idempotent no-op run must not rewrite the store");
  assert.equal(second.saved, false);
  assert.equal(second.created, 0);

  assert.deepEqual(parseCrmAutomationArgs([
    "--now=2026-07-13T08:00:00.000Z",
    "--threshold-days", "10",
    "--business=biz_a"
  ]), {
    now: NOW.toISOString(),
    thresholdDays: 10,
    businessId: "biz_a"
  });
  assert.throws(() => parseCrmAutomationArgs(["--unknown"]), /Unknown argument/);
  assert.throws(() => parseCrmAutomationArgs(["--now", "--business", "biz_a"]), /requires a value/);
  assert.throws(() => parseCrmAutomationArgs(["--threshold-days=0"]), /between 1 and 3650/);
}

function inactivityFixture() {
  return {
    contacts: [
      contact("exact_seven", "biz_a", { phone: "+34 600 000 001", createdAt: isoDaysBefore(7), lastInteractionAt: NOW.toISOString(), scoreLabel: "caliente" }),
      contact("auto_recent", "biz_a", { status: "contacted", email: "auto@example.com", createdAt: isoDaysBefore(10), scoreLabel: "templado" }),
      contact("recent_contact", "biz_a", { createdAt: new Date(NOW.getTime() - 7 * DAY_MS + 1).toISOString() }),
      contact("human_recent", "biz_a", { status: "waiting", createdAt: isoDaysBefore(12) }),
      contact("human_old", "biz_a", { status: "waiting", createdAt: isoDaysBefore(20) }),
      contact("manual_action", "biz_a", { createdAt: isoDaysBefore(30), nextAction: manualAction("reunion", NOW.toISOString()) }),
      contact("lost_contact", "biz_a", { status: "lost", createdAt: isoDaysBefore(30) }),
      contact("customer_contact", "biz_a", { type: "customer", status: "new", createdAt: isoDaysBefore(30) }),
      contact("merged_contact", "biz_a", { merged: true, createdAt: isoDaysBefore(30) }),
      contact("invalid_created", "biz_a", { createdAt: "invalid" }),
      contact("future_created", "biz_a", { createdAt: new Date(NOW.getTime() + DAY_MS).toISOString() }),
      contact("other_tenant", "biz_b", { createdAt: isoDaysBefore(8) }),
      contact("booking_activity", "biz_a", { status: "reserved", createdAt: isoDaysBefore(10) }),
      contact("created_activity", "biz_a", { createdAt: isoDaysBefore(10) }),
      contact("future_human", "biz_a", { createdAt: isoDaysBefore(10) })
    ],
    activities: [
      crmActivity("automated_recent", "biz_a", "auto_recent", "note", isoDaysBefore(1), "crm-automation", { note: "No debe contar", metadata: { automated: true } }),
      crmActivity("human_recent_activity", "biz_a", "human_recent", "note", isoDaysBefore(6), "dashboard", { note: "Contacto real" }),
      crmActivity("human_old_activity", "biz_a", "human_old", "message.sent", isoDaysBefore(8), "dashboard", { note: "Mensaje real" }),
      crmActivity("booking_recent", "biz_a", "booking_activity", "booking.updated", isoDaysBefore(1), "dashboard", { note: "Reserva actualizada" }),
      crmActivity("creation_recent", "biz_a", "created_activity", "contact.created", isoDaysBefore(1), "manual", { note: "Creación" }),
      crmActivity("future_activity", "biz_a", "future_human", "note", new Date(NOW.getTime() + DAY_MS).toISOString(), "dashboard", { note: "Fecha futura" })
    ]
  };
}

function contact(id, businessId, overrides = {}) {
  return {
    id,
    businessId,
    type: "lead",
    name: id,
    phone: "",
    email: "",
    status: "new",
    nextAction: null,
    merged: false,
    createdAt: isoDaysBefore(1),
    updatedAt: isoDaysBefore(1),
    ...overrides
  };
}

function manualAction(type, dueDate) {
  return {
    type,
    dueDate,
    status: "pendiente",
    note: "Acción manual",
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z"
  };
}

function activity(type, source, overrides = {}) {
  return {
    id: `${type}_${source}`,
    businessId: "biz_a",
    contactId: "contact_a",
    type,
    source,
    title: "",
    note: "",
    metadata: {},
    createdAt: NOW.toISOString(),
    ...overrides
  };
}

function crmActivity(id, businessId, contactId, type, createdAt, source, overrides = {}) {
  return {
    id,
    businessId,
    contactId,
    type,
    source,
    title: "",
    note: "",
    metadata: {},
    createdAt,
    ...overrides
  };
}

function findContact(store, id, businessId = "biz_a") {
  const value = store.contacts.find((item) => item.id === id && item.businessId === businessId);
  assert.ok(value, `Missing fixture contact ${businessId}/${id}`);
  return value;
}

function isoDaysBefore(days) {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}
