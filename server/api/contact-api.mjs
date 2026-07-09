import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { normalizeStoredScoreLabel, recalculateContactScore, withComputedLeadScore } from "../lib/lead-score.mjs";

const MAX_BODY_BYTES = Number(process.env.CONTACT_API_MAX_BODY_BYTES || 512 * 1024);
const CONTACT_TYPES = new Set(["lead", "customer"]);
const CONTACT_STATUSES = new Set(["new", "contacted", "waiting", "reserved", "won", "lost", "customer"]);
const CONTACT_PIPELINE_STATUSES = ["new", "contacted", "waiting", "reserved", "won", "lost", "customer"];
const CONTACT_PRIORITIES = new Set(["alta", "media", "baja"]);
const CONTACT_LOST_REASONS = new Set(["precio", "no_responde", "ya_tiene_proveedor", "fuera_de_zona", "pospuesto", "no_encaja", "competencia"]);
const NEXT_ACTION_TYPES = new Set(["llamada", "whatsapp", "email", "reunion", "enviar_propuesta", "revisar_reserva"]);
const NEXT_ACTION_STATUSES = new Set(["pendiente", "hecha", "vencida"]);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  bookings: [],
  bookingReminders: [],
  businessEvents: [],
  auditLog: []
};

export function isContactApiRequest(pathname) {
  return /^\/api\/public\/[^/]+\/leads$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/next-actions$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/contacts(?:\/(?:pipeline|duplicates|merge)|\/[^/]+(?:\/activities|\/pipeline|\/next-action|\/recalculate-score)?)?$/.test(pathname);
}

export async function handleContactApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (segments[0] === "api" && segments[1] === "public" && segments[3] === "leads" && method === "POST") {
      await createPublicLead(segments[2], request, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "next-actions" && method === "GET") {
      await listNextActions(segments[2], requestUrl, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "contacts") {
      const businessId = segments[2];
      const contactId = segments[4] || "";
      const action = segments[5] || "";

      if (contactId === "pipeline" && !action && method === "GET") {
        await getContactPipeline(businessId, requestUrl, response, context);
        return;
      }

      if (contactId === "duplicates" && !action && method === "GET") {
        await listDuplicateContacts(businessId, response, context);
        return;
      }

      if (contactId === "merge" && !action && method === "POST") {
        await mergeDuplicateContacts(businessId, request, response, context);
        return;
      }

      if (!contactId && method === "GET") {
        await listContacts(businessId, requestUrl, response, context);
        return;
      }

      if (!contactId && method === "POST") {
        await createAdminContact(businessId, request, response, context);
        return;
      }

      if (contactId && !action && method === "PATCH") {
        await updateContact(businessId, contactId, request, response, context);
        return;
      }

      if (contactId && action === "pipeline" && method === "PATCH") {
        await updateContactPipeline(businessId, contactId, request, response, context);
        return;
      }

      if (contactId && action === "next-action" && method === "POST") {
        await createNextAction(businessId, contactId, request, response, context);
        return;
      }

      if (contactId && action === "next-action" && method === "PATCH") {
        await updateNextAction(businessId, contactId, request, response, context);
        return;
      }

      if (contactId && action === "activities" && method === "POST") {
        await addContactActivity(businessId, contactId, request, response, context);
        return;
      }

      if (contactId && action === "recalculate-score" && method === "POST") {
        await recalculateContactScoreEndpoint(businessId, contactId, response, context);
        return;
      }
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, PATCH, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal contact API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function listContacts(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const type = cleanText(requestUrl.searchParams.get("type") || "");
  const status = normalizeOptionalStatus(requestUrl.searchParams.get("status") || "");
  const scoreLabel = normalizeOptionalScoreLabel(requestUrl.searchParams.get("scoreLabel") || requestUrl.searchParams.get("score") || "");
  const q = cleanText(requestUrl.searchParams.get("q") || "").toLowerCase();
  const includeActivities = requestUrl.searchParams.get("includeActivities") === "true";
  const includeMerged = requestUrl.searchParams.get("includeMerged") === "true";
  const now = new Date();

  let contacts = db.contacts
    .filter((contact) => contact.businessId === business.id)
    .filter((contact) => includeMerged || !contact.merged)
    .map((contact) => normalizeStoredContact(contact, db, business.id, now))
    .filter((contact) => !type || contact.type === type)
    .filter((contact) => !status || contact.status === status)
    .filter((contact) => !scoreLabel || contact.scoreLabel === scoreLabel)
    .filter((contact) => {
      if (!q) {
        return true;
      }

      return [contact.name, contact.phone, contact.email, contact.source, contact.status, contact.notes, ...(contact.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    })
    .sort((a, b) => String(b.lastInteractionAt || b.createdAt || "").localeCompare(String(a.lastInteractionAt || a.createdAt || "")));

  if (includeActivities) {
    contacts = contacts.map((contact) => ({
      ...contact,
      activities: db.activities
        .filter((activity) => activity.businessId === business.id && activity.contactId === contact.id)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    }));
  }

  sendJson(response, 200, { contacts, total: contacts.length }, context);
}

async function getContactPipeline(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const includeActivities = requestUrl.searchParams.get("includeActivities") === "true";
  const now = new Date();
  const contacts = db.contacts
    .filter((contact) => contact.businessId === business.id)
    .filter((contact) => !contact.merged)
    .map((contact) => normalizeStoredContact(contact, db, business.id, now));
  const columns = CONTACT_PIPELINE_STATUSES.map((status) => {
    const columnContacts = contacts
      .filter((contact) => contact.status === status)
      .sort(comparePipelineContacts)
      .map((contact) => includeActivities ? withContactActivities(db, business.id, contact) : contact);
    const totalValueEstimate = columnContacts.reduce((sum, contact) => sum + normalizeMoney(contact.valueEstimate), 0);

    return {
      status,
      count: columnContacts.length,
      totalValueEstimate,
      contacts: columnContacts
    };
  });

  const pipeline = Object.fromEntries(columns.map((column) => [column.status, column]));
  const totalValueEstimate = columns.reduce((sum, column) => sum + column.totalValueEstimate, 0);

  sendJson(response, 200, {
    statuses: CONTACT_PIPELINE_STATUSES,
    columns,
    pipeline,
    total: contacts.length,
    totalValueEstimate
  }, context);
}

async function listNextActions(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const filter = normalizeNextActionFilter(requestUrl.searchParams.get("filter") || "hoy");
  const completedTodayIds = getCompletedNextActionContactIds(db, business.id);
  const now = new Date();
  const contacts = db.contacts
    .filter((contact) => contact.businessId === business.id)
    .filter((contact) => !contact.merged)
    .map((contact) => normalizeStoredContact(contact, db, business.id, now));
  const actions = contacts
    .map((contact) => ({
      contact,
      nextAction: getComputedNextAction(contact.nextAction)
    }))
    .filter(({ contact, nextAction }) => matchesNextActionFilter(contact, nextAction, filter, completedTodayIds))
    .sort(compareNextActionItems)
    .map(({ contact, nextAction }) => ({
      contact: summarizeContact(contact),
      nextAction
    }));

  sendJson(response, 200, { filter, actions, total: actions.length }, context);
}

async function createPublicLead(slug, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, slug);

  if (!business || business.status === "archived") {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const existingIndex = findDuplicateContactIndexForPayload(db, business.id, payload);
  const existing = existingIndex >= 0 ? db.contacts[existingIndex] : null;
  const contact = normalizeContact(payload, existing, business.id, now, {
    type: "lead",
    status: "new",
    source: "web"
  });
  contact.lastInteractionAt = now;
  const activity = makeActivity(business.id, contact.id, payload, now, {
    type: existing ? "lead.updated" : "lead.created",
    title: existing ? "Lead actualizado" : "Lead creado",
    source: contact.source,
    note: contact.notes
  });

  if (existingIndex >= 0) {
    db.contacts[existingIndex] = contact;
  } else {
    db.contacts.push(contact);
  }
  db.activities.push(activity);
  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, existing ? "contact.public_lead_updated" : "contact.public_lead_created", business.id, now, contact.id);
  await saveDb(db, context, "lead");
  sendJson(response, existing ? 200 : 201, { contact, activity, mergedWithExisting: Boolean(existing) }, context);
}

async function createAdminContact(businessId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const existingIndex = findDuplicateContactIndexForPayload(db, business.id, payload);
  const existing = existingIndex >= 0 ? db.contacts[existingIndex] : null;
  const contact = normalizeContact(payload, existing, business.id, now, {
    type: "lead",
    status: "new",
    source: "manual"
  });
  contact.lastInteractionAt = now;
  const activity = makeActivity(business.id, contact.id, payload, now, {
    type: existing ? "contact.updated" : "contact.created",
    title: existing ? "Contacto actualizado" : "Contacto creado",
    source: contact.source,
    note: contact.notes
  });

  if (existingIndex >= 0) {
    db.contacts[existingIndex] = contact;
  } else {
    db.contacts.push(contact);
  }
  db.activities.push(activity);
  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, existing ? "contact.updated_from_duplicate_create" : "contact.created", business.id, now, contact.id);
  await saveDb(db, context, "contact");
  sendJson(response, existing ? 200 : 201, { contact, activity, mergedWithExisting: Boolean(existing) }, context);
}

async function listDuplicateContacts(businessId, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const groups = buildDuplicateContactGroups(db, business.id);

  sendJson(response, 200, { groups, total: groups.length }, context);
}

async function mergeDuplicateContacts(businessId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const source = extractPayload(payload);
  const survivorId = cleanId(source.survivorId);
  const duplicateIds = Array.isArray(source.duplicateIds)
    ? source.duplicateIds.map(cleanId).filter(Boolean)
    : [];

  if (!survivorId || !duplicateIds.length) {
    throw httpError(400, "Merge needs survivorId and duplicateIds");
  }

  if (duplicateIds.includes(survivorId)) {
    throw httpError(400, "survivorId cannot be included in duplicateIds");
  }

  const survivor = db.contacts.find((contact) => contact.businessId === business.id && contact.id === survivorId && !contact.merged);
  const duplicates = duplicateIds.map((id) => db.contacts.find((contact) => contact.businessId === business.id && contact.id === id && !contact.merged));

  if (!survivor || duplicates.some((contact) => !contact)) {
    throw httpError(404, "Merge contacts not found");
  }

  const now = new Date().toISOString();
  mergeContactData(survivor, duplicates, now);
  moveContactReferences(db, business, survivor.id, duplicateIds);

  duplicates.forEach((contact) => {
    contact.merged = true;
    contact.mergedInto = survivor.id;
    contact.updatedAt = now;
  });

  const activity = makeActivity(business.id, survivor.id, {
    note: `Fusionados ${duplicates.length} duplicado(s) en ${survivor.name}`,
    metadata: { survivorId: survivor.id, duplicateIds }
  }, now, {
    type: "contact.merged",
    title: "Contactos fusionados",
    source: "dashboard"
  });
  db.activities.push(activity);
  recalculateContactScore(db, business.id, survivor, new Date(now));
  appendAudit(db, "contact.merged", business.id, now, survivor.id);
  await saveDb(db, context, "contact-merge");
  sendJson(response, 200, {
    contact: normalizeStoredContact(survivor, db, business.id, new Date(now)),
    merged: duplicates.map((contact) => summarizeContact(normalizeStoredContact(contact, db, business.id, new Date(now)))),
    activity
  }, context);
}

async function updateContact(businessId, contactId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const index = db.contacts.findIndex((contact) => contact.businessId === business.id && contact.id === contactId);

  if (index === -1) {
    throw httpError(404, "Contact not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const previous = db.contacts[index];
  const contact = normalizeContact(payload, previous, business.id, now, {});

  db.contacts[index] = contact;

  let activity = null;
  if (previous.status !== contact.status) {
    activity = makeActivity(business.id, contact.id, {
      note: makeStatusChangeNote(previous, contact),
      metadata: makeStatusChangeMetadata(previous, contact)
    }, now, {
      type: "contact.status_changed",
      title: "Estado actualizado",
      source: "dashboard"
    });
    db.activities.push(activity);
  }

  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, "contact.updated", business.id, now, contact.id);
  await saveDb(db, context, "contact-update");
  sendJson(response, 200, { contact, activity }, context);
}

async function updateContactPipeline(businessId, contactId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const index = db.contacts.findIndex((contact) => contact.businessId === business.id && contact.id === contactId);

  if (index === -1) {
    throw httpError(404, "Contact not found");
  }

  const payload = await readJsonBody(request);
  const source = extractPayload(payload);
  const hasStatus = Object.prototype.hasOwnProperty.call(source, "status");
  const hasOrder = Object.prototype.hasOwnProperty.call(source, "order");

  if (!hasStatus && !hasOrder) {
    throw httpError(400, "Pipeline update needs status or order");
  }

  const now = new Date().toISOString();
  const previous = normalizeStoredContact(db.contacts[index]);
  const status = hasStatus ? normalizeStatus(source.status) : previous.status;
  const order = hasOrder ? normalizeOrder(source.order, previous.order) : previous.order;
  const lostReason = resolveLostReason(status, source, previous);
  const contact = {
    ...previous,
    status,
    order,
    lostReason,
    updatedAt: now
  };

  db.contacts[index] = contact;

  let activity = null;
  if (previous.status !== contact.status) {
    activity = makeActivity(business.id, contact.id, {
      note: makeStatusChangeNote(previous, contact),
      metadata: {
        ...makeStatusChangeMetadata(previous, contact),
        order: contact.order
      }
    }, now, {
      type: "contact.status_changed",
      title: "Estado actualizado",
      source: "dashboard"
    });
    db.activities.push(activity);
  }

  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, "contact.pipeline_updated", business.id, now, contact.id);
  await saveDb(db, context, "contact-pipeline");
  sendJson(response, 200, { contact, activity }, context);
}

async function createNextAction(businessId, contactId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const contact = db.contacts.find((item) => item.businessId === business.id && item.id === contactId);

  if (!contact) {
    throw httpError(404, "Contact not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const nextAction = normalizeNextAction(payload, now);

  contact.nextAction = nextAction;
  contact.lastInteractionAt = now;
  contact.updatedAt = now;

  const activity = makeActivity(business.id, contact.id, {
    note: nextAction.note || `${nextAction.type} para ${nextAction.dueDate}`,
    metadata: { nextAction }
  }, now, {
    type: "next_action.created",
    title: "Proxima accion creada",
    source: "dashboard"
  });

  db.activities.push(activity);
  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, "contact.next_action_created", business.id, now, contact.id);
  await saveDb(db, context, "next-action");
  sendJson(response, 201, { contact: normalizeStoredContact(contact), nextAction, activity }, context);
}

async function updateNextAction(businessId, contactId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const contact = db.contacts.find((item) => item.businessId === business.id && item.id === contactId);

  if (!contact) {
    throw httpError(404, "Contact not found");
  }

  const currentAction = normalizeOptionalNextAction(contact.nextAction);

  if (!currentAction) {
    throw httpError(404, "Contact has no active nextAction");
  }

  const payload = await readJsonBody(request);
  const source = extractPayload(payload);
  const now = new Date().toISOString();
  const status = normalizeNextActionStatus(source.status || "hecha");
  let nextAction = {
    ...currentAction,
    status,
    note: cleanText(source.note || currentAction.note || "", 1000)
  };
  let activity = null;

  if (status === "hecha") {
    nextAction = {
      ...nextAction,
      completedAt: now
    };
    activity = makeActivity(business.id, contact.id, {
      note: nextAction.note || `${nextAction.type} completada`,
      metadata: { nextAction }
    }, now, {
      type: "next_action.completed",
      title: "Proxima accion hecha",
      source: "dashboard"
    });
    db.activities.push(activity);
    contact.nextAction = null;
  } else {
    contact.nextAction = normalizeNextAction(nextAction, now);
  }

  contact.lastInteractionAt = now;
  contact.updatedAt = now;
  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, "contact.next_action_updated", business.id, now, contact.id);
  await saveDb(db, context, "next-action-update");
  sendJson(response, 200, { contact: normalizeStoredContact(contact), nextAction: contact.nextAction, activity }, context);
}

async function addContactActivity(businessId, contactId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const contact = db.contacts.find((item) => item.businessId === business.id && item.id === contactId);

  if (!contact) {
    throw httpError(404, "Contact not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const activity = makeActivity(business.id, contact.id, payload, now, {
    type: "note",
    title: "Nota",
    source: "dashboard"
  });

  db.activities.push(activity);
  contact.lastInteractionAt = now;
  contact.updatedAt = now;
  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, "contact.activity_created", business.id, now, contact.id);
  await saveDb(db, context, "activity");
  sendJson(response, 201, { contact, activity }, context);
}

async function recalculateContactScoreEndpoint(businessId, contactId, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const contact = db.contacts.find((item) => item.businessId === business.id && item.id === contactId);

  if (!contact) {
    throw httpError(404, "Contact not found");
  }

  const now = new Date().toISOString();
  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, "contact.score_recalculated", business.id, now, contact.id);
  await saveDb(db, context, "contact-score");
  sendJson(response, 200, { contact: normalizeStoredContact(contact, db, business.id, new Date(now)) }, context);
}

function normalizeContact(payload, existing, businessId, now, defaults) {
  const source = extractPayload(payload);
  const rawContact = cleanText(source.contact || source.leadContact || source.phoneOrEmail || "", 320);
  const email = cleanText(source.email || extractEmail(rawContact) || existing?.email || "", 320);
  const phone = cleanText(source.phone || source.telephone || extractPhone(rawContact) || existing?.phone || "", 80);
  const name = cleanText(source.name || source.fullName || source.leadName || existing?.name || "Lead sin nombre", 160);
  const notes = cleanText(source.notes || source.message || source.need || existing?.notes || "", 4000);

  if (!name && !phone && !email && !notes) {
    throw httpError(400, "Contact needs at least name, contact or notes");
  }

  const type = normalizeType(source.type || existing?.type || defaults.type || "lead");
  const status = normalizeStatus(source.status || existing?.status || defaults.status || (type === "customer" ? "customer" : "new"));
  const lostReason = resolveLostReason(status, source, existing || {});
  const tags = normalizeTags(source.tags ?? existing?.tags);
  const priority = normalizePriority(source.priority || existing?.priority || defaults.priority || "media");
  const order = normalizeOrder(source.order ?? existing?.order ?? defaults.order, fallbackContactOrder(existing, now));
  const nextAction = Object.prototype.hasOwnProperty.call(source, "nextAction")
    ? normalizeOptionalNextAction(source.nextAction, now, true)
    : normalizeOptionalNextAction(existing?.nextAction, now);

  return {
    id: existing?.id || cleanId(source.id) || `contact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    type,
    name,
    phone,
    email,
    source: cleanText(source.source || existing?.source || defaults.source || "manual", 80),
    status,
    lostReason,
    merged: Boolean(existing?.merged),
    mergedInto: cleanId(existing?.mergedInto || ""),
    priority,
    order,
    tags,
    notes,
    valueEstimate: Number.isFinite(Number(source.valueEstimate ?? existing?.valueEstimate))
      ? Number(source.valueEstimate ?? existing?.valueEstimate)
      : 0,
    privacyAccepted: normalizeBoolean(source.privacyAccepted, existing?.privacyAccepted ?? false),
    privacyAcceptedAt: cleanText(source.privacyAcceptedAt || existing?.privacyAcceptedAt || "", 80),
    privacyPolicyUrl: cleanText(source.privacyPolicyUrl || existing?.privacyPolicyUrl || "", 500),
    nextAction,
    score: normalizeScore(existing?.score),
    scoreLabel: normalizeStoredScoreLabel(existing?.scoreLabel, existing?.status === "lost" ? "perdido" : "frio"),
    lastInteractionAt: cleanText(source.lastInteractionAt || existing?.lastInteractionAt || now, 80),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeStoredContact(contact, db = null, businessId = "", now = new Date()) {
  const normalizedStatus = normalizeStoredStatus(contact?.status);
  const normalizedPriority = normalizeStoredPriority(contact?.priority);
  const lostReason = normalizeStoredLostReason(contact?.lostReason);
  const normalized = {
    ...contact,
    status: normalizedStatus,
    lostReason: normalizedStatus === "lost" ? lostReason : "",
    merged: Boolean(contact?.merged),
    mergedInto: cleanId(contact?.mergedInto || ""),
    priority: normalizedPriority,
    order: normalizeOrder(contact?.order, fallbackContactOrder(contact)),
    score: normalizeScore(contact?.score),
    scoreLabel: normalizeStoredScoreLabel(contact?.scoreLabel, normalizedStatus === "lost" ? "perdido" : "frio"),
    nextAction: getComputedNextAction(contact?.nextAction)
  };

  return db && businessId ? withComputedLeadScore(db, businessId, normalized, now) : normalized;
}

function withContactActivities(db, businessId, contact) {
  return {
    ...contact,
    activities: db.activities
      .filter((activity) => activity.businessId === businessId && activity.contactId === contact.id)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
  };
}

function findDuplicateContactIndexForPayload(db, businessId, payload) {
  const keys = getContactMatchKeysFromPayload(payload);

  if (!keys.email && !keys.phone) {
    return -1;
  }

  return db.contacts.findIndex((contact) => {
    if (contact.businessId !== businessId || contact.merged) {
      return false;
    }

    return (keys.email && normalizeEmail(contact.email) === keys.email)
      || (keys.phone && normalizePhone(contact.phone) === keys.phone);
  });
}

function getContactMatchKeysFromPayload(payload) {
  const source = extractPayload(payload);
  const rawContact = cleanText(source.contact || source.leadContact || source.phoneOrEmail || "", 320);
  const email = normalizeEmail(source.email || extractEmail(rawContact));
  const phone = normalizePhone(source.phone || source.telephone || extractPhone(rawContact));

  return { email, phone };
}

function buildDuplicateContactGroups(db, businessId) {
  const contacts = db.contacts
    .filter((contact) => contact.businessId === businessId && !contact.merged)
    .map((contact) => normalizeStoredContact(contact, db, businessId));
  const parent = new Map(contacts.map((contact) => [contact.id, contact.id]));
  const keyContacts = new Map();

  contacts.forEach((contact) => {
    getContactMatchKeys(contact).forEach((key) => {
      const ids = keyContacts.get(key) || [];
      ids.push(contact.id);
      keyContacts.set(key, ids);
    });
  });

  keyContacts.forEach((ids) => {
    ids.slice(1).forEach((id) => unionParents(parent, ids[0], id));
  });

  const grouped = new Map();
  contacts.forEach((contact) => {
    const root = findParent(parent, contact.id);
    const group = grouped.get(root) || [];
    group.push(contact);
    grouped.set(root, group);
  });

  return Array.from(grouped.values())
    .filter((group) => group.length > 1)
    .map((group, index) => {
      const ids = new Set(group.map((contact) => contact.id));
      const matchKeys = Array.from(keyContacts.entries())
        .filter(([, keyIds]) => keyIds.filter((id) => ids.has(id)).length > 1)
        .map(([key]) => key);

      return {
        id: `dup_${index + 1}`,
        matchKeys,
        contacts: group
          .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")))
          .map(summarizeContact)
      };
    });
}

function getContactMatchKeys(contact) {
  return [
    normalizeEmail(contact.email) ? `email:${normalizeEmail(contact.email)}` : "",
    normalizePhone(contact.phone) ? `phone:${normalizePhone(contact.phone)}` : ""
  ].filter(Boolean);
}

function findParent(parent, id) {
  const current = parent.get(id) || id;

  if (current === id) {
    return current;
  }

  const root = findParent(parent, current);
  parent.set(id, root);
  return root;
}

function unionParents(parent, left, right) {
  const leftRoot = findParent(parent, left);
  const rightRoot = findParent(parent, right);

  if (leftRoot !== rightRoot) {
    parent.set(rightRoot, leftRoot);
  }
}

function mergeContactData(survivor, duplicates, now) {
  survivor.name = survivor.name || duplicates.find((contact) => contact.name)?.name || survivor.name;
  survivor.phone = survivor.phone || duplicates.find((contact) => contact.phone)?.phone || "";
  survivor.email = survivor.email || duplicates.find((contact) => contact.email)?.email || "";
  survivor.source = survivor.source || duplicates.find((contact) => contact.source)?.source || "manual";
  survivor.tags = Array.from(new Set([
    ...(Array.isArray(survivor.tags) ? survivor.tags : []),
    ...duplicates.flatMap((contact) => Array.isArray(contact.tags) ? contact.tags : [])
  ])).slice(0, 12);
  survivor.notes = uniqueTexts([survivor.notes, ...duplicates.map((contact) => contact.notes)]).join("\n\n");
  const valueEstimates = [survivor, ...duplicates]
    .map((contact) => Number(contact.valueEstimate || 0))
    .filter((value) => Number.isFinite(value));
  survivor.valueEstimate = Math.max(0, ...valueEstimates);
  survivor.lastInteractionAt = latestIso([survivor.lastInteractionAt, ...duplicates.map((contact) => contact.lastInteractionAt)]) || survivor.lastInteractionAt || now;
  survivor.createdAt = earliestIso([survivor.createdAt, ...duplicates.map((contact) => contact.createdAt)]) || survivor.createdAt || now;
  survivor.updatedAt = now;
}

function moveContactReferences(db, business, survivorId, duplicateIds) {
  const duplicateSet = new Set(duplicateIds);

  db.activities.forEach((activity) => {
    if (duplicateSet.has(activity.contactId)) {
      activity.contactId = survivorId;
    }
  });

  db.bookings.forEach((booking) => {
    if (duplicateSet.has(booking.contactId)) {
      booking.contactId = survivorId;
    }
  });

  db.bookingReminders.forEach((reminder) => {
    if (duplicateSet.has(reminder.contactId)) {
      reminder.contactId = survivorId;
    }
  });

  [business.orders, business.content?.orders, business.content?.commerce?.orders]
    .filter(Array.isArray)
    .forEach((orders) => {
      orders.forEach((order) => {
        if (duplicateSet.has(order.contactId)) {
          order.contactId = survivorId;
        }

        if (order.customer && duplicateSet.has(order.customer.contactId)) {
          order.customer.contactId = survivorId;
        }
      });
    });
}

function uniqueTexts(values) {
  return Array.from(new Set(values.map((value) => cleanText(value || "", 4000)).filter(Boolean)));
}

function latestIso(values) {
  return pickIso(values, (left, right) => right - left);
}

function earliestIso(values) {
  return pickIso(values, (left, right) => left - right);
}

function pickIso(values, sorter) {
  const dates = values
    .map((value) => new Date(value || ""))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => sorter(left.getTime(), right.getTime()));

  return dates[0]?.toISOString() || "";
}

function makeActivity(businessId, contactId, payload, now, defaults) {
  const source = extractPayload(payload);
  return {
    id: cleanId(source.id) || `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    contactId,
    type: cleanText(source.type || defaults.type || "note", 80),
    title: cleanText(source.title || defaults.title || "Actividad", 160),
    note: cleanText(source.note || source.notes || source.message || defaults.note || "", 4000),
    source: cleanText(source.source || defaults.source || "manual", 80),
    metadata: isPlainObject(source.metadata) ? source.metadata : {},
    createdAt: now
  };
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);

  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.activities = Array.isArray(db.activities) ? db.activities : [];
  db.bookings = Array.isArray(db.bookings) ? db.bookings : [];
  db.bookingReminders = Array.isArray(db.bookingReminders) ? db.bookingReminders : [];
  db.businessEvents = Array.isArray(db.businessEvents) ? db.businessEvents : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveDb(db, context, backupLabel) {
  await saveBusinessStore(db, context, backupLabel);
}

async function readJsonBody(request) {
  let size = 0;
  let raw = "";

  for await (const chunk of request) {
    size += chunk.length;

    if (size > MAX_BODY_BYTES) {
      throw httpError(413, "JSON body is too large");
    }

    raw += chunk;
  }

  if (!raw.trim()) {
    throw httpError(400, "JSON body is required");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw httpError(400, "Invalid JSON body");
  }
}

function findBusiness(db, id) {
  return db.businesses.find((business) => business.id === id || business.slug === id);
}

function extractPayload(payload) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  if (isPlainObject(payload.contact)) {
    return payload.contact;
  }

  if (isPlainObject(payload.lead)) {
    return payload.lead;
  }

  if (isPlainObject(payload.activity)) {
    return payload.activity;
  }

  return payload;
}

function normalizeType(value) {
  const type = cleanText(value, 40);

  if (!CONTACT_TYPES.has(type)) {
    throw httpError(400, `Invalid contact type: ${type}`);
  }

  return type;
}

function normalizeStatus(value) {
  const status = normalizeStatusAlias(value);

  if (!CONTACT_STATUSES.has(status)) {
    throw httpError(400, `Invalid contact status: ${status}`);
  }

  return status;
}

function normalizeStoredStatus(value) {
  const status = normalizeStatusAlias(value);
  return CONTACT_STATUSES.has(status) ? status : "new";
}

function normalizePriority(value) {
  const priority = normalizePriorityAlias(value);

  if (!CONTACT_PRIORITIES.has(priority)) {
    throw httpError(400, `Invalid contact priority: ${priority}`);
  }

  return priority;
}

function normalizeStoredPriority(value) {
  const priority = normalizePriorityAlias(value);
  return CONTACT_PRIORITIES.has(priority) ? priority : "media";
}

function resolveLostReason(status, source, existing = {}) {
  if (status !== "lost") {
    return "";
  }

  const value = Object.prototype.hasOwnProperty.call(source, "lostReason")
    ? source.lostReason
    : existing?.lostReason;
  const reason = normalizeLostReason(value);

  if (!reason) {
    if (cleanText(value || "")) {
      throw httpError(400, `Invalid lostReason: ${cleanText(value, 80)}`);
    }

    throw httpError(400, "lostReason is required when status is lost");
  }

  return reason;
}

function normalizeLostReason(value) {
  const reason = normalizeLostReasonAlias(value);
  return CONTACT_LOST_REASONS.has(reason) ? reason : "";
}

function normalizeStoredLostReason(value) {
  return normalizeLostReason(value);
}

function normalizeLostReasonAlias(value) {
  const reason = normalizeToken(value);
  const aliases = {
    price: "precio",
    "no responde": "no_responde",
    no_response: "no_responde",
    unresponsive: "no_responde",
    "ya tiene proveedor": "ya_tiene_proveedor",
    has_provider: "ya_tiene_proveedor",
    "fuera de zona": "fuera_de_zona",
    out_of_area: "fuera_de_zona",
    postponed: "pospuesto",
    "no encaja": "no_encaja",
    not_fit: "no_encaja",
    competitor: "competencia"
  };

  return aliases[reason] || reason || "";
}

function normalizePriorityAlias(value) {
  const priority = cleanText(value, 40).toLowerCase();
  const aliases = {
    high: "alta",
    medium: "media",
    low: "baja"
  };

  return aliases[priority] || priority || "media";
}

function normalizeOrder(value, fallback = 0) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return number;
  }

  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
}

function fallbackContactOrder(contact, now = new Date().toISOString()) {
  const parsed = Date.parse(contact?.createdAt || contact?.updatedAt || now);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function comparePipelineContacts(left, right) {
  const order = normalizeOrder(left.order, fallbackContactOrder(left)) - normalizeOrder(right.order, fallbackContactOrder(right));

  if (Math.abs(order) > Number.EPSILON) {
    return order;
  }

  return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
}

function normalizeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function makeStatusChangeNote(previous, contact) {
  const base = `Estado: ${previous.status} -> ${contact.status}`;

  if (contact.status !== "lost" || !contact.lostReason) {
    return base;
  }

  return `${base}. Motivo: ${lostReasonLabel(contact.lostReason)}`;
}

function makeStatusChangeMetadata(previous, contact) {
  return {
    previousStatus: previous.status,
    status: contact.status,
    lostReason: contact.status === "lost" ? contact.lostReason || "" : ""
  };
}

function lostReasonLabel(value) {
  const labels = {
    precio: "Precio",
    no_responde: "No responde",
    ya_tiene_proveedor: "Ya tiene proveedor",
    fuera_de_zona: "Fuera de zona",
    pospuesto: "Pospuesto",
    no_encaja: "No encaja",
    competencia: "Competencia"
  };

  return labels[value] || value;
}

function normalizeScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(number)));
}

function normalizeNextAction(payload, now = new Date().toISOString()) {
  const source = extractNextActionPayload(payload);
  const type = normalizeNextActionType(source.type);
  const dueDate = normalizeIsoDate(source.dueDate || source.dueAt || source.date);
  const status = normalizeNextActionStatus(source.status || "pendiente");

  return {
    type,
    dueDate,
    status,
    note: cleanText(source.note || source.notes || "", 1000),
    createdAt: cleanText(source.createdAt || now, 80),
    updatedAt: now
  };
}

function normalizeOptionalNextAction(value, now = new Date().toISOString(), strict = false) {
  if (!value) {
    return null;
  }

  try {
    const nextAction = normalizeNextAction(value, now);
    return nextAction.status === "hecha" ? null : nextAction;
  } catch (error) {
    if (strict) {
      throw error;
    }

    return null;
  }
}

function extractNextActionPayload(payload) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "nextAction must be an object");
  }

  if (isPlainObject(payload.nextAction)) {
    return payload.nextAction;
  }

  return payload;
}

function normalizeNextActionType(value) {
  const type = normalizeToken(value);

  if (!NEXT_ACTION_TYPES.has(type)) {
    throw httpError(400, `Invalid nextAction type: ${type}`);
  }

  return type;
}

function normalizeNextActionStatus(value) {
  const status = normalizeToken(value);
  const aliases = {
    pending: "pendiente",
    done: "hecha",
    completed: "hecha",
    overdue: "vencida"
  };
  const normalized = aliases[status] || status || "pendiente";

  if (!NEXT_ACTION_STATUSES.has(normalized)) {
    throw httpError(400, `Invalid nextAction status: ${normalized}`);
  }

  return normalized;
}

function normalizeNextActionFilter(value) {
  const filter = normalizeToken(value || "hoy");

  if (["hoy", "vencidas", "sin-accion"].includes(filter)) {
    return filter;
  }

  throw httpError(400, `Invalid nextAction filter: ${filter}`);
}

function getComputedNextAction(value) {
  const nextAction = normalizeOptionalNextAction(value);

  if (!nextAction) {
    return null;
  }

  if (nextAction.status === "pendiente" && isBeforeToday(nextAction.dueDate)) {
    return {
      ...nextAction,
      status: "vencida"
    };
  }

  return nextAction;
}

function matchesNextActionFilter(contact, nextAction, filter, completedTodayIds = new Set()) {
  if (filter === "sin-accion") {
    return !nextAction
      && !completedTodayIds.has(contact.id)
      && !["lost", "customer"].includes(String(contact.status || ""));
  }

  if (!nextAction) {
    return false;
  }

  if (filter === "vencidas") {
    return nextAction.status === "vencida";
  }

  return sameLocalDate(nextAction.dueDate, new Date()) && nextAction.status !== "hecha";
}

function getCompletedNextActionContactIds(db, businessId) {
  return new Set(
    db.activities
      .filter((activity) => activity.businessId === businessId)
      .filter((activity) => activity.type === "next_action.completed")
      .filter((activity) => sameLocalDate(activity.createdAt, new Date()))
      .map((activity) => activity.contactId)
      .filter(Boolean)
  );
}

function compareNextActionItems(left, right) {
  const leftTime = Date.parse(left.nextAction?.dueDate || left.contact.lastInteractionAt || left.contact.createdAt || "");
  const rightTime = Date.parse(right.nextAction?.dueDate || right.contact.lastInteractionAt || right.contact.createdAt || "");
  const diff = normalizeTime(leftTime) - normalizeTime(rightTime);

  if (diff) {
    return diff;
  }

  return String(left.contact.name || "").localeCompare(String(right.contact.name || ""));
}

function summarizeContact(contact) {
  return {
    id: contact.id,
    businessId: contact.businessId,
    type: contact.type,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    source: contact.source,
    status: contact.status,
    priority: contact.priority,
    score: contact.score,
    scoreLabel: contact.scoreLabel,
    merged: Boolean(contact.merged),
    mergedInto: contact.mergedInto || "",
    valueEstimate: contact.valueEstimate,
    lastInteractionAt: contact.lastInteractionAt,
    createdAt: contact.createdAt
  };
}

function normalizeIsoDate(value) {
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    throw httpError(400, "nextAction dueDate must be a valid ISO date");
  }

  return date.toISOString();
}

function isBeforeToday(value) {
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date < startOfToday();
}

function sameLocalDate(value, date) {
  const parsed = new Date(value || "");

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getFullYear() === date.getFullYear()
    && parsed.getMonth() === date.getMonth()
    && parsed.getDate() === date.getDate();
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function normalizeTime(value) {
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function normalizeToken(value) {
  return cleanText(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeOptionalStatus(value) {
  return value ? normalizeStatus(value) : "";
}

function normalizeOptionalScoreLabel(value) {
  if (!value) {
    return "";
  }

  return normalizeStoredScoreLabel(value);
}

function normalizeStatusAlias(value) {
  const status = cleanText(value, 80).toLowerCase();
  const aliases = {
    nuevo: "new",
    contacted: "contacted",
    contactado: "contacted",
    "esperando respuesta": "waiting",
    waiting_response: "waiting",
    reservado: "reserved",
    ganada: "won",
    ganado: "won",
    perdida: "lost",
    perdido: "lost",
    cliente: "customer"
  };

  return aliases[status] || status || "new";
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item, 60)).filter(Boolean).slice(0, 12);
  }

  return cleanText(value || "", 300)
    .split(",")
    .map((item) => cleanText(item, 60))
    .filter(Boolean)
    .slice(0, 12);
}

function appendAudit(db, type, businessId, now, contactId) {
  db.auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    businessId,
    contactId,
    createdAt: now
  });
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
    Allow: "GET, POST, PATCH, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === "true" || value === "on" || value === 1 || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === "off" || value === 0 || value === "0") {
    return false;
  }

  return Boolean(fallback);
}

function cleanId(value) {
  return cleanText(value, 80).replace(/[^a-z0-9_-]/gi, "_").replace(/^_+|_+$/g, "");
}

function normalizeEmail(value) {
  return extractEmail(value).toLowerCase();
}

function normalizePhone(value) {
  return cleanText(value, 80).replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function extractEmail(value) {
  return String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function extractPhone(value) {
  return String(value || "").match(/(\+?\d[\d\s().-]{7,})/)?.[0] || "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
