const OPEN_LEAD_STATUSES = new Set(["new", "contacted", "waiting", "reserved"]);
const CUSTOMER_STATUSES = new Set(["won", "customer"]);
const ACTIVE_NEXT_ACTION_STATUSES = new Set(["pendiente", "pending", "vencida", "overdue"]);

export function buildDataQualityReport(db, business, options = {}) {
  const generatedAt = validDate(options.now)?.toISOString() || new Date().toISOString();
  const businessId = clean(business?.id);
  const contacts = (Array.isArray(db?.contacts) ? db.contacts : [])
    .filter((contact) => contact?.businessId === businessId && !contact?.merged);

  const contactsMissingPhoneOrEmail = contacts
    .map((contact) => {
      const missingFields = [
        clean(contact?.phone) ? "" : "phone",
        clean(contact?.email) ? "" : "email"
      ].filter(Boolean);

      return missingFields.length
        ? { ...contactSummary(contact), missingFields }
        : null;
    })
    .filter(Boolean)
    .sort(compareContactSummaries);
  const contactsWithoutAnyChannel = contactsMissingPhoneOrEmail
    .filter((contact) => contact.missingFields.length === 2).length;

  const openLeadsWithoutPendingNextAction = contacts
    .filter(isOpenLead)
    .filter((contact) => !hasPendingNextAction(contact?.nextAction))
    .map((contact) => ({
      ...contactSummary(contact),
      nextAction: null,
      lastInteractionAt: clean(contact?.lastInteractionAt)
    }))
    .sort(compareContactSummaries);

  const customersWithoutConsent = contacts
    .filter(isCustomer)
    .filter((contact) => contact?.privacyAccepted !== true)
    .map((contact) => ({
      ...contactSummary(contact),
      privacyAccepted: false
    }))
    .sort(compareContactSummaries);

  const reviewUrl = findReviewUrl(business);
  const bookingUrl = findBookingUrl(business);
  const missingReviewUrl = !reviewUrl;
  const missingBookingUrl = !bookingUrl;
  const businessConfigurationIssues = Number(missingReviewUrl) + Number(missingBookingUrl);

  return {
    business: {
      id: businessId,
      name: clean(business?.name)
    },
    generatedAt,
    counts: {
      totalContacts: contacts.length,
      contactsMissingPhoneOrEmail: contactsMissingPhoneOrEmail.length,
      contactsWithoutAnyChannel,
      openLeadsWithoutPendingNextAction: openLeadsWithoutPendingNextAction.length,
      customersWithoutConsent: customersWithoutConsent.length,
      businessConfigurationIssues,
      totalFindings: contactsMissingPhoneOrEmail.length
        + openLeadsWithoutPendingNextAction.length
        + customersWithoutConsent.length
        + businessConfigurationIssues
    },
    businessConfiguration: {
      missingReviewUrl,
      missingBookingUrl,
      reviewUrl,
      bookingUrl
    },
    contactsMissingPhoneOrEmail,
    openLeadsWithoutPendingNextAction,
    customersWithoutConsent
  };
}

export function hasPendingNextAction(nextAction) {
  if (!nextAction || typeof nextAction !== "object" || Array.isArray(nextAction)) {
    return false;
  }

  return ACTIVE_NEXT_ACTION_STATUSES.has(normalizeToken(nextAction.status));
}

export function isUsableBookingUrl(value) {
  const url = normalizeOperationalUrl(value);

  if (!url || url.startsWith("/")) {
    return Boolean(url);
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return !(
      parsed.protocol === "whatsapp:"
      || hostname === "wa.me"
      || hostname.endsWith(".wa.me")
      || hostname === "whatsapp.com"
      || hostname.endsWith(".whatsapp.com")
    );
  } catch {
    return false;
  }
}

function findReviewUrl(business) {
  const content = objectValue(business?.content);
  const contentGoogle = objectValue(content.google);
  const integrations = objectValue(business?.integrations);
  const integrationGoogle = objectValue(integrations.google);
  const candidates = [
    contentGoogle.reviewUrl,
    content.reviewUrl,
    integrationGoogle.reviewUrl,
    integrations.reviewUrl,
    business?.reviewUrl
  ];

  return firstOperationalUrl(candidates);
}

function findBookingUrl(business) {
  const content = objectValue(business?.content);
  const contentGoogle = objectValue(content.google);
  const contentBooking = objectValue(content.booking);
  const integrations = objectValue(business?.integrations);
  const integrationGoogle = objectValue(integrations.google);
  const integrationBooking = objectValue(integrations.booking);
  const candidates = [
    content.bookingUrl,
    content.appointmentUrl,
    contentBooking.url,
    contentBooking.bookingUrl,
    contentBooking.appointmentUrl,
    contentGoogle.appointmentUrl,
    contentGoogle.bookingUrl,
    integrationBooking.url,
    integrationBooking.bookingUrl,
    integrationBooking.appointmentUrl,
    integrationGoogle.appointmentUrl,
    integrationGoogle.bookingUrl,
    business?.bookingUrl,
    business?.appointmentUrl
  ];

  return candidates
    .map(normalizeOperationalUrl)
    .find((url) => isUsableBookingUrl(url)) || "";
}

function firstOperationalUrl(values) {
  return values.map(normalizeOperationalUrl).find(Boolean) || "";
}

function normalizeOperationalUrl(value) {
  const candidate = clean(value).slice(0, 2000);

  if (!candidate) {
    return "";
  }

  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

function isOpenLead(contact) {
  return normalizeToken(contact?.type) !== "customer"
    && OPEN_LEAD_STATUSES.has(normalizeToken(contact?.status));
}

function isCustomer(contact) {
  return normalizeToken(contact?.type) === "customer"
    || CUSTOMER_STATUSES.has(normalizeToken(contact?.status));
}

function contactSummary(contact) {
  return {
    id: clean(contact?.id),
    businessId: clean(contact?.businessId),
    name: clean(contact?.name || contact?.fullName || contact?.email || contact?.phone || "Contacto sin nombre"),
    type: normalizeToken(contact?.type) || "lead",
    status: normalizeToken(contact?.status) || "new",
    phone: clean(contact?.phone),
    email: clean(contact?.email),
    source: clean(contact?.source || "manual"),
    createdAt: validDate(contact?.createdAt)?.toISOString() || ""
  };
}

function compareContactSummaries(left, right) {
  return left.name.localeCompare(right.name, "es", { sensitivity: "base" })
    || left.id.localeCompare(right.id);
}

function normalizeToken(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
