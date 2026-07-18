import assert from "node:assert/strict";
import {
  applySequenceSignal,
  createAutomation,
  enrollSequence,
  executeAutomationRun,
  getAutomation,
  linkEnrollmentRun,
  listAutomationRuns,
  listAutomations,
  listSequenceEnrollments,
  matchingPublishedAutomations,
  publishAutomation,
  retryAutomationRun,
  seedAutomationRecipes,
  startAutomationRun,
  updateAutomationDraft,
  updateSequenceEnrollment
} from "../lib/automation-engine.mjs";
import { parseAutomationWorkerArgs, runAutomationWorker } from "./run-automation-worker.mjs";

const businessId = "biz_automation";
const now = "2026-07-17T09:00:00.000Z";
const db = {
  businesses: [{ id: businessId, name: "Automation Lab" }],
  contacts: [{ id: "contact_auto", businessId, name: "Ada Cliente", status: "new", tags: [], createdAt: now, updatedAt: now }],
  tasks: [], activities: [], communicationThreads: [], communicationMessages: [], auditLog: []
};

const recipes = seedAutomationRecipes(db, businessId, now);
assert.equal(recipes.length, 4);
assert.equal(seedAutomationRecipes(db, businessId, now).length, 0, "Recipe seeding must be idempotent");

const automation = createAutomation(db, businessId, {
  name: "Lead configurable",
  kind: "automation",
  trigger: { type: "record.created", entity: "contact" },
  limits: { maxActionsPerRun: 4, maxAttempts: 2 },
  nodes: [
    { id: "trigger", type: "trigger", label: "Contacto creado", config: { type: "record.created", entity: "contact" } },
    { id: "condition", type: "condition", label: "Nuevo", config: { field: "contact.status", operator: "equals", value: "new", onFalse: "exit" } },
    { id: "task", type: "action", label: "Tarea", config: { action: "create_task", title: "Responder" } },
    { id: "exit", type: "exit", label: "Fin", config: { outcome: "done" } }
  ]
}, now);
assert.equal(automation.status, "draft");
assert.equal(automation.draftVersion, 1);

const edited = updateAutomationDraft(db, businessId, automation.id, { description: "Version editable", limits: { maxActionsPerRun: 5, maxAttempts: 3 } }, now);
assert.equal(edited.description, "Version editable");
assert.equal(edited.draftDefinition.limits.maxActionsPerRun, 5);

const published = publishAutomation(db, businessId, automation.id, now);
assert.equal(published.status, "published");
assert.equal(published.publishedVersion, 1);
assert.equal(published.draftVersion, 2, "Publishing must open the next editable draft");
assert.equal(matchingPublishedAutomations(db, businessId, { type: "record.created", entity: "contact", entityId: "contact_auto" }).some((item) => item.id === automation.id), true);

const first = startAutomationRun(db, businessId, automation.id, {
  event: { id: "event_contact_auto", type: "record.created", entity: "contact", entityId: "contact_auto", contactId: "contact_auto" },
  context: { contact: db.contacts[0] },
  idempotencyKey: "lead-configurable-1"
}, now);
assert.equal(first.duplicate, false);
const actions = [];
const completed = await executeAutomationRun(db, businessId, first.run.id, {
  now,
  actionExecutor: async ({ node }) => { actions.push(node.config.action); return { taskId: "task_test" }; }
});
assert.equal(completed.status, "completed");
assert.deepEqual(actions, ["create_task"]);
assert.equal(completed.actionsExecuted, 1);
assert.equal(startAutomationRun(db, businessId, automation.id, { event: first.run.event, context: first.run.context, idempotencyKey: "lead-configurable-1" }, now).duplicate, true);

const falseRun = startAutomationRun(db, businessId, automation.id, {
  event: { id: "event_false", type: "record.created", entity: "contact", contactId: "contact_auto" },
  context: { contact: { ...db.contacts[0], status: "customer" } }
}, now);
await executeAutomationRun(db, businessId, falseRun.run.id, { now, actionExecutor: async () => { throw new Error("must not execute"); } });
assert.equal(falseRun.run.status, "completed");
assert.equal(falseRun.run.actionsExecuted, 0);

const waitingSequence = createAutomation(db, businessId, {
  name: "Secuencia de prueba",
  kind: "sequence",
  trigger: { type: "sequence.enrolled" },
  stopConditions: ["reply", "booking", "unsubscribe"],
  quietHours: { enabled: false },
  nodes: [
    { id: "start", type: "trigger", label: "Alta", config: { type: "sequence.enrolled" } },
    { id: "wait", type: "wait", label: "Esperar", config: { minutes: 60 } },
    { id: "tag", type: "action", label: "Etiquetar", config: { action: "add_tag", tag: "secuencia-completa" } },
    { id: "end", type: "exit", label: "Fin", config: {} }
  ]
}, now);
publishAutomation(db, businessId, waitingSequence.id, now);
const enrollmentResult = enrollSequence(db, businessId, waitingSequence.id, { contactId: "contact_auto", source: "test" }, now);
assert.equal(enrollmentResult.duplicate, false);
assert.equal(enrollSequence(db, businessId, waitingSequence.id, { contactId: "contact_auto" }, now).duplicate, true);
const sequenceRun = startAutomationRun(db, businessId, waitingSequence.id, {
  event: { id: "sequence-event", type: "sequence.enrolled", contactId: "contact_auto" },
  context: { contact: db.contacts[0] },
  idempotencyKey: "sequence-run-1"
}, now);
linkEnrollmentRun(db, businessId, enrollmentResult.enrollment.id, sequenceRun.run.id, now);
await executeAutomationRun(db, businessId, sequenceRun.run.id, { now, actionExecutor: async () => ({}) });
assert.equal(sequenceRun.run.status, "waiting");
assert.equal(sequenceRun.run.resumeAt, "2026-07-17T10:00:00.000Z");
const resumedActions = [];
await executeAutomationRun(db, businessId, sequenceRun.run.id, { now: "2026-07-17T10:01:00.000Z", actionExecutor: async ({ node }) => { resumedActions.push(node.config.action); return { tag: "secuencia-completa" }; } });
assert.equal(sequenceRun.run.status, "completed");
assert.deepEqual(resumedActions, ["add_tag"]);
assert.equal(listSequenceEnrollments(db, businessId)[0].status, "completed");

const stopEnrollment = enrollSequence(db, businessId, waitingSequence.id, { contactId: "contact_auto", source: "second" }, "2026-07-18T09:00:00.000Z");
assert.equal(updateSequenceEnrollment(db, businessId, stopEnrollment.enrollment.id, { action: "pause" }, now).status, "paused");
assert.equal(updateSequenceEnrollment(db, businessId, stopEnrollment.enrollment.id, { action: "resume" }, now).status, "active");
assert.equal(applySequenceSignal(db, businessId, "contact_auto", "reply", now).some((item) => item.id === stopEnrollment.enrollment.id), true);
assert.equal(stopEnrollment.enrollment.status, "stopped");

const failing = createAutomation(db, businessId, {
  name: "Fallo recuperable", kind: "automation", trigger: { type: "manual" }, limits: { maxAttempts: 2 },
  nodes: [{ type: "trigger", label: "Inicio", config: { type: "manual" } }, { type: "action", label: "Accion", config: { action: "create_task" } }]
}, now);
publishAutomation(db, businessId, failing.id, now);
const failedRun = startAutomationRun(db, businessId, failing.id, { event: { id: "fail-event", type: "manual", contactId: "contact_auto" }, context: { contact: db.contacts[0] } }, now);
await executeAutomationRun(db, businessId, failedRun.run.id, { now, actionExecutor: async () => { throw new Error("Provider temporal"); } });
assert.equal(failedRun.run.status, "failed");
retryAutomationRun(db, businessId, failedRun.run.id, "2026-07-17T09:01:00.000Z");
await executeAutomationRun(db, businessId, failedRun.run.id, { now: "2026-07-17T09:01:00.000Z", actionExecutor: async () => ({ recovered: true }) });
assert.equal(failedRun.run.status, "completed");

const testRun = startAutomationRun(db, businessId, automation.id, { testMode: true, event: { id: "test-run", type: "manual", contactId: "contact_auto" }, context: { contact: db.contacts[0] } }, now);
await executeAutomationRun(db, businessId, testRun.run.id, { now, actionExecutor: async () => { throw new Error("Test mode must simulate"); } });
assert.equal(testRun.run.status, "test_completed");
assert.ok(listAutomationRuns(db, businessId, automation.id).find((item) => item.id === testRun.run.id).logs.some((log) => log.status === "simulated"));
assert.ok(listAutomations(db, businessId).length >= 7);
assert.equal(getAutomation(db, businessId, automation.id).metrics.runs >= 3, true);
assert.ok(db.auditLog.some((entry) => entry.type === "automation.published"));

const workerFlow = createAutomation(db, businessId, {
  name: "Worker de esperas", kind: "sequence", trigger: { type: "sequence.enrolled" }, quietHours: { enabled: false },
  nodes: [{ type: "trigger", label: "Inicio", config: { type: "sequence.enrolled" } }, { type: "wait", label: "Un minuto", config: { minutes: 1 } }, { type: "action", label: "Tarea", config: { action: "create_task" } }, { type: "exit", label: "Fin", config: {} }]
}, now);
publishAutomation(db, businessId, workerFlow.id, now);
const workerRun = startAutomationRun(db, businessId, workerFlow.id, { event: { id: "worker-event", type: "sequence.enrolled", contactId: "contact_auto" }, context: { contact: db.contacts[0] } }, now);
await executeAutomationRun(db, businessId, workerRun.run.id, { now, actionExecutor: async () => ({}) });
assert.equal(workerRun.run.status, "waiting");
let workerSaves = 0;
const workerSummary = await runAutomationWorker({
  now: "2026-07-17T09:02:00.000Z", limit: 10,
  context: { root: process.cwd() },
  loadBusinessStore: async () => db,
  saveBusinessStore: async () => { workerSaves += 1; },
  actionExecutor: async () => ({ taskId: "worker-task" })
});
assert.equal(workerSummary.processed, 1);
assert.equal(workerSaves, 1);
assert.equal(workerRun.run.status, "completed");
assert.deepEqual(parseAutomationWorkerArgs(["--now=2026-07-17T09:02:00.000Z", "--limit", "5", "--business", businessId]), { now: "2026-07-17T09:02:00.000Z", limit: 5, businessId });

console.log("Automation engine checks passed: recipes, drafts, versions, publish, triggers, branches, waits, worker, actions, test mode, idempotency, retries, logs, bulk preview and sequence stops.");
