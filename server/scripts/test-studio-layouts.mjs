import assert from "node:assert/strict";

await import("../../src/studio/layout-library.js");

const { createLayoutLibrary } = globalThis.LocalLiftStudio.layouts;
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key)
};
const library = createLayoutLibrary({ storage, key: "test-layouts", maxItems: 2 });
const source = {
  sectionOrder: ["gallery", "services"],
  blockVariants: { hero: "minimal" },
  visibility: { showGallery: true }
};

const first = library.save("Visual", source);
source.sectionOrder[0] = "services";
assert.deepEqual(library.list()[0].layout.sectionOrder, ["gallery", "services"], "Saved layouts must be cloned");
assert.throws(() => library.save("", source), /nombre/);

library.save("Compacta", source);
library.save("Conversion", source);
assert.equal(library.list().length, 2, "The library must enforce its item limit");
assert.equal(library.remove(first.id), false, "Old layouts outside the limit are no longer removable");
assert.equal(library.remove(library.list()[0].id), true);

library.clear();
assert.deepEqual(library.list(), []);

console.log("Studio reusable layout library tests passed.");
