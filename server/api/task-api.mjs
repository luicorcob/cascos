import { randomUUID } from "node:crypto";
import {
  ASSOCIATION_KINDS,
  archiveEntityAssociations,
  associationCounterpart,
  findBusinessEntity,
  listEntityAssociations,
  normalizeAssociationEntityType,
  summarizeAssociatedEntity,
  upsertAssociation
} from "../lib/association-model.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { corsHeaders } from "../lib/cors.mjs";
import { TASK_PRIORITIES, TASK_RECURRENCES, TASK_STATUSES, TASK_TYPES, createRecurringTask } from "../lib/task-model.mjs";

const MAX_BODY_BYTES = Number(process.env.TASK_API_MAX_BODY_BYTES || 256 * 1024);
const TYPES = new Set(TASK_TYPES);
const STATUSES = new Set(TASK_STATUSES);
const PRIORITIES = new Set(TASK_PRIORITIES);
const RECURRENCES = new Set(TASK_RECURRENCES);
const KINDS = new Set(ASSOCIATION_KINDS);
const VIEWS = new Set(["all", "today", "overdue", "unassigned", "mine", "team", "completed"]);
const TASK_FIELDS = new Set([
  "title", "description", "type", "status", "priority", "ownerId", "participantIds",
  "dueAt", "reminderAt", "recurrence", "result", "dependencyIds", "tags", "source",
  "links", "entityType", "entityId"
]);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  accounts: [],
  deals: [],
  proposals: [],
  bookings: [],
  invoices: [],
  hospitalityInvoices: [],
  projects: [],
  communicationThreads: [],
  tasks: [],
  teamMembers: [],
  associations: [],
  activities: [],
  auditLog: []
};

export function isTaskApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/tasks(?:\/(?:queues|[^/]+(?:\/relations)?))?$/.test(pathname);
}

export async function handleTaskApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context);
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    const taskId = segments[4] || "";
    const action = segments[5] || "";
    if (!taskId && method === "GET") return await listTasks(businessRef, requestUrl, response, context);
    if (!taskId && method === "POST") return await createTask(businessRef, request, response, context);
    if (taskId === "queues" && !action && method === "GET") return await getTaskQueues(businessRef, requestUrl, response, context);
    if (taskId && action === "relations" && method === "GET") return await getTaskRelations(businessRef, taskId, response, context);
    if (taskId && !action && method === "GET") return await getTask(businessRef, taskId, response, context);
    if (taskId && !action && method === "PATCH") return await updateTask(businessRef, taskId, request, response, context);
    if (taskId && !action && method === "DELETE") return await archiveTask(businessRef, taskId, response, context);
    throw httpError(405, "Method not allowed");
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: (error.statusCode || 500) >= 500 ? "Internal task API error" : error.message,
      code: error.code || "task_error"
    }, context);
  }
}

async function listTasks(businessRef, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const view = requiredEnum(requestUrl.searchParams.get("view") || "all", VIEWS, "view");
  const ownerId = optionalId(requestUrl.searchParams.get("ownerId"), "ownerId");
  if (ownerId) requireTeamMember(db, business.id, ownerId);
  const includeArchived = requestUrl.searchParams.get("includeArchived") === "true";
  const rawEntityType = clean(requestUrl.searchParams.get("entityType"));
  const entityType = rawEntityType ? normalizeEntityType(rawEntityType) : "";
  const entityId = optionalId(requestUrl.searchParams.get("entityId"), "entityId");
  if (Boolean(entityType) !== Boolean(entityId)) throw httpError(400, "entityType and entityId must be provided together");
  let tasks = db.tasks.filter((task) => task.businessId === business.id && (includeArchived || !task.archivedAt));
  if (entityType) {
    const ids = new Set(listEntityAssociations(db, business.id, entityType, entityId).map((association) => {
      const counterpart = associationCounterpart(association, entityType, entityId);
      return counterpart.type === "task" ? counterpart.id : "";
    }).filter(Boolean));
    tasks = tasks.filter((task) => ids.has(task.id));
  }
  const search = clean(requestUrl.searchParams.get("search")).toLowerCase();
  if (search) tasks = tasks.filter((task) => [task.title, task.description, task.result, ...(task.tags || [])].join(" ").toLowerCase().includes(search));
  tasks = applyView(tasks, view, ownerId).sort(compareTasks);
  sendJson(response, 200, { view, tasks: tasks.map((task) => copyTask(db, business.id, task)), total: tasks.length }, context);
}

async function getTaskQueues(businessRef, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const ownerId = optionalId(requestUrl.searchParams.get("ownerId"), "ownerId");
  if (ownerId) requireTeamMember(db, business.id, ownerId);
  const active = db.tasks.filter((task) => task.businessId === business.id && !task.archivedAt && ["pending", "in_progress"].includes(task.status));
  const decorate = (tasks) => tasks.sort(compareTasks).map((task) => copyTask(db, business.id, task));
  const today = decorate(applyView([...active], "today", ownerId));
  const overdue = decorate(applyView([...active], "overdue", ownerId));
  const unassigned = decorate(applyView([...active], "unassigned", ownerId));
  const mine = decorate(applyView([...active], "mine", ownerId));
  const team = decorate([...active]);
  const members = db.teamMembers
    .filter((member) => member.businessId === business.id && member.active !== false)
    .sort((left, right) => clean(left.name).localeCompare(clean(right.name), "es", { sensitivity: "base" }))
    .map(copyMember);
  const unownedDeals = db.deals
    .filter((deal) => deal.businessId === business.id && !deal.archivedAt && deal.status === "open" && !deal.ownerId)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))
    .map((deal) => ({ id: deal.id, title: deal.title || "Oportunidad", value: Number(deal.value || 0), priority: deal.priority || "media", contactId: deal.contactId || "", accountId: deal.accountId || "" }));
  sendJson(response, 200, {
    ownerId,
    members,
    queues: { today, overdue, unassigned, mine, team },
    unownedDeals,
    counts: { today: today.length, overdue: overdue.length, unassigned: unassigned.length, mine: mine.length, team: team.length, unownedDeals: unownedDeals.length }
  }, context);
}

async function createTask(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source);
  const now = new Date().toISOString();
  const id = `task_${randomUUID()}`;
  const task = normalizeTask(db, business.id, source, null, id, now);
  db.tasks.push(task);
  const links = normalizeLinks(db, business.id, source, task.id);
  replaceTaskLinks(db, business.id, task.id, links, now);
  syncDealOwners(db, business.id, task, now);
  appendContactActivities(db, business.id, task, "task.created", "Tarea creada", now);
  appendAudit(db, "task.created", business.id, now, { taskId: task.id, ownerId: task.ownerId });
  await saveDb(db, context, "task-create");
  sendJson(response, 201, { task: copyTask(db, business.id, task) }, context);
}

async function getTask(businessRef, taskId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const task = requireTask(db, business.id, taskId);
  sendJson(response, 200, { task: copyTask(db, business.id, task) }, context);
}

async function getTaskRelations(businessRef, taskId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const task = requireTask(db, business.id, taskId);
  const relations = taskRelations(db, business.id, task.id);
  sendJson(response, 200, { taskId: task.id, relations, total: relations.length }, context);
}

async function updateTask(businessRef, taskId, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const task = requireTask(db, business.id, taskId);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source);
  if (!Object.keys(source).length) throw httpError(400, "Task update needs at least one field");
  const now = new Date().toISOString();
  const previousStatus = task.status;
  Object.assign(task, normalizeTask(db, business.id, source, task, task.id, now));
  if (Object.prototype.hasOwnProperty.call(source, "links") || Object.prototype.hasOwnProperty.call(source, "entityType") || Object.prototype.hasOwnProperty.call(source, "entityId")) {
    replaceTaskLinks(db, business.id, task.id, normalizeLinks(db, business.id, source, task.id), now);
  }
  let recurringTask = null;
  if (task.status === "completed" && previousStatus !== "completed") {
    appendContactActivities(db, business.id, task, "task.completed", "Tarea completada", now);
    recurringTask = createRecurringTask(db, task, now);
  }
  syncDealOwners(db, business.id, task, now);
  appendAudit(db, "task.updated", business.id, now, { taskId: task.id, previousStatus, status: task.status, recurringTaskId: recurringTask?.id || "" });
  await saveDb(db, context, "task-update");
  sendJson(response, 200, { task: copyTask(db, business.id, task), recurringTask: recurringTask ? copyTask(db, business.id, recurringTask) : null }, context);
}

async function archiveTask(businessRef, taskId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const task = requireTask(db, business.id, taskId);
  const now = new Date().toISOString();
  task.archivedAt = now;
  task.updatedAt = now;
  archiveEntityAssociations(db, business.id, "task", task.id, now);
  db.tasks.forEach((item) => {
    if (item.businessId === business.id && Array.isArray(item.dependencyIds) && item.dependencyIds.includes(task.id)) {
      item.dependencyIds = item.dependencyIds.filter((id) => id !== task.id);
      item.updatedAt = now;
    }
  });
  appendAudit(db, "task.archived", business.id, now, { taskId: task.id });
  await saveDb(db, context, "task-archive");
  sendJson(response, 200, { archived: true, task: copyTask(db, business.id, task) }, context);
}

function normalizeTask(db, businessId, source, existing, id, now) {
  const base = existing || {};
  const status = fieldEnum(source, base, "status", STATUSES, "pending");
  const ownerId = fieldId(source, base, "ownerId");
  if (ownerId) requireTeamMember(db, businessId, ownerId);
  const participantIds = Object.prototype.hasOwnProperty.call(source, "participantIds")
    ? normalizeIdArray(source.participantIds, "participantIds", 40)
    : [...(base.participantIds || [])];
  participantIds.forEach((participantId) => requireTeamMember(db, businessId, participantId));
  const dependencyIds = Object.prototype.hasOwnProperty.call(source, "dependencyIds")
    ? normalizeIdArray(source.dependencyIds, "dependencyIds", 40)
    : [...(base.dependencyIds || [])];
  dependencyIds.forEach((dependencyId) => {
    if (dependencyId === id) throw httpError(400, "A task cannot depend on itself");
    const dependency = requireTask(db, businessId, dependencyId);
    if (dependency.dependencyIds?.includes(id)) throw httpError(400, "Direct circular task dependencies are not allowed");
  });
  const dueAt = fieldIso(source, base, "dueAt");
  const reminderAt = fieldIso(source, base, "reminderAt");
  if (dueAt && reminderAt && Date.parse(reminderAt) > Date.parse(dueAt)) throw httpError(400, "reminderAt cannot be after dueAt");
  return {
    ...base,
    id,
    businessId,
    title: fieldRequiredText(source, base, "title", 240),
    description: fieldText(source, base, "description", 10000),
    type: fieldEnum(source, base, "type", TYPES, "follow_up"),
    status,
    priority: fieldEnum(source, base, "priority", PRIORITIES, "normal"),
    ownerId,
    participantIds,
    dueAt,
    reminderAt,
    recurrence: fieldEnum(source, base, "recurrence", RECURRENCES, "none"),
    result: fieldText(source, base, "result", 10000),
    dependencyIds,
    tags: Object.prototype.hasOwnProperty.call(source, "tags") ? normalizeTags(source.tags) : [...(base.tags || [])],
    source: fieldText(source, base, "source", 120) || base.source || "dashboard",
    createdAt: base.createdAt || now,
    updatedAt: now,
    completedAt: status === "completed" ? (base.completedAt || now) : "",
    cancelledAt: status === "cancelled" ? (base.cancelledAt || now) : "",
    archivedAt: base.archivedAt || "",
    recurrenceParentId: base.recurrenceParentId || ""
  };
}

function normalizeLinks(db, businessId, source, taskId) {
  let raw = source.links;
  if (raw === undefined && (source.entityType || source.entityId)) raw = [{ type: source.entityType, id: source.entityId, kind: "related", isPrimary: true }];
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 20) throw httpError(400, "links must be an array with at most 20 records");
  const seen = new Set();
  return raw.map((link) => {
    if (!link || typeof link !== "object" || Array.isArray(link)) throw httpError(400, "Each task link must be an object");
    const type = normalizeEntityType(link.type || link.entityType);
    const id = requiredId(link.id || link.entityId, "link.id");
    if (type === "task" && id === taskId) throw httpError(400, "A task cannot link to itself");
    if (!findBusinessEntity(db, businessId, type, id)) throw httpError(404, `Linked ${type} not found`);
    const kind = requiredEnum(link.kind || "related", KINDS, "link.kind");
    const key = `${type}:${id}:${kind}`;
    if (seen.has(key)) throw httpError(400, "Task links cannot be duplicated");
    seen.add(key);
    return { type, id, kind, isPrimary: link.isPrimary === true };
  });
}

function replaceTaskLinks(db, businessId, taskId, links, now) {
  db.associations.forEach((association) => {
    if (association.businessId === businessId && association.fromType === "task" && association.fromId === taskId && !association.archivedAt) {
      association.archivedAt = now;
      association.updatedAt = now;
    }
  });
  links.forEach((link) => upsertAssociation(db, {
    businessId,
    fromType: "task",
    fromId: taskId,
    toType: link.type,
    toId: link.id,
    kind: link.kind,
    isPrimary: link.isPrimary,
    now
  }));
}

function taskRelations(db, businessId, taskId) {
  return listEntityAssociations(db, businessId, "task", taskId).map((association) => {
    const counterpart = associationCounterpart(association, "task", taskId);
    return {
      id: association.id,
      kind: association.kind,
      isPrimary: association.isPrimary === true,
      direction: counterpart.direction,
      related: summarizeAssociatedEntity(counterpart.type, findBusinessEntity(db, businessId, counterpart.type, counterpart.id, { includeArchived: true }))
    };
  });
}

function copyTask(db, businessId, task) {
  const owner = task.ownerId ? db.teamMembers.find((member) => member.businessId === businessId && member.id === task.ownerId) : null;
  const participants = (task.participantIds || []).map((id) => db.teamMembers.find((member) => member.businessId === businessId && member.id === id)).filter(Boolean).map(copyMember);
  const dependencies = (task.dependencyIds || []).map((id) => db.tasks.find((item) => item.businessId === businessId && item.id === id)).filter(Boolean).map((item) => ({ id: item.id, title: item.title, status: item.status }));
  const dueTime = Date.parse(task.dueAt || "");
  return {
    ...task,
    participantIds: [...(task.participantIds || [])],
    dependencyIds: [...(task.dependencyIds || [])],
    tags: [...(task.tags || [])],
    owner: owner ? copyMember(owner) : null,
    participants,
    dependencies,
    relations: taskRelations(db, businessId, task.id),
    isOverdue: ["pending", "in_progress"].includes(task.status) && Number.isFinite(dueTime) && dueTime < startOfToday().getTime()
  };
}

function applyView(tasks, view, ownerId) {
  const active = (task) => ["pending", "in_progress"].includes(task.status) && !task.archivedAt;
  if (view === "team") return tasks.filter(active);
  if (view === "mine") return tasks.filter((task) => active(task) && Boolean(ownerId) && task.ownerId === ownerId);
  if (view === "unassigned") return tasks.filter((task) => active(task) && !task.ownerId);
  if (view === "today") return tasks.filter((task) => active(task) && isToday(task.dueAt));
  if (view === "overdue") return tasks.filter((task) => active(task) && isOverdue(task.dueAt));
  if (view === "completed") return tasks.filter((task) => task.status === "completed" && !task.archivedAt);
  return tasks;
}

function syncDealOwners(db, businessId, task, now) {
  if (!task.ownerId) return;
  taskRelations(db, businessId, task.id)
    .filter((relation) => relation.related?.type === "deal")
    .forEach((relation) => {
      const deal = db.deals.find((item) => item.businessId === businessId && item.id === relation.related.id && !item.archivedAt);
      if (deal && !deal.ownerId) {
        deal.ownerId = task.ownerId;
        deal.updatedAt = now;
        appendAudit(db, "deal.owner_assigned_from_task", businessId, now, { dealId: deal.id, taskId: task.id, ownerId: task.ownerId });
      }
    });
}

function appendContactActivities(db, businessId, task, type, title, now) {
  taskRelations(db, businessId, task.id)
    .filter((relation) => relation.related?.type === "contact")
    .forEach((relation) => db.activities.push({
      id: `activity_${randomUUID()}`,
      businessId,
      contactId: relation.related.id,
      type,
      title,
      note: task.title,
      source: "tasks",
      metadata: { taskId: task.id, status: task.status, ownerId: task.ownerId },
      createdAt: now
    }));
}

function compareTasks(left, right) {
  const priority = { urgent: 0, high: 1, normal: 2, low: 3 };
  const dueDiff = safeTime(left.dueAt, Number.MAX_SAFE_INTEGER) - safeTime(right.dueAt, Number.MAX_SAFE_INTEGER);
  if (dueDiff) return dueDiff;
  const priorityDiff = (priority[left.priority] ?? 9) - (priority[right.priority] ?? 9);
  return priorityDiff || clean(left.title).localeCompare(clean(right.title), "es", { sensitivity: "base" });
}

function requireBusiness(db, ref) {
  const business = db.businesses.find((item) => item.id === ref || item.slug === ref);
  if (!business) throw httpError(404, "Business not found");
  return business;
}

function requireTask(db, businessId, id) {
  const taskId = requiredId(id, "taskId");
  const task = db.tasks.find((item) => item.businessId === businessId && item.id === taskId && !item.archivedAt);
  if (!task) throw httpError(404, "Task not found");
  return task;
}

function requireTeamMember(db, businessId, id) {
  const member = db.teamMembers.find((item) => item.businessId === businessId && item.id === id && item.active !== false);
  if (!member) throw httpError(404, "Task owner or participant not found");
  return member;
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);
  Object.keys(DEFAULT_DB).forEach((key) => { if (Array.isArray(DEFAULT_DB[key])) db[key] = Array.isArray(db[key]) ? db[key] : []; });
  return db;
}

async function saveDb(db, context, label) {
  await saveBusinessStore(db, context, label);
}

function fieldRequiredText(source, base, field, max) {
  const value = Object.prototype.hasOwnProperty.call(source, field) ? source[field] : base[field];
  const result = optionalText(value, field, max);
  if (!result) throw httpError(400, `${field} is required`);
  return result;
}
function fieldText(source, base, field, max) { return Object.prototype.hasOwnProperty.call(source, field) ? optionalText(source[field], field, max) : clean(base[field]); }
function fieldEnum(source, base, field, allowed, fallback) { return Object.prototype.hasOwnProperty.call(source, field) ? requiredEnum(source[field], allowed, field) : (base[field] || fallback); }
function fieldId(source, base, field) { return Object.prototype.hasOwnProperty.call(source, field) ? optionalId(source[field], field) : clean(base[field]); }
function fieldIso(source, base, field) { return Object.prototype.hasOwnProperty.call(source, field) ? optionalIso(source[field], field) : clean(base[field]); }
function normalizeEntityType(value) {
  const type = normalizeAssociationEntityType(value);
  if (!type) throw httpError(400, "entityType has an invalid value");
  return type;
}
function normalizeIdArray(value, field, max) {
  if (!Array.isArray(value) || value.length > max) throw httpError(400, `${field} must be an array with at most ${max} ids`);
  return [...new Set(value.map((id) => requiredId(id, field)))];
}
function normalizeTags(value) {
  if (!Array.isArray(value) || value.length > 30) throw httpError(400, "tags must be an array with at most 30 values");
  return [...new Set(value.map((tag) => optionalText(tag, "tag", 80)).filter(Boolean))];
}
function assertAllowedFields(source) {
  const unknown = Object.keys(source).filter((field) => !TASK_FIELDS.has(field));
  if (unknown.length) throw httpError(400, `Unknown task field(s): ${unknown.join(", ")}`);
}
function requiredEnum(value, allowed, field) {
  const normalized = clean(value);
  if (!allowed.has(normalized)) throw httpError(400, `${field} has an invalid value`);
  return normalized;
}
function optionalText(value, field, max) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw httpError(400, `${field} must be text`);
  const result = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (result.length > max) throw httpError(400, `${field} cannot exceed ${max} characters`);
  return result;
}
function requiredId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) throw httpError(400, `${field} has an invalid format`);
  return value;
}
function optionalId(value, field) { return value === undefined || value === null || value === "" ? "" : requiredId(value, field); }
function optionalIso(value, field) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw httpError(400, `${field} must be an ISO date`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${field} must be an ISO date`);
  return date.toISOString();
}
function requireObject(value) { if (!value || typeof value !== "object" || Array.isArray(value)) throw httpError(400, "JSON body must be an object"); return value; }
function copyMember(member) { return { id: member.id, name: member.name || "", role: member.role || "employee", active: member.active !== false }; }
function isToday(value) { const time = Date.parse(value || ""); return Number.isFinite(time) && time >= startOfToday().getTime() && time < startOfTomorrow().getTime(); }
function isOverdue(value) { const time = Date.parse(value || ""); return Number.isFinite(time) && time < startOfToday().getTime(); }
function startOfToday() { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }
function startOfTomorrow() { const date = startOfToday(); date.setDate(date.getDate() + 1); return date; }
function safeTime(value, fallback) { const time = Date.parse(value || ""); return Number.isFinite(time) ? time : fallback; }
function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function appendAudit(db, type, businessId, now, extra = {}) { db.auditLog.push({ id: `audit_${randomUUID()}`, type, businessId, ...extra, createdAt: now }); }
function httpError(statusCode, message, code = "task_error") { return Object.assign(new Error(message), { statusCode, code }); }

async function readJsonBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, "Task payload too large");
    raw += chunk.toString("utf8");
  }
  if (!raw.trim()) throw httpError(400, "JSON body is required");
  try { return JSON.parse(raw); } catch { throw httpError(400, "Invalid JSON body"); }
}
function sendJson(response, statusCode, payload, context, extraHeaders = {}) { response.writeHead(statusCode, { ...corsHeaders(context.requestOrigin, context), "Content-Type": "application/json; charset=utf-8", ...extraHeaders }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, statusCode, context) { response.writeHead(statusCode, corsHeaders(context.requestOrigin, context)); response.end(); }
