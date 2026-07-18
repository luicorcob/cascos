import { createHash, randomUUID } from "node:crypto";

const AUTOMATION_KINDS = new Set(["automation", "sequence"]);
const AUTOMATION_STATUSES = new Set(["draft", "published", "paused", "archived"]);
const NODE_TYPES = new Set(["trigger", "condition", "wait", "action", "goal", "exit"]);
const TRIGGER_TYPES = new Set(["manual", "record.created", "record.updated", "event", "date", "message.received", "webhook", "sequence.enrolled"]);
const ACTION_TYPES = new Set(["create_task", "add_tag", "update_contact", "send_message", "internal_note"]);
const STOP_SIGNALS = new Set(["reply", "booking", "proposal_accepted", "unsubscribe", "goal", "manual"]);
const RUN_TERMINAL = new Set(["completed", "failed", "cancelled", "stopped", "test_completed"]);

export const AUTOMATION_RECIPES = Object.freeze([
  {
    key: "new-lead-response",
    name: "Responder lead nuevo",
    description: "Crea una tarea inmediata cuando entra un lead nuevo.",
    kind: "automation",
    trigger: { type: "record.created", entity: "contact" },
    nodes: [
      node("trigger", "Lead creado", { type: "record.created", entity: "contact" }),
      node("condition", "Sigue siendo nuevo", { field: "contact.status", operator: "equals", value: "new", onFalse: "exit" }),
      node("action", "Crear tarea de respuesta", { action: "create_task", title: "Responder lead nuevo", dueInMinutes: 0, priority: "high" }),
      node("exit", "Fin", { outcome: "completed" })
    ]
  },
  {
    key: "published-demo-follow-up",
    name: "Seguimiento de demo en 48h",
    description: "Espera 48 horas tras publicar una demo y crea el seguimiento.",
    kind: "sequence",
    trigger: { type: "event", event: "demo.published" },
    quietHours: defaultQuietHours(),
    stopConditions: ["reply", "booking", "proposal_accepted", "unsubscribe"],
    nodes: [
      node("trigger", "Demo publicada", { type: "event", event: "demo.published" }),
      node("wait", "Esperar 48 horas", { minutes: 2880 }),
      node("action", "Crear seguimiento", { action: "create_task", title: "Seguimiento de demo publicada", dueInMinutes: 0, priority: "normal" }),
      node("exit", "Fin", { outcome: "completed" })
    ]
  },
  {
    key: "inactive-lead-review",
    name: "Reactivar lead inactivo",
    description: "Programa una revision cuando un lead supera siete dias sin actividad.",
    kind: "automation",
    trigger: { type: "date", schedule: "daily" },
    nodes: [
      node("trigger", "Revision diaria", { type: "date", schedule: "daily" }),
      node("condition", "Lead abierto", { field: "contact.status", operator: "in", value: ["new", "contacted", "waiting", "reserved"], onFalse: "exit" }),
      node("condition", "Inactivo siete dias", { field: "contact.inactiveDays", operator: "gte", value: 7, onFalse: "exit" }),
      node("action", "Crear tarea de reactivacion", { action: "create_task", title: "Reactivar lead inactivo", dueInMinutes: 0, priority: "normal" }),
      node("exit", "Fin", { outcome: "completed" })
    ]
  },
  {
    key: "post-booking-review",
    name: "Solicitar resena tras visita",
    description: "Prepara una solicitud de resena despues de una reserva completada.",
    kind: "sequence",
    trigger: { type: "record.updated", entity: "booking", status: "completed" },
    quietHours: defaultQuietHours(),
    stopConditions: ["unsubscribe", "reply"],
    nodes: [
      node("trigger", "Reserva completada", { type: "record.updated", entity: "booking", status: "completed" }),
      node("wait", "Esperar dos horas", { minutes: 120 }),
      node("action", "Enviar solicitud", { action: "send_message", channel: "email", purpose: "reviews", subject: "Gracias por tu visita", body: "Gracias por visitarnos. Nos encantaria conocer tu opinion." }),
      node("exit", "Fin", { outcome: "completed" })
    ]
  }
]);

export function ensureAutomationCollections(db) {
  for (const key of ["businesses", "contacts", "tasks", "activities", "communicationThreads", "communicationMessages", "automations", "automationVersions", "automationRuns", "automationRunLogs", "sequenceEnrollments", "auditLog"]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  return db;
}

export function seedAutomationRecipes(db, businessId, now = new Date().toISOString()) {
  ensureAutomationCollections(db);
  const created = [];
  for (const recipe of AUTOMATION_RECIPES) {
    if (db.automations.some((item) => item.businessId === businessId && item.recipeKey === recipe.key && item.archived !== true)) continue;
    created.push(createAutomation(db, businessId, { ...recipe, recipeKey: recipe.key }, now));
  }
  return created;
}

export function createAutomation(db, businessId, source, now = new Date().toISOString()) {
  ensureAutomationCollections(db);
  const kind = clean(source.kind || "automation");
  if (!AUTOMATION_KINDS.has(kind)) throw modelError(400, "Invalid automation kind");
  const name = requiredText(source.name, "name", 180);
  const automation = {
    id: `automation_${randomUUID()}`,
    businessId,
    name,
    description: optionalText(source.description, 1000),
    kind,
    status: "draft",
    recipeKey: optionalToken(source.recipeKey, 120),
    draftVersionId: "",
    publishedVersionId: "",
    publishedVersion: 0,
    archived: false,
    createdAt: now,
    updatedAt: now
  };
  db.automations.push(automation);
  const version = createDraftVersion(db, automation, normalizeDefinition(source), 1, now);
  automation.draftVersionId = version.id;
  appendAudit(db, businessId, "automation.created", now, { automationId: automation.id, versionId: version.id, kind });
  return decorateAutomation(db, automation);
}

export function updateAutomationDraft(db, businessId, automationId, source, now = new Date().toISOString()) {
  const automation = requireAutomation(db, businessId, automationId);
  if (automation.status === "archived" || automation.archived) throw modelError(409, "Archived automation cannot be edited");
  const version = requireVersion(db, businessId, automation.draftVersionId);
  if (Object.prototype.hasOwnProperty.call(source, "name")) automation.name = requiredText(source.name, "name", 180);
  if (Object.prototype.hasOwnProperty.call(source, "description")) automation.description = optionalText(source.description, 1000);
  const definitionInput = { ...version.definition };
  for (const key of ["trigger", "nodes", "quietHours", "stopConditions", "limits"]) {
    if (Object.prototype.hasOwnProperty.call(source, key)) definitionInput[key] = source[key];
  }
  version.definition = normalizeDefinition(definitionInput);
  version.updatedAt = now;
  automation.updatedAt = now;
  appendAudit(db, businessId, "automation.draft_updated", now, { automationId, versionId: version.id });
  return decorateAutomation(db, automation);
}

export function publishAutomation(db, businessId, automationId, now = new Date().toISOString()) {
  const automation = requireAutomation(db, businessId, automationId);
  const draft = requireVersion(db, businessId, automation.draftVersionId);
  validatePublishableDefinition(draft.definition);
  if (automation.publishedVersionId) {
    const previous = db.automationVersions.find((item) => item.id === automation.publishedVersionId);
    if (previous) previous.status = "retired";
  }
  draft.status = "published";
  draft.publishedAt = now;
  draft.updatedAt = now;
  automation.publishedVersionId = draft.id;
  automation.publishedVersion = draft.version;
  automation.status = "published";
  const nextDraft = createDraftVersion(db, automation, draft.definition, draft.version + 1, now);
  automation.draftVersionId = nextDraft.id;
  automation.updatedAt = now;
  appendAudit(db, businessId, "automation.published", now, { automationId, versionId: draft.id, version: draft.version });
  return decorateAutomation(db, automation);
}

export function setAutomationStatus(db, businessId, automationId, status, now = new Date().toISOString()) {
  const automation = requireAutomation(db, businessId, automationId);
  const normalized = clean(status);
  if (!AUTOMATION_STATUSES.has(normalized) || normalized === "draft") throw modelError(400, "Invalid automation status");
  if (normalized === "published" && !automation.publishedVersionId) throw modelError(409, "Publish a version before activating this automation");
  automation.status = normalized;
  automation.archived = normalized === "archived";
  automation.updatedAt = now;
  appendAudit(db, businessId, "automation.status_changed", now, { automationId, status: normalized });
  return decorateAutomation(db, automation);
}

export function listAutomations(db, businessId, options = {}) {
  ensureAutomationCollections(db);
  const kind = clean(options.kind);
  const status = clean(options.status);
  return db.automations
    .filter((item) => item.businessId === businessId)
    .filter((item) => !kind || item.kind === kind)
    .filter((item) => !status || item.status === status)
    .map((item) => decorateAutomation(db, item))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export function getAutomation(db, businessId, automationId) {
  return decorateAutomation(db, requireAutomation(db, businessId, automationId));
}

export function startAutomationRun(db, businessId, automationId, input = {}, now = new Date().toISOString()) {
  const automation = requireAutomation(db, businessId, automationId);
  const testMode = Boolean(input.testMode);
  if (!testMode && automation.status !== "published") throw modelError(409, "Automation is not active");
  const versionId = testMode ? automation.draftVersionId : automation.publishedVersionId;
  const version = requireVersion(db, businessId, versionId);
  const event = normalizeEvent(input.event || { type: testMode ? "manual" : version.definition.trigger.type, id: input.eventId });
  const idempotencyKey = optionalText(input.idempotencyKey, 256) || stableId(`${automation.id}:${version.id}:${event.id || hashJson(event)}`);
  const existing = db.automationRuns.find((run) => run.businessId === businessId && run.idempotencyKey === idempotencyKey);
  if (existing) return { run: existing, duplicate: true };
  const run = {
    id: `automation_run_${randomUUID()}`,
    businessId,
    automationId: automation.id,
    automationVersionId: version.id,
    automationVersion: version.version,
    kind: automation.kind,
    status: "running",
    testMode,
    idempotencyKey,
    event,
    context: isPlainObject(input.context) ? structuredClone(input.context) : {},
    cursor: 0,
    actionsExecuted: 0,
    stepsExecuted: 0,
    attempts: 0,
    resumeAt: "",
    error: "",
    startedAt: now,
    completedAt: "",
    createdAt: now,
    updatedAt: now
  };
  db.automationRuns.push(run);
  appendRunLog(db, run, "run.started", "success", { eventType: event.type, testMode }, now);
  appendAudit(db, businessId, "automation.run_started", now, { automationId, runId: run.id, testMode });
  return { run, duplicate: false };
}

export async function executeAutomationRun(db, businessId, runId, options = {}) {
  ensureAutomationCollections(db);
  const now = validIso(options.now) || new Date().toISOString();
  const run = requireRun(db, businessId, runId);
  if (RUN_TERMINAL.has(run.status)) return run;
  if (run.status === "waiting" && Date.parse(run.resumeAt || "") > Date.parse(now)) return run;
  const version = requireVersion(db, businessId, run.automationVersionId);
  const nodes = version.definition.nodes;
  const limits = version.definition.limits;
  run.status = "running";
  run.resumeAt = "";
  run.attempts = Number(run.attempts || 0) + 1;
  run.updatedAt = now;

  try {
    while (run.cursor < nodes.length) {
      run.stepsExecuted = Number(run.stepsExecuted || 0) + 1;
      if (run.stepsExecuted > 500) throw modelError(409, "Automation step limit reached", "automation_limit");
      const nodeValue = nodes[run.cursor];
      if (run.actionsExecuted >= limits.maxActionsPerRun) throw modelError(409, "Automation action limit reached", "automation_limit");
      if (nodeValue.type === "trigger") {
        appendRunLog(db, run, "node.trigger", "success", { nodeId: nodeValue.id, label: nodeValue.label }, now);
        run.cursor += 1;
        continue;
      }
      if (nodeValue.type === "condition" || nodeValue.type === "goal") {
        const matched = evaluateCondition(nodeValue.config, run.context, run.event);
        appendRunLog(db, run, nodeValue.type === "goal" ? "node.goal" : "node.condition", matched ? "success" : "skipped", { nodeId: nodeValue.id, label: nodeValue.label, matched }, now);
        if (nodeValue.type === "goal" && matched) return finishRun(db, run, run.testMode ? "test_completed" : "completed", now, "goal");
        const branchTarget = clean(matched ? nodeValue.config.onTrueNodeId : nodeValue.config.onFalseNodeId);
        if (branchTarget) {
          const targetIndex = nodes.findIndex((item) => item.id === branchTarget);
          if (targetIndex === -1) throw modelError(409, `Automation branch target not found: ${branchTarget}`);
          run.cursor = targetIndex;
          continue;
        }
        if (!matched && nodeValue.config.onFalse === "exit") return finishRun(db, run, run.testMode ? "test_completed" : "completed", now, "condition_exit");
        run.cursor += 1;
        continue;
      }
      if (nodeValue.type === "wait") {
        if (run.testMode) {
          appendRunLog(db, run, "node.wait", "simulated", { nodeId: nodeValue.id, minutes: nodeValue.config.minutes }, now);
          run.cursor += 1;
          continue;
        }
        const resumeAt = new Date(Date.parse(now) + nodeValue.config.minutes * 60000).toISOString();
        run.cursor += 1;
        run.status = "waiting";
        run.resumeAt = resumeAt;
        run.updatedAt = now;
        appendRunLog(db, run, "node.wait", "waiting", { nodeId: nodeValue.id, resumeAt }, now);
        return run;
      }
      if (nodeValue.type === "action") {
        if (!run.testMode && nodeValue.config.action === "send_message") {
          const allowedAt = nextQuietHoursAllowedAt(version.definition.quietHours, now);
          if (allowedAt !== now) {
            run.status = "waiting";
            run.resumeAt = allowedAt;
            run.updatedAt = now;
            appendRunLog(db, run, "node.quiet_hours", "waiting", { nodeId: nodeValue.id, resumeAt: allowedAt }, now);
            return run;
          }
        }
        const result = run.testMode
          ? { simulated: true, action: nodeValue.config.action }
          : await options.actionExecutor?.({ db, businessId, run, node: nodeValue, now }) ?? { skipped: true, reason: "no_action_executor" };
        run.actionsExecuted += 1;
        run.context.lastAction = structuredClone(result);
        appendRunLog(db, run, "node.action", run.testMode ? "simulated" : "success", { nodeId: nodeValue.id, action: nodeValue.config.action, result }, now);
        run.cursor += 1;
        continue;
      }
      if (nodeValue.type === "exit") return finishRun(db, run, run.testMode ? "test_completed" : "completed", now, nodeValue.config.outcome || "completed");
      run.cursor += 1;
    }
    return finishRun(db, run, run.testMode ? "test_completed" : "completed", now, "completed");
  } catch (error) {
    run.status = "failed";
    run.error = optionalText(error.message, 2000);
    run.updatedAt = now;
    appendRunLog(db, run, "run.failed", "failed", { error: run.error, code: error.code || "automation_failed", cursor: run.cursor }, now);
    appendAudit(db, businessId, "automation.run_failed", now, { automationId: run.automationId, runId: run.id, error: run.error });
    return run;
  }
}

export function retryAutomationRun(db, businessId, runId, now = new Date().toISOString()) {
  const run = requireRun(db, businessId, runId);
  if (run.status !== "failed") throw modelError(409, "Only failed runs can be retried");
  const version = requireVersion(db, businessId, run.automationVersionId);
  if (run.attempts >= version.definition.limits.maxAttempts) throw modelError(409, "Automation retry limit reached", "automation_limit");
  run.status = "running";
  run.error = "";
  run.updatedAt = now;
  appendRunLog(db, run, "run.retry_requested", "success", { attempt: run.attempts + 1 }, now);
  return run;
}

export function cancelAutomationRun(db, businessId, runId, reason = "manual", now = new Date().toISOString()) {
  const run = requireRun(db, businessId, runId);
  if (RUN_TERMINAL.has(run.status)) return run;
  run.status = "cancelled";
  run.error = optionalText(reason, 500);
  run.completedAt = now;
  run.updatedAt = now;
  appendRunLog(db, run, "run.cancelled", "success", { reason: run.error }, now);
  return run;
}

export function listAutomationRuns(db, businessId, automationId = "") {
  ensureAutomationCollections(db);
  return db.automationRuns
    .filter((run) => run.businessId === businessId && (!automationId || run.automationId === automationId))
    .map((run) => ({ ...run, logs: db.automationRunLogs.filter((log) => log.runId === run.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))) }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function matchingPublishedAutomations(db, businessId, event) {
  const normalized = normalizeEvent(event);
  return listAutomations(db, businessId, { status: "published" }).filter((automation) => triggerMatches(automation.publishedDefinition.trigger, normalized));
}

export function enrollSequence(db, businessId, automationId, source, now = new Date().toISOString()) {
  const automation = requireAutomation(db, businessId, automationId);
  if (automation.kind !== "sequence" || automation.status !== "published") throw modelError(409, "Sequence must be published before enrollment");
  const publishedDefinition = requireVersion(db, businessId, automation.publishedVersionId).definition;
  const contactId = requiredText(source.contactId, "contactId", 180);
  const contact = db.contacts.find((item) => item.businessId === businessId && item.id === contactId && !item.merged);
  if (!contact) throw modelError(404, "Contact not found");
  const duplicate = db.sequenceEnrollments.find((item) => item.businessId === businessId && item.automationId === automationId && item.contactId === contactId && item.status === "active");
  if (duplicate) return { enrollment: duplicate, duplicate: true };
  const enrollment = {
    id: `sequence_enrollment_${randomUUID()}`,
    businessId,
    automationId,
    automationVersionId: automation.publishedVersionId,
    contactId,
    status: "active",
    stopConditions: normalizeStopConditions(source.stopConditions || publishedDefinition.stopConditions),
    runId: "",
    source: optionalText(source.source, 120) || "manual",
    stoppedBy: "",
    metrics: { sent: 0, delivered: 0, responses: 0, meetings: 0, conversions: 0 },
    enrolledAt: now,
    stoppedAt: "",
    createdAt: now,
    updatedAt: now
  };
  db.sequenceEnrollments.push(enrollment);
  appendAudit(db, businessId, "sequence.enrolled", now, { enrollmentId: enrollment.id, automationId, contactId });
  return { enrollment, duplicate: false };
}

export function linkEnrollmentRun(db, businessId, enrollmentId, runId, now = new Date().toISOString()) {
  const enrollment = requireEnrollment(db, businessId, enrollmentId);
  requireRun(db, businessId, runId);
  enrollment.runId = runId;
  enrollment.updatedAt = now;
  return enrollment;
}

export function updateSequenceEnrollment(db, businessId, enrollmentId, source, now = new Date().toISOString()) {
  const enrollment = requireEnrollment(db, businessId, enrollmentId);
  const action = clean(source.action);
  if (action === "pause" && enrollment.status === "active") enrollment.status = "paused";
  else if (action === "resume" && enrollment.status === "paused") enrollment.status = "active";
  else if (action === "stop") stopEnrollment(db, enrollment, clean(source.signal || "manual"), now);
  else throw modelError(409, "Enrollment action is not valid for its current state");
  enrollment.updatedAt = now;
  return enrollment;
}

export function applySequenceSignal(db, businessId, contactId, signal, now = new Date().toISOString()) {
  ensureAutomationCollections(db);
  const normalized = clean(signal);
  if (!STOP_SIGNALS.has(normalized)) throw modelError(400, "Invalid sequence stop signal");
  const stopped = [];
  for (const enrollment of db.sequenceEnrollments.filter((item) => item.businessId === businessId && item.contactId === contactId && item.status === "active" && item.stopConditions.includes(normalized))) {
    enrollment.metrics = normalizeEnrollmentMetrics(enrollment.metrics);
    if (normalized === "reply") enrollment.metrics.responses += 1;
    if (normalized === "booking") { enrollment.metrics.meetings += 1; enrollment.metrics.conversions += 1; }
    if (normalized === "proposal_accepted") enrollment.metrics.conversions += 1;
    stopEnrollment(db, enrollment, normalized, now);
    stopped.push(enrollment);
  }
  return stopped;
}

export function previewSequenceEnrollments(db, businessId, automationId, contactIds) {
  ensureAutomationCollections(db);
  const automation = requireAutomation(db, businessId, automationId);
  if (automation.kind !== "sequence" || automation.status !== "published") throw modelError(409, "Sequence must be published before preview");
  const definition = requireVersion(db, businessId, automation.publishedVersionId).definition;
  const ids = [...new Set((Array.isArray(contactIds) ? contactIds : []).map(clean).filter(Boolean))].slice(0, 500);
  if (!ids.length) throw modelError(400, "Sequence preview requires at least one contact");
  const eligible = [];
  const blocked = [];
  for (const contactId of ids) {
    const contact = db.contacts.find((item) => item.businessId === businessId && item.id === contactId && !item.merged);
    if (!contact) { blocked.push({ contactId, reason: "contact_not_found" }); continue; }
    const active = db.sequenceEnrollments.some((item) => item.businessId === businessId && item.automationId === automationId && item.contactId === contactId && item.status === "active");
    if (active) { blocked.push({ contactId, contact: summarizeContact(contact), reason: "already_enrolled" }); continue; }
    eligible.push({ contactId, contact: summarizeContact(contact) });
  }
  return {
    automationId,
    version: automation.publishedVersion,
    total: ids.length,
    eligible,
    blocked,
    steps: definition.nodes.map((item) => ({ id: item.id, type: item.type, label: item.label, config: item.config })),
    quietHours: definition.quietHours,
    stopConditions: definition.stopConditions
  };
}

export function recordSequenceMetric(db, businessId, runId, metric, amount = 1, now = new Date().toISOString()) {
  ensureAutomationCollections(db);
  const key = ({ sent: "sent", delivered: "delivered", response: "responses", meeting: "meetings", conversion: "conversions" })[clean(metric)];
  if (!key) throw modelError(400, "Invalid sequence metric");
  const enrollment = db.sequenceEnrollments.find((item) => item.businessId === businessId && item.runId === runId);
  if (!enrollment) return null;
  enrollment.metrics = normalizeEnrollmentMetrics(enrollment.metrics);
  enrollment.metrics[key] += Math.max(0, Number(amount) || 0);
  enrollment.updatedAt = now;
  return enrollment;
}

export function listSequenceEnrollments(db, businessId, options = {}) {
  ensureAutomationCollections(db);
  return db.sequenceEnrollments
    .filter((item) => item.businessId === businessId)
    .filter((item) => !options.automationId || item.automationId === options.automationId)
    .filter((item) => !options.contactId || item.contactId === options.contactId)
    .map((item) => ({ ...item, contact: db.contacts.find((contact) => contact.businessId === businessId && contact.id === item.contactId) || null, run: db.automationRuns.find((run) => run.id === item.runId) || null }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function decorateAutomation(db, automation) {
  const draft = db.automationVersions.find((item) => item.id === automation.draftVersionId) || null;
  const published = db.automationVersions.find((item) => item.id === automation.publishedVersionId) || null;
  const runs = db.automationRuns.filter((run) => run.automationId === automation.id);
  const enrollments = db.sequenceEnrollments.filter((item) => item.automationId === automation.id);
  return {
    ...automation,
    draftDefinition: draft?.definition || null,
    draftVersion: draft?.version || 0,
    publishedDefinition: published?.definition || null,
    metrics: {
      runs: runs.length,
      completed: runs.filter((run) => ["completed", "test_completed"].includes(run.status)).length,
      failed: runs.filter((run) => run.status === "failed").length,
      waiting: runs.filter((run) => run.status === "waiting").length,
      activeEnrollments: enrollments.filter((item) => item.status === "active").length,
      stoppedEnrollments: enrollments.filter((item) => item.status === "stopped").length
    }
  };
}

function createDraftVersion(db, automation, definition, version, now) {
  const record = { id: `automation_version_${randomUUID()}`, businessId: automation.businessId, automationId: automation.id, version, status: "draft", definition: structuredClone(definition), publishedAt: "", createdAt: now, updatedAt: now };
  db.automationVersions.push(record);
  return record;
}

function normalizeDefinition(source) {
  const trigger = normalizeTrigger(source.trigger || source.nodes?.find((item) => item?.type === "trigger")?.config || { type: "manual" });
  const nodes = normalizeNodes(source.nodes || [node("trigger", "Inicio manual", trigger), node("exit", "Fin", { outcome: "completed" })]);
  if (!nodes.some((item) => item.type === "trigger")) nodes.unshift(normalizeNode(node("trigger", "Inicio", trigger), 0));
  return {
    trigger,
    nodes,
    quietHours: normalizeQuietHours(source.quietHours),
    stopConditions: normalizeStopConditions(source.stopConditions),
    limits: normalizeLimits(source.limits)
  };
}

function normalizeNodes(value) {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw modelError(400, "Automation requires between 1 and 100 nodes");
  const ids = new Set();
  return value.map((item, index) => {
    const normalized = normalizeNode(item, index);
    if (ids.has(normalized.id)) throw modelError(400, "Automation node IDs must be unique");
    ids.add(normalized.id);
    return normalized;
  });
}

function normalizeNode(value, index) {
  if (!isPlainObject(value)) throw modelError(400, "Automation nodes must be objects");
  const type = clean(value.type);
  if (!NODE_TYPES.has(type)) throw modelError(400, `Unsupported automation node type: ${type}`);
  const config = isPlainObject(value.config) ? structuredClone(value.config) : {};
  if (type === "wait") config.minutes = clampInteger(config.minutes, 1, 525600, 1);
  if (type === "action") {
    config.action = clean(config.action);
    if (!ACTION_TYPES.has(config.action)) throw modelError(400, `Unsupported automation action: ${config.action}`);
  }
  if (["condition", "goal"].includes(type)) {
    config.field = requiredText(config.field, "condition.field", 240);
    config.operator = normalizeOperator(config.operator);
  }
  if (type === "trigger") Object.assign(config, normalizeTrigger(config));
  return { id: optionalToken(value.id, 180) || `node_${index + 1}_${randomUUID().slice(0, 8)}`, type, label: optionalText(value.label, 180) || type, config };
}

function normalizeTrigger(value) {
  const trigger = isPlainObject(value) ? structuredClone(value) : {};
  const type = clean(trigger.type || "manual");
  if (!TRIGGER_TYPES.has(type)) throw modelError(400, "Unsupported automation trigger");
  return { type, entity: optionalToken(trigger.entity, 120), event: optionalToken(trigger.event, 180), status: optionalToken(trigger.status, 120), schedule: optionalToken(trigger.schedule, 120) };
}

function validatePublishableDefinition(definition) {
  if (!definition.nodes.some((item) => item.type === "trigger")) throw modelError(400, "Published automation requires a trigger");
  if (!definition.nodes.some((item) => ["action", "goal", "exit"].includes(item.type))) throw modelError(400, "Published automation requires an action, goal or exit");
}

function normalizeQuietHours(value) {
  const source = isPlainObject(value) ? value : defaultQuietHours();
  return { enabled: Boolean(source.enabled), timezone: optionalText(source.timezone, 120) || "Europe/Madrid", start: normalizeClock(source.start, "09:00"), end: normalizeClock(source.end, "20:00"), days: normalizeDays(source.days) };
}

function defaultQuietHours() { return { enabled: true, timezone: "Europe/Madrid", start: "09:00", end: "20:00", days: [1, 2, 3, 4, 5] }; }
function normalizeDays(value) { const days = Array.isArray(value) ? [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))] : [1, 2, 3, 4, 5]; return days.length ? days.sort() : [1, 2, 3, 4, 5]; }
function normalizeClock(value, fallback) { const text = clean(value); return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback; }
function normalizeLimits(value) { const source = isPlainObject(value) ? value : {}; return { maxActionsPerRun: clampInteger(source.maxActionsPerRun, 1, 100, 20), maxAttempts: clampInteger(source.maxAttempts, 1, 10, 3), timeoutSeconds: clampInteger(source.timeoutSeconds, 1, 300, 30) }; }
function normalizeStopConditions(value) { return [...new Set((Array.isArray(value) ? value : []).map(clean).filter((item) => STOP_SIGNALS.has(item)))]; }
function normalizeOperator(value) { const operator = clean(value || "equals"); if (!new Set(["equals", "not_equals", "in", "not_in", "contains", "exists", "gt", "gte", "lt", "lte"]).has(operator)) throw modelError(400, "Unsupported condition operator"); return operator; }

function evaluateCondition(config, context, event) {
  const actual = readPath({ ...context, event }, config.field);
  const expected = config.value;
  if (config.operator === "exists") return actual !== undefined && actual !== null && actual !== "";
  if (config.operator === "equals") return scalar(actual) === scalar(expected);
  if (config.operator === "not_equals") return scalar(actual) !== scalar(expected);
  if (config.operator === "in") return (Array.isArray(expected) ? expected : [expected]).map(scalar).includes(scalar(actual));
  if (config.operator === "not_in") return !(Array.isArray(expected) ? expected : [expected]).map(scalar).includes(scalar(actual));
  if (config.operator === "contains") return Array.isArray(actual) ? actual.map(scalar).includes(scalar(expected)) : String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
  const left = Number(actual); const right = Number(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return config.operator === "gt" ? left > right : config.operator === "gte" ? left >= right : config.operator === "lt" ? left < right : left <= right;
}

function triggerMatches(trigger, event) {
  if (trigger.type === "event") return event.type === "event" && (!trigger.event || trigger.event === event.name);
  if (trigger.type !== event.type) return false;
  if (trigger.entity && trigger.entity !== clean(event.entity)) return false;
  if (trigger.status && trigger.status !== clean(event.payload?.status || event.status)) return false;
  return true;
}

function normalizeEvent(value) {
  const source = isPlainObject(value) ? value : {};
  return { id: optionalText(source.id, 256) || `event_${randomUUID()}`, type: optionalToken(source.type, 120) || "manual", name: optionalToken(source.name || source.event, 180), entity: optionalToken(source.entity, 120), entityId: optionalText(source.entityId, 180), contactId: optionalText(source.contactId, 180), payload: isPlainObject(source.payload) ? structuredClone(source.payload) : {}, occurredAt: validIso(source.occurredAt) || new Date().toISOString() };
}

function nextQuietHoursAllowedAt(quietHours, now) {
  if (!quietHours?.enabled) return now;
  const date = new Date(now);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: quietHours.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const day = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[parts.weekday];
  const clock = `${parts.hour}:${parts.minute}`;
  if (quietHours.days.includes(day) && clock >= quietHours.start && clock < quietHours.end) return now;
  for (let offset = 1; offset <= 8 * 24 * 60; offset += 1) {
    const candidate = new Date(date.getTime() + offset * 60000);
    const candidateParts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: quietHours.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(candidate).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const candidateDay = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[candidateParts.weekday];
    if (quietHours.days.includes(candidateDay) && `${candidateParts.hour}:${candidateParts.minute}` === quietHours.start) return candidate.toISOString();
  }
  return now;
}

function finishRun(db, run, status, now, outcome) {
  run.status = status;
  run.completedAt = now;
  run.updatedAt = now;
  run.context.outcome = outcome;
  appendRunLog(db, run, "run.completed", "success", { outcome, actionsExecuted: run.actionsExecuted }, now);
  appendAudit(db, run.businessId, "automation.run_completed", now, { automationId: run.automationId, runId: run.id, status, outcome });
  const enrollment = db.sequenceEnrollments.find((item) => item.runId === run.id && ["active", "paused"].includes(item.status));
  if (enrollment) { enrollment.status = "completed"; enrollment.stoppedBy = "goal"; enrollment.stoppedAt = now; enrollment.updatedAt = now; }
  return run;
}

function stopEnrollment(db, enrollment, signal, now) {
  enrollment.status = "stopped";
  enrollment.stoppedBy = signal;
  enrollment.stoppedAt = now;
  enrollment.updatedAt = now;
  if (enrollment.runId) {
    const run = db.automationRuns.find((item) => item.id === enrollment.runId && !RUN_TERMINAL.has(item.status));
    if (run) { run.status = "stopped"; run.completedAt = now; run.updatedAt = now; appendRunLog(db, run, "run.stopped", "success", { signal }, now); }
  }
  appendAudit(db, enrollment.businessId, "sequence.stopped", now, { enrollmentId: enrollment.id, automationId: enrollment.automationId, contactId: enrollment.contactId, signal });
}

function normalizeEnrollmentMetrics(value) { const source = isPlainObject(value) ? value : {}; return { sent: Number(source.sent || 0), delivered: Number(source.delivered || 0), responses: Number(source.responses || 0), meetings: Number(source.meetings || 0), conversions: Number(source.conversions || 0) }; }
function summarizeContact(contact) { return { id: contact.id, name: contact.name || "", email: contact.email || "", phone: contact.phone || "" }; }

function appendRunLog(db, run, event, status, data, now) { const log = { id: `automation_log_${randomUUID()}`, businessId: run.businessId, automationId: run.automationId, runId: run.id, event, status, nodeId: optionalText(data?.nodeId, 180), data: isPlainObject(data) ? structuredClone(data) : {}, createdAt: now }; db.automationRunLogs.push(log); return log; }
function appendAudit(db, businessId, type, createdAt, extra = {}) { db.auditLog.push({ id: `audit_${randomUUID()}`, businessId, type, ...extra, createdAt }); }
function requireAutomation(db, businessId, id) { ensureAutomationCollections(db); const item = db.automations.find((value) => value.businessId === businessId && value.id === id); if (!item) throw modelError(404, "Automation not found"); return item; }
function requireVersion(db, businessId, id) { const item = db.automationVersions.find((value) => value.businessId === businessId && value.id === id); if (!item) throw modelError(404, "Automation version not found"); return item; }
function requireRun(db, businessId, id) { const item = db.automationRuns.find((value) => value.businessId === businessId && value.id === id); if (!item) throw modelError(404, "Automation run not found"); return item; }
function requireEnrollment(db, businessId, id) { const item = db.sequenceEnrollments.find((value) => value.businessId === businessId && value.id === id); if (!item) throw modelError(404, "Sequence enrollment not found"); return item; }
function readPath(source, path) { return clean(path).split(".").reduce((value, key) => value === undefined || value === null ? undefined : value[key], source); }
function node(type, label, config) { return { type, label, config }; }
function stableId(value) { return `auto_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`; }
function hashJson(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function scalar(value) { return typeof value === "string" ? value.trim().toLowerCase() : String(value ?? ""); }
function validIso(value) { const time = Date.parse(value || ""); return Number.isFinite(time) ? new Date(time).toISOString() : ""; }
function clampInteger(value, min, max, fallback) { const number = Number(value); return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function optionalToken(value, max) { const text = clean(value); return text && /^[A-Za-z0-9_.:-]+$/.test(text) ? text.slice(0, max) : ""; }
function requiredText(value, field, max) { const result = optionalText(value, max); if (!result) throw modelError(400, `${field} is required`); return result; }
function optionalText(value, max) { if (value === undefined || value === null || value === "") return ""; if (typeof value !== "string") throw modelError(400, "Text fields must be strings"); const result = value.replace(/[\u0000-\u001F\u007F]/g, "").trim(); if (result.length > max) throw modelError(400, `Text cannot exceed ${max} characters`); return result; }
function isPlainObject(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function modelError(statusCode, message, code = "automation_error") { return Object.assign(new Error(message), { statusCode, code }); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
