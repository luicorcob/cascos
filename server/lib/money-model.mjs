import { randomUUID } from "node:crypto";

const MONEY_STATUSES = new Set(["draft", "open", "sent", "partially_paid", "paid", "overdue", "void", "cancelled", "refunded", "disputed"]);

export function ensureMoneyCollections(db) {
  db.moneyRecords = Array.isArray(db.moneyRecords) ? db.moneyRecords : [];
  db.payments = Array.isArray(db.payments) ? db.payments : [];
  db.invoices = Array.isArray(db.invoices) ? db.invoices : [];
  db.hospitalityInvoices = Array.isArray(db.hospitalityInvoices) ? db.hospitalityInvoices : [];
  db.associations = Array.isArray(db.associations) ? db.associations : [];
  return db;
}

export function reconcileMoneyRecords(db, businessId, now = new Date().toISOString()) {
  ensureMoneyCollections(db);
  const sources = [
    ...db.invoices.filter((item) => item.businessId === businessId).map((item) => ({ type: "invoice", item })),
    ...db.hospitalityInvoices.filter((item) => item.businessId === businessId).map((item) => ({ type: "hospitalityInvoice", item }))
  ];
  const summary = { scanned: sources.length, created: 0, updated: 0, unchanged: 0, recordIds: [] };
  for (const source of sources) {
    const normalized = normalizeMoneySource(db, businessId, source.type, source.item, now);
    const existing = db.moneyRecords.find((item) => item.businessId === businessId && item.sourceType === source.type && item.sourceId === source.item.id);
    if (!existing) {
      db.moneyRecords.push(normalized);
      summary.created += 1;
      summary.recordIds.push(normalized.id);
      continue;
    }
    const comparable = JSON.stringify({ ...existing, updatedAt: normalized.updatedAt, reconciledAt: normalized.reconciledAt });
    const incoming = JSON.stringify({ ...normalized, id: existing.id, createdAt: existing.createdAt, updatedAt: normalized.updatedAt, reconciledAt: normalized.reconciledAt });
    if (comparable === incoming) summary.unchanged += 1;
    else {
      Object.assign(existing, normalized, { id: existing.id, createdAt: existing.createdAt, updatedAt: now });
      summary.updated += 1;
    }
    summary.recordIds.push(existing.id);
  }
  return { summary, center: buildMoneyCenter(db, businessId) };
}

export function buildMoneyCenter(db, businessId, filters = {}) {
  ensureMoneyCollections(db);
  const status = clean(filters.status);
  const customerId = clean(filters.customerId || filters.contactId);
  const records = db.moneyRecords.filter((item) => item.businessId === businessId)
    .filter((item) => !status || item.status === status)
    .filter((item) => !customerId || item.contactId === customerId || item.accountId === customerId)
    .map((item) => decorateMoneyRecord(db, item))
    .sort((a, b) => String(b.issueDate || b.createdAt).localeCompare(String(a.issueDate || a.createdAt)));
  const currencies = [...new Set(records.map((item) => item.currency))];
  const byCurrency = currencies.map((currency) => {
    const matching = records.filter((item) => item.currency === currency);
    return {
      currency,
      invoiced: round(matching.reduce((sum, item) => sum + item.total, 0)),
      paid: round(matching.reduce((sum, item) => sum + item.paidAmount, 0)),
      outstanding: round(matching.reduce((sum, item) => sum + item.balance, 0)),
      overdue: round(matching.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.balance, 0))
    };
  });
  return { records, summary: { total: records.length, paid: records.filter((item) => item.status === "paid").length, open: records.filter((item) => ["open", "sent", "partially_paid", "overdue"].includes(item.status)).length, overdue: records.filter((item) => item.status === "overdue").length, byCurrency } };
}

export function updateMoneyRecord(db, businessId, recordId, input, now = new Date().toISOString()) {
  ensureMoneyCollections(db);
  const record = requireMoneyRecord(db, businessId, recordId);
  const source = object(input);
  if (source.contactId !== undefined) record.contactId = clean(source.contactId);
  if (source.accountId !== undefined) record.accountId = clean(source.accountId);
  if (source.customerName !== undefined) record.customerName = clean(source.customerName) || record.customerName;
  if (source.currency !== undefined) record.currency = normalizeCurrency(source.currency);
  if (source.status !== undefined) record.status = normalizeMoneyStatus(source.status, record.dueDate);
  if (source.issueDate !== undefined) record.issueDate = isoDate(source.issueDate) || record.issueDate;
  if (source.dueDate !== undefined) record.dueDate = isoDate(source.dueDate);
  if (source.lines !== undefined) record.lines = normalizeLines(source.lines, record.currency);
  if (source.taxRate !== undefined) record.taxRate = clampNumber(source.taxRate, 0, 100);
  recalculateRecord(record, db);
  record.updatedAt = now;
  syncMoneySource(db, record, now);
  return decorateMoneyRecord(db, record);
}

export function createMoneyPayment(db, businessId, recordId, input, now = new Date().toISOString()) {
  ensureMoneyCollections(db);
  const record = requireMoneyRecord(db, businessId, recordId);
  const source = object(input);
  const amount = round(Number(source.amount));
  if (!(amount > 0)) throw moneyError(400, "Payment amount must be positive");
  const payment = {
    id: clean(source.id) || `payment_${randomUUID()}`,
    businessId,
    moneyRecordId: record.id,
    invoiceId: record.sourceType === "invoice" ? record.sourceId : "",
    hospitalityInvoiceId: record.sourceType === "hospitalityInvoice" ? record.sourceId : "",
    proposalId: record.proposalId,
    projectId: record.projectId,
    subscriptionId: record.subscriptionId,
    amount,
    currency: normalizeCurrency(source.currency || record.currency),
    status: clean(source.status || "paid"),
    provider: clean(source.provider || "manual"),
    providerPaymentId: clean(source.providerPaymentId),
    paidAt: validIso(source.paidAt) || now,
    createdAt: now,
    updatedAt: now
  };
  if (payment.currency !== record.currency) throw moneyError(409, "Payment currency must match the money record");
  const duplicate = db.payments.find((item) => item.businessId === businessId && ((payment.providerPaymentId && item.providerPaymentId === payment.providerPaymentId) || item.id === payment.id));
  if (duplicate) return { payment: duplicate, record: decorateMoneyRecord(db, record), duplicate: true };
  db.payments.push(payment);
  recalculateRecord(record, db);
  record.updatedAt = now;
  syncMoneySource(db, record, now);
  return { payment, record: decorateMoneyRecord(db, record), duplicate: false };
}

export function normalizeMoneySource(db, businessId, sourceType, source, now) {
  const currency = normalizeCurrency(source.currency || "EUR");
  const lines = normalizeLines(source.lines?.length ? source.lines : [{
    description: source.concept || source.description || source.number || "Servicio",
    quantity: 1,
    unitPrice: number(source.subtotal ?? source.amount ?? source.total),
    taxRate: number(source.taxRate)
  }], currency);
  const subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const taxTotal = round(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const total = round(source.total ?? subtotal + taxTotal);
  const direct = directMoneyLinks(source);
  const associations = db.associations.filter((item) => item.businessId === businessId && (
    (item.fromType === sourceType && item.fromId === source.id) || (item.toType === sourceType && item.toId === source.id)
  ));
  const linked = (type) => associations.map((item) => item.fromType === type ? item.fromId : item.toType === type ? item.toId : "").find(Boolean) || "";
  const record = {
    id: `money_${sourceType}_${source.id}`,
    businessId,
    sourceType,
    sourceId: source.id,
    number: clean(source.number || source.invoiceNumber || source.reference || source.id),
    contactId: direct.contactId || linked("contact"),
    accountId: direct.accountId || linked("account"),
    customerName: clean(source.customerName || source.clientName || source.customer?.name || "Cliente sin asociar"),
    legacyCustomerNamePreserved: Boolean(source.customerName && !direct.contactId && !linked("contact")),
    currency,
    status: normalizeMoneyStatus(source.status, source.dueDate),
    issueDate: isoDate(source.issueDate || source.createdAt) || isoDate(now),
    dueDate: isoDate(source.dueDate),
    lines,
    subtotal,
    taxTotal,
    total,
    taxRate: number(source.taxRate),
    proposalId: direct.proposalId || linked("proposal"),
    projectId: direct.projectId || linked("project"),
    subscriptionId: direct.subscriptionId || linked("subscription"),
    paymentIds: [],
    paidAmount: 0,
    balance: total,
    reconciledAt: now,
    createdAt: validIso(source.createdAt) || now,
    updatedAt: now
  };
  recalculateRecord(record, db);
  return record;
}

function decorateMoneyRecord(db, record) {
  const payments = db.payments.filter((item) => item.businessId === record.businessId && (item.moneyRecordId === record.id || item.invoiceId === record.sourceId || item.hospitalityInvoiceId === record.sourceId));
  return { ...record, payments, links: { contactId: record.contactId, accountId: record.accountId, proposalId: record.proposalId, projectId: record.projectId, subscriptionId: record.subscriptionId } };
}
function recalculateRecord(record, db) {
  const lines = normalizeLines(record.lines, record.currency);
  record.lines = lines;
  record.subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0));
  record.taxTotal = round(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  record.total = round(lines.reduce((sum, line) => sum + line.total, 0));
  const payments = db.payments.filter((item) => item.businessId === record.businessId && ["paid", "succeeded", "completed"].includes(clean(item.status).toLowerCase()) && (item.moneyRecordId === record.id || item.invoiceId === record.sourceId || item.hospitalityInvoiceId === record.sourceId));
  record.paymentIds = payments.map((item) => item.id);
  record.paidAmount = round(payments.reduce((sum, item) => sum + number(item.amount), 0));
  record.balance = round(Math.max(0, record.total - record.paidAmount));
  if (record.balance === 0 && record.total > 0) record.status = "paid";
  else if (record.paidAmount > 0 && record.balance > 0) record.status = "partially_paid";
  else if (record.dueDate && new Date(`${record.dueDate}T23:59:59.999Z`) < new Date() && !["cancelled", "void", "refunded", "disputed"].includes(record.status)) record.status = "overdue";
}
function syncMoneySource(db, record, now) {
  const collection = record.sourceType === "hospitalityInvoice" ? db.hospitalityInvoices : db.invoices;
  const source = collection.find((item) => item.businessId === record.businessId && item.id === record.sourceId);
  if (!source) return;
  Object.assign(source, { contactId: record.contactId, accountId: record.accountId, customerName: record.customerName, currency: record.currency, status: record.status, issueDate: record.issueDate, dueDate: record.dueDate, lines: record.lines, subtotal: record.subtotal, taxTotal: record.taxTotal, total: record.total, proposalId: record.proposalId, projectId: record.projectId, subscriptionId: record.subscriptionId, moneyRecordId: record.id, updatedAt: now });
}
function normalizeLines(value, currency) {
  const values = Array.isArray(value) ? value : [];
  return values.map((item, index) => {
    const source = object(item);
    const quantity = Math.max(0.0001, number(source.quantity || 1));
    const unitPrice = round(number(source.unitPrice ?? source.price ?? source.amount));
    const discountPercent = clampNumber(source.discountPercent || source.discount || 0, 0, 100);
    const taxRate = clampNumber(source.taxRate || 0, 0, 100);
    const gross = round(quantity * unitPrice);
    const discountAmount = round(gross * discountPercent / 100);
    const subtotal = round(gross - discountAmount);
    const taxAmount = round(subtotal * taxRate / 100);
    return { id: clean(source.id) || `line_${index + 1}`, description: clean(source.description || source.name || `Linea ${index + 1}`), quantity, unitPrice, discountPercent, discountAmount, taxRate, taxAmount, subtotal, total: round(subtotal + taxAmount), currency };
  });
}
function directMoneyLinks(source) { return { contactId: clean(source.contactId || source.customerId), accountId: clean(source.accountId), proposalId: clean(source.proposalId || source.quoteId), projectId: clean(source.projectId), subscriptionId: clean(source.subscriptionId) }; }
function normalizeMoneyStatus(value, dueDate) { const raw = clean(value).toLowerCase().replaceAll("-", "_"); const mapped = ({ borrador: "draft", enviada: "sent", pendiente: "open", pagada: "paid", vencida: "overdue", cancelada: "cancelled", canceled: "cancelled", partial: "partially_paid" })[raw] || raw || "draft"; if (MONEY_STATUSES.has(mapped)) return mapped; if (dueDate && new Date(`${isoDate(dueDate)}T23:59:59.999Z`) < new Date()) return "overdue"; return "open"; }
function normalizeCurrency(value) { const currency = clean(value).toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw moneyError(400, "Currency must be an ISO 4217 code"); return currency; }
function requireMoneyRecord(db, businessId, recordId) { const record = db.moneyRecords.find((item) => item.businessId === businessId && item.id === recordId); if (!record) throw moneyError(404, "Money record not found"); return record; }
function isoDate(value) { const text = clean(value); const time = Date.parse(text); return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : ""; }
function validIso(value) { const time = Date.parse(value || ""); return Number.isFinite(time) ? new Date(time).toISOString() : ""; }
function round(value) { return Math.round((number(value) + Number.EPSILON) * 100) / 100; }
function number(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function clampNumber(value, min, max) { return Math.min(max, Math.max(min, number(value))); }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function clean(value) { return String(value ?? "").trim(); }
function moneyError(statusCode, message, code = "money_error") { return Object.assign(new Error(message), { statusCode, code }); }
