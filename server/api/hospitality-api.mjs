import { randomUUID } from "node:crypto";
import { corsHeaders } from "../lib/cors.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";

const MAX_BODY_BYTES = Number(process.env.HOSPITALITY_API_MAX_BODY_BYTES || 96 * 1024);
const RESOURCE_CONFIG = Object.freeze({
  invoices: {
    collection: "hospitalityInvoices",
    singular: "invoice",
    fields: new Set(["customerName", "customerTaxId", "concept", "issueDate", "dueDate", "subtotal", "taxRate", "status", "paymentMethod", "notes"]),
    normalize: normalizeHospitalityInvoice
  },
  expenses: {
    collection: "hospitalityExpenses",
    singular: "expense",
    fields: new Set(["concept", "supplierId", "category", "date", "subtotal", "taxRate", "paymentMethod", "status", "deductible", "notes"]),
    normalize: normalizeExpense
  },
  suppliers: {
    collection: "hospitalitySuppliers",
    singular: "supplier",
    fields: new Set(["name", "taxId", "email", "phone", "category", "active"]),
    normalize: normalizeSupplier
  },
  employees: {
    collection: "hospitalityEmployees",
    singular: "employee",
    fields: new Set(["name", "email", "phone", "role", "accessLevel", "hourlyRate", "active", "color"]),
    normalize: normalizeEmployee
  },
  shifts: {
    collection: "hospitalityShifts",
    singular: "shift",
    fields: new Set(["employeeId", "date", "startTime", "endTime", "area", "status", "notes"]),
    normalize: normalizeShift
  },
  inventory: {
    collection: "hospitalityInventory",
    singular: "item",
    fields: new Set(["name", "category", "unit", "currentStock", "minStock", "costPerUnit", "supplierId", "active", "notes"]),
    normalize: normalizeInventoryItem
  }
});

const EXPENSE_CATEGORIES = new Set(["food", "drinks", "supplies", "rent", "utilities", "staff", "marketing", "maintenance", "taxes", "other"]);
const PAYMENT_METHODS = new Set(["cash", "card", "transfer", "direct-debit", "other"]);
const EXPENSE_STATUSES = new Set(["pending", "paid"]);
const INVOICE_STATUSES = new Set(["draft", "sent", "paid", "overdue", "cancelled"]);
const EMPLOYEE_ROLES = new Set(["owner", "manager", "chef", "kitchen", "waiter", "bartender", "delivery", "admin"]);
const ACCESS_LEVELS = new Set(["owner", "manager", "employee", "restricted"]);
const SHIFT_AREAS = new Set(["kitchen", "floor", "bar", "delivery", "admin"]);
const SHIFT_STATUSES = new Set(["scheduled", "confirmed", "completed", "absent"]);
const INVENTORY_UNITS = new Set(["units", "kg", "g", "l", "ml", "boxes", "bottles"]);

export function isHospitalityApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/hospitality\/(?:summary|invoices|expenses|suppliers|employees|shifts|inventory)(?:\/[^/]+)?$/.test(pathname);
}

export async function handleHospitalityApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    const route = parseRoute(requestUrl.pathname);
    const db = await loadBusinessStore(context);
    ensureCollections(db);
    const business = requireBusiness(db, route.businessRef);
    const clientSession = getRequestClientSession(request);
    if (clientSession?.businessId && clientSession.businessId !== business.id) {
      throw httpError(403, "Client session cannot access this business");
    }

    if (route.resource === "summary") {
      if (method !== "GET") throw methodNotAllowed("GET, OPTIONS");
      sendJson(response, 200, buildSummary(db, business, requestUrl.searchParams), context);
      return;
    }

    const config = RESOURCE_CONFIG[route.resource];
    if (!config) throw httpError(404, "Hospitality resource not found");
    await handleResource({ request, response, context, requestUrl, route, method, db, business, config });
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: (error.statusCode || 500) >= 500 ? "Internal hospitality API error" : error.message,
      code: error.code || "hospitality_error"
    }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function handleResource({ request, response, context, requestUrl, route, method, db, business, config }) {
  if (!route.resourceId) {
    if (method === "GET") {
      const items = listItems(db, business.id, route.resource, requestUrl.searchParams);
      sendJson(response, 200, { [config.collection]: items, items, total: items.length }, context);
      return;
    }
    if (method === "POST") {
      const source = extractPayload(await readJsonBody(request), config.singular);
      assertAllowedFields(source, config.fields, config.singular);
      const now = new Date().toISOString();
      const item = config.normalize(source, null, business.id, db, now);
      db[config.collection].push(item);
      appendAudit(db, `hospitality.${config.singular}_created`, item, now);
      await saveBusinessStore(db, context, `hospitality-${config.singular}-create`);
      sendJson(response, 201, { [config.singular]: decorateItem(db, route.resource, item) }, context);
      return;
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  const item = db[config.collection].find((candidate) => candidate.id === route.resourceId && candidate.businessId === business.id);
  if (!item) throw httpError(404, `${capitalize(config.singular)} not found`);

  if (method === "GET") {
    sendJson(response, 200, { [config.singular]: decorateItem(db, route.resource, item) }, context);
    return;
  }
  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), config.singular);
    assertAllowedFields(source, config.fields, config.singular);
    if (!Object.keys(source).length) throw httpError(400, `${config.singular} needs at least one field`);
    const now = new Date().toISOString();
    Object.assign(item, config.normalize(source, item, business.id, db, now));
    appendAudit(db, `hospitality.${config.singular}_updated`, item, now);
    await saveBusinessStore(db, context, `hospitality-${config.singular}-update`);
    sendJson(response, 200, { [config.singular]: decorateItem(db, route.resource, item) }, context);
    return;
  }
  if (method === "DELETE") {
    if (["suppliers", "employees", "inventory"].includes(route.resource)) {
      item.active = false;
      item.updatedAt = new Date().toISOString();
    } else {
      db[config.collection] = db[config.collection].filter((candidate) => candidate.id !== item.id);
    }
    const now = new Date().toISOString();
    appendAudit(db, `hospitality.${config.singular}_deleted`, item, now);
    await saveBusinessStore(db, context, `hospitality-${config.singular}-delete`);
    sendJson(response, 200, { [config.singular]: item, deleted: true }, context);
    return;
  }
  throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
}

function buildSummary(db, business, searchParams) {
  const month = validMonth(searchParams.get("month")) || new Date().toISOString().slice(0, 7);
  const invoices = db.hospitalityInvoices.filter((item) => item.businessId === business.id);
  const expenses = db.hospitalityExpenses.filter((item) => item.businessId === business.id);
  const employees = db.hospitalityEmployees.filter((item) => item.businessId === business.id && item.active !== false);
  const shifts = db.hospitalityShifts.filter((item) => item.businessId === business.id);
  const inventory = db.hospitalityInventory.filter((item) => item.businessId === business.id && item.active !== false);
  const suppliers = db.hospitalitySuppliers.filter((item) => item.businessId === business.id && item.active !== false);
  const monthInvoices = invoices.filter((item) => item.issueDate?.startsWith(month) && item.status !== "cancelled");
  const monthExpenses = expenses.filter((item) => item.date?.startsWith(month) && item.status !== "cancelled");
  const income = sum(monthInvoices, "total");
  const expenseTotal = sum(monthExpenses, "total");
  const outstanding = roundMoney(invoices
    .filter((item) => !["paid", "cancelled"].includes(item.status))
    .reduce((total, invoice) => total + (invoice.status === "paid" ? 0 : Number(invoice.total || 0)), 0));
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const weekShifts = shifts.filter((item) => item.date >= weekStart && item.date <= weekEnd && item.status !== "absent");
  const lowStockItems = inventory.filter(isLowStock);

  return {
    business: { id: business.id, name: business.name, slug: business.slug || "" },
    month,
    finance: {
      income,
      expenses: expenseTotal,
      profit: roundMoney(income - expenseTotal),
      outstanding,
      invoiceCount: monthInvoices.length,
      expenseCount: monthExpenses.length,
      monthlySeries: lastMonths(month, 6).map((key) => ({
        month: key,
        income: sum(invoices.filter((item) => item.issueDate?.startsWith(key) && item.status !== "cancelled"), "total"),
        expenses: sum(expenses.filter((item) => item.date?.startsWith(key)), "total")
      }))
    },
    team: {
      activeEmployees: employees.length,
      workingToday: new Set(shifts.filter((item) => item.date === today && item.employeeId && item.status !== "absent").map((item) => item.employeeId)).size,
      weeklyHours: roundMoney(weekShifts.reduce((total, shift) => total + shiftDuration(shift), 0)),
      uncoveredShifts: shifts.filter((item) => item.date >= today && !item.employeeId && item.status !== "absent").length
    },
    inventory: {
      activeItems: inventory.length,
      lowStock: lowStockItems.length,
      value: roundMoney(inventory.reduce((total, item) => total + Number(item.currentStock || 0) * Number(item.costPerUnit || 0), 0)),
      activeSuppliers: suppliers.length
    }
  };
}

function listItems(db, businessId, resource, searchParams) {
  const config = RESOURCE_CONFIG[resource];
  const search = clean(searchParams.get("search")).toLowerCase();
  const active = clean(searchParams.get("active"));
  const from = optionalDate(searchParams.get("from"), "from");
  const to = optionalDate(searchParams.get("to"), "to");
  const status = clean(searchParams.get("status"));
  const items = db[config.collection]
    .filter((item) => item.businessId === businessId)
    .filter((item) => active === "" || Boolean(item.active !== false) === parseBoolean(active))
    .filter((item) => !status || item.status === status)
    .filter((item) => !from || (item.date || item.issueDate || "") >= from)
    .filter((item) => !to || (item.date || item.issueDate || "") <= to)
    .filter((item) => !search || Object.values(item).map(clean).join(" ").toLowerCase().includes(search))
    .map((item) => decorateItem(db, resource, item));

  if (resource === "shifts") return items.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  if (resource === "invoices") return items.sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)) || compareUpdated(a, b));
  if (resource === "expenses") return items.sort((a, b) => String(b.date).localeCompare(String(a.date)) || compareUpdated(a, b));
  return items.sort((a, b) => clean(a.name).localeCompare(clean(b.name), "es", { sensitivity: "base" }));
}

function decorateItem(db, resource, item) {
  if (resource === "expenses") {
    const supplier = db.hospitalitySuppliers.find((candidate) => candidate.id === item.supplierId);
    return { ...item, supplierName: supplier?.name || "" };
  }
  if (resource === "shifts") {
    const employee = db.hospitalityEmployees.find((candidate) => candidate.id === item.employeeId);
    return { ...item, employeeName: employee?.name || "Sin asignar", durationHours: shiftDuration(item) };
  }
  if (resource === "inventory") {
    const supplier = db.hospitalitySuppliers.find((candidate) => candidate.id === item.supplierId);
    return { ...item, supplierName: supplier?.name || "", lowStock: isLowStock(item), stockValue: roundMoney(Number(item.currentStock || 0) * Number(item.costPerUnit || 0)) };
  }
  return { ...item };
}

function normalizeExpense(source, existing, businessId, db, now) {
  const supplierId = optionalId(valueOf(source, existing, "supplierId"), "supplierId");
  if (supplierId && !db.hospitalitySuppliers.some((item) => item.id === supplierId && item.businessId === businessId)) throw httpError(404, "Supplier not found");
  const subtotal = money(valueOf(source, existing, "subtotal", 0), "subtotal");
  const taxRate = percentage(valueOf(source, existing, "taxRate", 21), "taxRate");
  const taxAmount = roundMoney(subtotal * taxRate / 100);
  return {
    id: existing?.id || `hospitality_expense_${randomUUID()}`,
    businessId,
    concept: requiredText(valueOf(source, existing, "concept"), "concept", 240),
    supplierId,
    category: enumValue(valueOf(source, existing, "category", "other"), EXPENSE_CATEGORIES, "category"),
    date: requiredDate(valueOf(source, existing, "date", new Date().toISOString().slice(0, 10)), "date"),
    subtotal,
    taxRate,
    taxAmount,
    total: roundMoney(subtotal + taxAmount),
    paymentMethod: enumValue(valueOf(source, existing, "paymentMethod", "card"), PAYMENT_METHODS, "paymentMethod"),
    status: enumValue(valueOf(source, existing, "status", "paid"), EXPENSE_STATUSES, "status"),
    deductible: Boolean(valueOf(source, existing, "deductible", true)),
    notes: optionalText(valueOf(source, existing, "notes"), 1000),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeHospitalityInvoice(source, existing, businessId, db, now) {
  const issueDate = requiredDate(valueOf(source, existing, "issueDate", new Date().toISOString().slice(0, 10)), "issueDate");
  const dueDate = requiredDate(valueOf(source, existing, "dueDate", issueDate), "dueDate");
  if (dueDate < issueDate) throw httpError(400, "dueDate cannot be before issueDate");
  const subtotal = money(valueOf(source, existing, "subtotal", 0), "subtotal");
  const taxRate = percentage(valueOf(source, existing, "taxRate", 21), "taxRate");
  const taxAmount = roundMoney(subtotal * taxRate / 100);
  return {
    id: existing?.id || `hospitality_invoice_${randomUUID()}`,
    businessId,
    number: existing?.number || nextHospitalityInvoiceNumber(db, issueDate, businessId),
    customerName: requiredText(valueOf(source, existing, "customerName"), "customerName", 160),
    customerTaxId: optionalText(valueOf(source, existing, "customerTaxId"), 40),
    concept: requiredText(valueOf(source, existing, "concept"), "concept", 240),
    issueDate,
    dueDate,
    subtotal,
    taxRate,
    taxAmount,
    total: roundMoney(subtotal + taxAmount),
    status: enumValue(valueOf(source, existing, "status", "draft"), INVOICE_STATUSES, "status"),
    paymentMethod: enumValue(valueOf(source, existing, "paymentMethod", "transfer"), PAYMENT_METHODS, "paymentMethod"),
    notes: optionalText(valueOf(source, existing, "notes"), 1000),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeSupplier(source, existing, businessId, _db, now) {
  return {
    id: existing?.id || `hospitality_supplier_${randomUUID()}`,
    businessId,
    name: requiredText(valueOf(source, existing, "name"), "name", 160),
    taxId: optionalText(valueOf(source, existing, "taxId"), 40),
    email: optionalEmail(valueOf(source, existing, "email")),
    phone: optionalText(valueOf(source, existing, "phone"), 40),
    category: optionalText(valueOf(source, existing, "category", "General"), 80) || "General",
    active: Boolean(valueOf(source, existing, "active", true)),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeEmployee(source, existing, businessId, _db, now) {
  return {
    id: existing?.id || `hospitality_employee_${randomUUID()}`,
    businessId,
    name: requiredText(valueOf(source, existing, "name"), "name", 120),
    email: optionalEmail(valueOf(source, existing, "email")),
    phone: optionalText(valueOf(source, existing, "phone"), 40),
    role: enumValue(valueOf(source, existing, "role", "waiter"), EMPLOYEE_ROLES, "role"),
    accessLevel: enumValue(valueOf(source, existing, "accessLevel", "employee"), ACCESS_LEVELS, "accessLevel"),
    hourlyRate: money(valueOf(source, existing, "hourlyRate", 0), "hourlyRate"),
    color: optionalColor(valueOf(source, existing, "color", "#5262d9")),
    active: Boolean(valueOf(source, existing, "active", true)),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeShift(source, existing, businessId, db, now) {
  const employeeId = optionalId(valueOf(source, existing, "employeeId"), "employeeId");
  if (employeeId && !db.hospitalityEmployees.some((item) => item.id === employeeId && item.businessId === businessId && item.active !== false)) throw httpError(404, "Employee not found");
  const startTime = requiredTime(valueOf(source, existing, "startTime"), "startTime");
  const endTime = requiredTime(valueOf(source, existing, "endTime"), "endTime");
  if (timeMinutes(endTime) <= timeMinutes(startTime)) throw httpError(400, "endTime must be after startTime");
  return {
    id: existing?.id || `hospitality_shift_${randomUUID()}`,
    businessId,
    employeeId,
    date: requiredDate(valueOf(source, existing, "date"), "date"),
    startTime,
    endTime,
    area: enumValue(valueOf(source, existing, "area", "floor"), SHIFT_AREAS, "area"),
    status: enumValue(valueOf(source, existing, "status", "scheduled"), SHIFT_STATUSES, "status"),
    notes: optionalText(valueOf(source, existing, "notes"), 500),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeInventoryItem(source, existing, businessId, db, now) {
  const supplierId = optionalId(valueOf(source, existing, "supplierId"), "supplierId");
  if (supplierId && !db.hospitalitySuppliers.some((item) => item.id === supplierId && item.businessId === businessId)) throw httpError(404, "Supplier not found");
  return {
    id: existing?.id || `hospitality_inventory_${randomUUID()}`,
    businessId,
    name: requiredText(valueOf(source, existing, "name"), "name", 160),
    category: optionalText(valueOf(source, existing, "category", "General"), 80) || "General",
    unit: enumValue(valueOf(source, existing, "unit", "units"), INVENTORY_UNITS, "unit"),
    currentStock: quantity(valueOf(source, existing, "currentStock", 0), "currentStock"),
    minStock: quantity(valueOf(source, existing, "minStock", 0), "minStock"),
    costPerUnit: money(valueOf(source, existing, "costPerUnit", 0), "costPerUnit"),
    supplierId,
    active: Boolean(valueOf(source, existing, "active", true)),
    notes: optionalText(valueOf(source, existing, "notes"), 500),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function parseRoute(pathname) {
  const segments = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  return { businessRef: segments[2] || "", resource: segments[4] || "", resourceId: segments[5] || "" };
}

function ensureCollections(db) {
  for (const config of Object.values(RESOURCE_CONFIG)) db[config.collection] = Array.isArray(db[config.collection]) ? db[config.collection] : [];
  for (const key of ["businesses", "invoices", "payments", "auditLog"]) db[key] = Array.isArray(db[key]) ? db[key] : [];
}

function requireBusiness(db, ref) {
  const business = db.businesses.find((item) => item.id === ref || item.slug === ref);
  if (!business) throw httpError(404, "Business not found");
  return business;
}

function extractPayload(payload, singular) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw httpError(400, "JSON object is required");
  const nested = payload[singular];
  return nested && typeof nested === "object" && !Array.isArray(nested) ? nested : payload;
}

function assertAllowedFields(source, allowed, label) {
  const unknown = Object.keys(source).filter((key) => !allowed.has(key));
  if (unknown.length) throw httpError(400, `${label} contains unknown fields: ${unknown.join(", ")}`);
}

function valueOf(source, existing, field, fallback = "") {
  return Object.prototype.hasOwnProperty.call(source, field) ? source[field] : (existing?.[field] ?? fallback);
}

function requiredText(value, field, maxLength) {
  const text = clean(value);
  if (!text) throw httpError(400, `${field} is required`);
  if (text.length > maxLength) throw httpError(400, `${field} is too long`);
  return text;
}

function optionalText(value, maxLength) {
  const text = clean(value);
  if (text.length > maxLength) throw httpError(400, "Text is too long");
  return text;
}

function optionalEmail(value) {
  const email = clean(value).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "email must be valid");
  return email;
}

function optionalColor(value) {
  const color = clean(value) || "#5262d9";
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw httpError(400, "color must be a hex color");
  return color.toLowerCase();
}

function optionalId(value, field) {
  const id = clean(value);
  if (id && !/^[a-zA-Z0-9._:-]{1,180}$/.test(id)) throw httpError(400, `${field} is invalid`);
  return id;
}

function enumValue(value, allowed, field) {
  const result = clean(value);
  if (!allowed.has(result)) throw httpError(400, `${field} is invalid`);
  return result;
}

function requiredDate(value, field) {
  const date = optionalDate(value, field);
  if (!date) throw httpError(400, `${field} is required`);
  return date;
}

function optionalDate(value, field) {
  if (value === null || value === undefined || value === "") return "";
  const date = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) throw httpError(400, `${field} must use YYYY-MM-DD`);
  return date;
}

function requiredTime(value, field) {
  const time = clean(value);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw httpError(400, `${field} must use HH:MM`);
  return time;
}

function money(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000 || Math.abs(number * 100 - Math.round(number * 100)) > 1e-7) throw httpError(400, `${field} must be a non-negative amount with at most two decimals`);
  return number;
}

function quantity(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000 || Math.abs(number * 1000 - Math.round(number * 1000)) > 1e-7) throw httpError(400, `${field} must be a non-negative quantity`);
  return number;
}

function percentage(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw httpError(400, `${field} must be between 0 and 100`);
  return number;
}

function isLowStock(item) { return Number(item.currentStock || 0) <= Number(item.minStock || 0); }
function sum(items, field) { return roundMoney(items.reduce((total, item) => total + Number(item[field] || 0), 0)); }
function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function timeMinutes(value) { const [hours, minutes] = clean(value).split(":").map(Number); return hours * 60 + minutes; }
function shiftDuration(shift) { return Math.max(0, roundMoney((timeMinutes(shift.endTime) - timeMinutes(shift.startTime)) / 60)); }
function compareUpdated(left, right) { return String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")); }
function parseBoolean(value) { return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase()); }
function clean(value) { return String(value ?? "").trim(); }
function capitalize(value) { return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "Resource"; }
function validMonth(value) { const month = clean(value); return /^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) ? month : ""; }

function mondayOf(dateValue) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function lastMonths(month, count) {
  const [year, monthNumber] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - count + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

function nextHospitalityInvoiceNumber(db, issueDate, businessId) {
  const year = issueDate.slice(0, 4);
  const prefix = `FAC-${year}-`;
  const sequence = db.hospitalityInvoices
    .filter((invoice) => invoice.businessId === businessId)
    .map((invoice) => clean(invoice.number))
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((max, number) => Math.max(max, number), 0) + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

function appendAudit(db, type, entity, now) {
  db.auditLog.push({ id: `audit_${randomUUID()}`, type, businessId: entity.businessId, entityId: entity.id, createdAt: now });
}

async function readJsonBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, "Hospitality payload too large");
    raw += chunk.toString("utf8");
  }
  if (!raw.trim()) throw httpError(400, "JSON body is required");
  try { return JSON.parse(raw); } catch { throw httpError(400, "Invalid JSON body"); }
}

function methodNotAllowed(allow) { const error = httpError(405, "Method not allowed"); error.allow = allow; return error; }
function httpError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: "GET, POST, PATCH, DELETE, OPTIONS" });
  response.end();
}
