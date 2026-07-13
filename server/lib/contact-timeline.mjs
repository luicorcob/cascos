const BOOKING_ACTIVITY_TYPE = "booking.created";
const REMINDER_ACTIVITY_TYPE = "booking.reminder";
const RELEVANT_REPORT_EVENT = /(?:click|lead|booking|reservation|chatbot|message|form.*submit|store|checkout|order|conversion|review|whatsapp|phone|email)/i;

/**
 * Builds the read-only, unified history for a CRM contact.
 *
 * The returned DTO intentionally has a small and stable public contract:
 * { type, date, summary, refId }.
 */
export function buildContactTimeline(db = {}, business = {}, contact = {}) {
  const businessId = text(business?.id);

  if (
    !businessId
    || !text(contact?.id)
    || (text(contact?.businessId) && text(contact.businessId) !== businessId)
  ) {
    return [];
  }

  const bookings = scopedRecords(db?.bookings, businessId)
    .filter((booking) => isRecordAssociatedWithContact(booking, contact));
  const bookingIds = new Set(bookings.map(recordId).filter(Boolean));
  const reminders = scopedRecords(db?.bookingReminders, businessId)
    .filter((reminder) => (
      isRecordAssociatedWithContact(reminder, contact)
      || bookingIds.has(firstText(reminder.bookingId, reminder.booking_id))
    ));
  const reminderIds = new Set(reminders.map(recordId).filter(Boolean));

  const associatedActivities = scopedRecords(db?.activities, businessId)
    .filter((activity) => isRecordAssociatedWithContact(activity, contact));
  const activities = associatedActivities
    .filter((activity) => !isMirroredBookingActivity(activity, bookingIds, reminderIds));
  const legacyNotes = getLegacyContactNoteItems(contact, associatedActivities);
  const orders = getBusinessOrders(db, business, businessId)
    .filter((order) => isRecordAssociatedWithContact(order, contact));
  const events = getAssociatedEvents(
    scopedRecords(db?.businessEvents, businessId).filter(isRelevantReportEvent),
    contact
  );

  const timeline = [
    ...activities.map(activityTimelineItem),
    ...legacyNotes,
    ...bookings.map(bookingTimelineItem),
    ...reminders.map(reminderTimelineItem),
    ...orders.map((order) => orderTimelineItem(order, business)),
    ...events.map(eventTimelineItem)
  ].filter((item) => item.date);

  return sortTimelineDescending(deduplicateTimelineItems(timeline));
}

/**
 * Contact matching is deliberately shared by every timeline source. This keeps
 * legacy records addressable even when they predate direct contactId storage.
 */
export function isRecordAssociatedWithContact(record, contact) {
  if (!isObject(record) || !isObject(contact)) {
    return false;
  }

  const detail = objectValue(record.detail);
  const metadata = objectValue(record.metadata);
  const customer = objectValue(record.customer);
  const nestedContact = objectValue(record.contact);
  const billing = objectValue(record.billing);
  const contactId = text(contact.id);
  const ids = [
    record.contactId,
    record.contact_id,
    record.leadId,
    record.lead_id,
    detail.contactId,
    detail.contact_id,
    detail.leadId,
    detail.lead_id,
    metadata.contactId,
    metadata.contact_id,
    metadata.leadId,
    metadata.lead_id,
    customer.contactId,
    customer.contact_id,
    nestedContact.id,
    nestedContact.contactId,
    nestedContact.contact_id
  ].map(text).filter(Boolean);

  if (contactId && ids.includes(contactId)) {
    return true;
  }

  const contactEmail = normalizeEmail(contact.email);
  const emails = [
    record.email,
    record.customerEmail,
    record.customer_email,
    record.contactEmail,
    record.contact_email,
    record.leadEmail,
    record.lead_email,
    typeof record.contact === "string" ? record.contact : "",
    detail.email,
    detail.customerEmail,
    detail.customer_email,
    detail.contactEmail,
    detail.contact_email,
    detail.leadEmail,
    detail.lead_email,
    detail.contact,
    detail.leadContact,
    detail.phoneOrEmail,
    metadata.email,
    metadata.contact,
    metadata.leadContact,
    metadata.phoneOrEmail,
    customer.email,
    nestedContact.email,
    billing.email
  ].map(normalizeEmail).filter(Boolean);

  if (contactEmail && emails.includes(contactEmail)) {
    return true;
  }

  const contactPhone = normalizePhone(contact.phone);
  const phones = [
    record.phone,
    record.telephone,
    record.customerPhone,
    record.customer_phone,
    record.contactPhone,
    record.contact_phone,
    typeof record.contact === "string" ? record.contact : "",
    detail.phone,
    detail.telephone,
    detail.customerPhone,
    detail.customer_phone,
    detail.contactPhone,
    detail.contact_phone,
    detail.contact,
    detail.leadContact,
    detail.phoneOrEmail,
    metadata.phone,
    metadata.contact,
    metadata.leadContact,
    metadata.phoneOrEmail,
    customer.phone,
    customer.telephone,
    nestedContact.phone,
    nestedContact.telephone,
    billing.phone
  ].map(normalizePhone).filter(Boolean);

  return Boolean(contactPhone && phones.includes(contactPhone));
}

function scopedRecords(records, businessId) {
  return asArray(records).filter((record) => isObject(record) && text(record.businessId) === businessId);
}

function getBusinessOrders(db, business, businessId) {
  const sources = [
    business?.content?.orders,
    business?.content?.commerce?.orders,
    business?.orders
  ];
  const databaseOrders = asArray(db?.orders)
    .filter((order) => isObject(order) && text(order.businessId) === businessId);
  const seenObjects = new Set();
  const seenKeys = new Set();
  const orders = [];

  for (const source of sources) {
    for (const order of asArray(source)) {
      if (!isObject(order)) {
        continue;
      }

      // Embedded orders belong to this business unless an explicit, conflicting
      // businessId says otherwise.
      if (text(order.businessId) && text(order.businessId) !== businessId) {
        continue;
      }

      pushUniqueOrder(orders, order, seenObjects, seenKeys);
    }
  }

  for (const order of databaseOrders) {
    pushUniqueOrder(orders, order, seenObjects, seenKeys);
  }

  return orders;
}

function pushUniqueOrder(orders, order, seenObjects, seenKeys) {
  if (seenObjects.has(order)) {
    return;
  }

  const key = orderKey(order);

  if (key && seenKeys.has(key)) {
    return;
  }

  seenObjects.add(order);

  if (key) {
    seenKeys.add(key);
  }

  orders.push(order);
}

function orderKey(order) {
  const id = firstText(order.id, order.reference, order.orderNumber, order.order_number);
  return id ? id.toLowerCase() : "";
}

function isMirroredBookingActivity(activity, bookingIds, reminderIds) {
  const type = text(activity?.type).toLowerCase();
  const metadata = objectValue(activity?.metadata);

  if (type === BOOKING_ACTIVITY_TYPE) {
    const bookingId = firstText(
      metadata.bookingId,
      metadata.booking_id,
      activity.bookingId,
      activity.booking_id,
      activity.refId
    );
    return Boolean(bookingId && bookingIds.has(bookingId));
  }

  if (type === REMINDER_ACTIVITY_TYPE) {
    const reminderId = firstText(
      metadata.reminderId,
      metadata.reminder_id,
      activity.reminderId,
      activity.reminder_id,
      activity.refId
    );
    return Boolean(reminderId && reminderIds.has(reminderId));
  }

  return false;
}

function getAssociatedEvents(events, contact) {
  const eventSessionIds = new Map();
  const eventsBySessionId = new Map();

  events.forEach((event) => {
    const ids = getEventSessionIds(event);
    eventSessionIds.set(event, ids);

    ids.forEach((id) => {
      const related = eventsBySessionId.get(id) || [];
      related.push(event);
      eventsBySessionId.set(id, related);
    });
  });

  const directlyAssociated = events.filter((event) => isRecordAssociatedWithContact(event, contact));
  const associated = new Set(directlyAssociated);
  const queue = [...directlyAssociated];
  const visitedSessionIds = new Set();

  // A conversation can carry both conversationId and sessionId across its event
  // stream. Traverse their graph once so messages without PII remain attached to
  // the directly identified CRM contact, even for large event histories.
  for (let index = 0; index < queue.length; index += 1) {
    const event = queue[index];

    for (const sessionId of eventSessionIds.get(event) || []) {
      if (visitedSessionIds.has(sessionId)) {
        continue;
      }

      visitedSessionIds.add(sessionId);

      for (const relatedEvent of eventsBySessionId.get(sessionId) || []) {
        if (!associated.has(relatedEvent)) {
          associated.add(relatedEvent);
          queue.push(relatedEvent);
        }
      }
    }
  }

  return events.filter((event) => associated.has(event));
}

function isRelevantReportEvent(event) {
  return RELEVANT_REPORT_EVENT.test(firstText(event?.type, event?.name));
}

function getEventSessionIds(event) {
  const detail = objectValue(event?.detail);
  return [
    detail.conversationId,
    detail.conversation_id,
    detail.sessionId,
    detail.session_id,
    event?.conversationId,
    event?.conversation_id,
    event?.sessionId,
    event?.session_id
  ].map(text).filter(Boolean);
}

function activityTimelineItem(activity) {
  return timelineItem(
    activity.type || "activity",
    firstDate(activity.createdAt, activity.date, activity.timestamp, activity.updatedAt),
    joinSummary(activity.title, activity.note) || "Actividad",
    recordId(activity)
  );
}

function getLegacyContactNoteItems(contact, activities) {
  const noteBlocks = String(contact?.notes ?? "")
    .split(/\r?\n\s*\r?\n+/)
    .map(text)
    .filter(Boolean);
  const representedNotes = new Set(
    activities.map((activity) => normalizeComparableText(activity.note)).filter(Boolean)
  );
  const missingNotes = noteBlocks.filter((note) => !representedNotes.has(normalizeComparableText(note)));

  if (!missingNotes.length) {
    return [];
  }

  return [timelineItem(
    "note",
    firstDate(contact.updatedAt, contact.lastInteractionAt, contact.createdAt),
    joinSummary("Nota", missingNotes.join(" · ")),
    contact.id
  )];
}

function bookingTimelineItem(booking) {
  const startsAt = firstDate(booking.startsAt);

  return timelineItem(
    "booking",
    firstDate(booking.createdAt, booking.startsAt, booking.updatedAt),
    [
      booking.serviceName || booking.service || "Reserva",
      booking.status,
      startsAt ? `Inicio: ${startsAt}` : "",
      booking.notes
    ]
      .map(text)
      .filter(Boolean)
      .join(" - "),
    recordId(booking)
  );
}

function reminderTimelineItem(reminder) {
  return timelineItem(
    REMINDER_ACTIVITY_TYPE,
    firstDate(reminder.sentAt, reminder.createdAt, reminder.updatedAt),
    joinSummary(`Recordatorio ${text(reminder.channel) || "manual"}`, reminder.message),
    recordId(reminder)
  );
}

function orderTimelineItem(order, business) {
  const reference = firstText(order.reference, order.orderNumber, order.order_number, order.id);
  const amount = order.total ?? order.amount ?? order.amountPaid ?? order.totals?.total;
  const money = formatMoney(amount, order.currency || business?.content?.commerce?.currency || business?.content?.currency);

  return timelineItem(
    "order",
    firstDate(order.paidAt, order.createdAt, order.updatedAt),
    [`Pedido ${reference}`.trim(), order.status, money].map(text).filter(Boolean).join(" - ") || "Pedido",
    firstText(order.id, order.reference, order.orderNumber, order.order_number)
  );
}

function eventTimelineItem(event) {
  const detail = objectValue(event.detail);
  const label = firstText(event.name, event.type) || "Evento";
  const description = firstText(
    detail.summary,
    detail.title,
    detail.message,
    detail.text,
    detail.question,
    detail.prompt,
    detail.response,
    detail.answer,
    detail.source,
    event.page
  );

  return timelineItem(
    event.type || event.name || "event",
    firstDate(event.createdAt, event.timestamp, event.date),
    joinSummary(label, description) || "Evento",
    recordId(event)
  );
}

function timelineItem(type, date, summary, refId) {
  return {
    type: text(type) || "event",
    date: text(date),
    summary: text(summary),
    refId: text(refId)
  };
}

function deduplicateTimelineItems(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = item.refId
      ? `${item.type}\u0000${item.refId}`
      : `${item.type}\u0000${item.date}\u0000${normalizeComparableText(item.summary)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sortTimelineDescending(items) {
  return items
    .map((item, index) => ({ item, index, timestamp: parseTimelineDate(item.date) }))
    .sort((left, right) => {
      const leftValid = Number.isFinite(left.timestamp);
      const rightValid = Number.isFinite(right.timestamp);

      if (leftValid && rightValid && left.timestamp !== right.timestamp) {
        return right.timestamp - left.timestamp;
      }

      if (leftValid !== rightValid) {
        return leftValid ? -1 : 1;
      }

      const lexical = right.item.date.localeCompare(left.item.date);
      return lexical || left.index - right.index;
    })
    .map(({ item }) => item);
}

function parseTimelineDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function firstDate(...values) {
  for (const value of values) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const date = new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    const candidate = text(value);

    if (candidate) {
      const date = new Date(candidate);

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  return "";
}

function recordId(record) {
  return firstText(record?.id, record?.refId, record?.reference);
}

function formatMoney(value, currency) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return `${amount} ${text(currency).toUpperCase() || "EUR"}`;
}

function joinSummary(label, description) {
  const parts = [label, description].map(text).filter(Boolean);
  return parts.join(": ");
}

function firstText(...values) {
  for (const value of values) {
    const candidate = text(value);

    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function normalizeEmail(value) {
  return String(value ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
}

function normalizePhone(value) {
  const phone = text(value).replace(/[^\d+]/g, "").replace(/^\+/, "");
  return phone.length >= 6 ? phone : "";
}

function normalizeComparableText(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function objectValue(value) {
  return isObject(value) ? value : {};
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
