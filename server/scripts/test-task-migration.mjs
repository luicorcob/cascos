import assert from "node:assert/strict";
import { migrateNextActionsToTasks } from "../lib/task-model.mjs";

const now = "2026-07-17T10:00:00.000Z";
const db = {
  contacts: [
    {
      id: "contact_one",
      businessId: "biz_one",
      name: "Ana",
      priority: "alta",
      nextAction: { type: "llamada", dueDate: "2026-07-18T09:00:00.000Z", note: "Confirmar decision", createdAt: "2026-07-16T09:00:00.000Z" }
    },
    {
      id: "contact_two",
      businessId: "biz_two",
      name: "Beto",
      nextAction: { type: "email", dueDate: "2026-07-19T09:00:00.000Z", status: "hecha" }
    },
    { id: "contact_merged", businessId: "biz_one", merged: true, nextAction: { type: "email", dueDate: "2026-07-20T09:00:00.000Z" } }
  ],
  tasks: [],
  associations: [],
  activities: [{ id: "activity_original", businessId: "biz_one", contactId: "contact_one", type: "next_action.created" }]
};

const first = migrateNextActionsToTasks(db, { now });
assert.equal(first.contactsScanned, 2);
assert.equal(first.actionsFound, 1);
assert.equal(first.tasksCreated, 1);
assert.equal(first.associationsCreated, 1);
assert.equal(db.tasks[0].type, "call");
assert.equal(db.tasks[0].priority, "high");
assert.equal(db.tasks[0].legacyContactId, "contact_one");
assert.equal(db.contacts[0].nextAction.taskId, db.tasks[0].id);
assert.equal(db.activities.length, 1, "Migration must not duplicate legacy timeline activities");

const second = migrateNextActionsToTasks(db, { now: "2026-07-17T11:00:00.000Z" });
assert.equal(second.tasksCreated, 0);
assert.equal(second.tasksSkipped, 1);
assert.equal(second.associationsCreated, 0);
assert.equal(db.tasks.length, 1);
assert.equal(db.associations.length, 1);

console.log("Task migration checks passed: active next actions, tenant links, idempotence and no duplicate timeline events.");
