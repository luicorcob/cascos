import {
  dealStatusForStage,
  ensureDefaultPipelineRecord,
  findPipelineStage,
  legacyStageId
} from "./deal-model.mjs";

export function migrateContactsToDeals(db, options = {}) {
  const now = options.now || new Date().toISOString();
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.pipelines = Array.isArray(db.pipelines) ? db.pipelines : [];
  db.deals = Array.isArray(db.deals) ? db.deals : [];

  const summary = {
    businessesScanned: db.businesses.length,
    contactsScanned: 0,
    pipelinesCreated: 0,
    dealsCreated: 0,
    dealsSkipped: 0,
    createdDealIds: []
  };

  for (const business of db.businesses) {
    const contacts = db.contacts.filter((contact) => isMigratableContact(contact, business.id));
    summary.contactsScanned += contacts.length;
    if (!contacts.length) continue;

    const pipelineResult = ensureDefaultPipelineRecord(db, business.id, now);
    if (pipelineResult.created) summary.pipelinesCreated += 1;
    const pipeline = pipelineResult.pipeline;

    for (const contact of contacts) {
      const exists = db.deals.some((deal) => (
        deal.businessId === business.id
        && (deal.legacyContactId === contact.id || deal.id === legacyDealId(contact.id))
      ));
      if (exists) {
        summary.dealsSkipped += 1;
        continue;
      }

      const stageId = legacyStageId(contact.status);
      const stage = findPipelineStage(pipeline, stageId) || pipeline.stages[0];
      const deal = {
        id: legacyDealId(contact.id),
        businessId: business.id,
        contactId: contact.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        title: `${clean(contact.name) || "Contacto"} · oportunidad inicial`,
        value: normalizeMoney(contact.valueEstimate),
        currency: business.content?.commerce?.currency || business.content?.currency || "EUR",
        probability: Number(stage.probability || 0),
        status: dealStatusForStage(stage),
        priority: ["alta", "media", "baja"].includes(contact.priority) ? contact.priority : "media",
        order: Number.isFinite(Number(contact.order)) ? Number(contact.order) : Date.parse(contact.createdAt || now),
        ownerId: "",
        expectedCloseAt: "",
        lostReason: stage.type === "lost" ? clean(contact.lostReason) : "",
        tags: Array.isArray(contact.tags) ? [...new Set(contact.tags.map(clean).filter(Boolean))].slice(0, 24) : [],
        notes: clean(contact.notes),
        source: clean(contact.source) || "legacy-contact",
        legacyContactId: contact.id,
        createdAt: contact.createdAt || now,
        updatedAt: now,
        closedAt: stage.type === "open" ? "" : (contact.updatedAt || now),
        wonAt: stage.type === "won" ? (contact.updatedAt || now) : "",
        lostAt: stage.type === "lost" ? (contact.updatedAt || now) : ""
      };
      db.deals.push(deal);
      summary.dealsCreated += 1;
      summary.createdDealIds.push(deal.id);
    }
  }

  return summary;
}

export function legacyDealId(contactId) {
  return `deal_legacy_${String(contactId || "contact").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 140)}`;
}

function isMigratableContact(contact, businessId) {
  if (!contact || contact.businessId !== businessId || contact.merged) return false;
  if (contact.type === "customer" || contact.status === "customer") return false;
  return true;
}

function normalizeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
