import assert from "node:assert/strict";

await import("../../src/studio/media-library.js");

const { createMediaLibrary } = globalThis.LocalLiftStudio.media;
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key)
};
const library = createMediaLibrary({
  storage,
  key: "test-media",
  maxItems: 2,
  maxItemBytes: 2_000,
  maxTotalBytes: 3_000
});

const first = library.add({ name: "Portada", url: "https://example.com/hero.jpg", size: 400 });
assert.equal(first.name, "Portada");
assert.equal(library.list().length, 1);
assert.equal(library.add({ url: first.url }).id, first.id, "Duplicate URLs must reuse the stored item");
assert.equal(library.update(first.id, { alt: "Fachada del negocio", width: 1200, height: 800 }).alt, "Fachada del negocio");
assert.equal(library.list()[0].width, 1200);

const second = library.add({ url: "data:image/png;base64,aGVsbG8=", size: 500 });
assert.equal(library.list().length, 2);
assert.throws(() => library.add({ url: "https://example.com/third.jpg" }), /maximo de 2/);
assert.equal(library.remove(second.id), true);
assert.equal(library.list().length, 1);
assert.throws(() => library.add({ url: "javascript:alert(1)" }), /URL http/);

library.clear();
assert.deepEqual(library.list(), []);

console.log("Studio media library contract tests passed.");
