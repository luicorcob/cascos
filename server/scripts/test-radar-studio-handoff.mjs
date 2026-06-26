import assert from "node:assert/strict";

await import("../../src/radar/studio-handoff.js");

const handoffApi = globalThis.DLSRadarStudioHandoff;
const full = handoffApi.buildHandoff({
  id: "places_demo",
  providerId: "demo",
  provider: "places",
  sourceLabel: "Google Places",
  name: "Clínica Norte",
  category: "Clínica dental",
  city: "Santander",
  province: "Cantabria",
  postalCode: "39001",
  street: "Calle Alta",
  streetNumber: "12",
  address: "Calle Alta 12, 39001 Santander",
  phone: "+34 942 123 456",
  rating: 4.7,
  reviews: 83,
  mapsUrl: "https://maps.google.com/example",
  coordinates: { lat: 43.4623, lng: -3.8099 },
  openingHours: ["lunes: 09:00–18:00"],
  reviewItems: [{ author: "María", relativeDate: "hace un mes", text: "Trato cercano y puntual." }],
  photos: ["https://example.com/clinic.jpg"],
  types: ["dentist", "health", "point_of_interest"],
  websiteStatus: "none"
});

assert.equal(full.version, 2);
assert.equal(full.detected.phone, "+34 942 123 456");
assert.equal(full.detected.reviewItems[0].text, "Trato cercano y puntual.");
assert.equal(full.draft.bookingUrl, "tel:+34942123456");
assert.equal(full.draft.google.rating, 4.7);
assert.equal(full.draft.google.reviewCount, 83);
assert.deepEqual(full.draft.hours, ["lunes: 09:00–18:00"]);
assert.deepEqual(full.draft.gallery, ["https://example.com/clinic.jpg"]);
assert.ok(full.draft.services.some((item) => item.includes("Dentist")));
assert.ok(full.draft.localSeo.keywords.includes("Clínica dental en Santander"));
assert.equal(full.draft.contentProvenance.mode, "radar-real");
assert.equal(full.missing.length, 0);

const sparse = handoffApi.buildHandoff({
  name: "Taller Central",
  category: "Taller",
  city: "León",
  websiteStatus: "unverified",
  provider: "openstreetmap"
});

assert.equal(sparse.draft.phone, "");
assert.equal(sparse.draft.address, "");
assert.equal(sparse.draft.heroImage, "");
assert.equal(sparse.draft.showGallery, false);
assert.equal(sparse.draft.blockVariants.hero, "minimal");
assert.deepEqual(sparse.draft.hours, ["Horario pendiente de confirmar."]);
assert.match(sparse.draft.services[0], /añade aquí los servicios reales/i);
assert.match(sparse.draft.testimonials[0].text, /opiniones reales/i);
assert.ok(sparse.missing.includes("Teléfono"));
assert.ok(sparse.missing.includes("Reseñas textuales"));
assert.doesNotMatch(JSON.stringify(sparse.draft), /somos líderes|900 000 000|Laura M\./i);

console.log("Radar to Studio grounded handoff tests passed.");
