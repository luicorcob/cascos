import assert from "node:assert/strict";

await import("../../src/studio/core-utils.js");

const core = globalThis.LocalLiftStudio?.core;

assert.ok(core, "Studio core utilities must be registered");
assert.deepEqual(core.parseLines(" uno \n\n dos "), ["uno", "dos"]);
assert.deepEqual(core.parsePairs("Nombre | Texto con | separador", "", ""), [["Nombre", "Texto con | separador"]]);
assert.equal(core.parsePrice(" 12,345 "), 12.35);
assert.equal(core.normalizeCurrency(" eur "), "EUR");
assert.equal(core.normalizeCurrency("invalid"), "EUR");
assert.equal(core.normalizeUrl("example.com/reservas"), "https://example.com/reservas");
assert.equal(core.normalizeUrl("#contacto"), "#contacto");
assert.equal(core.normalizeOptionalUrl(""), "");
assert.equal(core.slugify("Clínica Áurea Sevilla"), "clinica-aurea-sevilla");
assert.equal(core.initials("Local Lift Studio"), "LL");
assert.equal(core.escapeHtml('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
assert.equal(core.isFoodCategory("Cafetería de barrio"), true);
assert.deepEqual(core.normalizeSectionOrder(["faq", "services", "faq"], ["services", "gallery", "faq"]), [
  "faq",
  "services",
  "gallery"
]);
assert.equal(core.sectionBaseKey("services__copy2"), "services");
assert.deepEqual(core.normalizeSectionOrder(["services", "services__copy1", "faq"], ["services", "gallery", "faq"]), [
  "services",
  "services__copy1",
  "faq",
  "gallery"
]);
assert.deepEqual(core.groupMenuItems([
  { category: "Cafe", name: "Solo", price: "1,50" },
  { category: "Cafe", name: "Leche", price: 2 }
]), [{
  category: "Cafe",
  items: [
    { category: "Cafe", name: "Solo", price: 1.5, description: "" },
    { category: "Cafe", name: "Leche", price: 2, description: "" }
  ]
}]);

console.log("Studio core utility tests passed.");
