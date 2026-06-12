import assert from "node:assert/strict";

await import("../../src/studio/validation.js");

const { validateBusiness } = globalThis.LocalLiftStudio.validation;
const invalid = validateBusiness({
  showLeadForm: true,
  showBooking: false,
  showMap: true,
  services: [],
  commerce: { enabled: true, products: [] }
});

assert.equal(invalid.ok, false);
assert.ok(invalid.errors.some((issue) => issue.code === "missing_name"));
assert.ok(invalid.errors.some((issue) => issue.code === "missing_privacy"));
assert.ok(invalid.errors.some((issue) => issue.code === "missing_checkout"));
assert.ok(invalid.warnings.some((issue) => issue.code === "few_services"));

const validBusiness = {
  name: "Luma",
  category: "Belleza",
  phone: "+34 600 000 000",
  services: ["Uno", "Dos", "Tres"],
  heroImage: "https://example.com/hero.jpg",
  mediaMetadata: {
    "https://example.com/hero.jpg": { alt: "Interior de Luma" }
  },
  privacyUrl: "/privacidad",
  showLeadForm: true,
  showBooking: false,
  showMap: false,
  commerce: { enabled: false, products: [] }
};
const valid = validateBusiness(validBusiness);
assert.equal(valid.ok, true);
assert.equal(valid.score, 100);

const missingAlt = validateBusiness({ ...validBusiness, mediaMetadata: {} });
assert.ok(missingAlt.warnings.some((issue) => issue.code === "missing_hero_alt"));

const relativePrivacy = validateBusiness({
  ...validBusiness,
  privacyUrl: "pages/privacy-demo.html"
});
assert.equal(relativePrivacy.ok, true);

console.log("Studio validation tests passed.");
