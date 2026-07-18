import { randomUUID } from "node:crypto";
import { corsHeaders } from "../lib/cors.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { upsertAssociation } from "../lib/association-model.mjs";
import { sendChannelMessage } from "../lib/channel-providers.mjs";
import {
  addInternalNote,
  assertOutboundConsent,
  ensureOutboundCustomerThread,
  listChannelConnections,
  recordOutboundMessage
} from "../lib/omnichannel-model.mjs";
import {
  AUTOMATION_RECIPES,
  applySequenceSignal,
  cancelAutomationRun,
  createAutomation,
  ensureAutomationCollections,
  enrollSequence,
  executeAutomationRun,
  getAutomation,
  linkEnrollmentRun,
  listAutomationRuns,
  listAutomations,
  listSequenceEnrollments,
  matchingPublishedAutomations,
  publishAutomation,
  previewSequenceEnrollments,
  recordSequenceMetric,
  retryAutomationRun,
  seedAutomationRecipes,
  setAutomationStatus,
  startAutomationRun,
  updateAutomationDraft,
  updateSequenceEnrollment
} from "../lib/automation-engine.mjs";

const MAX_BODY_BYTES = Number(process.env.AUTOMATION_API_MAX_BODY_BYTES || 512 * 1024);

export function isAutomationApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/(?:automations|sequences)(?:\/.*)?$/.test(pathname);
}

export async function handleAutomationApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PATCH, DELETE, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2];
    const area = segments[3];
    const db = ensureAutomationCollections(await loadBusinessStore(context));
    const business = requireBusiness(db, businessRef);
    const clientSession = getRequestClientSession(request);
    if (clientSession && clientSession.businessId !== business.id) throw apiError(403, "Client session cannot access this business");
    const canMutate = !clientSession;
    if (area === "automations") return await handleAutomations({ request, response, context, requestUrl, method, segments, db, business, canMutate });
    if (area === "sequences") return await handleSequences({ request, response, context, requestUrl, method, segments, db, business, canMutate });
    throw apiError(404, "Automation resource not found");
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { error: status >= 500 && !error.expose && process.env.NODE_ENV !== "test" ? "Internal automation API error" : error.message, code: error.code || "automation_error" }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function handleAutomations(input) {
  const { request, response, context, requestUrl, method, segments, db, business, canMutate } = input;
  const resourceId = segments[4] || "";
  const action = segments[5] || "";
  const childId = segments[6] || "";
  const childAction = segments[7] || "";

  if (!resourceId) {
    if (method === "GET") return sendJson(response, 200, { automations: listAutomations(db, business.id, { kind: requestUrl.searchParams.get("kind"), status: requestUrl.searchParams.get("status") }), recipes: AUTOMATION_RECIPES }, context);
    requireMutation(canMutate);
    if (method === "POST") {
      const source = requireObject(await readJsonBody(request));
      const recipe = source.recipeKey ? AUTOMATION_RECIPES.find((item) => item.key === source.recipeKey) : null;
      const automation = createAutomation(db, business.id, recipe ? { ...recipe, ...source, nodes: source.nodes || recipe.nodes, trigger: source.trigger || recipe.trigger } : source);
      await saveBusinessStore(db, context, "automation-create");
      return sendJson(response, 201, { automation }, context);
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  if (resourceId === "recipes") {
    if (method === "GET") return sendJson(response, 200, { recipes: AUTOMATION_RECIPES }, context);
    requireMutation(canMutate);
    if (method === "POST" && action === "seed") {
      const created = seedAutomationRecipes(db, business.id);
      if (created.length) await saveBusinessStore(db, context, "automation-recipes-seed");
      return sendJson(response, 200, { created, automations: listAutomations(db, business.id) }, context);
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  if (resourceId === "events") {
    requireMutation(canMutate);
    if (method !== "POST") throw methodNotAllowed("POST, OPTIONS");
    const source = requireObject(await readJsonBody(request));
    const runs = await dispatchAutomationEvent(db, business, source.event || source, context, { idempotencyKey: source.idempotencyKey, now: source.now });
    if (runs.length) await saveBusinessStore(db, context, "automation-event-dispatch");
    return sendJson(response, 200, { matched: runs.length, runs }, context);
  }

  const automationId = resourceId;
  if (!action) {
    if (method === "GET") return sendJson(response, 200, { automation: getAutomation(db, business.id, automationId) }, context);
    requireMutation(canMutate);
    if (method === "PATCH") {
      const source = requireObject(await readJsonBody(request));
      const automation = Object.prototype.hasOwnProperty.call(source, "status") && Object.keys(source).length === 1
        ? setAutomationStatus(db, business.id, automationId, source.status)
        : updateAutomationDraft(db, business.id, automationId, source);
      await saveBusinessStore(db, context, "automation-update");
      return sendJson(response, 200, { automation }, context);
    }
    if (method === "DELETE") {
      const automation = setAutomationStatus(db, business.id, automationId, "archived");
      await saveBusinessStore(db, context, "automation-archive");
      return sendJson(response, 200, { automation }, context);
    }
    throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
  }

  if (action === "runs" && !childId && method === "GET") return sendJson(response, 200, { runs: listAutomationRuns(db, business.id, automationId) }, context);
  requireMutation(canMutate);
  if (action === "publish" && method === "POST") {
    const automation = publishAutomation(db, business.id, automationId);
    await saveBusinessStore(db, context, "automation-publish");
    return sendJson(response, 200, { automation }, context);
  }
  if (action === "test" && method === "POST") {
    const source = requireObject(await readJsonBody(request));
    const event = source.event || { type: "manual", id: `test_${randomUUID()}`, contactId: source.contactId };
    const contextData = { ...(await buildRunContext(db, business.id, event)), ...(source.context || {}) };
    const started = startAutomationRun(db, business.id, automationId, { testMode: true, event, context: contextData, idempotencyKey: source.idempotencyKey });
    const run = started.duplicate ? started.run : await executeAutomationRun(db, business.id, started.run.id, { actionExecutor: createActionExecutor(context, business), now: source.now });
    await saveBusinessStore(db, context, "automation-test");
    return sendJson(response, 200, { run, duplicate: started.duplicate, logs: listAutomationRuns(db, business.id, automationId).find((item) => item.id === run.id)?.logs || [] }, context);
  }
  if (action === "run" && method === "POST") {
    const source = requireObject(await readJsonBody(request));
    const event = source.event || { type: "manual", id: source.eventId, contactId: source.contactId };
    const started = startAutomationRun(db, business.id, automationId, { event, context: { ...(await buildRunContext(db, business.id, event)), ...(source.context || {}) }, idempotencyKey: source.idempotencyKey });
    const run = started.duplicate ? started.run : await executeAutomationRun(db, business.id, started.run.id, { actionExecutor: createActionExecutor(context, business), now: source.now });
    await saveBusinessStore(db, context, "automation-run");
    return sendJson(response, started.duplicate ? 200 : 201, { run, duplicate: started.duplicate }, context);
  }
  if (action === "runs" && childId) {
    if (method !== "POST") throw methodNotAllowed("POST, OPTIONS");
    let run;
    if (childAction === "resume") run = await executeAutomationRun(db, business.id, childId, { actionExecutor: createActionExecutor(context, business) });
    else if (childAction === "retry") { retryAutomationRun(db, business.id, childId); run = await executeAutomationRun(db, business.id, childId, { actionExecutor: createActionExecutor(context, business) }); }
    else if (childAction === "cancel") run = cancelAutomationRun(db, business.id, childId, "manual");
    else throw apiError(404, "Automation run action not found");
    await saveBusinessStore(db, context, `automation-run-${childAction}`);
    return sendJson(response, 200, { run }, context);
  }
  throw apiError(404, "Automation action not found");
}

export async function dispatchAutomationEvent(db, business, event, context, options = {}) {
  ensureAutomationCollections(db);
  const matches = matchingPublishedAutomations(db, business.id, event);
  const runs = [];
  for (const automation of matches) {
    const started = startAutomationRun(db, business.id, automation.id, {
      event,
      context: { ...(await buildRunContext(db, business.id, event)), ...(options.context || {}) },
      idempotencyKey: options.idempotencyKey ? `${options.idempotencyKey}:${automation.id}` : ""
    });
    const run = started.duplicate ? started.run : await executeAutomationRun(db, business.id, started.run.id, { actionExecutor: createActionExecutor(context, business), now: options.now });
    runs.push({ run, duplicate: started.duplicate });
  }
  return runs;
}

async function handleSequences(input) {
  const { request, response, context, requestUrl, method, segments, db, business, canMutate } = input;
  const resource = segments[4] || "";
  const resourceId = segments[5] || "";
  requireMutation(canMutate, method === "GET");
  if (resource === "preview") {
    if (method !== "POST") throw methodNotAllowed("POST, OPTIONS");
    const source = requireObject(await readJsonBody(request));
    const contactIds = Array.isArray(source.contactIds) ? source.contactIds : [source.contactId].filter(Boolean);
    return sendJson(response, 200, { preview: previewSequenceEnrollments(db, business.id, requiredText(source.automationId, "automationId", 180), contactIds) }, context);
  }
  if (resource === "enrollments" && !resourceId) {
    if (method === "GET") return sendJson(response, 200, { enrollments: listSequenceEnrollments(db, business.id, { automationId: requestUrl.searchParams.get("automationId"), contactId: requestUrl.searchParams.get("contactId") }) }, context);
    if (method === "POST") {
      const source = requireObject(await readJsonBody(request));
      const automationId = requiredText(source.automationId, "automationId", 180);
      const contactIds = [...new Set((Array.isArray(source.contactIds) ? source.contactIds : [source.contactId]).map(clean).filter(Boolean))].slice(0, 500);
      const preview = previewSequenceEnrollments(db, business.id, automationId, contactIds);
      if (source.dryRun) return sendJson(response, 200, { preview, enrollments: [] }, context);
      const results = [];
      for (const contact of preview.eligible) {
        const result = enrollSequence(db, business.id, automationId, { ...source, contactId: contact.contactId });
        if (!result.duplicate) {
          const event = { type: "sequence.enrolled", id: `sequence:${result.enrollment.id}`, entity: "contact", entityId: result.enrollment.contactId, contactId: result.enrollment.contactId, payload: { enrollmentId: result.enrollment.id } };
          const started = startAutomationRun(db, business.id, result.enrollment.automationId, { event, context: await buildRunContext(db, business.id, event), idempotencyKey: `sequence:${result.enrollment.id}` });
          linkEnrollmentRun(db, business.id, result.enrollment.id, started.run.id);
          await executeAutomationRun(db, business.id, started.run.id, { actionExecutor: createActionExecutor(context, business) });
        }
        results.push(result);
      }
      await saveBusinessStore(db, context, "sequence-enroll");
      const enrollmentIds = new Set(results.map((item) => item.enrollment.id));
      const enrollments = listSequenceEnrollments(db, business.id).filter((item) => enrollmentIds.has(item.id));
      return sendJson(response, results.some((item) => !item.duplicate) ? 201 : 200, { enrollment: enrollments[0] || null, enrollments, duplicate: Boolean(results.length && results.every((item) => item.duplicate)), preview }, context);
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }
  if (resource === "enrollments" && resourceId) {
    if (method !== "PATCH") throw methodNotAllowed("PATCH, OPTIONS");
    const enrollment = updateSequenceEnrollment(db, business.id, resourceId, requireObject(await readJsonBody(request)));
    await saveBusinessStore(db, context, "sequence-enrollment-update");
    return sendJson(response, 200, { enrollment }, context);
  }
  if (resource === "signals") {
    if (method !== "POST") throw methodNotAllowed("POST, OPTIONS");
    const source = requireObject(await readJsonBody(request));
    const stopped = applySequenceSignal(db, business.id, requiredText(source.contactId, "contactId", 180), requiredText(source.signal, "signal", 80));
    if (stopped.length) await saveBusinessStore(db, context, "sequence-signal");
    return sendJson(response, 200, { stopped }, context);
  }
  throw apiError(404, "Sequence resource not found");
}

export function createActionExecutor(context, business) {
  return async ({ db, businessId, run, node, now }) => {
    const config = node.config;
    const contact = resolveRunContact(db, businessId, run);
    if (["create_task", "add_tag", "update_contact", "send_message", "internal_note"].includes(config.action) && !contact) throw apiError(404, "Automation contact context is missing");
    if (config.action === "create_task") {
      const task = { id: `task_${randomUUID()}`, businessId, title: interpolate(config.title || "Tarea automatizada", run.context), description: interpolate(config.description || "", run.context), type: clean(config.taskType || "follow_up"), status: "pending", priority: ["low", "normal", "high", "urgent"].includes(config.priority) ? config.priority : "normal", ownerId: clean(config.ownerId), participantIds: [], dueAt: new Date(Date.parse(now) + Number(config.dueInMinutes || 0) * 60000).toISOString(), reminderAt: "", recurrence: "none", result: "", dependencyIds: [], tags: ["automation", `automation:${run.automationId}`], source: "automation-engine", createdAt: now, updatedAt: now, completedAt: "", cancelledAt: "", archivedAt: "", recurrenceParentId: "" };
      db.tasks.push(task);
      upsertAssociation(db, { businessId, fromType: "task", fromId: task.id, toType: "contact", toId: contact.id, kind: "related", isPrimary: true, now });
      return { taskId: task.id, dueAt: task.dueAt };
    }
    if (config.action === "add_tag") {
      const tag = requiredText(interpolate(config.tag || "automation", run.context), "tag", 120);
      contact.tags = [...new Set([...(Array.isArray(contact.tags) ? contact.tags : []), tag])];
      contact.updatedAt = now;
      return { contactId: contact.id, tag };
    }
    if (config.action === "update_contact") {
      if (config.status) contact.status = clean(config.status);
      if (config.priority) contact.priority = clean(config.priority);
      contact.updatedAt = now;
      return { contactId: contact.id, status: contact.status, priority: contact.priority };
    }
    const channel = config.channel === "whatsapp" ? "whatsapp" : "email";
    const connection = listChannelConnections(db, businessId, process.env).find((item) => item.channel === channel);
    const thread = ensureOutboundCustomerThread(db, business, contact, channel, { provider: connection?.provider || "automation", subject: interpolate(config.subject || "", run.context) }, now);
    if (config.action === "internal_note") {
      const note = addInternalNote(db, businessId, thread.id, { senderName: "Automatizacion", body: interpolate(config.body || "Nota automatizada", run.context), mentions: config.mentions || [] }, now);
      return { noteId: note.id, threadId: thread.id };
    }
    const purpose = clean(config.purpose || "service");
    assertOutboundConsent(db, businessId, contact.id, channel, purpose);
    if (!connection) throw apiError(409, "Channel connection not found");
    const providerInput = { body: requiredText(interpolate(config.body || "", run.context), "message body", 20000), subject: interpolate(config.subject || "", run.context), purpose, senderName: "Automatizacion", attachments: [], actorId: "automation-engine", idempotencyKey: `automation_${run.id}_${node.id}`, automationRunId: run.id, provider: connection.provider };
    const providerResult = await sendChannelMessage({ connection, thread, contact, message: providerInput, env: process.env, fetchImpl: context.fetchImpl });
    const message = recordOutboundMessage(db, business, thread, contact, providerInput, providerResult, now);
    recordSequenceMetric(db, businessId, run.id, "sent", 1, now);
    if (["delivered", "read"].includes(message.deliveryStatus)) recordSequenceMetric(db, businessId, run.id, "delivered", 1, now);
    return { messageId: message.id, threadId: thread.id, deliveryStatus: message.deliveryStatus };
  };
}

async function buildRunContext(db, businessId, event) {
  const contactId = clean(event.contactId || (event.entity === "contact" ? event.entityId : "") || event.payload?.contactId);
  const contact = db.contacts.find((item) => item.businessId === businessId && item.id === contactId && !item.merged) || null;
  const entity = event.entity ? db[`${event.entity}s`]?.find?.((item) => item.businessId === businessId && item.id === event.entityId) || null : null;
  return { contact: contact ? structuredClone(contact) : {}, entity: entity ? structuredClone(entity) : {}, payload: structuredClone(event.payload || {}) };
}

function resolveRunContact(db, businessId, run) { const id = clean(run.context?.contact?.id || run.event?.contactId || (run.event?.entity === "contact" ? run.event.entityId : "") || run.event?.payload?.contactId); return db.contacts.find((item) => item.businessId === businessId && item.id === id && !item.merged) || null; }
function interpolate(value, context) { return String(value ?? "").replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (_, path) => String(path.split(".").reduce((current, key) => current?.[key], context) ?? "")); }
function requireMutation(canMutate, readOnly = false) { if (!canMutate && !readOnly) throw apiError(403, "Automation configuration requires admin access"); }
function requireBusiness(db, ref) { const business = db.businesses.find((item) => item.id === ref || item.slug === ref); if (!business) throw apiError(404, "Business not found"); return business; }
function requireObject(value) { if (!value || typeof value !== "object" || Array.isArray(value)) throw apiError(400, "JSON body must be an object"); return value; }
function requiredText(value, field, max) { const result = clean(value); if (!result) throw apiError(400, `${field} is required`); if (result.length > max) throw apiError(400, `${field} is too long`); return result; }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "automation_error") { return Object.assign(new Error(message), { statusCode, code, expose: true }); }
async function readJsonBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Automation payload too large"); raw += chunk.toString("utf8"); } if (!raw.trim()) return {}; try { return JSON.parse(raw); } catch { throw apiError(400, "Invalid JSON body"); } }
function clean(value) { return String(value ?? "").trim(); }
function sendJson(response, status, payload, context, extraHeaders = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
