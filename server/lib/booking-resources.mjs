import { createHash, randomBytes, randomUUID } from "node:crypto";

const OPEN_STATUSES = new Set(["pending", "confirmed"]);
const RESOURCE_TYPES = new Set(["professional", "table", "room", "cabin", "equipment", "capacity", "other"]);
const WAITLIST_STATUSES = new Set(["waiting", "offered", "accepted", "booked", "canceled", "expired"]);

export function ensureBookingResourceCollections(db) {
  for (const key of ["bookingResources", "bookingResourceSchedules", "bookingResourceExceptions", "bookingResourceAssignments", "bookingWaitlist", "bookingWaitlistOffers", "bookingCheckouts", "bookingPaymentEvents"]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  db.bookings = Array.isArray(db.bookings) ? db.bookings : [];
  db.services = Array.isArray(db.services) ? db.services : [];
  return db;
}

export function normalizeBookingResource(input, existing, businessId, now = new Date().toISOString()) {
  const source = object(input?.resource || input);
  const name = clean(source.name || existing?.name);
  if (!name) throw modelError(400, "Resource name is required");
  const type = clean(source.type || existing?.type || "professional").toLowerCase();
  if (!RESOURCE_TYPES.has(type)) throw modelError(400, "Invalid resource type");
  return {
    id: existing?.id || cleanId(source.id) || `res_${randomUUID()}`,
    businessId,
    name: name.slice(0, 160),
    type,
    description: clean(source.description ?? existing?.description).slice(0, 800),
    location: clean(source.location ?? existing?.location).slice(0, 160),
    color: normalizeColor(source.color ?? existing?.color),
    serviceIds: uniqueIds(source.serviceIds ?? existing?.serviceIds),
    capacity: integer(source.capacity ?? existing?.capacity ?? 1, 1, 10000),
    simultaneousCapacity: integer(source.simultaneousCapacity ?? existing?.simultaneousCapacity ?? 1, 1, 1000),
    bufferBeforeMinutes: integer(source.bufferBeforeMinutes ?? existing?.bufferBeforeMinutes ?? 0, 0, 1440),
    bufferAfterMinutes: integer(source.bufferAfterMinutes ?? existing?.bufferAfterMinutes ?? 0, 0, 1440),
    timezone: clean((source.timezone ?? existing?.timezone) || "Europe/Madrid").slice(0, 100),
    active: boolean(source.active, existing?.active ?? true),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

export function replaceResourceSchedule(db, resource, input, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  const rules = array(input?.schedule ?? input?.rules ?? input).map((rule, index) => normalizeScheduleRule(rule, resource, index, now));
  db.bookingResourceSchedules = db.bookingResourceSchedules.filter((item) => !(item.businessId === resource.businessId && item.resourceId === resource.id));
  db.bookingResourceSchedules.push(...rules);
  return rules;
}

export function normalizeResourceException(input, existing, resource, now = new Date().toISOString()) {
  const source = object(input?.exception || input);
  const startsAt = validDate(source.startsAt ?? existing?.startsAt, "Exception startsAt is required");
  const endsAt = validDate(source.endsAt ?? existing?.endsAt, "Exception endsAt is required");
  if (endsAt <= startsAt) throw modelError(400, "Exception end must be after start");
  const mode = clean(source.mode || existing?.mode || "blocked").toLowerCase();
  if (!new Set(["blocked", "available"]).has(mode)) throw modelError(400, "Invalid exception mode");
  return {
    id: existing?.id || cleanId(source.id) || `rex_${randomUUID()}`,
    businessId: resource.businessId,
    resourceId: resource.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    mode,
    reason: clean((source.reason ?? existing?.reason) || (mode === "blocked" ? "No disponible" : "Disponibilidad extra")).slice(0, 300),
    active: boolean(source.active, existing?.active ?? true),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

export function allocateBookingResources(db, booking, options = {}) {
  ensureBookingResourceCollections(db);
  if (!OPEN_STATUSES.has(booking.status)) return { managed: hasApplicableResources(db, booking), resourceIds: uniqueIds(booking.resourceIds), resources: [] };
  const applicable = applicableResources(db, booking);
  if (!applicable.length) {
    booking.resourceIds = [];
    return { managed: false, resourceIds: [], resources: [] };
  }
  const requestedIds = uniqueIds(options.resourceIds ?? booking.resourceIds);
  const requested = requestedIds.map((id) => applicable.find((item) => item.id === id));
  if (requested.some((item) => !item)) throw modelError(409, "Requested resource is not available for this service");
  const requiredTypes = uniqueStrings(booking.requiredResourceTypes);
  let selected = requested.filter(Boolean);
  if (requiredTypes.length) {
    for (const type of requiredTypes) {
      if (selected.some((resource) => resource.type === type)) continue;
      const candidate = applicable.find((resource) => resource.type === type && !selected.some((item) => item.id === resource.id) && isResourceAvailable(db, resource, booking, options.ignoredBookingId));
      if (!candidate) throw modelError(409, `No ${type} resource available for this slot`);
      selected.push(candidate);
    }
  } else if (!selected.length) {
    const candidate = applicable.find((resource) => isResourceAvailable(db, resource, booking, options.ignoredBookingId));
    if (!candidate) throw modelError(409, "No resource available for this slot");
    selected = [candidate];
  }
  for (const resource of selected) {
    if (!isResourceAvailable(db, resource, booking, options.ignoredBookingId)) throw modelError(409, `${resource.name} is not available for this slot`);
  }
  booking.resourceIds = uniqueIds(selected.map((item) => item.id));
  booking.resourceMode = "managed";
  return { managed: true, resourceIds: booking.resourceIds, resources: selected };
}

export function syncBookingResourceAssignments(db, booking, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  const current = db.bookingResourceAssignments.filter((item) => item.bookingId === booking.id && item.businessId === booking.businessId);
  const resourceIds = OPEN_STATUSES.has(booking.status) ? uniqueIds(booking.resourceIds) : [];
  for (const assignment of current) {
    assignment.status = resourceIds.includes(assignment.resourceId) ? "active" : "released";
    assignment.releasedAt = assignment.status === "released" ? now : "";
    assignment.updatedAt = now;
  }
  for (const resourceId of resourceIds) {
    if (current.some((item) => item.resourceId === resourceId)) continue;
    db.bookingResourceAssignments.push({ id: `rassign_${randomUUID()}`, businessId: booking.businessId, bookingId: booking.id, resourceId, status: "active", startsAt: booking.startsAt, endsAt: booking.endsAt, partySize: booking.partySize || 1, createdAt: now, updatedAt: now, releasedAt: "" });
  }
  return db.bookingResourceAssignments.filter((item) => item.bookingId === booking.id);
}

export function decorateBookingResources(db, booking, now = new Date()) {
  ensureBookingResourceCollections(db);
  const resources = uniqueIds(booking.resourceIds).map((id) => db.bookingResources.find((item) => item.id === id)).filter(Boolean);
  return {
    ...booking,
    resources: resources.map(publicResource),
    noShowRisk: calculateNoShowRisk(db, booking, now),
    deposit: bookingDepositSummary(booking)
  };
}

export function getResourceAvailability(db, businessId, input) {
  ensureBookingResourceCollections(db);
  const serviceId = clean(input.serviceId);
  const service = db.services.find((item) => item.businessId === businessId && item.id === serviceId);
  if (!service) throw modelError(404, "Service not found");
  const startsAt = validDate(input.startsAt, "startsAt is required");
  const duration = integer(input.durationMinutes ?? service.durationMinutes ?? 60, 10, 480);
  const endsAt = input.endsAt ? validDate(input.endsAt, "endsAt is invalid") : new Date(startsAt.getTime() + duration * 60000);
  const booking = { businessId, serviceId, serviceName: service.name, status: "confirmed", startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), partySize: integer(input.partySize ?? service.defaultPartySize ?? 1, 1, 10000), requiredResourceTypes: uniqueStrings(service.requiredResourceTypes) };
  const resources = applicableResources(db, booking).map((resource) => ({ ...publicResource(resource), available: isResourceAvailable(db, resource, booking, ""), reason: resourceAvailabilityReason(db, resource, booking, "") }));
  return { service: { id: service.id, name: service.name, durationMinutes: duration }, startsAt: booking.startsAt, endsAt: booking.endsAt, partySize: booking.partySize, available: resources.some((item) => item.available), resources };
}

export function createWaitlistEntry(db, business, input, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  const source = object(input?.entry || input);
  const service = db.services.find((item) => item.businessId === business.id && item.id === clean(source.serviceId));
  if (!service) throw modelError(404, "Service not found");
  const desiredStartsAt = validDate(source.desiredStartsAt || source.startsAt, "Desired start is required");
  const desiredEndsAt = source.desiredEndsAt || source.endsAt ? validDate(source.desiredEndsAt || source.endsAt, "Desired end is invalid") : new Date(desiredStartsAt.getTime() + Number(service.durationMinutes || 60) * 60000);
  if (desiredEndsAt <= desiredStartsAt) throw modelError(400, "Desired end must be after start");
  const entry = {
    id: cleanId(source.id) || `wait_${randomUUID()}`,
    businessId: business.id,
    serviceId: service.id,
    serviceName: service.name,
    customerName: clean(source.customerName || source.name || "Cliente").slice(0, 160),
    phone: clean(source.phone).slice(0, 80),
    email: clean(source.email).slice(0, 320),
    contactId: cleanId(source.contactId),
    desiredStartsAt: desiredStartsAt.toISOString(),
    desiredEndsAt: desiredEndsAt.toISOString(),
    flexibleMinutes: integer(source.flexibleMinutes ?? 0, 0, 10080),
    partySize: integer(source.partySize ?? service.defaultPartySize ?? 1, 1, 10000),
    priority: integer(source.priority ?? 0, -100, 100),
    notes: clean(source.notes).slice(0, 1000),
    status: "waiting",
    source: clean(source.source || "dashboard").slice(0, 80),
    offeredAt: "",
    bookedAt: "",
    bookingId: "",
    createdAt: now,
    updatedAt: now
  };
  if (!entry.phone && !entry.email) throw modelError(400, "Waitlist contact is required");
  db.bookingWaitlist.push(entry);
  return entry;
}

export function updateWaitlistEntry(db, businessId, entryId, input, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  const entry = db.bookingWaitlist.find((item) => item.businessId === businessId && item.id === entryId);
  if (!entry) throw modelError(404, "Waitlist entry not found");
  const source = object(input?.entry || input);
  if (source.status !== undefined) {
    const status = clean(source.status).toLowerCase();
    if (!WAITLIST_STATUSES.has(status)) throw modelError(400, "Invalid waitlist status");
    entry.status = status;
  }
  if (source.bookingId !== undefined) entry.bookingId = cleanId(source.bookingId);
  if (entry.status === "booked") entry.bookedAt ||= now;
  entry.updatedAt = now;
  return entry;
}

export function offerWaitlistSlot(db, business, input, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  expireWaitlistOffers(db, new Date(now));
  const source = object(input);
  const slotStart = validDate(source.startsAt, "Offer startsAt is required");
  const slotEnd = validDate(source.endsAt, "Offer endsAt is required");
  const candidates = db.bookingWaitlist
    .filter((entry) => entry.businessId === business.id && entry.status === "waiting")
    .filter((entry) => !source.serviceId || entry.serviceId === source.serviceId)
    .filter((entry) => waitlistMatchesSlot(entry, slotStart, slotEnd))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const entry = source.entryId ? candidates.find((item) => item.id === source.entryId) : candidates[0];
  if (!entry) throw modelError(404, "No waitlist candidate matches this slot");
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(new Date(now).getTime() + integer(source.expiresInMinutes ?? 30, 5, 1440) * 60000).toISOString();
  const offer = { id: `woffer_${randomUUID()}`, businessId: business.id, waitlistEntryId: entry.id, serviceId: entry.serviceId, startsAt: slotStart.toISOString(), endsAt: slotEnd.toISOString(), partySize: entry.partySize, tokenHash: hashToken(rawToken), status: "offered", expiresAt, acceptedAt: "", createdAt: now, updatedAt: now };
  db.bookingWaitlistOffers.push(offer);
  entry.status = "offered"; entry.offeredAt = now; entry.updatedAt = now;
  return { offer: publicOffer(offer), token: rawToken, entry };
}

export function resolveWaitlistOffer(db, token, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  expireWaitlistOffers(db, new Date(now));
  const offer = db.bookingWaitlistOffers.find((item) => item.tokenHash === hashToken(token));
  if (!offer || !["offered", "accepted"].includes(offer.status)) throw modelError(404, "Waitlist offer not found or expired");
  const entry = db.bookingWaitlist.find((item) => item.id === offer.waitlistEntryId && item.businessId === offer.businessId);
  if (!entry) throw modelError(404, "Waitlist entry not found");
  return { offer, entry };
}

export function acceptWaitlistOffer(db, token, now = new Date().toISOString()) {
  const context = resolveWaitlistOffer(db, token, now);
  context.offer.status = "accepted"; context.offer.acceptedAt ||= now; context.offer.updatedAt = now;
  context.entry.status = "accepted"; context.entry.updatedAt = now;
  return { offer: publicOffer(context.offer), entry: context.entry, bookingDraft: { serviceId: context.entry.serviceId, customerName: context.entry.customerName, phone: context.entry.phone, email: context.entry.email, contactId: context.entry.contactId, startsAt: context.offer.startsAt, endsAt: context.offer.endsAt, partySize: context.entry.partySize, notes: context.entry.notes, waitlistEntryId: context.entry.id, waitlistOfferId: context.offer.id } };
}

export function markWaitlistBooked(db, booking, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  const entry = db.bookingWaitlist.find((item) => item.businessId === booking.businessId && item.id === cleanId(booking.waitlistEntryId));
  if (!entry) return null;
  entry.status = "booked"; entry.bookingId = booking.id; entry.bookedAt = now; entry.updatedAt = now;
  const offer = db.bookingWaitlistOffers.find((item) => item.businessId === booking.businessId && item.id === cleanId(booking.waitlistOfferId));
  if (offer) { offer.status = "booked"; offer.bookingId = booking.id; offer.updatedAt = now; }
  return entry;
}

export function autoOfferFreedSlot(db, business, booking, now = new Date().toISOString()) {
  try { return offerWaitlistSlot(db, business, { serviceId: booking.serviceId, startsAt: booking.startsAt, endsAt: booking.endsAt, expiresInMinutes: 30 }, now); } catch (error) { if (error.statusCode === 404) return null; throw error; }
}

export function createBookingCheckoutRecord(db, business, booking, input, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  if (!(Number(booking.depositAmount || 0) > 0)) throw modelError(409, "This booking does not require a deposit");
  if (booking.depositStatus === "paid") throw modelError(409, "Booking deposit is already paid");
  const source = object(input);
  const idempotencyKey = clean(source.idempotencyKey) || `booking:${booking.id}:deposit`;
  const existing = db.bookingCheckouts.find((item) => item.businessId === business.id && item.idempotencyKey === idempotencyKey);
  if (existing) return { checkout: existing, duplicate: true };
  const checkout = { id: `bcheckout_${randomUUID()}`, businessId: business.id, bookingId: booking.id, amount: roundMoney(booking.depositAmount), currency: clean(booking.currency || business.currency || "EUR").toUpperCase(), status: "pending", idempotencyKey, provider: "", providerSessionId: "", providerPaymentId: "", checkoutUrl: "", expiresAt: "", paidAt: "", createdAt: now, updatedAt: now };
  db.bookingCheckouts.push(checkout);
  booking.depositStatus = "pending"; booking.updatedAt = now;
  return { checkout, duplicate: false };
}

export function applyBookingCheckoutProviderResult(db, checkoutId, provider, now = new Date().toISOString()) {
  const checkout = db.bookingCheckouts.find((item) => item.id === checkoutId);
  if (!checkout) throw modelError(404, "Booking checkout not found");
  Object.assign(checkout, { provider: clean(provider.provider), providerSessionId: clean(provider.providerSessionId), checkoutUrl: clean(provider.checkoutUrl), expiresAt: clean(provider.expiresAt), updatedAt: now });
  return checkout;
}

export function completeBookingCheckout(db, event, now = new Date().toISOString()) {
  ensureBookingResourceCollections(db);
  if (db.bookingPaymentEvents.some((item) => item.providerEventId === event.id)) return { completed: false, duplicate: true };
  const checkout = db.bookingCheckouts.find((item) => item.providerSessionId === event.providerSessionId);
  if (!checkout) return { completed: false, missing: true };
  checkout.status = "paid"; checkout.providerPaymentId = clean(event.providerPaymentId); checkout.paidAt = event.paidAt || now; checkout.updatedAt = now;
  const booking = db.bookings.find((item) => item.id === checkout.bookingId && item.businessId === checkout.businessId);
  if (booking) { booking.depositStatus = "paid"; booking.depositPaidAt = checkout.paidAt; booking.guaranteeStatus = "secured"; booking.updatedAt = now; }
  db.bookingPaymentEvents.push({ id: `bpayevt_${randomUUID()}`, businessId: checkout.businessId, bookingId: checkout.bookingId, checkoutId: checkout.id, providerEventId: event.id, providerPaymentId: clean(event.providerPaymentId), amount: checkout.amount, currency: checkout.currency, type: clean(event.type), createdAt: now });
  return { completed: true, checkout, booking };
}

export function applyBookingStatusPolicy(booking, previousStatus, now = new Date().toISOString()) {
  if (booking.status === "no-show" && previousStatus !== "no-show") {
    booking.noShowRecordedAt = now;
    if (booking.depositStatus === "paid") booking.depositStatus = "forfeited";
    if (booking.guaranteeRequired) booking.guaranteeStatus = "charge_due";
  }
  if (booking.status === "completed") {
    if (booking.guaranteeStatus === "secured") booking.guaranteeStatus = "released";
  }
  if (booking.status === "canceled" && previousStatus !== "canceled") booking.canceledAt = now;
  return booking;
}

export function bookingResourceSummary(db, businessId) {
  ensureBookingResourceCollections(db);
  const resources = db.bookingResources.filter((item) => item.businessId === businessId);
  const waitlist = db.bookingWaitlist.filter((item) => item.businessId === businessId);
  const bookings = db.bookings.filter((item) => item.businessId === businessId);
  return { resources: resources.length, activeResources: resources.filter((item) => item.active !== false).length, waiting: waitlist.filter((item) => item.status === "waiting").length, offered: waitlist.filter((item) => item.status === "offered").length, depositsPending: bookings.filter((item) => item.depositStatus === "pending").length, depositsPaid: bookings.filter((item) => item.depositStatus === "paid").length, noShows: bookings.filter((item) => item.status === "no-show").length };
}

function applicableResources(db, booking) { return db.bookingResources.filter((resource) => resource.businessId === booking.businessId && resource.active !== false && (!resource.serviceIds?.length || resource.serviceIds.includes(booking.serviceId)) && Number(resource.capacity || 1) >= Number(booking.partySize || 1)); }
function hasApplicableResources(db, booking) { return applicableResources(db, booking).length > 0; }
function isResourceAvailable(db, resource, booking, ignoredBookingId = "") { return !resourceAvailabilityReason(db, resource, booking, ignoredBookingId); }
function resourceAvailabilityReason(db, resource, booking, ignoredBookingId = "") {
  const start = new Date(booking.startsAt); const end = new Date(booking.endsAt);
  if (!(end > start)) return "invalid_dates";
  const exceptions = db.bookingResourceExceptions.filter((item) => item.resourceId === resource.id && item.active !== false && overlaps(start, end, new Date(item.startsAt), new Date(item.endsAt)));
  if (exceptions.some((item) => item.mode === "blocked")) return "exception_blocked";
  const forcedAvailable = exceptions.some((item) => item.mode === "available" && contains(new Date(item.startsAt), new Date(item.endsAt), start, end));
  if (!forcedAvailable && !matchesResourceSchedule(db, resource, start, end)) return "outside_schedule";
  const before = Number(resource.bufferBeforeMinutes || 0) * 60000; const after = Number(resource.bufferAfterMinutes || 0) * 60000;
  const overlapping = db.bookings.filter((item) => item.businessId === resource.businessId && item.id !== ignoredBookingId && OPEN_STATUSES.has(item.status) && uniqueIds(item.resourceIds).includes(resource.id) && overlaps(new Date(start.getTime() - before), new Date(end.getTime() + after), new Date(new Date(item.startsAt).getTime() - before), new Date(new Date(item.endsAt).getTime() + after)));
  if (resource.type === "capacity") { const occupied = overlapping.reduce((sum, item) => sum + Number(item.partySize || 1), 0); if (occupied + Number(booking.partySize || 1) > Number(resource.capacity || 1)) return "capacity_exceeded"; }
  else if (overlapping.length >= Number(resource.simultaneousCapacity || 1)) return "already_assigned";
  return "";
}
function matchesResourceSchedule(db, resource, start, end) {
  const rules = db.bookingResourceSchedules.filter((item) => item.resourceId === resource.id && item.active !== false);
  if (!rules.length) return true;
  if (start.toDateString() !== end.toDateString()) return false;
  const startMinutes = start.getHours() * 60 + start.getMinutes(); const endMinutes = end.getHours() * 60 + end.getMinutes();
  return rules.some((rule) => Number(rule.weekday) === start.getDay() && startMinutes >= minutes(rule.startTime) && endMinutes <= minutes(rule.endTime));
}
function normalizeScheduleRule(input, resource, index, now) { const source = object(input); const weekday = integer(source.weekday, 0, 6); const startTime = time(source.startTime || source.start); const endTime = time(source.endTime || source.end); if (minutes(endTime) <= minutes(startTime)) throw modelError(400, "Schedule end must be after start"); return { id: cleanId(source.id) || `rsched_${resource.id}_${weekday}_${index}`, businessId: resource.businessId, resourceId: resource.id, weekday, startTime, endTime, active: boolean(source.active, true), createdAt: clean(source.createdAt) || now, updatedAt: now }; }
function calculateNoShowRisk(db, booking, now) { const prior = db.bookings.filter((item) => item.businessId === booking.businessId && item.id !== booking.id && ((booking.contactId && item.contactId === booking.contactId) || (booking.email && item.email === booking.email) || (booking.phone && item.phone === booking.phone))); const noShows = prior.filter((item) => item.status === "no-show").length; let score = Math.min(60, noShows * 30); const hours = (new Date(booking.startsAt) - now) / 3600000; if (hours < 24) score += 10; if (booking.depositRequired && booking.depositStatus !== "paid") score += 20; if (!booking.lastReminderAt) score += 10; score = Math.min(100, score); return { score, level: score >= 70 ? "high" : score >= 35 ? "medium" : "low", priorNoShows: noShows, recommendedAction: score >= 70 ? "Exigir señal y confirmación" : score >= 35 ? "Enviar recordatorio y confirmar" : "Seguimiento normal" }; }
function bookingDepositSummary(booking) { return { required: Boolean(booking.depositRequired), mode: clean(booking.depositMode || "none"), amount: Number(booking.depositAmount || 0), status: clean(booking.depositStatus || (booking.depositRequired ? "pending" : "not_required")), currency: clean(booking.currency || "EUR"), guaranteeRequired: Boolean(booking.guaranteeRequired), guaranteeStatus: clean(booking.guaranteeStatus || "not_required") }; }
function waitlistMatchesSlot(entry, start, end) { const desired = new Date(entry.desiredStartsAt).getTime(); const flex = Number(entry.flexibleMinutes || 0) * 60000; return start.getTime() >= desired - flex && start.getTime() <= desired + flex && end > start; }
function expireWaitlistOffers(db, now) { for (const offer of db.bookingWaitlistOffers) { if (offer.status === "offered" && new Date(offer.expiresAt) <= now) { offer.status = "expired"; offer.updatedAt = now.toISOString(); const entry = db.bookingWaitlist.find((item) => item.id === offer.waitlistEntryId); if (entry?.status === "offered") { entry.status = "waiting"; entry.updatedAt = now.toISOString(); } } } }
function publicResource(resource) { const { businessId, ...result } = resource; return result; }
function publicOffer(offer) { const { tokenHash, ...result } = offer; return result; }
function hashToken(value) { return createHash("sha256").update(clean(value)).digest("hex"); }
function normalizeColor(value) { const color = clean(value || "#2563eb"); return /^#[0-9a-f]{6}$/i.test(color) ? color : "#2563eb"; }
function time(value) { const result = clean(value); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) throw modelError(400, "Invalid time"); return result; }
function minutes(value) { const [hours, mins] = String(value).split(":").map(Number); return hours * 60 + mins; }
function validDate(value, message) { const date = new Date(value || ""); if (Number.isNaN(date.getTime())) throw modelError(400, message); return date; }
function contains(startA, endA, startB, endB) { return startB >= startA && endB <= endA; }
function overlaps(startA, endA, startB, endB) { return startA < endB && endA > startB; }
function uniqueIds(value) { return [...new Set(array(value).map(cleanId).filter(Boolean))]; }
function uniqueStrings(value) { return [...new Set(array(value).map((item) => clean(item).toLowerCase()).filter(Boolean))]; }
function array(value) { return Array.isArray(value) ? value : value === undefined || value === null || value === "" ? [] : [value]; }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function clean(value) { return String(value ?? "").trim(); }
function cleanId(value) { return clean(value).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 180); }
function boolean(value, fallback) { if (value === undefined || value === null || value === "") return Boolean(fallback); if (typeof value === "boolean") return value; return !["false", "0", "no", "off"].includes(clean(value).toLowerCase()); }
function integer(value, min, max) { const number = Math.round(Number(value)); return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min)); }
function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function modelError(statusCode, message, code = "booking_resource_error") { return Object.assign(new Error(message), { statusCode, code }); }
