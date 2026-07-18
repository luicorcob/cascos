import { createHash, randomBytes, randomUUID } from "node:crypto";

const EXPERIENCE_TYPES = new Set(["experience", "menu", "event"]);
const DEPOSIT_MODES = new Set(["none", "fixed", "percent", "full"]);
const POLICY_EVENT_TYPES = new Set(["accepted", "refund_requested", "refund_approved", "refunded", "refund_rejected", "dispute_opened", "dispute_resolved"]);

export function ensureVerticalOperationsCollections(db) {
  for (const key of [
    "hospitalityZones",
    "hospitalityTableCombinations",
    "hospitalityServiceShifts",
    "hospitalityExperiences",
    "bookingPolicies",
    "bookingPolicyEvents",
    "bookingReminderConfirmations",
    "operationalAlerts"
  ]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  for (const key of ["bookingResources", "bookings", "services", "hospitalityInventory", "hospitalityShifts", "hospitalityEmployees", "contacts"]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  return db;
}

export function upsertHospitalityZone(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const source = object(input?.zone || input);
  const resourceIds = ids(source.resourceIds ?? existing?.resourceIds);
  for (const resourceId of resourceIds) {
    const resource = db.bookingResources.find((item) => item.businessId === businessId && item.id === resourceId && item.active !== false);
    if (!resource || !["table", "room", "capacity"].includes(resource.type)) throw verticalError(404, "Zone resource must be an active table, room or capacity");
  }
  const zone = {
    id: existing?.id || `zone_${randomUUID()}`,
    businessId,
    name: required(source.name || existing?.name, "Zone name is required").slice(0, 120),
    description: clean(source.description ?? existing?.description).slice(0, 500),
    resourceIds,
    capacity: integer(source.capacity ?? existing?.capacity ?? resourceIds.reduce((sum, id) => sum + Number(db.bookingResources.find((item) => item.id === id)?.capacity || 0), 0), 1, 10000),
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, zone); else db.hospitalityZones.push(zone);
  return zone;
}

export function upsertTableCombination(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const source = object(input?.combination || input);
  const tableResourceIds = ids(source.tableResourceIds ?? existing?.tableResourceIds);
  if (tableResourceIds.length < 2) throw verticalError(400, "A table combination needs at least two tables");
  const tables = tableResourceIds.map((id) => db.bookingResources.find((item) => item.businessId === businessId && item.id === id && item.type === "table" && item.active !== false));
  if (tables.some((item) => !item)) throw verticalError(404, "Table combination contains an unavailable table");
  const zoneId = clean(source.zoneId || existing?.zoneId);
  const zone = db.hospitalityZones.find((item) => item.businessId === businessId && item.id === zoneId && item.active !== false);
  if (!zone) throw verticalError(404, "Zone not found");
  if (tableResourceIds.some((id) => !zone.resourceIds.includes(id))) throw verticalError(409, "Every combined table must belong to the selected zone");
  const capacity = tables.reduce((sum, item) => sum + Number(item.capacity || 1), 0);
  const combination = {
    id: existing?.id || `table_combo_${randomUUID()}`,
    businessId,
    zoneId,
    name: required(source.name || existing?.name, "Combination name is required").slice(0, 120),
    tableResourceIds,
    minGuests: integer(source.minGuests ?? existing?.minGuests ?? Math.max(2, capacity - 2), 1, capacity),
    maxGuests: integer(source.maxGuests ?? existing?.maxGuests ?? capacity, 1, capacity),
    setupMinutes: integer(source.setupMinutes ?? existing?.setupMinutes ?? 10, 0, 240),
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (combination.minGuests > combination.maxGuests) throw verticalError(400, "minGuests cannot exceed maxGuests");
  if (existing) Object.assign(existing, combination); else db.hospitalityTableCombinations.push(combination);
  return combination;
}

export function upsertServiceShift(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const source = object(input?.shift || input);
  const startTime = time(source.startTime || existing?.startTime || "13:00");
  const endTime = time(source.endTime || existing?.endTime || "16:00");
  if (minutes(endTime) <= minutes(startTime)) throw verticalError(400, "Service shift end must be after start");
  const shift = {
    id: existing?.id || `service_shift_${randomUUID()}`,
    businessId,
    name: required(source.name || existing?.name, "Service shift name is required").slice(0, 100),
    weekdays: uniqueIntegers(source.weekdays ?? existing?.weekdays ?? [1, 2, 3, 4, 5, 6, 0], 0, 6),
    startTime,
    endTime,
    expectedDurationMinutes: integer(source.expectedDurationMinutes ?? existing?.expectedDurationMinutes ?? 90, 15, 480),
    turnoverBufferMinutes: integer(source.turnoverBufferMinutes ?? existing?.turnoverBufferMinutes ?? 15, 0, 180),
    maxCovers: integer(source.maxCovers ?? existing?.maxCovers ?? 80, 1, 10000),
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, shift); else db.hospitalityServiceShifts.push(shift);
  return shift;
}

export function upsertBookingPolicy(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const source = object(input?.policy || input);
  const policy = {
    id: existing?.id || `booking_policy_${randomUUID()}`,
    businessId,
    name: required(source.name || existing?.name, "Policy name is required").slice(0, 140),
    version: clean(source.version || existing?.version || "v1").slice(0, 40),
    visibleText: required(source.visibleText || existing?.visibleText, "Visible policy text is required").slice(0, 10000),
    cancellationHours: integer(source.cancellationHours ?? existing?.cancellationHours ?? 24, 0, 8760),
    refundPercentBeforeDeadline: percentage(source.refundPercentBeforeDeadline ?? existing?.refundPercentBeforeDeadline ?? 100),
    refundPercentAfterDeadline: percentage(source.refundPercentAfterDeadline ?? existing?.refundPercentAfterDeadline ?? 0),
    noShowDepositTreatment: enumValue(source.noShowDepositTreatment || existing?.noShowDepositTreatment || "forfeit", ["forfeit", "refund", "review"], "Invalid no-show deposit treatment"),
    disputeInstructions: clean(source.disputeInstructions ?? existing?.disputeInstructions).slice(0, 2000),
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, policy); else db.bookingPolicies.push(policy);
  return policy;
}

export function upsertHospitalityExperience(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const source = object(input?.experience || input);
  const type = clean(source.type || existing?.type || "experience").toLowerCase();
  if (!EXPERIENCE_TYPES.has(type)) throw verticalError(400, "Unsupported experience type");
  const policyId = clean(source.policyId || existing?.policyId);
  if (policyId && !db.bookingPolicies.some((item) => item.businessId === businessId && item.id === policyId && item.active !== false)) throw verticalError(404, "Booking policy not found");
  const serviceId = clean(source.serviceId || existing?.serviceId);
  if (serviceId && !db.services.some((item) => item.businessId === businessId && item.id === serviceId)) throw verticalError(404, "Service not found");
  const experience = {
    id: existing?.id || `experience_${randomUUID()}`,
    businessId,
    name: required(source.name || existing?.name, "Experience name is required").slice(0, 160),
    description: clean(source.description ?? existing?.description).slice(0, 3000),
    type,
    serviceId,
    zoneIds: ids(source.zoneIds ?? existing?.zoneIds),
    serviceShiftIds: ids(source.serviceShiftIds ?? existing?.serviceShiftIds),
    minGuests: integer(source.minGuests ?? existing?.minGuests ?? 1, 1, 10000),
    maxGuests: integer(source.maxGuests ?? existing?.maxGuests ?? 20, 1, 10000),
    durationMinutes: integer(source.durationMinutes ?? existing?.durationMinutes ?? 90, 15, 720),
    capacity: integer(source.capacity ?? existing?.capacity ?? source.maxGuests ?? existing?.maxGuests ?? 20, 1, 100000),
    startsAt: isoOrEmpty(source.startsAt ?? existing?.startsAt),
    endsAt: isoOrEmpty(source.endsAt ?? existing?.endsAt),
    inventoryRules: normalizeInventoryRules(db, businessId, source.inventoryRules ?? existing?.inventoryRules),
    depositRules: normalizeDepositRules(source.depositRules ?? existing?.depositRules),
    policyId,
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (experience.minGuests > experience.maxGuests) throw verticalError(400, "minGuests cannot exceed maxGuests");
  if (experience.startsAt && experience.endsAt && experience.endsAt <= experience.startsAt) throw verticalError(400, "Experience end must be after start");
  if (existing) Object.assign(existing, experience); else db.hospitalityExperiences.push(experience);
  return experience;
}

export function resolveExperienceDepositRule(experience, bookingDate, segments = []) {
  const date = String(bookingDate || "").slice(0, 10);
  const segmentSet = new Set(array(segments).map(clean));
  const matching = array(experience?.depositRules)
    .filter((rule) => (!rule.validFrom || date >= rule.validFrom) && (!rule.validTo || date <= rule.validTo))
    .filter((rule) => !rule.segments.length || rule.segments.some((item) => segmentSet.has(item)))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  return matching[0] || { id: "default-none", mode: "none", value: 0, segments: [], validFrom: "", validTo: "", priority: -1 };
}

export function acceptBookingPolicy(db, businessId, bookingId, input, actor = {}, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const booking = db.bookings.find((item) => item.businessId === businessId && item.id === bookingId);
  if (!booking) throw verticalError(404, "Booking not found");
  const source = object(input);
  const policy = db.bookingPolicies.find((item) => item.businessId === businessId && item.id === clean(source.policyId) && item.active !== false);
  if (!policy) throw verticalError(404, "Booking policy not found");
  const duplicate = db.bookingPolicyEvents.find((item) => item.businessId === businessId && item.bookingId === bookingId && item.type === "accepted" && item.policyId === policy.id && item.policyVersion === policy.version);
  if (duplicate) return { event: duplicate, duplicate: true };
  const event = {
    id: `booking_policy_event_${randomUUID()}`,
    businessId,
    bookingId,
    policyId: policy.id,
    policyVersion: policy.version,
    policyTextSnapshot: policy.visibleText,
    type: "accepted",
    amount: 0,
    currency: clean(booking.currency || "EUR").toUpperCase(),
    reason: clean(source.reason || "Consentimiento al reservar").slice(0, 500),
    evidence: {
      channel: clean(source.channel || "dashboard"),
      ipHash: source.ip ? hash(source.ip) : "",
      userAgentHash: source.userAgent ? hash(source.userAgent) : "",
      checkbox: source.accepted === true
    },
    actorType: clean(actor.type || "contact"),
    actorId: clean(actor.id || actor.userId || booking.contactId || "guest"),
    createdAt: now
  };
  if (source.accepted !== true) throw verticalError(400, "Policy must be explicitly accepted");
  db.bookingPolicyEvents.push(event);
  booking.policyId = policy.id;
  booking.policyVersion = policy.version;
  booking.policyAcceptedAt = now;
  booking.updatedAt = now;
  return { event, duplicate: false };
}

export function recordBookingPolicyEvent(db, businessId, bookingId, input, actor = {}, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const booking = db.bookings.find((item) => item.businessId === businessId && item.id === bookingId);
  if (!booking) throw verticalError(404, "Booking not found");
  const source = object(input);
  const type = clean(source.type);
  if (!POLICY_EVENT_TYPES.has(type) || type === "accepted") throw verticalError(400, "Unsupported refund or dispute event");
  const amount = Math.max(0, number(source.amount));
  const event = {
    id: `booking_policy_event_${randomUUID()}`,
    businessId,
    bookingId,
    policyId: clean(booking.policyId || source.policyId),
    policyVersion: clean(booking.policyVersion || source.policyVersion),
    policyTextSnapshot: "",
    type,
    amount: round(amount),
    currency: clean(source.currency || booking.currency || "EUR").toUpperCase(),
    reason: required(source.reason, "Refund or dispute reason is required").slice(0, 1000),
    evidence: object(source.evidence),
    actorType: clean(actor.type || "admin"),
    actorId: clean(actor.id || actor.userId || "admin"),
    createdAt: now
  };
  db.bookingPolicyEvents.push(event);
  if (type === "refunded") {
    booking.depositStatus = "refunded";
    booking.depositRefundedAmount = event.amount;
    booking.depositRefundedAt = now;
  } else if (type === "dispute_opened") booking.depositStatus = "disputed";
  else if (type === "dispute_resolved" && booking.depositStatus === "disputed") booking.depositStatus = clean(source.resolution || "paid");
  booking.updatedAt = now;
  return event;
}

export function createReminderConfirmation(db, businessId, bookingId, input = {}, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const booking = db.bookings.find((item) => item.businessId === businessId && item.id === bookingId);
  if (!booking) throw verticalError(404, "Booking not found");
  const source = object(input);
  const rawToken = randomBytes(32).toString("base64url");
  const existing = db.bookingReminderConfirmations.find((item) => item.businessId === businessId && item.bookingId === bookingId && item.status === "pending" && item.expiresAt > now);
  if (existing) return { confirmation: publicConfirmation(existing), token: "", duplicate: true };
  const confirmation = {
    id: `booking_confirm_${randomUUID()}`,
    businessId,
    bookingId,
    tokenHash: hash(rawToken),
    status: "pending",
    expiresAt: new Date(new Date(now).getTime() + integer(source.expiresInHours ?? 48, 1, 336) * 3600000).toISOString(),
    confirmedAt: "",
    declinedAt: "",
    createdAt: now,
    updatedAt: now
  };
  db.bookingReminderConfirmations.push(confirmation);
  return { confirmation: publicConfirmation(confirmation), token: rawToken, duplicate: false };
}

export function resolveReminderConfirmation(db, token, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const confirmation = db.bookingReminderConfirmations.find((item) => item.tokenHash === hash(token));
  if (!confirmation || confirmation.expiresAt <= now) throw verticalError(404, "Booking confirmation not found or expired");
  const booking = db.bookings.find((item) => item.businessId === confirmation.businessId && item.id === confirmation.bookingId);
  if (!booking) throw verticalError(404, "Booking not found");
  const business = db.businesses.find((item) => item.id === confirmation.businessId);
  return { confirmation, booking, business };
}

export function answerReminderConfirmation(db, token, decision, now = new Date().toISOString()) {
  const resolved = resolveReminderConfirmation(db, token, now);
  if (!["confirm", "decline"].includes(decision)) throw verticalError(400, "Decision must be confirm or decline");
  if (resolved.confirmation.status !== "pending") return { ...resolved, duplicate: true };
  resolved.confirmation.status = decision === "confirm" ? "confirmed" : "declined";
  resolved.confirmation.confirmedAt = decision === "confirm" ? now : "";
  resolved.confirmation.declinedAt = decision === "decline" ? now : "";
  resolved.confirmation.updatedAt = now;
  resolved.booking.customerConfirmationStatus = resolved.confirmation.status;
  resolved.booking.customerConfirmedAt = resolved.confirmation.confirmedAt;
  if (decision === "decline") resolved.booking.status = "canceled";
  resolved.booking.updatedAt = now;
  return { ...resolved, duplicate: false };
}

export function assignTableCombination(db, businessId, bookingId, combinationId, now = new Date().toISOString()) {
  ensureVerticalOperationsCollections(db);
  const booking = db.bookings.find((item) => item.businessId === businessId && item.id === bookingId);
  if (!booking) throw verticalError(404, "Booking not found");
  const combination = db.hospitalityTableCombinations.find((item) => item.businessId === businessId && item.id === combinationId && item.active !== false);
  if (!combination) throw verticalError(404, "Table combination not found");
  const partySize = Number(booking.partySize || 1);
  if (partySize < combination.minGuests || partySize > combination.maxGuests) throw verticalError(409, "Party size does not fit this table combination");
  booking.tableCombinationId = combination.id;
  booking.zoneId = combination.zoneId;
  booking.resourceIds = [...combination.tableResourceIds];
  booking.updatedAt = now;
  return { booking, combination };
}

export function buildVerticalOperationsCenter(db, businessId, options = {}) {
  ensureVerticalOperationsCollections(db);
  const planning = buildOperationalPlanning(db, businessId, options);
  return {
    zones: db.hospitalityZones.filter((item) => item.businessId === businessId && item.active !== false),
    tableCombinations: db.hospitalityTableCombinations.filter((item) => item.businessId === businessId && item.active !== false),
    serviceShifts: db.hospitalityServiceShifts.filter((item) => item.businessId === businessId && item.active !== false),
    experiences: db.hospitalityExperiences.filter((item) => item.businessId === businessId && item.active !== false),
    policies: db.bookingPolicies.filter((item) => item.businessId === businessId && item.active !== false),
    policyEvents: db.bookingPolicyEvents.filter((item) => item.businessId === businessId).slice(-100).reverse(),
    reminderConfirmations: db.bookingReminderConfirmations.filter((item) => item.businessId === businessId).map(publicConfirmation),
    planning
  };
}

export function buildOperationalPlanning(db, businessId, options = {}) {
  ensureVerticalOperationsCollections(db);
  const startDate = validDateOnly(options.startDate) || new Date().toISOString().slice(0, 10);
  const days = integer(options.days ?? 7, 1, 31);
  const dates = Array.from({ length: days }, (_, index) => addDays(startDate, index));
  const resources = db.bookingResources.filter((item) => item.businessId === businessId && item.active !== false && ["table", "room", "capacity"].includes(item.type));
  const baseCapacity = Math.max(1, resources.reduce((sum, item) => sum + Number(item.capacity || 1), 0));
  const bookings = db.bookings.filter((item) => item.businessId === businessId && !["canceled", "no-show"].includes(item.status));
  const shifts = db.hospitalityShifts.filter((item) => item.businessId === businessId && item.status !== "absent");
  const history = bookings.filter((item) => String(item.startsAt || "").slice(0, 10) < startDate);
  const daily = dates.map((date) => {
    const dayBookings = bookings.filter((item) => String(item.startsAt || "").slice(0, 10) === date);
    const covers = dayBookings.reduce((sum, item) => sum + Number(item.partySize || 1), 0);
    const serviceDuration = average(dayBookings.map((item) => Math.max(0, (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000)).filter(Number.isFinite)) || 90;
    const turns = Math.max(1, round(240 / Math.max(30, serviceDuration)));
    const capacity = baseCapacity * turns;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const samples = history.filter((item) => new Date(item.startsAt).getUTCDay() === weekday);
    const historicalDemand = average(samples.map((item) => Number(item.partySize || 1)));
    const demandForecast = round(Math.max(covers, historicalDemand * Math.max(1, samples.length ? Math.min(8, samples.length) : 1)));
    const scheduledHours = round(shifts.filter((item) => item.date === date).reduce((sum, item) => sum + shiftHours(item), 0));
    const requiredHours = round(Math.max(0, demandForecast / 12 * 4));
    return {
      date,
      bookings: dayBookings.length,
      covers,
      capacity,
      occupancyPercent: round(Math.min(100, covers / capacity * 100)),
      expectedRotationMinutes: round(serviceDuration),
      demandForecast,
      demandSampleSize: samples.length,
      scheduledStaffHours: scheduledHours,
      requiredStaffHours: requiredHours,
      staffGapHours: round(Math.max(0, requiredHours - scheduledHours))
    };
  });
  const stock = buildStockProjection(db, businessId, bookings, dates);
  const alerts = buildOperationalAlerts(businessId, daily, stock);
  db.operationalAlerts = db.operationalAlerts.filter((item) => item.businessId !== businessId).concat(alerts);
  return {
    period: { startDate, endDate: dates.at(-1), days },
    daily,
    stock,
    alerts,
    summary: {
      averageOccupancyPercent: round(average(daily.map((item) => item.occupancyPercent))),
      forecastCovers: round(daily.reduce((sum, item) => sum + item.demandForecast, 0)),
      staffGapHours: round(daily.reduce((sum, item) => sum + item.staffGapHours, 0)),
      criticalStockItems: stock.filter((item) => item.critical).length,
      alerts: alerts.length
    }
  };
}

function buildStockProjection(db, businessId, bookings, dates) {
  const dateSet = new Set(dates);
  const experiences = db.hospitalityExperiences.filter((item) => item.businessId === businessId && item.active !== false);
  const inventory = db.hospitalityInventory.filter((item) => item.businessId === businessId && item.active !== false);
  return inventory.map((item) => {
    let projectedUse = 0;
    for (const booking of bookings.filter((candidate) => dateSet.has(String(candidate.startsAt || "").slice(0, 10)))) {
      const experience = experiences.find((candidate) => candidate.id === booking.experienceId || (candidate.serviceId && candidate.serviceId === booking.serviceId));
      const rule = experience?.inventoryRules?.find((candidate) => candidate.inventoryItemId === item.id);
      projectedUse += Number(rule?.quantityPerGuest || 0) * Number(booking.partySize || 1);
    }
    const projectedStock = round(Number(item.currentStock || 0) - projectedUse);
    return {
      inventoryItemId: item.id,
      name: item.name,
      currentStock: Number(item.currentStock || 0),
      minStock: Number(item.minStock || 0),
      projectedUse: round(projectedUse),
      projectedStock,
      unit: item.unit,
      critical: projectedStock <= Number(item.minStock || 0),
      sourceUrl: `?tab=inventory&item=${encodeURIComponent(item.id)}`
    };
  });
}

function buildOperationalAlerts(businessId, daily, stock) {
  const alerts = [];
  for (const day of daily) {
    if (day.occupancyPercent >= 85) alerts.push(alert(businessId, "occupancy", "high", `Ocupación alta el ${day.date}`, `${day.occupancyPercent}% previsto con ${day.covers} cubiertos`, `?tab=bookings&date=${day.date}`, { date: day.date, occupancyPercent: day.occupancyPercent }));
    if (day.staffGapHours > 0) alerts.push(alert(businessId, "staff", day.staffGapHours >= 8 ? "critical" : "high", `Faltan ${day.staffGapHours} h de personal`, `Demanda prevista de ${day.demandForecast} cubiertos`, `?tab=team&date=${day.date}`, { date: day.date, staffGapHours: day.staffGapHours }));
  }
  for (const item of stock.filter((candidate) => candidate.critical)) {
    alerts.push(alert(businessId, "stock", item.projectedStock < 0 ? "critical" : "high", `Stock crítico: ${item.name}`, `Proyección ${item.projectedStock} ${item.unit}; mínimo ${item.minStock}`, item.sourceUrl, { inventoryItemId: item.inventoryItemId, projectedStock: item.projectedStock }));
  }
  return alerts;
}

function alert(businessId, type, severity, title, reason, sourceUrl, evidence) {
  return { id: `opalert_${hash(`${businessId}:${type}:${title}`).slice(0, 18)}`, businessId, type, severity, title, reason, sourceUrl, evidence, status: "open", createdAt: new Date().toISOString() };
}

function normalizeInventoryRules(db, businessId, value) {
  return array(value).map((item) => {
    const inventoryItemId = clean(item?.inventoryItemId);
    if (!db.hospitalityInventory.some((candidate) => candidate.businessId === businessId && candidate.id === inventoryItemId && candidate.active !== false)) throw verticalError(404, "Experience inventory item not found");
    return { inventoryItemId, quantityPerGuest: positive(item?.quantityPerGuest, "quantityPerGuest") };
  });
}

function normalizeDepositRules(value) {
  return array(value).map((item, index) => {
    const mode = clean(item?.mode || "none");
    if (!DEPOSIT_MODES.has(mode)) throw verticalError(400, "Unsupported deposit rule mode");
    const rule = {
      id: clean(item?.id) || `deposit_rule_${index + 1}`,
      validFrom: validDateOnly(item?.validFrom),
      validTo: validDateOnly(item?.validTo),
      segments: ids(item?.segments),
      mode,
      value: mode === "none" ? 0 : positive(item?.value, "deposit rule value"),
      priority: integer(item?.priority ?? 0, -100, 100)
    };
    if (rule.validFrom && rule.validTo && rule.validTo < rule.validFrom) throw verticalError(400, "Deposit rule validTo cannot precede validFrom");
    if (mode === "percent" && rule.value > 100) throw verticalError(400, "Deposit percent cannot exceed 100");
    return rule;
  });
}

function publicConfirmation(item) { const { tokenHash, ...result } = item; return result; }
function shiftHours(shift) { return Math.max(0, (minutes(shift.endTime) - minutes(shift.startTime)) / 60); }
function average(values) { return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0; }
function addDays(dateValue, days) { const date = new Date(`${dateValue}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function validDateOnly(value) { const result = clean(value); return /^\d{4}-\d{2}-\d{2}$/.test(result) && Number.isFinite(Date.parse(`${result}T12:00:00Z`)) ? result : ""; }
function isoOrEmpty(value) { if (!value) return ""; const timestamp = Date.parse(value); if (!Number.isFinite(timestamp)) throw verticalError(400, "Invalid date"); return new Date(timestamp).toISOString(); }
function enumValue(value, allowed, message) { const result = clean(value); if (!allowed.includes(result)) throw verticalError(400, message); return result; }
function percentage(value) { const result = number(value); if (result < 0 || result > 100) throw verticalError(400, "Percentage must be between 0 and 100"); return round(result); }
function positive(value, field) { const result = number(value); if (!(result > 0)) throw verticalError(400, `${field} must be positive`); return round(result); }
function required(value, message) { const result = clean(value); if (!result) throw verticalError(400, message); return result; }
function time(value) { const result = clean(value); if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result)) throw verticalError(400, "Time must use HH:MM"); return result; }
function minutes(value) { const [hours, mins] = clean(value).split(":").map(Number); return hours * 60 + mins; }
function uniqueIntegers(value, min, max) { return [...new Set(array(value).map((item) => integer(item, min, max)))]; }
function ids(value) { return [...new Set(array(value).map(clean).filter(Boolean))]; }
function integer(value, min, max) { const result = Math.round(number(value)); return Math.min(max, Math.max(min, result)); }
function round(value) { return Math.round((number(value) + Number.EPSILON) * 100) / 100; }
function number(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function hash(value) { return createHash("sha256").update(clean(value)).digest("hex"); }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function clean(value) { return String(value ?? "").trim(); }
function verticalError(statusCode, message, code = "vertical_operations_error") { return Object.assign(new Error(message), { statusCode, code }); }
