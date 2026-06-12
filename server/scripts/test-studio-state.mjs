import assert from "node:assert/strict";

await import("../../src/studio/state-controller.js");

const { createHistory, createAutoSave } = globalThis.LocalLiftStudio.state;
const history = createHistory({ limit: 2 });

history.record({ value: 1 });
history.record({ value: 2 });
history.record({ value: 3 });
assert.equal(history.size, 2);
assert.deepEqual(history.undo({ value: 4 }), { value: 3 });
assert.deepEqual(history.undo({ value: 3 }), { value: 2 });
assert.equal(history.undo({ value: 2 }), null);
assert.deepEqual(history.redo({ value: 2 }), { value: 3 });

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
};
const autoSave = createAutoSave({ storage, key: "draft", delay: 0 });
autoSave.schedule({ name: "Luma" });
assert.equal(autoSave.flush(), true);
assert.deepEqual(autoSave.load(), { name: "Luma" });
autoSave.clear();
assert.equal(autoSave.load(), null);

console.log("Studio state controller tests passed.");
