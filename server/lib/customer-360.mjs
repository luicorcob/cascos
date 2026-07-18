import { consentStateForContact, evaluateConsentState } from "./consent-model.mjs";

const CUSTOMER_STATUSES = new Set(["customer", "won", "cliente"]);
const OPEN_BOOKING_STATUSES = new Set(["pending", "confirmed"]);
const COMPLETED_BOOKING_STATUSES = new Set(["completed"]);
const CANCELED_BOOKING_STATUSES = new Set(["canceled", "cancelled"]);
const OPEN_PROPOSAL_STATUSES = new Set(["borrador", "enviada", "vista"]);
const ACCEPTED_PROPOSAL_STATUSES = new Set(["aceptada"]);
const OPEN_INVOICE_STATUSES = new Set(["sent", "overdue"]);

export function buildCustomer360(db, businessId, options = {}) {
  const business = collection(db, "businesses").find((item) => item.id === businessId) || {};
  const now = validDate(options.now) || new Date();
  const currency = preferredCurrency(business);
  const contacts = collection(db, "contacts")
    .filter((contact) => contact.businessId === businessId && !contact.merged && !contact.archivedAt);
  const baseProfiles = contacts
    .map((contact) => buildBaseProfile(db, business, contact, now, currency, options))
    .filter((profile) => profile.isCustomer);

  assignMonetaryScores(baseProfiles);
  baseProfiles.forEach((profile) => finalizeProfile(profile, now));
  baseProfiles.sort(compareProfiles);

  const segments = buildSegmentSummary(baseProfiles);
  const summary = buildSummary(baseProfiles, currency);
  const search = clean(options.search).toLowerCase();
  const segment = clean(options.segment);
  const filtered = baseProfiles
    .filter((profile) => !segment || profile.segments.includes(segment))
    .filter((profile) => !search || profileSearchText(profile).includes(search));
  const limit = clampInteger(options.limit, 1, 500, 250);

  return {
    generatedAt: now.toISOString(),
    business: { id: business.id || businessId, name: business.name || "", currency },
    summary,
    segments,
    filters: { search, segment },
    total: baseProfiles.length,
    filteredTotal: filtered.length,
    customers: filtered.slice(0, limit)
  };
}

export function buildCustomer360Detail(db, businessId, contactId, options = {}) {
  const result = buildCustomer360(db, businessId, { ...options, search: "", segment: "", limit: 500, timelineLimit: options.timelineLimit || 40 });
  const customer = result.customers.find((profile) => profile.contact.id === contactId);
  return customer ? { generatedAt: result.generatedAt, business: result.business, customer } : null;
}

function buildBaseProfile(db, business, contact, now, currency, options) {
  const businessId = business.id;
  const related = relatedIds(db, businessId, contact.id);
  const proposals = collection(db, "proposals").filter((item) => item.businessId === businessId && (item.contactId === contact.id || related.proposal.has(item.id)));
  const deals = collection(db, "deals").filter((item) => item.businessId === businessId && !item.archivedAt && (item.contactId === contact.id || related.deal.has(item.id)));
  const bookings = collection(db, "bookings").filter((item) => item.businessId === businessId && (item.contactId === contact.id || related.booking.has(item.id) || identityMatches(item, contact)));
  const projects = collection(db, "projects").filter((item) => item.businessId === businessId && (
    item.contactId === contact.id || related.project.has(item.id) || proposals.some((proposal) => proposal.id === item.proposalId)
  ));
  const invoices = collection(db, "invoices").filter((item) => item.businessId === businessId && (
    related.invoice.has(item.id) || projects.some((project) => project.id === item.projectId) || proposals.some((proposal) => proposal.id === item.proposalId)
  ));
  const hospitalityInvoices = collection(db, "hospitalityInvoices").filter((item) => item.businessId === businessId && (
    related.hospitalityInvoice.has(item.id) || identityMatches(item, contact)
  ));
  const conversations = collection(db, "communicationThreads").filter((item) => item.businessId === businessId && (item.contactId === contact.id || related.conversation.has(item.id)));
  const tasks = collection(db, "tasks").filter((item) => item.businessId === businessId && !item.archivedAt && related.task.has(item.id));
  const activities = collection(db, "activities").filter((item) => item.businessId === businessId && item.contactId === contact.id);
  const orders = embeddedOrders(business).filter((item) => identityMatches(item, contact));
  const completedBookings = bookings.filter((booking) => COMPLETED_BOOKING_STATUSES.has(normalizeStatus(booking.status)) && dateValue(booking.startsAt) <= now.getTime());
  const futureBookings = bookings.filter((booking) => OPEN_BOOKING_STATUSES.has(normalizeStatus(booking.status)) && dateValue(booking.startsAt) >= now.getTime()).sort(compareDates("startsAt"));
  const canceledBookings = bookings.filter((booking) => CANCELED_BOOKING_STATUSES.has(normalizeStatus(booking.status)));
  const noShows = bookings.filter((booking) => normalizeStatus(booking.status) === "no-show");
  const paidTransactions = revenueTransactions(db, invoices, hospitalityInvoices, orders);
  const totalSpent = money(paidTransactions.reduce((sum, transaction) => sum + transaction.amount, 0));
  const averageTicket = paidTransactions.length ? money(totalSpent / paidTransactions.length) : 0;
  const visitDates = completedBookings.map((booking) => validDate(booking.startsAt)).filter(Boolean).sort((left, right) => left - right);
  const lastVisit = visitDates.at(-1)?.toISOString() || "";
  const nextVisit = futureBookings[0]?.startsAt || "";
  const frequencyDays = averageGapDays(visitDates);
  const daysSinceLastVisit = lastVisit ? daysBetween(validDate(lastVisit), now) : null;
  const favoriteServices = topValues(completedBookings.length ? completedBookings : bookings, (booking) => booking.serviceName || booking.service || "");
  const consent = consentStateForContact(db, businessId, contact.id);
  const marketingChannels = availableAllowedChannels(contact, consent, "marketing");
  const reviewChannels = availableAllowedChannels(contact, consent, "reviews");
  const invoiceSummary = summarizeInvoices(db, invoices, hospitalityInvoices, now);
  const openProposals = proposals.filter((proposal) => OPEN_PROPOSAL_STATUSES.has(normalizeStatus(proposal.status)));
  const openDeals = deals.filter((deal) => normalizeStatus(deal.status) === "open");
  const wonDeals = deals.filter((deal) => normalizeStatus(deal.status) === "won");
  const acceptedProposals = proposals.filter((proposal) => ACCEPTED_PROPOSAL_STATUSES.has(normalizeStatus(proposal.status)));
  const risk = riskScore({ daysSinceLastVisit, completedVisits: completedBookings.length, futureBookings, noShows, canceledBookings, bookings, overdueBalance: invoiceSummary.overdueBalance });
  const projectedTwelveMonths = projectedRevenue({ totalSpent, averageTicket, completedVisits: completedBookings.length, frequencyDays });
  const account = findPrimaryAccount(db, businessId, contact.id, related.account);
  const timeline = buildTimeline({ activities, bookings, orders, deals, proposals, projects, invoices, hospitalityInvoices, conversations, tasks }, options.timelineLimit || 6);
  const createdDaysAgo = daysBetween(validDate(contact.createdAt), now);
  const isCustomer = CUSTOMER_STATUSES.has(normalizeStatus(contact.status))
    || normalizeStatus(contact.type) === "customer"
    || bookings.length > 0
    || wonDeals.length > 0
    || acceptedProposals.length > 0
    || paidTransactions.length > 0;

  return {
    isCustomer,
    contact: summarizeContact(contact),
    account,
    currency,
    relationship: {
      createdAt: contact.createdAt || "",
      createdDaysAgo,
      source: contact.source || "",
      lastInteractionAt: contact.lastInteractionAt || timeline[0]?.at || contact.updatedAt || contact.createdAt || ""
    },
    metrics: {
      totalSpent,
      transactionCount: paidTransactions.length,
      averageTicket,
      completedVisits: completedBookings.length,
      totalBookings: bookings.length,
      cancellations: canceledBookings.length,
      noShows: noShows.length,
      lastVisit,
      nextVisit,
      daysSinceLastVisit,
      frequencyDays,
      favoriteServices,
      projectedTwelveMonths,
      estimatedLtv: money(totalSpent + projectedTwelveMonths),
      ltvMethod: frequencyDays > 0 && averageTicket > 0 ? "historico + frecuencia anualizada" : "historico + referencia conservadora"
    },
    commercial: {
      openDeals: openDeals.length,
      openDealValue: money(openDeals.reduce((sum, item) => sum + Number(item.value || 0), 0)),
      wonDeals: wonDeals.length,
      openProposals: openProposals.length,
      openProposalValue: money(openProposals.reduce((sum, item) => sum + Number(item.setupPrice || 0) + Number(item.monthlyPrice || 0), 0)),
      projects: projects.length,
      activeProjects: projects.filter((item) => !["completed", "cancelled", "canceled"].includes(normalizeStatus(item.status))).length,
      conversations: conversations.length,
      openConversations: conversations.filter((item) => normalizeStatus(item.status) === "open").length,
      openTasks: tasks.filter((item) => !["completed", "done", "cancelled", "canceled"].includes(normalizeStatus(item.status))).length
    },
    finance: invoiceSummary,
    consent: {
      globalSuppressed: consent.globalSuppressed,
      eventCount: consent.total,
      marketingChannels,
      reviewChannels,
      serviceChannels: availableAllowedChannels(contact, consent, "service")
    },
    risk: { score: risk, level: riskLevel(risk), reasons: riskReasons({ daysSinceLastVisit, futureBookings, noShows, canceledBookings, overdueBalance: invoiceSummary.overdueBalance }) },
    rfm: {
      recency: recencyScore(daysSinceLastVisit, completedBookings.length),
      frequency: frequencyScore(completedBookings.length),
      monetary: 1,
      score: "111"
    },
    primarySegment: "new",
    segments: [],
    nextBestAction: null,
    timeline,
    records: {
      bookings: bookings.length,
      orders: orders.length,
      deals: deals.length,
      proposals: proposals.length,
      projects: projects.length,
      invoices: invoices.length + hospitalityInvoices.length,
      conversations: conversations.length,
      activities: activities.length
    },
    context: {
      futureBooking: futureBookings[0] ? summarizeRecord(futureBookings[0], "booking") : null,
      expiringProposal: soonestProposal(openProposals, now),
      recentRevenue: paidTransactions.slice().sort((left, right) => dateValue(right.at) - dateValue(left.at)).slice(0, 5)
    }
  };
}

function finalizeProfile(profile, now) {
  profile.rfm.score = `${profile.rfm.recency}${profile.rfm.frequency}${profile.rfm.monetary}`;
  profile.segments = customerSegments(profile, now);
  profile.primarySegment = primarySegment(profile);
  profile.nextBestAction = nextBestAction(profile, now);
  delete profile.isCustomer;
}

function assignMonetaryScores(profiles) {
  const sorted = profiles.map((profile) => profile.metrics.totalSpent).sort((left, right) => left - right);
  profiles.forEach((profile) => {
    if (!sorted.length || profile.metrics.totalSpent <= 0) {
      profile.rfm.monetary = 1;
      return;
    }
    const lastIndex = sorted.reduce((found, value, index) => value <= profile.metrics.totalSpent ? index : found, 0);
    profile.rfm.monetary = Math.max(1, Math.min(5, Math.ceil(((lastIndex + 1) / sorted.length) * 5)));
  });
}

function customerSegments(profile) {
  const segments = [];
  const { metrics, finance, commercial, consent, risk, rfm, relationship } = profile;
  if (rfm.monetary >= 4 && rfm.frequency >= 4) segments.push("vip");
  if (metrics.completedVisits >= 3 && (metrics.daysSinceLastVisit === null || metrics.daysSinceLastVisit <= 90)) segments.push("recurring");
  if (metrics.completedVisits <= 1 && relationship.createdDaysAgo <= 60) segments.push("new");
  if (risk.score >= 60 && metrics.completedVisits > 0) segments.push("at_risk");
  if (metrics.daysSinceLastVisit !== null && metrics.daysSinceLastVisit >= 30) segments.push("inactive_30");
  if (metrics.daysSinceLastVisit !== null && metrics.daysSinceLastVisit >= 60) segments.push("inactive_60");
  if (metrics.daysSinceLastVisit !== null && metrics.daysSinceLastVisit >= 90) segments.push("inactive_90");
  if (rfm.monetary >= 4) segments.push("high_value");
  if (metrics.noShows > 0) segments.push("no_show");
  if (finance.outstandingBalance > 0) segments.push("open_balance");
  if (commercial.openProposals > 0) segments.push("open_proposal");
  if (metrics.nextVisit) segments.push("upcoming_booking");
  if (consent.marketingChannels.length > 0 && !consent.globalSuppressed) segments.push("marketing_reachable");
  (profile.contact.tags || []).map(staticSegmentId).filter(Boolean).forEach((id) => segments.push(id));
  return segments.length ? [...new Set(segments)] : ["occasional"];
}

function primarySegment(profile) {
  for (const segment of ["vip", "at_risk", "recurring", "new", "inactive_90", "open_balance", "occasional"]) {
    if (profile.segments.includes(segment)) return segment;
  }
  return profile.segments[0] || "occasional";
}

function nextBestAction(profile, now) {
  const channel = profile.consent.marketingChannels[0] || profile.consent.serviceChannels[0] || (profile.contact.phone ? "phone" : profile.contact.email ? "email" : "task");
  if (profile.finance.overdueBalance > 0) return action("collect_payment", `Cobrar ${profile.finance.overdueBalance.toFixed(2)} ${profile.currency}`, "Existe saldo vencido asociado al cliente.", channel, "high");
  if (profile.context.futureBooking) {
    const hours = (dateValue(profile.context.futureBooking.at) - now.getTime()) / 3600000;
    if (hours <= 48) return action("prepare_visit", "Preparar la proxima visita", "La reserva comienza en menos de 48 horas.", "task", "high");
  }
  if (profile.context.expiringProposal) return action("follow_proposal", "Dar seguimiento a la propuesta", "Hay una propuesta abierta que caduca pronto.", channel, "high");
  if (profile.metrics.noShows > 0 && !profile.metrics.nextVisit) return action("recover_no_show", "Recuperar el no-show", "Tiene ausencias y ninguna reserva futura.", channel, "medium");
  if (profile.risk.score >= 60 && !profile.metrics.nextVisit) {
    if (profile.consent.marketingChannels.length) return action("reactivate", "Lanzar reactivacion personalizada", "El riesgo de inactividad es alto y existe un canal de marketing permitido.", profile.consent.marketingChannels[0], "high");
    return action("manual_follow_up", "Crear seguimiento manual", "El riesgo es alto, pero no existe permiso de marketing efectivo.", "task", "high");
  }
  if (profile.commercial.openDeals > 0) return action("advance_deal", "Mover la oportunidad al siguiente paso", "Hay oportunidades abiertas sin cierre.", "task", "medium");
  if (profile.metrics.lastVisit && profile.consent.reviewChannels.length && daysBetween(validDate(profile.metrics.lastVisit), now) <= 14) return action("request_review", "Solicitar una reseña", "La visita reciente es elegible y el canal esta permitido.", profile.consent.reviewChannels[0], "medium");
  if (!profile.metrics.nextVisit && profile.metrics.completedVisits > 0) return action("book_again", "Proponer la siguiente reserva", "Es cliente conocido y no tiene una visita futura.", channel, "medium");
  return action("enrich_profile", "Completar el perfil del cliente", "Faltan señales suficientes para una recomendacion mas precisa.", "task", "low");
}

function action(type, label, reason, channel, priority) { return { type, label, reason, channel, priority, requiresConfirmation: true }; }

function buildSummary(profiles, currency) {
  const revenue = money(profiles.reduce((sum, profile) => sum + profile.metrics.totalSpent, 0));
  const transactions = profiles.reduce((sum, profile) => sum + profile.metrics.transactionCount, 0);
  return {
    customers: profiles.length,
    currency,
    revenue,
    averageTicket: transactions ? money(revenue / transactions) : 0,
    completedVisits: profiles.reduce((sum, profile) => sum + profile.metrics.completedVisits, 0),
    vip: profiles.filter((profile) => profile.segments.includes("vip")).length,
    atRisk: profiles.filter((profile) => profile.segments.includes("at_risk")).length,
    upcomingBookings: profiles.filter((profile) => profile.metrics.nextVisit).length,
    marketingReachable: profiles.filter((profile) => profile.segments.includes("marketing_reachable")).length,
    outstandingBalance: money(profiles.reduce((sum, profile) => sum + profile.finance.outstandingBalance, 0)),
    estimatedLtv: money(profiles.reduce((sum, profile) => sum + profile.metrics.estimatedLtv, 0))
  };
}

function buildSegmentSummary(profiles) {
  const labels = {
    vip: "VIP", recurring: "Recurrentes", new: "Nuevos", at_risk: "En riesgo", inactive_30: "Inactivos 30d",
    inactive_60: "Inactivos 60d", inactive_90: "Inactivos 90d", high_value: "Alto valor", no_show: "Con no-show",
    open_balance: "Saldo pendiente", open_proposal: "Propuesta abierta", upcoming_booking: "Proxima reserva",
    marketing_reachable: "Contactables", occasional: "Ocasionales"
  };
  const manualIds = [...new Set(profiles.flatMap((profile) => profile.segments).filter((id) => id.startsWith("manual_")))];
  manualIds.forEach((id) => { labels[id] = `Manual · ${humanize(id.slice(7))}`; });
  return Object.entries(labels).map(([id, label]) => {
    const matching = profiles.filter((profile) => profile.segments.includes(id));
    return { id, label, count: matching.length, sample: matching.slice(0, 3).map((profile) => ({ id: profile.contact.id, name: profile.contact.name })) };
  });
}

function summarizeInvoices(db, invoices, hospitalityInvoices, now) {
  const general = invoices.map((invoice) => {
    const paid = money(collection(db, "payments").filter((payment) => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const total = money(invoice.total || 0);
    const status = normalizeStatus(invoice.status);
    const balance = ["paid", "cancelled", "canceled"].includes(status) ? 0 : Math.max(0, money(total - paid));
    return { total, balance, overdue: status === "overdue" || (OPEN_INVOICE_STATUSES.has(status) && dateValue(`${invoice.dueDate}T23:59:59Z`) < now.getTime()) };
  });
  const hospitality = hospitalityInvoices.map((invoice) => {
    const status = normalizeStatus(invoice.status);
    const total = money(invoice.total || 0);
    const balance = ["paid", "cancelled", "canceled"].includes(status) ? 0 : total;
    return { total, balance, overdue: status === "overdue" || (balance > 0 && dateValue(`${invoice.dueDate}T23:59:59Z`) < now.getTime()) };
  });
  const all = [...general, ...hospitality];
  return {
    invoiceCount: all.length,
    invoiced: money(all.reduce((sum, item) => sum + item.total, 0)),
    outstandingBalance: money(all.reduce((sum, item) => sum + item.balance, 0)),
    overdueBalance: money(all.filter((item) => item.overdue).reduce((sum, item) => sum + item.balance, 0)),
    overdueInvoices: all.filter((item) => item.overdue && item.balance > 0).length
  };
}

function revenueTransactions(db, invoices, hospitalityInvoices, orders) {
  const transactions = [];
  for (const invoice of invoices) {
    const payments = collection(db, "payments").filter((payment) => payment.invoiceId === invoice.id);
    if (payments.length) payments.forEach((payment) => transactions.push({ type: "payment", id: payment.id, amount: money(payment.amount), at: payment.paidAt || payment.createdAt || invoice.issueDate || "" }));
    else if (normalizeStatus(invoice.status) === "paid") transactions.push({ type: "invoice", id: invoice.id, amount: money(invoice.total), at: invoice.issueDate || invoice.updatedAt || "" });
  }
  hospitalityInvoices.filter((invoice) => normalizeStatus(invoice.status) === "paid")
    .forEach((invoice) => transactions.push({ type: "hospitality_invoice", id: invoice.id, amount: money(invoice.total), at: invoice.issueDate || invoice.updatedAt || "" }));
  orders.filter((order) => ["paid", "fulfilled", "completed", "ready"].includes(normalizeStatus(order.status)))
    .forEach((order) => transactions.push({ type: "order", id: order.id || "", amount: money(order.total || order.amount), at: order.paidAt || order.completedAt || order.createdAt || "" }));
  return transactions.filter((item) => item.amount > 0);
}

function buildTimeline(groups, limit) {
  const items = [];
  groups.activities.forEach((item) => items.push({ id: item.id, type: item.type || "activity", title: item.title || "Actividad", note: item.note || "", at: item.createdAt || item.updatedAt || "" }));
  groups.bookings.forEach((item) => items.push({ id: item.id, type: "booking", title: `Reserva · ${item.serviceName || "Servicio"}`, note: normalizeStatus(item.status), at: item.startsAt || item.createdAt || "" }));
  groups.orders.forEach((item) => items.push({ id: item.id || "", type: "order", title: item.title || item.number || "Pedido", note: normalizeStatus(item.status), at: item.paidAt || item.completedAt || item.updatedAt || item.createdAt || "" }));
  groups.deals.forEach((item) => items.push({ id: item.id, type: "deal", title: item.title || "Oportunidad", note: normalizeStatus(item.status), at: item.updatedAt || item.createdAt || "" }));
  groups.proposals.forEach((item) => items.push({ id: item.id, type: "proposal", title: "Propuesta comercial", note: normalizeStatus(item.status), at: item.updatedAt || item.createdAt || "" }));
  groups.projects.forEach((item) => items.push({ id: item.id, type: "project", title: item.name || "Proyecto", note: normalizeStatus(item.status), at: item.updatedAt || item.createdAt || "" }));
  groups.invoices.forEach((item) => items.push({ id: item.id, type: "invoice", title: item.concept || item.number || "Factura", note: normalizeStatus(item.status), at: item.issueDate || item.updatedAt || "" }));
  groups.hospitalityInvoices.forEach((item) => items.push({ id: item.id, type: "invoice", title: item.concept || item.number || "Factura operativa", note: normalizeStatus(item.status), at: item.issueDate || item.updatedAt || "" }));
  groups.conversations.forEach((item) => items.push({ id: item.id, type: "conversation", title: item.title || "Conversacion", note: normalizeStatus(item.status), at: item.updatedAt || item.createdAt || "" }));
  groups.tasks.forEach((item) => items.push({ id: item.id, type: "task", title: item.title || "Tarea", note: normalizeStatus(item.status), at: item.updatedAt || item.createdAt || "" }));
  return deduplicateTimeline(items).sort((left, right) => dateValue(right.at) - dateValue(left.at)).slice(0, clampInteger(limit, 1, 100, 6));
}

function deduplicateTimeline(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}:${item.title}:${item.at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function relatedIds(db, businessId, contactId) {
  const result = Object.fromEntries(["account", "deal", "task", "proposal", "booking", "invoice", "hospitalityInvoice", "project", "conversation"].map((type) => [type, new Set()]));
  collection(db, "associations").filter((association) => association.businessId === businessId && !association.archivedAt).forEach((association) => {
    if (association.fromType === "contact" && association.fromId === contactId && result[association.toType]) result[association.toType].add(association.toId);
    if (association.toType === "contact" && association.toId === contactId && result[association.fromType]) result[association.fromType].add(association.fromId);
  });
  return result;
}

function findPrimaryAccount(db, businessId, contactId, associatedIds) {
  const association = collection(db, "associations").find((item) => item.businessId === businessId && !item.archivedAt && item.fromType === "contact" && item.fromId === contactId && item.toType === "account" && item.isPrimary)
    || collection(db, "associations").find((item) => item.businessId === businessId && !item.archivedAt && ((item.fromType === "contact" && item.fromId === contactId && item.toType === "account") || (item.toType === "contact" && item.toId === contactId && item.fromType === "account")));
  const accountId = association ? (association.fromType === "account" ? association.fromId : association.toId) : [...associatedIds][0];
  const account = collection(db, "accounts").find((item) => item.businessId === businessId && item.id === accountId && !item.archivedAt);
  return account ? { id: account.id, name: account.name || "", type: account.type || "", status: account.status || "" } : null;
}

function availableAllowedChannels(contact, consent, purpose) {
  return [
    ["whatsapp", Boolean(contact.phone)], ["email", Boolean(contact.email)], ["sms", Boolean(contact.phone)], ["phone", Boolean(contact.phone)]
  ].filter(([channel, available]) => available && evaluateConsentState(consent, channel, purpose).allowed && !evaluateConsentState(consent, channel, purpose).suppressed).map(([channel]) => channel);
}

function riskScore(input) {
  let score = 10;
  if (!input.futureBookings.length) score += 12;
  if (input.daysSinceLastVisit === null && input.completedVisits === 0) score += 10;
  else if (input.daysSinceLastVisit > 180) score += 52;
  else if (input.daysSinceLastVisit > 90) score += 38;
  else if (input.daysSinceLastVisit > 60) score += 26;
  else if (input.daysSinceLastVisit > 30) score += 12;
  else score -= 12;
  score += Math.min(24, input.noShows.length * 12);
  score += Math.min(18, input.bookings.length ? Math.round((input.canceledBookings.length / input.bookings.length) * 25) : 0);
  if (input.overdueBalance > 0) score += 15;
  if (input.futureBookings.length) score -= 25;
  return Math.max(0, Math.min(100, score));
}

function riskReasons(input) {
  const reasons = [];
  if (!input.futureBookings.length) reasons.push("sin reserva futura");
  if (input.daysSinceLastVisit > 90) reasons.push(`ultima visita hace ${input.daysSinceLastVisit} dias`);
  else if (input.daysSinceLastVisit === null) reasons.push("sin visita completada");
  if (input.noShows.length) reasons.push(`${input.noShows.length} no-show`);
  if (input.canceledBookings.length) reasons.push(`${input.canceledBookings.length} cancelacion(es)`);
  if (input.overdueBalance > 0) reasons.push("saldo vencido");
  return reasons.length ? reasons : ["relacion estable"];
}

function riskLevel(score) { return score >= 70 ? "high" : score >= 40 ? "medium" : "low"; }
function recencyScore(days, visits) { if (!visits || days === null) return 1; if (days <= 30) return 5; if (days <= 60) return 4; if (days <= 90) return 3; if (days <= 180) return 2; return 1; }
function frequencyScore(visits) { if (visits >= 10) return 5; if (visits >= 6) return 4; if (visits >= 3) return 3; if (visits >= 2) return 2; return 1; }
function projectedRevenue({ totalSpent, averageTicket, completedVisits, frequencyDays }) { if (averageTicket > 0 && completedVisits >= 2 && frequencyDays > 0) return money(averageTicket * Math.min(52, 365 / frequencyDays)); return totalSpent > 0 ? money(Math.min(totalSpent, averageTicket || totalSpent)) : 0; }

function topValues(items, selector) {
  const counts = new Map();
  items.forEach((item) => { const value = clean(selector(item)); if (value) counts.set(value, (counts.get(value) || 0) + 1); });
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es")).slice(0, 3).map(([name, count]) => ({ name, count }));
}

function soonestProposal(proposals, now) {
  const proposal = proposals.filter((item) => dateValue(item.expiresAt) >= now.getTime()).sort(compareDates("expiresAt"))[0];
  return proposal && daysBetween(now, validDate(proposal.expiresAt)) <= 14 ? summarizeRecord(proposal, "proposal") : null;
}

function summarizeRecord(item, type) { return { id: item.id || "", type, title: item.title || item.name || item.serviceName || item.concept || type, status: item.status || "", at: item.startsAt || item.expiresAt || item.updatedAt || item.createdAt || "" }; }
function summarizeContact(contact) { return { id: contact.id, name: contact.name || "", email: contact.email || "", phone: contact.phone || "", status: contact.status || "", type: contact.type || "", city: contact.city || "", tags: Array.isArray(contact.tags) ? contact.tags : [] }; }
function embeddedOrders(business) { const sources = [business.orders, business.content?.orders, business.content?.commerce?.orders]; const seen = new Set(); return sources.flatMap((value) => Array.isArray(value) ? value : []).filter((item) => { const key = item.id || JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true; }); }
function identityMatches(record, contact) { if (record.contactId && record.contactId === contact.id) return true; const email = normalizeEmail(record.email || record.customerEmail || record.contactEmail); if (email && email === normalizeEmail(contact.email)) return true; const phone = normalizePhone(record.phone || record.customerPhone || record.contactPhone); if (phone && phone === normalizePhone(contact.phone)) return true; const name = normalizeName(record.customerName || record.name || record.contactName); return Boolean(name && name === normalizeName(contact.name)); }
function preferredCurrency(business) { const currency = clean(business.content?.commerce?.currency || business.content?.currency || business.currency || "EUR").toUpperCase(); return /^[A-Z]{3}$/.test(currency) ? currency : "EUR"; }
function profileSearchText(profile) { return [profile.contact.name, profile.contact.email, profile.contact.phone, profile.account?.name, profile.primarySegment, ...profile.segments, ...profile.metrics.favoriteServices.map((item) => item.name)].map(clean).join(" ").toLowerCase(); }
function compareProfiles(left, right) { return right.risk.score - left.risk.score || right.metrics.totalSpent - left.metrics.totalSpent || left.contact.name.localeCompare(right.contact.name, "es"); }
function compareDates(field) { return (left, right) => dateValue(left[field]) - dateValue(right[field]); }
function averageGapDays(dates) { if (dates.length < 2) return 0; const gaps = dates.slice(1).map((date, index) => Math.max(0, daysBetween(dates[index], date))); return Math.round((gaps.reduce((sum, value) => sum + value, 0) / gaps.length) * 10) / 10; }
function daysBetween(from, to) { if (!from || !to) return 0; return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000)); }
function dateValue(value) { const date = validDate(value); return date ? date.getTime() : 0; }
function validDate(value) { if (value instanceof Date && Number.isFinite(value.getTime())) return value; const date = new Date(value || ""); return Number.isFinite(date.getTime()) ? date : null; }
function normalizeStatus(value) { return clean(value).toLowerCase(); }
function normalizeEmail(value) { return clean(value).toLowerCase(); }
function normalizePhone(value) { return clean(value).replace(/\D+/g, ""); }
function normalizeName(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function staticSegmentId(value) { const match = clean(value).match(/^segment(?::|_)(.+)$/i); if (!match) return ""; const slug = match[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60); return slug ? `manual_${slug}` : ""; }
function humanize(value) { return clean(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function collection(db, key) { return Array.isArray(db?.[key]) ? db[key] : []; }
function money(value) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }
function clampInteger(value, min, max, fallback) { const number = Number(value); return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
