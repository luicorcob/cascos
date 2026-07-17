import { randomUUID } from "node:crypto";
import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { archiveDealAccountAssociations, archiveEntityAssociations, upsertAssociation } from "../lib/association-model.mjs";
import {
  DEAL_PRIORITIES,
  DEAL_STAGE_TYPES,
  compareDeals,
  createDefaultPipeline,
  dealStatusForStage,
  defaultPipelineId,
  ensureDefaultPipelineRecord,
  findPipelineStage,
  getBusinessPipelines,
  sortedPipelineStages
} from "../lib/deal-model.mjs";

const MAX_BODY_BYTES = Number(process.env.DEAL_API_MAX_BODY_BYTES || 256 * 1024);
const LOST_REASONS = new Set(["precio", "no_responde", "ya_tiene_proveedor", "fuera_de_zona", "pospuesto", "no_encaja", "competencia"]);
const PRIORITIES = new Set(DEAL_PRIORITIES);
const STAGE_TYPES = new Set(DEAL_STAGE_TYPES);
const PIPELINE_CREATE_FIELDS = new Set(["name", "kind", "isDefault", "stages"]);
const PIPELINE_UPDATE_FIELDS = new Set(["name", "isDefault", "stages"]);
const STAGE_FIELDS = new Set(["id", "name", "type", "order", "probability"]);
const DEAL_CREATE_FIELDS = new Set([
  "contactId", "accountId", "pipelineId", "stageId", "title", "value", "currency", "probability",
  "priority", "order", "ownerId", "expectedCloseAt", "lostReason", "tags", "notes", "source"
]);
const DEAL_UPDATE_FIELDS = new Set(DEAL_CREATE_FIELDS);
const DEAL_MOVE_FIELDS = new Set(["pipelineId", "stageId", "order", "lostReason"]);

const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  accounts: [],
  associations: [],
  activities: [],
  pipelines: [],
  deals: [],
  teamMembers: [],
  auditLog: []
};

export function isDealApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/(?:pipelines(?:\/[^/]+)?|deals(?:\/(?:pipeline|[^/]+(?:\/pipeline)?))?)$/.test(pathname);
}

export async function handleDealApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    const businessRef = segments[2] || "";
    const area = segments[3] || "";
    const recordId = segments[4] || "";
    const action = segments[5] || "";

    if (area === "pipelines") {
      if (!recordId && method === "GET") return await listPipelines(businessRef, requestUrl, response, context);
      if (!recordId && method === "POST") return await createPipeline(businessRef, request, response, context);
      if (recordId && method === "GET") return await getPipeline(businessRef, recordId, response, context);
      if (recordId && method === "PATCH") return await updatePipeline(businessRef, recordId, request, response, context);
      if (recordId && method === "DELETE") return await deletePipeline(businessRef, recordId, response, context);
    }

    if (area === "deals") {
      if (!recordId && method === "GET") return await listDeals(businessRef, requestUrl, response, context);
      if (!recordId && method === "POST") return await createDeal(businessRef, request, response, context);
      if (recordId === "pipeline" && !action && method === "GET") return await getDealPipeline(businessRef, requestUrl, response, context);
      if (recordId && !action && method === "GET") return await getDeal(businessRef, recordId, response, context);
      if (recordId && !action && method === "PATCH") return await updateDeal(businessRef, recordId, request, response, context);
      if (recordId && !action && method === "DELETE") return await archiveDeal(businessRef, recordId, response, context);
      if (recordId && action === "pipeline" && method === "PATCH") return await moveDeal(businessRef, recordId, request, response, context);
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, PATCH, DELETE, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, {
      error: status >= 500 ? "Internal deal API error" : error.message
    }, context);
  }
}

async function listPipelines(businessRef, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const includeArchived = requestUrl.searchParams.get("includeArchived") === "true";
  const pipelines = getBusinessPipelines(db, business.id, { includeArchived }).map(copyPipeline);
  sendJson(response, 200, { pipelines, total: pipelines.length }, context);
}

async function getPipeline(businessRef, pipelineId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const pipeline = requirePipeline(db, business.id, pipelineId, { allowVirtualDefault: true });
  sendJson(response, 200, { pipeline: copyPipeline(pipeline) }, context);
}

async function createPipeline(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, PIPELINE_CREATE_FIELDS, "pipeline");
  const now = new Date().toISOString();
  const isDefault = source.isDefault === true || !db.pipelines.some((pipeline) => pipeline.businessId === business.id && !pipeline.archivedAt);
  const pipeline = {
    id: `pipeline_${randomUUID()}`,
    businessId: business.id,
    name: requiredText(source.name, "name", 120),
    kind: optionalText(source.kind, "kind", 60) || "sales",
    isDefault,
    stages: normalizeStages(source.stages),
    createdAt: now,
    updatedAt: now
  };

  if (isDefault) unsetDefaultPipelines(db, business.id);
  db.pipelines.push(pipeline);
  appendAudit(db, "pipeline.created", business.id, now, { pipelineId: pipeline.id });
  await saveDb(db, context, "pipeline-create");
  sendJson(response, 201, { pipeline: copyPipeline(pipeline) }, context);
}

async function updatePipeline(businessRef, pipelineId, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const pipeline = materializePipeline(db, business.id, pipelineId);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, PIPELINE_UPDATE_FIELDS, "pipeline");
  const now = new Date().toISOString();

  if (Object.prototype.hasOwnProperty.call(source, "name")) pipeline.name = requiredText(source.name, "name", 120);
  if (Object.prototype.hasOwnProperty.call(source, "stages")) {
    const stages = normalizeStages(source.stages);
    const removedIds = new Set(pipeline.stages.map((stage) => stage.id));
    stages.forEach((stage) => removedIds.delete(stage.id));
    const usedStage = db.deals.find((deal) => deal.businessId === business.id && deal.pipelineId === pipeline.id && !deal.archivedAt && removedIds.has(deal.stageId));
    if (usedStage) throw httpError(409, `Stage ${usedStage.stageId} is still used by active deals`);
    pipeline.stages = stages;
  }
  if (source.isDefault === true) {
    unsetDefaultPipelines(db, business.id);
    pipeline.isDefault = true;
  } else if (source.isDefault === false && pipeline.isDefault) {
    const replacement = db.pipelines.find((item) => item.businessId === business.id && item.id !== pipeline.id && !item.archivedAt);
    if (!replacement) throw httpError(409, "A business must keep one active default pipeline");
    pipeline.isDefault = false;
    replacement.isDefault = true;
    replacement.updatedAt = now;
  }

  pipeline.updatedAt = now;
  appendAudit(db, "pipeline.updated", business.id, now, { pipelineId: pipeline.id });
  await saveDb(db, context, "pipeline-update");
  sendJson(response, 200, { pipeline: copyPipeline(pipeline) }, context);
}

async function deletePipeline(businessRef, pipelineId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const pipeline = requirePipeline(db, business.id, pipelineId);
  if (pipeline.isDefault) throw httpError(409, "The default pipeline cannot be archived");
  if (db.deals.some((deal) => deal.businessId === business.id && deal.pipelineId === pipeline.id && !deal.archivedAt)) {
    throw httpError(409, "A pipeline with active deals cannot be archived");
  }
  const now = new Date().toISOString();
  pipeline.archivedAt = now;
  pipeline.updatedAt = now;
  appendAudit(db, "pipeline.archived", business.id, now, { pipelineId: pipeline.id });
  await saveDb(db, context, "pipeline-archive");
  sendJson(response, 200, { archived: true, pipeline: copyPipeline(pipeline) }, context);
}

async function listDeals(businessRef, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const contactId = optionalId(requestUrl.searchParams.get("contactId"), "contactId");
  const pipelineId = optionalId(requestUrl.searchParams.get("pipelineId"), "pipelineId");
  const stageId = optionalId(requestUrl.searchParams.get("stageId"), "stageId");
  const status = optionalEnum(requestUrl.searchParams.get("status"), new Set(["open", "won", "lost"]), "status");
  const q = clean(requestUrl.searchParams.get("q")).toLowerCase();
  const includeArchived = requestUrl.searchParams.get("includeArchived") === "true";
  const deals = db.deals
    .filter((deal) => deal.businessId === business.id)
    .filter((deal) => includeArchived || !deal.archivedAt)
    .filter((deal) => !contactId || deal.contactId === contactId)
    .filter((deal) => !pipelineId || deal.pipelineId === pipelineId)
    .filter((deal) => !stageId || deal.stageId === stageId)
    .filter((deal) => !status || deal.status === status)
    .filter((deal) => !q || dealMatchesQuery(deal, findContact(db, business.id, deal.contactId), q))
    .sort(compareDeals)
    .map((deal) => copyDeal(deal, findContact(db, business.id, deal.contactId), findAccount(db, business.id, deal.accountId), findTeamMember(db, business.id, deal.ownerId)));
  sendJson(response, 200, { deals, total: deals.length }, context);
}

async function getDealPipeline(businessRef, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const requestedPipelineId = optionalId(requestUrl.searchParams.get("pipelineId"), "pipelineId");
  const pipeline = requestedPipelineId
    ? requirePipeline(db, business.id, requestedPipelineId, { allowVirtualDefault: true })
    : getBusinessPipelines(db, business.id)[0];
  const deals = db.deals
    .filter((deal) => deal.businessId === business.id && deal.pipelineId === pipeline.id && !deal.archivedAt);
  const columns = sortedPipelineStages(pipeline).map((stage) => {
    const stageDeals = deals
      .filter((deal) => deal.stageId === stage.id)
      .sort(compareDeals)
      .map((deal) => copyDeal(deal, findContact(db, business.id, deal.contactId), findAccount(db, business.id, deal.accountId), findTeamMember(db, business.id, deal.ownerId)));
    return {
      stage: { ...stage },
      stageId: stage.id,
      count: stageDeals.length,
      totalValue: stageDeals.reduce((sum, deal) => sum + deal.value, 0),
      deals: stageDeals
    };
  });
  sendJson(response, 200, {
    pipeline: copyPipeline(pipeline),
    columns,
    total: deals.length,
    totalValue: deals.reduce((sum, deal) => sum + normalizeMoney(deal.value, "value"), 0)
  }, context);
}

async function createDeal(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, DEAL_CREATE_FIELDS, "deal");
  const now = new Date().toISOString();
  const contactId = requiredId(source.contactId, "contactId");
  const contact = requireContact(db, business.id, contactId);
  const accountId = optionalId(source.accountId, "accountId");
  const account = accountId ? requireAccount(db, business.id, accountId) : null;
  const ownerId = optionalId(source.ownerId, "ownerId");
  const owner = ownerId ? requireTeamMember(db, business.id, ownerId) : null;
  const pipeline = source.pipelineId
    ? materializePipeline(db, business.id, requiredId(source.pipelineId, "pipelineId"))
    : ensureDefaultPipelineRecord(db, business.id, now).pipeline;
  const stage = source.stageId
    ? requireStage(pipeline, requiredId(source.stageId, "stageId"))
    : sortedPipelineStages(pipeline)[0];
  const deal = {
    id: `deal_${randomUUID()}`,
    businessId: business.id,
    contactId: contact.id,
    accountId: account?.id || "",
    pipelineId: pipeline.id,
    stageId: stage.id,
    title: requiredText(source.title, "title", 180),
    value: normalizeMoney(source.value ?? 0, "value"),
    currency: normalizeCurrency(source.currency || business.content?.commerce?.currency || business.content?.currency || "EUR"),
    probability: source.probability === undefined ? normalizeProbability(stage.probability) : normalizeProbability(source.probability),
    status: dealStatusForStage(stage),
    priority: source.priority === undefined ? "media" : requiredEnum(source.priority, PRIORITIES, "priority"),
    order: source.order === undefined ? Date.now() : normalizeOrder(source.order),
    ownerId: owner?.id || "",
    expectedCloseAt: optionalIsoDate(source.expectedCloseAt, "expectedCloseAt"),
    lostReason: stage.type === "lost" ? requiredEnum(source.lostReason, LOST_REASONS, "lostReason") : "",
    tags: normalizeTags(source.tags),
    notes: optionalText(source.notes, "notes", 10000),
    source: optionalText(source.source, "source", 120) || clean(contact.source) || "dashboard",
    createdAt: now,
    updatedAt: now,
    closedAt: stage.type === "open" ? "" : now,
    wonAt: stage.type === "won" ? now : "",
    lostAt: stage.type === "lost" ? now : ""
  };
  db.deals.push(deal);
  syncDealAccountAssociations(db, deal, contact, account, now);
  const activity = recordDealActivity(db, deal, contact, "deal.created", now, { title: "Oportunidad creada" });
  appendAudit(db, "deal.created", business.id, now, { dealId: deal.id, contactId: contact.id, pipelineId: pipeline.id });
  await saveDb(db, context, "deal-create");
  sendJson(response, 201, { deal: copyDeal(deal, contact, account, owner), activity }, context);
}

async function getDeal(businessRef, dealId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const deal = requireDeal(db, business.id, dealId);
  sendJson(response, 200, { deal: copyDeal(deal, findContact(db, business.id, deal.contactId), findAccount(db, business.id, deal.accountId), findTeamMember(db, business.id, deal.ownerId)) }, context);
}

async function updateDeal(businessRef, dealId, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const deal = requireDeal(db, business.id, dealId);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, DEAL_UPDATE_FIELDS, "deal");
  const now = new Date().toISOString();
  const previous = snapshotDeal(deal);

  if (Object.prototype.hasOwnProperty.call(source, "contactId")) {
    deal.contactId = requireContact(db, business.id, requiredId(source.contactId, "contactId")).id;
  }
  if (Object.prototype.hasOwnProperty.call(source, "accountId")) {
    const accountId = optionalId(source.accountId, "accountId");
    deal.accountId = accountId ? requireAccount(db, business.id, accountId).id : "";
  }
  if (Object.prototype.hasOwnProperty.call(source, "title")) deal.title = requiredText(source.title, "title", 180);
  if (Object.prototype.hasOwnProperty.call(source, "value")) deal.value = normalizeMoney(source.value, "value");
  if (Object.prototype.hasOwnProperty.call(source, "currency")) deal.currency = normalizeCurrency(source.currency);
  if (Object.prototype.hasOwnProperty.call(source, "priority")) deal.priority = requiredEnum(source.priority, PRIORITIES, "priority");
  if (Object.prototype.hasOwnProperty.call(source, "order")) deal.order = normalizeOrder(source.order);
  if (Object.prototype.hasOwnProperty.call(source, "ownerId")) {
    const ownerId = optionalId(source.ownerId, "ownerId");
    deal.ownerId = ownerId ? requireTeamMember(db, business.id, ownerId).id : "";
  }
  if (Object.prototype.hasOwnProperty.call(source, "expectedCloseAt")) deal.expectedCloseAt = optionalIsoDate(source.expectedCloseAt, "expectedCloseAt");
  if (Object.prototype.hasOwnProperty.call(source, "tags")) deal.tags = normalizeTags(source.tags);
  if (Object.prototype.hasOwnProperty.call(source, "notes")) deal.notes = optionalText(source.notes, "notes", 10000);
  if (Object.prototype.hasOwnProperty.call(source, "source")) deal.source = optionalText(source.source, "source", 120);

  const pipeline = Object.prototype.hasOwnProperty.call(source, "pipelineId")
    ? materializePipeline(db, business.id, requiredId(source.pipelineId, "pipelineId"))
    : requirePipeline(db, business.id, deal.pipelineId, { allowVirtualDefault: true });
  const stageId = Object.prototype.hasOwnProperty.call(source, "stageId") ? requiredId(source.stageId, "stageId") : deal.stageId;
  const stage = requireStage(pipeline, stageId);
  applyStageTransition(deal, pipeline, stage, source, now);
  if (Object.prototype.hasOwnProperty.call(source, "probability")) deal.probability = normalizeProbability(source.probability);
  deal.updatedAt = now;

  const contact = requireContact(db, business.id, deal.contactId);
  const account = deal.accountId ? requireAccount(db, business.id, deal.accountId) : null;
  if (Object.prototype.hasOwnProperty.call(source, "accountId") || Object.prototype.hasOwnProperty.call(source, "contactId")) {
    syncDealAccountAssociations(db, deal, contact, account, now);
  }
  const stageChanged = previous.pipelineId !== deal.pipelineId || previous.stageId !== deal.stageId;
  const activity = recordDealActivity(db, deal, contact, stageChanged ? "deal.stage_changed" : "deal.updated", now, {
    title: stageChanged ? "Oportunidad movida" : "Oportunidad actualizada",
    previous
  });
  appendAudit(db, stageChanged ? "deal.stage_changed" : "deal.updated", business.id, now, { dealId: deal.id, contactId: deal.contactId, pipelineId: deal.pipelineId });
  await saveDb(db, context, "deal-update");
  sendJson(response, 200, { deal: copyDeal(deal, contact, account, findTeamMember(db, business.id, deal.ownerId)), activity }, context);
}

async function moveDeal(businessRef, dealId, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const deal = requireDeal(db, business.id, dealId);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, DEAL_MOVE_FIELDS, "deal movement");
  const now = new Date().toISOString();
  const previous = snapshotDeal(deal);
  const pipeline = source.pipelineId
    ? materializePipeline(db, business.id, requiredId(source.pipelineId, "pipelineId"))
    : requirePipeline(db, business.id, deal.pipelineId, { allowVirtualDefault: true });
  const stage = requireStage(pipeline, requiredId(source.stageId, "stageId"));
  applyStageTransition(deal, pipeline, stage, source, now);
  if (Object.prototype.hasOwnProperty.call(source, "order")) deal.order = normalizeOrder(source.order);
  deal.updatedAt = now;
  const contact = requireContact(db, business.id, deal.contactId);
  const activity = recordDealActivity(db, deal, contact, "deal.stage_changed", now, { title: "Oportunidad movida", previous });
  appendAudit(db, "deal.stage_changed", business.id, now, { dealId: deal.id, contactId: deal.contactId, pipelineId: deal.pipelineId });
  await saveDb(db, context, "deal-move");
  sendJson(response, 200, { deal: copyDeal(deal, contact, findAccount(db, business.id, deal.accountId), findTeamMember(db, business.id, deal.ownerId)), activity }, context);
}

async function archiveDeal(businessRef, dealId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const deal = requireDeal(db, business.id, dealId);
  const now = new Date().toISOString();
  deal.archivedAt = now;
  deal.updatedAt = now;
  archiveEntityAssociations(db, business.id, "deal", deal.id, now);
  const contact = findContact(db, business.id, deal.contactId);
  const activity = recordDealActivity(db, deal, contact, "deal.archived", now, { title: "Oportunidad archivada" });
  appendAudit(db, "deal.archived", business.id, now, { dealId: deal.id, contactId: deal.contactId, pipelineId: deal.pipelineId });
  await saveDb(db, context, "deal-archive");
  sendJson(response, 200, { archived: true, deal: copyDeal(deal, contact, findAccount(db, business.id, deal.accountId), findTeamMember(db, business.id, deal.ownerId)), activity }, context);
}

function applyStageTransition(deal, pipeline, stage, source, now) {
  const nextStatus = dealStatusForStage(stage);
  if (stage.type === "lost") {
    deal.lostReason = requiredEnum(source.lostReason || deal.lostReason, LOST_REASONS, "lostReason");
  } else {
    deal.lostReason = "";
  }
  deal.pipelineId = pipeline.id;
  deal.stageId = stage.id;
  deal.status = nextStatus;
  if (!Object.prototype.hasOwnProperty.call(source, "probability")) deal.probability = normalizeProbability(stage.probability);
  deal.closedAt = stage.type === "open" ? "" : (deal.closedAt || now);
  deal.wonAt = stage.type === "won" ? (deal.wonAt || now) : "";
  deal.lostAt = stage.type === "lost" ? (deal.lostAt || now) : "";
}

function recordDealActivity(db, deal, contact, type, now, options = {}) {
  const previous = options.previous || {};
  const activity = {
    id: `activity_${randomUUID()}`,
    businessId: deal.businessId,
    contactId: deal.contactId,
    dealId: deal.id,
    type,
    title: options.title || "Oportunidad actualizada",
    note: previous.stageId && previous.stageId !== deal.stageId
      ? `${deal.title}: ${previous.stageId} -> ${deal.stageId}. Valor: ${deal.value} ${deal.currency}.`
      : `${deal.title}. Etapa: ${deal.stageId}. Valor: ${deal.value} ${deal.currency}.`,
    source: "crm-deals",
    metadata: {
      dealId: deal.id,
      pipelineId: deal.pipelineId,
      stageId: deal.stageId,
      previousPipelineId: previous.pipelineId || "",
      previousStageId: previous.stageId || "",
      status: deal.status,
      value: deal.value,
      currency: deal.currency,
      lostReason: deal.lostReason || ""
    },
    createdAt: now
  };
  db.activities.push(activity);
  if (contact) {
    contact.lastInteractionAt = now;
    contact.updatedAt = now;
  }
  return activity;
}

function materializePipeline(db, businessId, pipelineId) {
  const existing = db.pipelines.find((pipeline) => pipeline.businessId === businessId && pipeline.id === pipelineId && !pipeline.archivedAt);
  if (existing) return existing;
  if (pipelineId === defaultPipelineId(businessId)) return ensureDefaultPipelineRecord(db, businessId).pipeline;
  throw httpError(404, "Pipeline not found");
}

function requirePipeline(db, businessId, pipelineId, options = {}) {
  const pipeline = db.pipelines.find((item) => item.businessId === businessId && item.id === pipelineId && !item.archivedAt);
  if (pipeline) return pipeline;
  if (options.allowVirtualDefault && pipelineId === defaultPipelineId(businessId)) return createDefaultPipeline(businessId);
  throw httpError(404, "Pipeline not found");
}

function requireStage(pipeline, stageId) {
  const stage = findPipelineStage(pipeline, stageId);
  if (!stage) throw httpError(400, "Stage does not belong to the selected pipeline");
  return stage;
}

function normalizeStages(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) {
    throw httpError(400, "stages must contain between 2 and 20 stages");
  }
  const ids = new Set();
  const stages = value.map((source, index) => {
    const stage = requireObject(source);
    assertAllowedFields(stage, STAGE_FIELDS, "pipeline stage");
    const id = requiredId(stage.id, `stages[${index}].id`);
    if (ids.has(id)) throw httpError(400, `Duplicate stage id: ${id}`);
    ids.add(id);
    return {
      id,
      name: requiredText(stage.name, `stages[${index}].name`, 80),
      type: requiredEnum(stage.type, STAGE_TYPES, `stages[${index}].type`),
      order: normalizeOrder(stage.order ?? ((index + 1) * 100)),
      probability: normalizeProbability(stage.probability)
    };
  }).sort((left, right) => left.order - right.order);
  if (!stages.some((stage) => stage.type === "open")) throw httpError(400, "A pipeline needs at least one open stage");
  if (!stages.some((stage) => stage.type === "won")) throw httpError(400, "A pipeline needs a won stage");
  if (!stages.some((stage) => stage.type === "lost")) throw httpError(400, "A pipeline needs a lost stage");
  return stages;
}

function unsetDefaultPipelines(db, businessId) {
  db.pipelines.forEach((pipeline) => {
    if (pipeline.businessId === businessId) pipeline.isDefault = false;
  });
}

function requireBusiness(db, businessRef) {
  const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
  if (!business) throw httpError(404, "Business not found");
  return business;
}

function requireContact(db, businessId, contactId) {
  const contact = findContact(db, businessId, contactId);
  if (!contact) throw httpError(404, "Contact not found");
  if (contact.merged) throw httpError(409, "Contact has been merged into another contact");
  return contact;
}

function findContact(db, businessId, contactId) {
  return db.contacts.find((contact) => contact.businessId === businessId && contact.id === contactId) || null;
}

function requireAccount(db, businessId, accountId) {
  const account = findAccount(db, businessId, accountId);
  if (!account) throw httpError(404, "Account not found");
  return account;
}

function findAccount(db, businessId, accountId) {
  if (!accountId) return null;
  return db.accounts.find((account) => account.businessId === businessId && account.id === accountId && !account.archivedAt && !account.merged) || null;
}

function requireTeamMember(db, businessId, memberId) {
  const member = findTeamMember(db, businessId, memberId);
  if (!member) throw httpError(404, "Opportunity owner not found");
  return member;
}

function findTeamMember(db, businessId, memberId) {
  if (!memberId) return null;
  return db.teamMembers.find((member) => member.businessId === businessId && member.id === memberId && member.active !== false) || null;
}

function syncDealAccountAssociations(db, deal, contact, account, now) {
  if (contact) {
    upsertAssociation(db, {
      businessId: deal.businessId,
      fromType: "contact",
      fromId: contact.id,
      toType: "deal",
      toId: deal.id,
      kind: "primary",
      isPrimary: true,
      now
    });
  }
  archiveDealAccountAssociations(db, deal.businessId, deal.id, now);
  if (!account) return;
  upsertAssociation(db, {
    businessId: deal.businessId,
    fromType: "deal",
    fromId: deal.id,
    toType: "account",
    toId: account.id,
    kind: "primary",
    isPrimary: true,
    now
  });
  if (contact) {
    upsertAssociation(db, {
      businessId: deal.businessId,
      fromType: "contact",
      fromId: contact.id,
      toType: "account",
      toId: account.id,
      kind: "member",
      isPrimary: false,
      now
    });
  }
}

function requireDeal(db, businessId, dealId) {
  const id = requiredId(dealId, "dealId");
  const deal = db.deals.find((item) => item.businessId === businessId && item.id === id && !item.archivedAt);
  if (!deal) throw httpError(404, "Deal not found");
  return deal;
}

function copyPipeline(pipeline) {
  return {
    id: pipeline.id,
    businessId: pipeline.businessId,
    name: pipeline.name,
    kind: pipeline.kind || "sales",
    isDefault: Boolean(pipeline.isDefault),
    stages: sortedPipelineStages(pipeline).map((stage) => ({ ...stage })),
    createdAt: pipeline.createdAt || "",
    updatedAt: pipeline.updatedAt || "",
    archivedAt: pipeline.archivedAt || ""
  };
}

function copyDeal(deal, contact, account, owner) {
  return {
    id: deal.id,
    businessId: deal.businessId,
    contactId: deal.contactId,
    accountId: deal.accountId || "",
    pipelineId: deal.pipelineId,
    stageId: deal.stageId,
    title: deal.title,
    value: normalizeMoney(deal.value, "value"),
    currency: deal.currency || "EUR",
    probability: normalizeProbability(deal.probability),
    status: deal.status || "open",
    priority: deal.priority || "media",
    order: Number(deal.order || 0),
    ownerId: deal.ownerId || "",
    owner: owner ? { id: owner.id, name: owner.name || "", role: owner.role || "employee" } : null,
    expectedCloseAt: deal.expectedCloseAt || "",
    lostReason: deal.lostReason || "",
    tags: Array.isArray(deal.tags) ? [...deal.tags] : [],
    notes: deal.notes || "",
    source: deal.source || "",
    legacyContactId: deal.legacyContactId || "",
    createdAt: deal.createdAt || "",
    updatedAt: deal.updatedAt || "",
    closedAt: deal.closedAt || "",
    wonAt: deal.wonAt || "",
    lostAt: deal.lostAt || "",
    archivedAt: deal.archivedAt || "",
    contact: contact ? {
      id: contact.id,
      name: contact.name || "",
      phone: contact.phone || "",
      email: contact.email || "",
      type: contact.type || "lead",
      status: contact.status || "new",
      score: Number(contact.score || 0),
      scoreLabel: contact.scoreLabel || "",
      nextAction: contact.nextAction || null
    } : null,
    account: account ? {
      id: account.id,
      name: account.name || "",
      type: account.type || "company",
      domain: account.domain || "",
      city: account.city || "",
      status: account.status || "active"
    } : null
  };
}

function snapshotDeal(deal) {
  return {
    pipelineId: deal.pipelineId,
    stageId: deal.stageId,
    status: deal.status,
    value: deal.value
  };
}

function dealMatchesQuery(deal, contact, q) {
  return [deal.title, deal.notes, deal.source, contact?.name, contact?.email, contact?.phone, ...(deal.tags || [])]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.accounts = Array.isArray(db.accounts) ? db.accounts : [];
  db.associations = Array.isArray(db.associations) ? db.associations : [];
  db.activities = Array.isArray(db.activities) ? db.activities : [];
  db.pipelines = Array.isArray(db.pipelines) ? db.pipelines : [];
  db.deals = Array.isArray(db.deals) ? db.deals : [];
  db.teamMembers = Array.isArray(db.teamMembers) ? db.teamMembers : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveDb(db, context, label) {
  await saveBusinessStore(db, context, label);
}

async function readJsonBody(request) {
  let size = 0;
  let raw = "";
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, "Deal payload too large");
    raw += chunk.toString("utf8");
  }
  if (!raw.trim()) throw httpError(400, "JSON body is required");
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "Invalid JSON body");
  }
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw httpError(400, "JSON body must be an object");
  return value;
}

function assertAllowedFields(source, allowed, label) {
  const unknown = Object.keys(source).filter((field) => !allowed.has(field));
  if (unknown.length) throw httpError(400, `Unknown ${label} field(s): ${unknown.join(", ")}`);
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string") throw httpError(400, `${field} must be a string`);
  const text = clean(value);
  if (!text) throw httpError(400, `${field} cannot be empty`);
  if (text.length > maxLength) throw httpError(400, `${field} cannot exceed ${maxLength} characters`);
  return text;
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw httpError(400, `${field} must be a string`);
  const text = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (text.length > maxLength) throw httpError(400, `${field} cannot exceed ${maxLength} characters`);
  return text;
}

function requiredEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.has(value)) throw httpError(400, `${field} has an invalid value`);
  return value;
}

function optionalEnum(value, allowed, field) {
  if (value === undefined || value === null || value === "") return "";
  return requiredEnum(value, allowed, field);
}

function requiredId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) throw httpError(400, `${field} has an invalid format`);
  return value;
}

function optionalId(value, field) {
  if (value === undefined || value === null || value === "") return "";
  return requiredId(value, field);
}

function normalizeMoney(value, field = "value") {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000000) {
    throw httpError(400, `${field} must be a non-negative number no greater than 100000000`);
  }
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) throw httpError(400, `${field} must have at most two decimal places`);
  return Math.round(value * 100) / 100;
}

function normalizeProbability(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) throw httpError(400, "probability must be between 0 and 100");
  return Math.round(value * 100) / 100;
}

function normalizeOrder(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw httpError(400, "order must be a finite number");
  return value;
}

function normalizeCurrency(value) {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) throw httpError(400, "currency must be a three-letter code");
  return value.toUpperCase();
}

function optionalIsoDate(value, field) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > 80) throw httpError(400, `${field} must be an ISO date-time string`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw httpError(400, `${field} must be a valid date-time`);
  return new Date(timestamp).toISOString();
}

function normalizeTags(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 24) throw httpError(400, "tags must be an array with at most 24 values");
  const tags = value.map((tag) => requiredText(tag, "tag", 60));
  return [...new Set(tags)];
}

function appendAudit(db, type, businessId, now, metadata = {}) {
  db.auditLog.push({
    id: `audit_${randomUUID()}`,
    type,
    businessId,
    ...metadata,
    createdAt: now
  });
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: "GET, POST, PATCH, DELETE, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
