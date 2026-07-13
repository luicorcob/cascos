import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { moveContactReferences } from "../api/contact-api.mjs";
import { loadCommerceOrdersForBusiness, mergeTimelineOrders } from "../lib/commerce-order-source.mjs";
import { buildContactTimeline } from "../lib/contact-timeline.mjs";

const business = {
  id: "biz-a",
  content: {
    currency: "EUR",
    orders: [
      {
        id: "ord-content",
        customer: { email: " CLIENTE@EXAMPLE.COM " },
        total: 25,
        status: "paid",
        createdAt: "2026-07-04T10:00:00.000Z"
      }
    ],
    commerce: {
      currency: "EUR",
      orders: [
        {
          id: "ord-content",
          customer: { email: "cliente@example.com" },
          total: 25,
          status: "paid",
          createdAt: "2026-07-04T10:00:00.000Z"
        },
        {
          id: "ord-commerce",
          customer: { phone: "34600111222" },
          total: 40,
          status: "paid",
          createdAt: "2026-07-05T10:00:00.000Z"
        }
      ]
    }
  },
  orders: [
    {
      id: "ord-business",
      contactId: "contact-a",
      amount: 60,
      status: "ready",
      createdAt: "2026-07-06T10:00:00.000Z"
    },
    {
      id: "ord-other-contact",
      contactId: "contact-other",
      total: 999,
      createdAt: "2026-07-12T10:00:00.000Z"
    }
  ]
};

const contact = {
  id: "contact-a",
  businessId: business.id,
  name: "Cliente Timeline",
  email: "cliente@example.com",
  phone: "+34 600 111 222",
  notes: "Prefiere contacto por la tarde",
  updatedAt: "2026-07-02T10:00:00.000Z"
};

const db = {
  activities: [
    {
      id: "act-note",
      businessId: business.id,
      contactId: contact.id,
      type: "note",
      title: "Nota comercial",
      note: "Prefiere contacto por la tarde",
      createdAt: "2026-07-02T10:00:00.000Z"
    },
    {
      id: "act-booking-mirror",
      businessId: business.id,
      contactId: contact.id,
      type: "booking.created",
      title: "Reserva creada",
      metadata: { bookingId: "booking-a" },
      createdAt: "2026-07-11T10:00:00.000Z"
    },
    {
      id: "act-reminder-mirror",
      businessId: business.id,
      contactId: contact.id,
      type: "booking.reminder",
      title: "Recordatorio de reserva",
      metadata: { reminderId: "reminder-a", bookingId: "booking-a" },
      createdAt: "2026-07-11T09:00:00.000Z"
    },
    {
      id: "act-other-contact",
      businessId: business.id,
      contactId: "contact-other",
      type: "note",
      title: "No debe aparecer",
      createdAt: "2026-07-12T10:00:00.000Z"
    },
    {
      id: "act-other-business",
      businessId: "biz-b",
      contactId: contact.id,
      type: "note",
      title: "No debe cruzar negocios",
      createdAt: "2026-07-13T10:00:00.000Z"
    }
  ],
  bookings: [
    {
      id: "booking-a",
      businessId: business.id,
      phone: "34600111222",
      serviceName: "Consulta inicial",
      status: "confirmed",
      startsAt: "2026-07-08T10:00:00.000Z",
      createdAt: "2026-07-01T10:00:00.000Z"
    },
    {
      id: "booking-other-contact",
      businessId: business.id,
      email: "otra@example.com",
      startsAt: "2026-07-12T10:00:00.000Z"
    },
    {
      id: "booking-other-business",
      businessId: "biz-b",
      contactId: contact.id,
      startsAt: "2026-07-13T10:00:00.000Z"
    }
  ],
  bookingReminders: [
    {
      id: "reminder-a",
      businessId: business.id,
      email: "CLIENTE@example.com",
      channel: "whatsapp",
      message: "Te esperamos manana",
      sentAt: "2026-07-07T10:00:00.000Z",
      createdAt: "2026-07-07T09:59:00.000Z"
    },
    {
      id: "reminder-other-contact",
      businessId: business.id,
      contactId: "contact-other",
      createdAt: "2026-07-12T10:00:00.000Z"
    }
  ],
  orders: [
    {
      id: "ord-db",
      businessId: business.id,
      contact_id: contact.id,
      totals: { total: 80 },
      currency: "eur",
      status: "paid",
      paidAt: "2026-07-09T10:00:00.000Z"
    },
    {
      id: "ord-db-other-business",
      businessId: "biz-b",
      contactId: contact.id,
      total: 500,
      createdAt: "2026-07-13T10:00:00.000Z"
    },
    {
      id: "ord-db-other-contact",
      businessId: business.id,
      contactId: "contact-other",
      total: 500,
      createdAt: "2026-07-12T10:00:00.000Z"
    }
  ],
  businessEvents: [
    {
      id: "evt-chat-captured",
      businessId: business.id,
      type: "chatbot_lead_captured",
      detail: {
        contactId: contact.id,
        conversationId: "conversation-a",
        source: "chatbot"
      },
      createdAt: "2026-07-10T10:00:00.000Z"
    },
    {
      id: "evt-chat-bridge",
      businessId: business.id,
      type: "chatbot_open",
      detail: {
        conversationId: "conversation-a",
        sessionId: "session-a"
      },
      createdAt: "2026-07-10T09:59:00.000Z"
    },
    {
      id: "evt-chat-message",
      businessId: business.id,
      type: "chatbot_message",
      detail: {
        sessionId: "session-a",
        message: "Necesito una cita"
      },
      createdAt: "2026-07-10T09:58:00.000Z"
    },
    {
      id: "evt-booking-click",
      businessId: business.id,
      type: "booking_click",
      phone: "+34 (600) 111-222",
      detail: { source: "hero" },
      createdAt: "2026-07-03T10:00:00.000Z"
    },
    {
      id: "evt-page-view-noise",
      businessId: business.id,
      type: "page_view",
      detail: { contactId: contact.id },
      createdAt: "2026-07-11T11:00:00.000Z"
    },
    {
      id: "evt-unrelated-session",
      businessId: business.id,
      type: "chatbot_message",
      detail: { sessionId: "session-other", message: "No incluir" },
      createdAt: "2026-07-13T10:00:00.000Z"
    },
    {
      id: "evt-other-contact",
      businessId: business.id,
      type: "form_submit",
      detail: { contactId: "contact-other" },
      createdAt: "2026-07-12T10:00:00.000Z"
    },
    {
      id: "evt-other-business",
      businessId: "biz-b",
      type: "chatbot_message",
      detail: { contactId: contact.id, sessionId: "session-a" },
      createdAt: "2026-07-13T10:00:00.000Z"
    }
  ]
};

const timeline = buildContactTimeline(db, business, contact);
const refs = new Set(timeline.map((item) => item.refId));

assert(timeline.length > 0, "The fixture must produce timeline items");
timeline.forEach((item) => {
  assert.deepEqual(Object.keys(item), ["type", "date", "summary", "refId"], "Timeline DTO must expose the exact public schema");
  Object.values(item).forEach((value) => assert.equal(typeof value, "string", "Timeline DTO values must be strings"));
});

for (let index = 1; index < timeline.length; index += 1) {
  assert(
    Date.parse(timeline[index - 1].date) >= Date.parse(timeline[index].date),
    `Timeline must be in reverse chronological order at index ${index}`
  );
}

[
  "act-note",
  "booking-a",
  "reminder-a",
  "ord-content",
  "ord-commerce",
  "ord-business",
  "ord-db",
  "evt-chat-captured",
  "evt-chat-bridge",
  "evt-chat-message",
  "evt-booking-click"
].forEach((refId) => assert(refs.has(refId), `Timeline must include ${refId}`));

assert.equal(timeline.filter((item) => item.type === "booking").length, 1, "Canonical booking must appear once");
assert.equal(timeline.filter((item) => item.type === "booking.reminder").length, 1, "Canonical reminder must replace its mirrored activity");
assert(!timeline.some((item) => item.type === "booking.created"), "Mirrored booking.created activity must be removed");
assert(!refs.has("act-reminder-mirror"), "Mirrored reminder activity must be removed");
assert.equal(timeline.filter((item) => item.type === "order").length, 4, "All embedded and business-scoped DB order sources must be aggregated and deduplicated");
assert.match(timeline.find((item) => item.refId === "evt-chat-message")?.summary || "", /Necesito una cita/, "Chatbot message summary must remain useful");
assert.equal(timeline.filter((item) => item.type === "note").length, 1, "Legacy contact.notes must not duplicate an existing note activity");
assert.equal(timeline.find((item) => item.refId === "booking-a")?.date, "2026-07-01T10:00:00.000Z", "Booking milestone must use createdAt rather than the future appointment time");
assert.match(timeline.find((item) => item.refId === "booking-a")?.summary || "", /2026-07-08T10:00:00.000Z/, "Booking summary must retain startsAt");

[
  "act-other-contact",
  "act-other-business",
  "booking-other-contact",
  "booking-other-business",
  "reminder-other-contact",
  "ord-other-contact",
  "ord-db-other-business",
  "ord-db-other-contact",
  "evt-unrelated-session",
  "evt-other-contact",
  "evt-other-business"
].forEach((refId) => assert(!refs.has(refId), `Timeline must isolate unrelated record ${refId}`));
assert(!refs.has("evt-page-view-noise"), "Timeline must exclude report noise without commercial relevance");
assert.deepEqual(
  buildContactTimeline(db, business, { ...contact, businessId: "biz-b" }),
  [],
  "A contact explicitly owned by another business must never expose this business timeline"
);

const legacyNoteTimeline = buildContactTimeline(
  { activities: [], bookings: [], bookingReminders: [], businessEvents: [] },
  { id: "biz-legacy", content: {} },
  {
    id: "contact-legacy",
    businessId: "biz-legacy",
    notes: "Nota importada sin actividad",
    createdAt: "2025-01-02T10:00:00.000Z"
  }
);
assert.deepEqual(legacyNoteTimeline, [{
  type: "note",
  date: "2025-01-02T10:00:00.000Z",
  summary: "Nota: Nota importada sin actividad",
  refId: "contact-legacy"
}], "Unrepresented legacy contact.notes must remain visible");

const mergeBusiness = {
  id: "biz-a",
  content: {
    orders: [
      {
        id: "ord-migrate-by-phone",
        customer: { phone: "+34 699 123 123" }
      }
    ]
  }
};
const mergeDb = {
  contacts: [
    { id: "survivor", businessId: "biz-a", email: "survivor@example.com", phone: "+34 600 000 000" },
    { id: "duplicate-a", businessId: "biz-a", email: "duplicate@example.com", phone: "+34 699 123 123" },
    { id: "duplicate-b", businessId: "biz-a", email: "duplicate-b@example.com", phone: "+34 688 456 456" }
  ],
  activities: [],
  bookings: [
    {
      id: "booking-migrate-by-email",
      businessId: "biz-a",
      email: "DUPLICATE@example.com"
    },
    {
      id: "booking-migrate-other-business",
      businessId: "biz-b",
      email: "duplicate@example.com"
    }
  ],
  bookingReminders: [],
  orders: [
    {
      id: "ord-db-migrate-by-email",
      businessId: "biz-a",
      customer: { email: "duplicate-b@example.com" }
    },
    {
      id: "ord-db-migrate-other-business",
      businessId: "biz-b",
      customer: { email: "duplicate-b@example.com" }
    }
  ],
  businessEvents: [
    {
      id: "evt-migrate",
      businessId: mergeBusiness.id,
      contactId: "duplicate-a",
      contact_id: "duplicate-b",
      detail: {
        contactId: "duplicate-a",
        contact_id: "duplicate-b",
        leadId: "duplicate-a",
        lead_id: "duplicate-b",
        source: "chatbot",
        nested: { preserved: true }
      }
    },
    {
      id: "evt-migrate-by-email",
      businessId: mergeBusiness.id,
      type: "chatbot_lead_captured",
      detail: {
        email: "duplicate@example.com",
        source: "chatbot",
        conversationId: "merge-conversation"
      }
    },
    {
      id: "evt-migrate-other-business",
      businessId: "biz-b",
      contactId: "duplicate-a",
      detail: { contactId: "duplicate-a", source: "keep" }
    }
  ]
};

moveContactReferences(mergeDb, mergeBusiness, "survivor", ["duplicate-a", "duplicate-b"]);

assert.equal(mergeDb.businessEvents[0].contactId, "survivor", "Direct event contactId must migrate");
assert.equal(mergeDb.businessEvents[0].contact_id, "survivor", "Direct event contact_id must migrate");
assert.deepEqual(mergeDb.businessEvents[0].detail, {
  contactId: "survivor",
  contact_id: "survivor",
  leadId: "survivor",
  lead_id: "survivor",
  source: "chatbot",
  nested: { preserved: true }
}, "Event detail migration must preserve every unrelated field");
assert.equal(mergeDb.businessEvents[2].contactId, "duplicate-a", "Merge must not mutate another business");
assert.equal(mergeDb.businessEvents[2].detail.contactId, "duplicate-a", "Other-business detail must remain untouched");
assert.equal(mergeDb.bookings[0].contactId, "survivor", "Booking matched by duplicate email must migrate to survivor");
assert(!mergeDb.bookings[1].contactId, "Booking from another business must remain untouched");
assert.equal(mergeBusiness.content.orders[0].contactId, "survivor", "Embedded order matched by duplicate phone must migrate to survivor");
assert.equal(mergeDb.orders[0].contactId, "survivor", "Business-scoped DB order matched by duplicate email must migrate to survivor");
assert(!mergeDb.orders[1].contactId, "DB order from another business must remain untouched");
assert.deepEqual(mergeDb.businessEvents[1].detail, {
  email: "duplicate@example.com",
  source: "chatbot",
  conversationId: "merge-conversation",
  contactId: "survivor"
}, "PII-matched event must gain survivor detail.contactId without losing detail");

const storeFixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "dls-timeline-store-"));
const storeFixturePath = path.join(storeFixtureDirectory, "store-db.json");
const previousStorePath = process.env.STORE_DB_PATH;

try {
  await writeFile(storeFixturePath, JSON.stringify({
    orders: [
      { id: "store-order-a", businessId: "biz-a" },
      { id: "store-order-by-slug", businessSlug: "negocio-a" },
      { id: "store-order-other", businessId: "biz-b" },
      { id: "store-order-unscoped" }
    ]
  }), "utf8");
  process.env.STORE_DB_PATH = storeFixturePath;

  const commerceOrders = await loadCommerceOrdersForBusiness(
    { root: storeFixtureDirectory },
    { id: "biz-a", slug: "negocio-a" }
  );
  assert.deepEqual(
    commerceOrders.map((order) => order.id),
    ["store-order-a", "store-order-by-slug"],
    "Commerce order source must enforce business scope and reject unscoped legacy orders"
  );
  assert.equal(
    mergeTimelineOrders([{ id: "store-order-a", source: "embedded" }], commerceOrders).length,
    2,
    "Commerce orders must merge without duplicating an embedded order"
  );
} finally {
  if (previousStorePath === undefined) {
    delete process.env.STORE_DB_PATH;
  } else {
    process.env.STORE_DB_PATH = previousStorePath;
  }
  await rm(storeFixtureDirectory, { recursive: true, force: true });
}

console.log(`Contact timeline tests passed (${timeline.length} unified items).`);
