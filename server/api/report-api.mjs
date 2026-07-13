import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore } from "../lib/business-store.mjs";
import {
  buildCommercialDashboardReport,
  buildCommercialLostReasons
} from "../lib/commercial-dashboard-report.mjs";
import { buildCommercialForecast, normalizeForecastMonth } from "../lib/commercial-forecast.mjs";
import { buildCommercialSla, normalizeSlaHours } from "../lib/commercial-sla.mjs";

const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  proposals: [],
  services: [],
  bookings: [],
  bookingReminders: [],
  businessEvents: [],
  auditLog: []
};

export function isReportApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/reports\/monthly$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/reports\/lost-reasons$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/reports\/forecast$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/reports\/sla$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/reports\/commercial-dashboard$/.test(pathname);
}

export async function handleReportApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "reports" && segments[4] === "monthly" && method === "GET") {
      await getMonthlyReport(segments[2], requestUrl, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "reports" && segments[4] === "lost-reasons" && method === "GET") {
      await getLostReasonsReport(segments[2], response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "reports" && segments[4] === "forecast" && method === "GET") {
      await getForecastReport(segments[2], requestUrl, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "reports" && segments[4] === "sla" && method === "GET") {
      await getSlaReport(segments[2], requestUrl, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "reports" && segments[4] === "commercial-dashboard" && method === "GET") {
      await getCommercialDashboardReport(segments[2], requestUrl, response, context);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal report API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function getCommercialDashboardReport(businessId, requestUrl, response, context) {
  const now = new Date();
  const month = optionalCommercialDashboardMonth(requestUrl, now);
  const hours = optionalSlaHours(requestUrl);
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const commercialDashboard = buildCommercialDashboardReport(db, business, { month, hours, now });
  sendJson(response, 200, { commercialDashboard }, context);
}

async function getSlaReport(businessId, requestUrl, response, context) {
  const hours = optionalSlaHours(requestUrl);
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const sla = buildCommercialSla(db, business, { hours });
  sendJson(response, 200, { sla }, context);
}

async function getForecastReport(businessId, requestUrl, response, context) {
  const month = requiredForecastMonth(requestUrl);
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const forecast = buildCommercialForecast(db, business, { month });
  sendJson(response, 200, { forecast }, context);
}

async function getMonthlyReport(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const period = normalizePeriod(requestUrl.searchParams.get("month") || "");
  const range = getMonthRange(period);
  const report = buildMonthlyReport(db, business, range);

  sendJson(response, 200, { report }, context);
}

async function getLostReasonsReport(businessId, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  sendJson(response, 200, buildCommercialLostReasons(db, business), context);
}

function buildMonthlyReport(db, business, range) {
  const content = business.content || {};
  const commerce = content.commerce || {};
  const currency = commerce.currency || content.currency || "EUR";
  const contacts = db.contacts.filter((contact) => contact.businessId === business.id);
  const activities = db.activities.filter((activity) => activity.businessId === business.id);
  const bookings = db.bookings.filter((booking) => booking.businessId === business.id);
  const reminders = db.bookingReminders.filter((reminder) => reminder.businessId === business.id);
  const orders = arrayFrom(content.orders, commerce.orders, business.orders);
  const events = [
    ...db.businessEvents.filter((event) => event.businessId === business.id),
    ...arrayFrom(content.metricEvents, business.metricEvents, content.events)
  ];

  const monthContacts = contacts.filter((contact) => isInRange(contact.createdAt, range));
  const monthActivities = activities.filter((activity) => isInRange(activity.createdAt, range));
  const monthBookings = bookings.filter((booking) => isInRange(booking.startsAt || booking.createdAt, range));
  const monthReminders = reminders.filter((reminder) => isInRange(reminder.createdAt, range));
  const monthOrders = orders.filter((order) => isInRange(order.paidAt || order.createdAt || order.updatedAt, range));
  const monthEvents = events.filter((event) => isInRange(event.timestamp || event.createdAt || event.date, range));
  const paidOrders = monthOrders.filter((order) => ["paid", "preparing", "ready", "fulfilled"].includes(String(order.status || "").toLowerCase()));
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || order.amount || 0), 0);

  const metrics = {
    newContacts: monthContacts.length,
    leads: contacts.filter((contact) => contact.type !== "customer" && contact.status !== "customer").length,
    customers: contacts.filter((contact) => contact.type === "customer" || ["customer", "won"].includes(String(contact.status || ""))).length,
    bookings: monthBookings.length,
    confirmedBookings: monthBookings.filter((booking) => booking.status === "confirmed").length,
    completedBookings: monthBookings.filter((booking) => booking.status === "completed").length,
    canceledBookings: monthBookings.filter((booking) => ["canceled", "cancelled"].includes(String(booking.status || ""))).length,
    remindersPrepared: monthReminders.length,
    orders: monthOrders.length,
    paidOrders: paidOrders.length,
    revenue,
    conversionEvents: monthEvents.filter((event) => String(event.type || event.name || "").includes("click") || String(event.type || event.name || "").includes("lead")).length,
    activities: monthActivities.length
  };

  return {
    business: {
      id: business.id,
      slug: business.slug,
      name: business.name,
      category: business.category,
      city: business.city,
      plan: business.plan
    },
    period: {
      month: range.month,
      from: range.from.toISOString(),
      to: range.to.toISOString()
    },
    currency,
    metrics,
    funnel: buildFunnel(contacts, bookings, orders),
    topSources: countBy(monthContacts, (contact) => contact.source || "manual").slice(0, 5),
    eventBreakdown: countBy(monthEvents, (event) => event.name || event.type || "evento").slice(0, 8),
    eventSources: countBy(monthEvents, (event) => event.detail?.source || event.detail?.business || event.source || "web").slice(0, 5),
    bookingStatus: countBy(monthBookings, (booking) => booking.status || "pending"),
    recentActivity: monthActivities
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8)
      .map((activity) => ({
        id: activity.id,
        title: activity.title,
        type: activity.type,
        source: activity.source,
        createdAt: activity.createdAt
      })),
    recommendations: buildRecommendations({ business, content, metrics, contacts, bookings, orders, reminders })
  };
}

function buildFunnel(contacts, bookings, orders) {
  const paidOrders = orders.filter((order) => ["paid", "preparing", "ready", "fulfilled"].includes(String(order.status || "").toLowerCase()));
  return [
    { label: "Contactos", value: contacts.length },
    { label: "Reservas", value: bookings.length },
    { label: "Clientes", value: contacts.filter((contact) => contact.type === "customer" || ["customer", "won"].includes(String(contact.status || ""))).length },
    { label: "Pedidos pagados", value: paidOrders.length }
  ];
}

function buildRecommendations(input) {
  const { business, content, metrics, contacts, bookings, orders, reminders } = input;
  const recommendations = [];

  if (!contacts.length) {
    recommendations.push(makeRecommendation("Activar captacion", "Publicar la web y probar formulario/chatbot con una campana local pequena.", "alta"));
  }

  if (metrics.bookings > 0 && metrics.remindersPrepared === 0) {
    recommendations.push(makeRecommendation("Preparar recordatorios", "Hay reservas este mes sin recordatorios registrados. Usa la cola dry-run antes del servicio.", "media"));
  }

  if (String(business.plan || "").includes("comercio") && !orders.length) {
    recommendations.push(makeRecommendation("Cargar primeros productos", "El plan comercial necesita catalogo y pedidos para medir ventas reales.", "media"));
  }

  if (!content.reviewUrl && !business.integrations?.google?.reviewUrl) {
    recommendations.push(makeRecommendation("Pedir resenas", "Anadir enlace de resenas y lanzar una accion mensual a clientes recientes.", "media"));
  }

  if (bookings.length && metrics.canceledBookings > Math.max(1, metrics.confirmedBookings)) {
    recommendations.push(makeRecommendation("Revisar disponibilidad", "Las cancelaciones superan reservas confirmadas. Ajusta horarios, bloqueos o texto del widget.", "alta"));
  }

  if (!reminders.length && bookings.length) {
    recommendations.push(makeRecommendation("Crear rutina de agenda", "Usar recordatorios manuales antes de automatizar WhatsApp/email.", "baja"));
  }

  if (!recommendations.length) {
    recommendations.push(makeRecommendation("Mantener ritmo", "El negocio tiene base operativa. El siguiente salto es automatizar reporte y recordatorios.", "baja"));
  }

  return recommendations;
}

function makeRecommendation(title, text, priority) {
  return { title, text, priority };
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);

  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.activities = Array.isArray(db.activities) ? db.activities : [];
  db.proposals = Array.isArray(db.proposals) ? db.proposals : [];
  db.services = Array.isArray(db.services) ? db.services : [];
  db.bookings = Array.isArray(db.bookings) ? db.bookings : [];
  db.bookingReminders = Array.isArray(db.bookingReminders) ? db.bookingReminders : [];
  db.businessEvents = Array.isArray(db.businessEvents) ? db.businessEvents : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

function normalizePeriod(value) {
  const text = String(value || "").trim();

  if (/^\d{4}-\d{2}$/.test(text)) {
    return text;
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function requiredForecastMonth(requestUrl) {
  const values = requestUrl.searchParams.getAll("month");
  const value = values[0] || "";

  if (values.length !== 1 || !/^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(value)) {
    throw httpError(400, "month is required and must use YYYY-MM");
  }

  try {
    return normalizeForecastMonth(value);
  } catch {
    throw httpError(400, "month is required and must use YYYY-MM");
  }
}

function optionalCommercialDashboardMonth(requestUrl, now) {
  const values = requestUrl.searchParams.getAll("month");

  if (!values.length) {
    return normalizeForecastMonth(undefined, now);
  }

  const value = values[0] || "";
  if (values.length !== 1 || !/^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(value)) {
    throw httpError(400, "month must use YYYY-MM");
  }

  try {
    return normalizeForecastMonth(value, now);
  } catch {
    throw httpError(400, "month must use YYYY-MM");
  }
}

function optionalSlaHours(requestUrl) {
  const values = requestUrl.searchParams.getAll("hours");

  if (!values.length) {
    return normalizeSlaHours(undefined);
  }

  const value = values[0] || "";

  if (values.length !== 1 || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw httpError(400, "hours must be a number greater than 0 and at most 2160");
  }

  try {
    return normalizeSlaHours(value);
  } catch {
    throw httpError(400, "hours must be a number greater than 0 and at most 2160");
  }
}

function getMonthRange(period) {
  const [year, month] = period.split("-").map(Number);
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 1, 0, 0, 0, 0);
  return { month: period, from, to };
}

function isInRange(value, range) {
  const date = new Date(value || "");
  return !Number.isNaN(date.getTime()) && date >= range.from && date < range.to;
}

function countBy(items, getKey) {
  const counts = new Map();

  items.forEach((item) => {
    const key = String(getKey(item) || "sin-dato");
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function arrayFrom(...values) {
  const arrays = values.filter((value) => Array.isArray(value));
  return arrays.find((value) => value.length) || arrays[0] || [];
}

function findBusiness(db, id) {
  return db.businesses.find((business) => business.id === id || business.slug === id);
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: "GET, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
