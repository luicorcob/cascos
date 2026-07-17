import { createHash, randomUUID } from "node:crypto";
import { upsertAssociation } from "./association-model.mjs";

export const TASK_TYPES = Object.freeze([
  "call",
  "whatsapp",
  "email",
  "meeting",
  "proposal",
  "booking",
  "follow_up",
  "admin",
  "other"
]);
export const TASK_STATUSES = Object.freeze(["pending", "in_progress", "completed", "cancelled"]);
export const TASK_PRIORITIES = Object.freeze(["low", "normal", "high", "urgent"]);
export const TASK_RECURRENCES = Object.freeze(["none", "daily", "weekly", "monthly", "yearly"]);

const LEGACY_TYPE_MAP = Object.freeze({
  llamada: "call",
  whatsapp: "whatsapp",
  email: "email",
  reunion: "meeting",
  enviar_propuesta: "proposal",
  revisar_reserva: "booking"
});
const LEGACY_PRIORITY_MAP = Object.freeze({ alta: "high", media: "normal", baja: "low" });

export function migrateNextActionsToTasks(db, options = {}) {
  const now = options.now || new Date().toISOString();
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.tasks = Array.isArray(db.tasks) ? db.tasks : [];
  db.associations = Array.isArray(db.associations) ? db.associations : [];
  const summary = {
    contactsScanned: 0,
    actionsFound: 0,
    tasksCreated: 0,
    tasksSkipped: 0,
    associationsCreated: 0,
    contactProjectionsUpdated: 0,
    createdTaskIds: []
  };

  for (const contact of db.contacts) {
    if (!contact?.businessId || contact.merged) continue;
    summary.contactsScanned += 1;
    const action = normalizeLegacyNextAction(contact.nextAction, now);
    if (!action) continue;
    summary.actionsFound += 1;
    const result = syncLegacyNextActionTask(db, contact, action, { now });
    if (result.created) {
      summary.tasksCreated += 1;
      summary.createdTaskIds.push(result.task.id);
    } else {
      summary.tasksSkipped += 1;
    }
    if (result.associationCreated) summary.associationsCreated += 1;
    if (contact.nextAction?.taskId !== result.task.id) {
      contact.nextAction = { ...contact.nextAction, taskId: result.task.id };
      summary.contactProjectionsUpdated += 1;
    }
  }
  return summary;
}

export function syncLegacyNextActionTask(db, contact, input, options = {}) {
  const now = options.now || new Date().toISOString();
  const action = normalizeLegacyNextAction(input, now);
  if (!action || !contact?.businessId || !contact?.id) return { task: null, created: false, associationCreated: false };
  db.tasks = Array.isArray(db.tasks) ? db.tasks : [];
  db.associations = Array.isArray(db.associations) ? db.associations : [];
  const id = action.taskId || legacyTaskId(contact.id, action);
  let task = db.tasks.find((item) => item.businessId === contact.businessId && item.id === id);
  const created = !task;
  const base = {
    businessId: contact.businessId,
    title: action.note || `${legacyTaskTypeLabel(action.type)} · ${clean(contact.name) || "Contacto"}`,
    description: action.note || "",
    type: LEGACY_TYPE_MAP[action.type] || "follow_up",
    status: "pending",
    priority: LEGACY_PRIORITY_MAP[contact.priority] || "normal",
    ownerId: "",
    participantIds: [],
    dueAt: action.dueDate,
    reminderAt: "",
    recurrence: "none",
    result: "",
    dependencyIds: [],
    tags: ["legacy-next-action"],
    source: "legacy-next-action",
    legacyNextAction: true,
    legacyContactId: contact.id,
    createdAt: action.createdAt || contact.createdAt || now,
    updatedAt: now,
    completedAt: "",
    cancelledAt: "",
    archivedAt: "",
    recurrenceParentId: ""
  };
  if (created) {
    task = { id, ...base };
    db.tasks.push(task);
  } else if (!task.archivedAt && !["completed", "cancelled"].includes(task.status)) {
    Object.assign(task, base, { createdAt: task.createdAt || base.createdAt });
  }
  const associationResult = upsertAssociation(db, {
    businessId: contact.businessId,
    fromType: "task",
    fromId: task.id,
    toType: "contact",
    toId: contact.id,
    kind: "related",
    isPrimary: true,
    now
  });
  return { task, created, associationCreated: associationResult.created };
}

export function completeLegacyNextActionTask(db, contact, input, options = {}) {
  const now = options.now || new Date().toISOString();
  const taskId = clean(input?.taskId || contact?.nextAction?.taskId);
  let task = taskId
    ? (Array.isArray(db.tasks) ? db.tasks : []).find((item) => item.businessId === contact.businessId && item.id === taskId)
    : null;
  if (!task) {
    task = (Array.isArray(db.tasks) ? db.tasks : [])
      .filter((item) => item.businessId === contact.businessId && item.legacyContactId === contact.id)
      .filter((item) => !item.archivedAt && !["completed", "cancelled"].includes(item.status))
      .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
  }
  if (!task) return null;
  task.status = "completed";
  task.result = clean(options.result || input?.note || task.result);
  task.completedAt = now;
  task.updatedAt = now;
  return task;
}

export function legacyTaskId(contactId, action = {}) {
  const fingerprint = [contactId, action.createdAt, action.dueDate, action.type, action.note].map(clean).join("|");
  const digest = createHash("sha256").update(fingerprint).digest("hex").slice(0, 18);
  return `task_legacy_${safeId(contactId).slice(0, 90)}_${digest}`;
}

export function createRecurringTask(db, task, now = new Date().toISOString()) {
  if (!task || !TASK_RECURRENCES.includes(task.recurrence) || task.recurrence === "none") return null;
  db.tasks = Array.isArray(db.tasks) ? db.tasks : [];
  db.associations = Array.isArray(db.associations) ? db.associations : [];
  const existing = db.tasks.find((item) => item.businessId === task.businessId && item.recurrenceParentId === task.id && !item.archivedAt);
  if (existing) return existing;
  const dueAt = advanceIso(task.dueAt || now, task.recurrence);
  const reminderAt = shiftReminder(task.reminderAt, task.dueAt, dueAt);
  const child = {
    ...task,
    id: `task_${randomUUID()}`,
    status: "pending",
    dueAt,
    reminderAt,
    result: "",
    dependencyIds: [],
    recurrenceParentId: task.id,
    source: "recurrence",
    createdAt: now,
    updatedAt: now,
    completedAt: "",
    cancelledAt: "",
    archivedAt: ""
  };
  db.tasks.push(child);
  const relations = db.associations.filter((association) => association.businessId === task.businessId && !association.archivedAt && (
    (association.fromType === "task" && association.fromId === task.id)
    || (association.toType === "task" && association.toId === task.id)
  ));
  for (const relation of relations) {
    upsertAssociation(db, {
      businessId: task.businessId,
      fromType: relation.fromType,
      fromId: relation.fromType === "task" ? child.id : relation.fromId,
      toType: relation.toType,
      toId: relation.toType === "task" ? child.id : relation.toId,
      kind: relation.kind,
      isPrimary: relation.isPrimary,
      now
    });
  }
  return child;
}

function normalizeLegacyNextAction(value, now) {
  if (!value || typeof value !== "object") return null;
  const status = clean(value.status).toLowerCase();
  if (["hecha", "done", "completed", "cancelled", "canceled"].includes(status)) return null;
  const due = new Date(value.dueDate || value.dueAt || value.date || "");
  if (Number.isNaN(due.getTime())) return null;
  const type = clean(value.type).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(LEGACY_TYPE_MAP, type)) return null;
  return {
    type,
    dueDate: due.toISOString(),
    note: clean(value.note || value.notes),
    createdAt: validIso(value.createdAt) || now,
    taskId: clean(value.taskId)
  };
}

function advanceIso(value, recurrence) {
  const date = new Date(value);
  if (recurrence === "daily") date.setUTCDate(date.getUTCDate() + 1);
  if (recurrence === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (recurrence === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  if (recurrence === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString();
}

function shiftReminder(reminderAt, previousDueAt, nextDueAt) {
  const reminder = Date.parse(reminderAt || "");
  const previousDue = Date.parse(previousDueAt || "");
  const nextDue = Date.parse(nextDueAt || "");
  if (![reminder, previousDue, nextDue].every(Number.isFinite)) return "";
  return new Date(nextDue - (previousDue - reminder)).toISOString();
}

function legacyTaskTypeLabel(type) {
  return ({ llamada: "Llamada", whatsapp: "WhatsApp", email: "Email", reunion: "Reunion", enviar_propuesta: "Enviar propuesta", revisar_reserva: "Revisar reserva" })[type] || "Seguimiento";
}

function validIso(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function safeId(value) {
  return clean(value).replace(/[^A-Za-z0-9_-]/g, "_") || "contact";
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
