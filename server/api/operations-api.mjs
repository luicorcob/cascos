import { randomUUID } from "node:crypto";
import { archiveEntityAssociations, upsertAssociation } from "../lib/association-model.mjs";
import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";

const MAX_BODY_BYTES = Number(process.env.OPERATIONS_API_MAX_BODY_BYTES || 128 * 1024);
const PROJECT_STATUSES = new Set(["pending", "in-design", "review", "published", "maintenance"]);
const PROJECT_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const TASK_STATUSES = new Set(["pending", "in-progress", "done"]);
const SUBSCRIPTION_STATUSES = new Set(["active", "paused", "cancelled", "expired"]);
const SUBSCRIPTION_FREQUENCIES = new Set(["monthly", "quarterly", "yearly", "custom"]);
const INVOICE_STATUSES = new Set(["draft", "sent", "paid", "overdue", "cancelled"]);
const DOCUMENT_CATEGORIES = new Set(["contract", "quote", "invoice", "client-file", "deliverable", "other"]);
const DOCUMENT_VISIBILITIES = new Set(["client", "internal"]);
const APPROVAL_DECISIONS = new Set(["approved", "changes-requested"]);
const PROJECT_FIELDS = new Set(["businessId", "proposalId", "contactId", "name", "description", "responsible", "priority", "status", "startDate", "dueDate"]);
const PROJECT_UPDATE_FIELDS = new Set([...PROJECT_FIELDS].filter((field) => field !== "businessId"));
const TASK_FIELDS = new Set(["title", "assignee", "status", "dueDate"]);
const FILE_FIELDS = new Set(["name", "url", "category"]);
const COMMENT_FIELDS = new Set(["message"]);
const APPROVAL_FIELDS = new Set(["decision", "note"]);
const SUBSCRIPTION_FIELDS = new Set(["businessId", "name", "description", "price", "currency", "frequency", "intervalMonths", "nextRenewal", "status", "noticeDays"]);
const SUBSCRIPTION_UPDATE_FIELDS = new Set([...SUBSCRIPTION_FIELDS].filter((field) => field !== "businessId"));
const INVOICE_FIELDS = new Set(["businessId", "projectId", "proposalId", "concept", "issueDate", "dueDate", "subtotal", "taxRate", "currency", "status"]);
const INVOICE_UPDATE_FIELDS = new Set([...INVOICE_FIELDS].filter((field) => field !== "businessId"));
const PAYMENT_FIELDS = new Set(["amount", "paidAt", "method", "reference"]);
const DOCUMENT_FIELDS = new Set(["businessId", "projectId", "invoiceId", "proposalId", "name", "category", "url", "visibility"]);
const DOCUMENT_UPDATE_FIELDS = new Set([...DOCUMENT_FIELDS].filter((field) => field !== "businessId"));

export function isOperationsApiRequest(pathname) {
  return /^\/api\/enterprise\/(?:summary|projects|subscriptions|invoices|documents)(?:\/[^/]+(?:\/(?:tasks|files|comments|approvals|payments)(?:\/[^/]+)?)?)?$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/(?:projects|subscriptions|invoices|documents)(?:\/[^/]+(?:\/(?:tasks|files|comments|approvals|payments)(?:\/[^/]+)?)?)?$/.test(pathname);
}

export async function handleOperationsApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    const route = parseRoute(requestUrl.pathname);
    const db = await loadDb(context);
    const clientSession = getRequestClientSession(request);

    if (clientSession && method !== "GET" && !canClientMutate(route, method)) {
      throw httpError(403, "Client sessions have read-only access to operations");
    }

    const business = resolveBusiness(db, route.businessRef, requestUrl.searchParams.get("businessId"));
    if (route.resource === "summary") {
      requireMethod(method, "GET");
      sendJson(response, 200, buildSummary(db, business?.id || ""), context);
      return;
    }

    if (route.resource === "projects") {
      await handleProjects({ request, response, context, requestUrl, route, method, db, business, clientSession });
      return;
    }

    if (route.resource === "subscriptions") {
      await handleSubscriptions({ request, response, context, requestUrl, route, method, db, business });
      return;
    }

    if (route.resource === "invoices") {
      await handleInvoices({ request, response, context, requestUrl, route, method, db, business, clientSession });
      return;
    }

    if (route.resource === "documents") {
      await handleDocuments({ request, response, context, requestUrl, route, method, db, business, clientSession });
      return;
    }

    throw httpError(404, "Operations resource not found");
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, {
      error: status >= 500 ? "Internal operations API error" : error.message,
      code: error.code || "operations_error"
    }, context);
  }
}

async function handleProjects(input) {
  const { request, response, context, requestUrl, route, method, db, business, clientSession } = input;
  const businessId = business?.id || "";

  if (!route.resourceId) {
    if (method === "GET") {
      const projects = listProjects(db, requestUrl.searchParams, businessId);
      sendJson(response, 200, { projects, total: projects.length }, context);
      return;
    }
    if (method === "POST") {
      const source = extractPayload(await readJsonBody(request), "project");
      assertAllowedFields(source, PROJECT_FIELDS, "project");
      const targetBusiness = business || requireBusiness(db, requiredId(source.businessId, "businessId"));
      const now = new Date().toISOString();
      const project = normalizeProject(source, null, targetBusiness.id, db, now);
      db.projects.push(project);
      syncProjectAssociations(db, project, now);
      appendAudit(db, "project.created", project, now);
      await saveBusinessStore(db, context, "project-create");
      sendJson(response, 201, { project: decorateProject(db, project) }, context);
      return;
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  const project = requireProject(db, route.resourceId, businessId);
  if (route.subresource) {
    await handleProjectChildren({ request, response, context, route, method, db, project, clientSession });
    return;
  }

  if (method === "GET") {
    sendJson(response, 200, { project: decorateProject(db, project) }, context);
    return;
  }
  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), "project");
    assertAllowedFields(source, PROJECT_UPDATE_FIELDS, "project");
    assertHasFields(source, "project");
    const now = new Date().toISOString();
    Object.assign(project, normalizeProject(source, project, project.businessId, db, now));
    syncProjectAssociations(db, project, now);
    appendAudit(db, "project.updated", project, now);
    await saveBusinessStore(db, context, "project-update");
    sendJson(response, 200, { project: decorateProject(db, project) }, context);
    return;
  }
  if (method === "DELETE") {
    db.projects = db.projects.filter((item) => item.id !== project.id);
    db.projectTasks = db.projectTasks.filter((item) => item.projectId !== project.id);
    db.projectFiles = db.projectFiles.filter((item) => item.projectId !== project.id);
    db.projectComments = db.projectComments.filter((item) => item.projectId !== project.id);
    db.projectApprovals = db.projectApprovals.filter((item) => item.projectId !== project.id);
    const now = new Date().toISOString();
    archiveEntityAssociations(db, project.businessId, "project", project.id, now);
    appendAudit(db, "project.deleted", project, now);
    await saveBusinessStore(db, context, "project-delete");
    sendJson(response, 200, { project: decorateProject(db, project), deleted: true }, context);
    return;
  }
  throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
}

async function handleProjectChildren({ request, response, context, route, method, db, project, clientSession }) {
  const config = route.subresource === "tasks"
    ? { collection: "projectTasks", singular: "task", fields: TASK_FIELDS, normalizer: normalizeTask }
    : route.subresource === "files"
      ? { collection: "projectFiles", singular: "file", fields: FILE_FIELDS, normalizer: normalizeFile }
      : route.subresource === "comments"
        ? { collection: "projectComments", singular: "comment", fields: COMMENT_FIELDS, normalizer: normalizeComment }
        : route.subresource === "approvals"
          ? { collection: "projectApprovals", singular: "approval", fields: APPROVAL_FIELDS, normalizer: normalizeApproval }
          : null;
  if (!config) {
    throw httpError(404, "Project resource not found");
  }

  if (!route.subresourceId) {
    if (method === "GET") {
      const items = db[config.collection].filter((item) => item.projectId === project.id).sort(compareUpdated);
      sendJson(response, 200, { [config.collection]: items, total: items.length }, context);
      return;
    }
    if (method === "POST") {
      const source = extractPayload(await readJsonBody(request), config.singular);
      assertAllowedFields(source, config.fields, config.singular);
      const now = new Date().toISOString();
      const item = config.normalizer(source, null, project, now, clientSession ? "client" : "admin");
      db[config.collection].push(item);
      project.updatedAt = now;
      appendAudit(db, `${config.singular}.created`, item, now, { projectId: project.id });
      await saveBusinessStore(db, context, `${config.singular}-create`);
      sendJson(response, 201, { [config.singular]: item }, context);
      return;
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  const item = db[config.collection].find((candidate) => (
    candidate.id === route.subresourceId && candidate.projectId === project.id
  ));
  if (!item) {
    throw httpError(404, `${capitalize(config.singular)} not found`);
  }

  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), config.singular);
    assertAllowedFields(source, config.fields, config.singular);
    assertHasFields(source, config.singular);
    const now = new Date().toISOString();
    Object.assign(item, config.normalizer(source, item, project, now, clientSession ? "client" : "admin"));
    project.updatedAt = now;
    appendAudit(db, `${config.singular}.updated`, item, now, { projectId: project.id });
    await saveBusinessStore(db, context, `${config.singular}-update`);
    sendJson(response, 200, { [config.singular]: item }, context);
    return;
  }
  if (method === "DELETE") {
    db[config.collection] = db[config.collection].filter((candidate) => candidate.id !== item.id);
    const now = new Date().toISOString();
    project.updatedAt = now;
    appendAudit(db, `${config.singular}.deleted`, item, now, { projectId: project.id });
    await saveBusinessStore(db, context, `${config.singular}-delete`);
    sendJson(response, 200, { [config.singular]: item, deleted: true }, context);
    return;
  }
  throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
}

async function handleSubscriptions(input) {
  const { request, response, context, requestUrl, route, method, db, business } = input;
  const businessId = business?.id || "";

  if (!route.resourceId) {
    if (method === "GET") {
      const subscriptions = listSubscriptions(db, requestUrl.searchParams, businessId);
      sendJson(response, 200, { subscriptions, total: subscriptions.length }, context);
      return;
    }
    if (method === "POST") {
      const source = extractPayload(await readJsonBody(request), "subscription");
      assertAllowedFields(source, SUBSCRIPTION_FIELDS, "subscription");
      const targetBusiness = business || requireBusiness(db, requiredId(source.businessId, "businessId"));
      const now = new Date().toISOString();
      const subscription = normalizeSubscription(source, null, targetBusiness.id, now);
      db.subscriptions.push(subscription);
      appendAudit(db, "subscription.created", subscription, now);
      await saveBusinessStore(db, context, "subscription-create");
      sendJson(response, 201, { subscription: decorateSubscription(subscription) }, context);
      return;
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  const subscription = requireSubscription(db, route.resourceId, businessId);
  if (route.subresource) {
    throw httpError(404, "Subscription resource not found");
  }
  if (method === "GET") {
    sendJson(response, 200, { subscription: decorateSubscription(subscription) }, context);
    return;
  }
  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), "subscription");
    assertAllowedFields(source, SUBSCRIPTION_UPDATE_FIELDS, "subscription");
    assertHasFields(source, "subscription");
    const now = new Date().toISOString();
    Object.assign(subscription, normalizeSubscription(source, subscription, subscription.businessId, now));
    appendAudit(db, "subscription.updated", subscription, now);
    await saveBusinessStore(db, context, "subscription-update");
    sendJson(response, 200, { subscription: decorateSubscription(subscription) }, context);
    return;
  }
  if (method === "DELETE") {
    db.subscriptions = db.subscriptions.filter((item) => item.id !== subscription.id);
    const now = new Date().toISOString();
    appendAudit(db, "subscription.deleted", subscription, now);
    await saveBusinessStore(db, context, "subscription-delete");
    sendJson(response, 200, { subscription: decorateSubscription(subscription), deleted: true }, context);
    return;
  }
  throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
}

async function handleInvoices(input) {
  const { request, response, context, requestUrl, route, method, db, business } = input;
  const businessId = business?.id || "";

  if (!route.resourceId) {
    if (method === "GET") {
      const expired = expireInvoices(db, businessId, new Date().toISOString());
      if (expired) await saveBusinessStore(db, context, "invoice-expiration");
      const invoices = listInvoices(db, requestUrl.searchParams, businessId);
      sendJson(response, 200, { invoices, total: invoices.length }, context);
      return;
    }
    if (method === "POST") {
      const source = extractPayload(await readJsonBody(request), "invoice");
      assertAllowedFields(source, INVOICE_FIELDS, "invoice");
      const targetBusiness = business || requireBusiness(db, requiredId(source.businessId, "businessId"));
      const now = new Date().toISOString();
      const invoice = normalizeInvoice(source, null, targetBusiness.id, db, now);
      db.invoices.push(invoice);
      syncInvoiceAssociations(db, invoice, now);
      updateInvoicePaymentStatus(db, invoice, now);
      appendAudit(db, "invoice.created", invoice, now);
      await saveBusinessStore(db, context, "invoice-create");
      sendJson(response, 201, { invoice: decorateInvoice(db, invoice) }, context);
      return;
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  const invoice = requireInvoice(db, route.resourceId, businessId);
  if (route.subresource) {
    if (route.subresource !== "payments") throw httpError(404, "Invoice resource not found");
    await handlePayments({ request, response, context, route, method, db, invoice });
    return;
  }
  if (method === "GET") {
    const expired = expireInvoices(db, invoice.businessId, new Date().toISOString());
    if (expired) await saveBusinessStore(db, context, "invoice-expiration");
    sendJson(response, 200, { invoice: decorateInvoice(db, invoice) }, context);
    return;
  }
  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), "invoice");
    assertAllowedFields(source, INVOICE_UPDATE_FIELDS, "invoice");
    assertHasFields(source, "invoice");
    const now = new Date().toISOString();
    Object.assign(invoice, normalizeInvoice(source, invoice, invoice.businessId, db, now));
    syncInvoiceAssociations(db, invoice, now);
    updateInvoicePaymentStatus(db, invoice, now);
    appendAudit(db, "invoice.updated", invoice, now);
    await saveBusinessStore(db, context, "invoice-update");
    sendJson(response, 200, { invoice: decorateInvoice(db, invoice) }, context);
    return;
  }
  if (method === "DELETE") {
    db.invoices = db.invoices.filter((item) => item.id !== invoice.id);
    db.payments = db.payments.filter((item) => item.invoiceId !== invoice.id);
    db.documents = db.documents.filter((item) => item.invoiceId !== invoice.id);
    const now = new Date().toISOString();
    archiveEntityAssociations(db, invoice.businessId, "invoice", invoice.id, now);
    appendAudit(db, "invoice.deleted", invoice, now);
    await saveBusinessStore(db, context, "invoice-delete");
    sendJson(response, 200, { invoice: decorateInvoice(db, invoice), deleted: true }, context);
    return;
  }
  throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
}

async function handlePayments({ request, response, context, route, method, db, invoice }) {
  if (!route.subresourceId) {
    if (method === "GET") {
      const payments = db.payments.filter((item) => item.invoiceId === invoice.id).sort(comparePaymentDates);
      sendJson(response, 200, { payments, total: payments.length }, context);
      return;
    }
    if (method === "POST") {
      const source = extractPayload(await readJsonBody(request), "payment");
      assertAllowedFields(source, PAYMENT_FIELDS, "payment");
      const now = new Date().toISOString();
      const payment = normalizePayment(source, null, invoice, now);
      assertPaymentWithinBalance(db, invoice, payment);
      db.payments.push(payment);
      updateInvoicePaymentStatus(db, invoice, now);
      appendAudit(db, "payment.created", payment, now, { invoiceId: invoice.id });
      await saveBusinessStore(db, context, "payment-create");
      sendJson(response, 201, { payment, invoice: decorateInvoice(db, invoice) }, context);
      return;
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  const payment = db.payments.find((item) => item.id === route.subresourceId && item.invoiceId === invoice.id);
  if (!payment) throw httpError(404, "Payment not found");
  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), "payment");
    assertAllowedFields(source, PAYMENT_FIELDS, "payment");
    assertHasFields(source, "payment");
    const now = new Date().toISOString();
    const normalizedPayment = normalizePayment(source, payment, invoice, now);
    assertPaymentWithinBalance(db, invoice, normalizedPayment, payment.id);
    Object.assign(payment, normalizedPayment);
    updateInvoicePaymentStatus(db, invoice, now);
    appendAudit(db, "payment.updated", payment, now, { invoiceId: invoice.id });
    await saveBusinessStore(db, context, "payment-update");
    sendJson(response, 200, { payment, invoice: decorateInvoice(db, invoice) }, context);
    return;
  }
  if (method === "DELETE") {
    db.payments = db.payments.filter((item) => item.id !== payment.id);
    const now = new Date().toISOString();
    updateInvoicePaymentStatus(db, invoice, now);
    appendAudit(db, "payment.deleted", payment, now, { invoiceId: invoice.id });
    await saveBusinessStore(db, context, "payment-delete");
    sendJson(response, 200, { payment, invoice: decorateInvoice(db, invoice), deleted: true }, context);
    return;
  }
  throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
}

async function handleDocuments(input) {
  const { request, response, context, requestUrl, route, method, db, business, clientSession } = input;
  const businessId = business?.id || "";

  if (!route.resourceId) {
    if (method === "GET") {
      const documents = listDocuments(db, requestUrl.searchParams, businessId, Boolean(clientSession));
      sendJson(response, 200, { documents, total: documents.length }, context);
      return;
    }
    if (method === "POST") {
      const source = extractPayload(await readJsonBody(request), "document");
      assertAllowedFields(source, DOCUMENT_FIELDS, "document");
      const targetBusiness = business || requireBusiness(db, requiredId(source.businessId, "businessId"));
      const now = new Date().toISOString();
      const document = normalizeDocument(source, null, targetBusiness.id, db, now, Boolean(clientSession));
      db.documents.push(document);
      appendAudit(db, "document.created", document, now);
      await saveBusinessStore(db, context, "document-create");
      sendJson(response, 201, { document }, context);
      return;
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }

  const document = requireDocument(db, route.resourceId, businessId, Boolean(clientSession));
  if (route.subresource) throw httpError(404, "Document resource not found");
  if (method === "GET") {
    sendJson(response, 200, { document }, context);
    return;
  }
  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), "document");
    assertAllowedFields(source, DOCUMENT_UPDATE_FIELDS, "document");
    assertHasFields(source, "document");
    const now = new Date().toISOString();
    Object.assign(document, normalizeDocument(source, document, document.businessId, db, now, false));
    appendAudit(db, "document.updated", document, now);
    await saveBusinessStore(db, context, "document-update");
    sendJson(response, 200, { document }, context);
    return;
  }
  if (method === "DELETE") {
    db.documents = db.documents.filter((item) => item.id !== document.id);
    const now = new Date().toISOString();
    appendAudit(db, "document.deleted", document, now);
    await saveBusinessStore(db, context, "document-delete");
    sendJson(response, 200, { document, deleted: true }, context);
    return;
  }
  throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
}

function parseRoute(pathname) {
  const segments = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (segments[1] === "enterprise") {
    return {
      businessRef: "",
      resource: segments[2] || "",
      resourceId: segments[3] || "",
      subresource: segments[4] || "",
      subresourceId: segments[5] || ""
    };
  }
  return {
    businessRef: segments[2] || "",
    resource: segments[3] || "",
    resourceId: segments[4] || "",
    subresource: segments[5] || "",
    subresourceId: segments[6] || ""
  };
}

function resolveBusiness(db, routeBusinessRef, queryBusinessRef) {
  const ref = clean(routeBusinessRef || queryBusinessRef);
  return ref ? requireBusiness(db, ref) : null;
}

function listProjects(db, searchParams, businessId) {
  const search = clean(searchParams.get("search")).toLowerCase();
  const status = optionalEnum(searchParams.get("status"), PROJECT_STATUSES, "status");
  const priority = optionalEnum(searchParams.get("priority"), PROJECT_PRIORITIES, "priority");
  const overdueOnly = parseBoolean(searchParams.get("overdue"));
  const today = todayValue();
  return db.projects
    .filter((project) => !businessId || project.businessId === businessId)
    .filter((project) => !status || project.status === status)
    .filter((project) => !priority || project.priority === priority)
    .filter((project) => !overdueOnly || isProjectOverdue(project, today))
    .filter((project) => !search || projectSearchText(db, project).includes(search))
    .sort(compareProjects)
    .map((project) => decorateProject(db, project));
}

function listSubscriptions(db, searchParams, businessId) {
  const search = clean(searchParams.get("search")).toLowerCase();
  const status = optionalEnum(searchParams.get("status"), SUBSCRIPTION_STATUSES, "status");
  const dueInDays = optionalInteger(searchParams.get("dueInDays"), "dueInDays", 0, 3660);
  const cutoff = dueInDays === null ? "" : addDays(todayValue(), dueInDays);
  return db.subscriptions
    .filter((subscription) => !businessId || subscription.businessId === businessId)
    .filter((subscription) => !status || subscription.status === status)
    .filter((subscription) => !cutoff || subscription.nextRenewal <= cutoff)
    .filter((subscription) => !search || subscriptionSearchText(db, subscription).includes(search))
    .sort(compareRenewals)
    .map(decorateSubscription);
}

function listInvoices(db, searchParams, businessId) {
  const search = clean(searchParams.get("search")).toLowerCase();
  const status = optionalEnum(searchParams.get("status"), INVOICE_STATUSES, "status");
  return db.invoices
    .filter((invoice) => !businessId || invoice.businessId === businessId)
    .filter((invoice) => !status || invoice.status === status)
    .filter((invoice) => !search || invoiceSearchText(db, invoice).includes(search))
    .sort((left, right) => String(right.issueDate).localeCompare(String(left.issueDate)) || compareUpdated(left, right))
    .map((invoice) => decorateInvoice(db, invoice));
}

function listDocuments(db, searchParams, businessId, clientMode) {
  const search = clean(searchParams.get("search")).toLowerCase();
  const category = optionalEnum(searchParams.get("category"), DOCUMENT_CATEGORIES, "category");
  return db.documents
    .filter((document) => !businessId || document.businessId === businessId)
    .filter((document) => !clientMode || document.visibility === "client")
    .filter((document) => !category || document.category === category)
    .filter((document) => !search || [document.name, document.category].map(clean).join(" ").toLowerCase().includes(search))
    .sort(compareUpdated);
}

function normalizeProject(source, existing, businessId, db, now) {
  const startDate = optionalDate(valueOf(source, existing, "startDate"), "startDate");
  const dueDate = optionalDate(valueOf(source, existing, "dueDate"), "dueDate");
  if (startDate && dueDate && dueDate < startDate) {
    throw httpError(400, "dueDate cannot be before startDate");
  }
  const proposalId = optionalId(valueOf(source, existing, "proposalId"), "proposalId");
  const contactId = optionalId(valueOf(source, existing, "contactId"), "contactId");
  if (proposalId && !db.proposals.some((item) => item.id === proposalId && item.businessId === businessId)) {
    throw httpError(404, "Proposal not found");
  }
  if (contactId && !db.contacts.some((item) => item.id === contactId && item.businessId === businessId)) {
    throw httpError(404, "Contact not found");
  }
  return {
    id: existing?.id || `project_${randomUUID()}`,
    businessId,
    proposalId,
    contactId,
    name: requiredText(valueOf(source, existing, "name"), "name", 160),
    description: optionalText(valueOf(source, existing, "description"), 4000),
    responsible: optionalText(valueOf(source, existing, "responsible"), 120),
    priority: requiredEnum(valueOf(source, existing, "priority", "medium"), PROJECT_PRIORITIES, "priority"),
    status: requiredEnum(valueOf(source, existing, "status", "pending"), PROJECT_STATUSES, "status"),
    startDate,
    dueDate,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeTask(source, existing, project, now) {
  return {
    id: existing?.id || `task_${randomUUID()}`,
    businessId: project.businessId,
    projectId: project.id,
    title: requiredText(valueOf(source, existing, "title"), "title", 240),
    assignee: optionalText(valueOf(source, existing, "assignee"), 120),
    status: requiredEnum(valueOf(source, existing, "status", "pending"), TASK_STATUSES, "status"),
    dueDate: optionalDate(valueOf(source, existing, "dueDate"), "dueDate"),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeFile(source, existing, project, now) {
  return {
    id: existing?.id || `project_file_${randomUUID()}`,
    businessId: project.businessId,
    projectId: project.id,
    name: requiredText(valueOf(source, existing, "name"), "name", 240),
    url: requiredHttpUrl(valueOf(source, existing, "url"), "url"),
    category: optionalText(valueOf(source, existing, "category", "project"), 80) || "project",
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeComment(source, existing, project, now, actorRole) {
  return {
    id: existing?.id || `project_comment_${randomUUID()}`,
    businessId: project.businessId,
    projectId: project.id,
    message: requiredText(valueOf(source, existing, "message"), "message", 4000),
    actorRole: existing?.actorRole || actorRole || "admin",
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeApproval(source, existing, project, now, actorRole) {
  return {
    id: existing?.id || `project_approval_${randomUUID()}`,
    businessId: project.businessId,
    projectId: project.id,
    decision: requiredEnum(valueOf(source, existing, "decision"), APPROVAL_DECISIONS, "decision"),
    note: optionalText(valueOf(source, existing, "note"), 2000),
    actorRole: existing?.actorRole || actorRole || "admin",
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeSubscription(source, existing, businessId, now) {
  const frequency = requiredEnum(valueOf(source, existing, "frequency", "monthly"), SUBSCRIPTION_FREQUENCIES, "frequency");
  const intervalMonths = frequency === "custom"
    ? requiredInteger(valueOf(source, existing, "intervalMonths", 1), "intervalMonths", 1, 120)
    : ({ monthly: 1, quarterly: 3, yearly: 12 })[frequency];
  return {
    id: existing?.id || `subscription_${randomUUID()}`,
    businessId,
    name: requiredText(valueOf(source, existing, "name"), "name", 160),
    description: optionalText(valueOf(source, existing, "description"), 2000),
    price: requiredMoney(valueOf(source, existing, "price"), "price"),
    currency: requiredCurrency(valueOf(source, existing, "currency", "EUR")),
    frequency,
    intervalMonths,
    nextRenewal: requiredDate(valueOf(source, existing, "nextRenewal"), "nextRenewal"),
    status: requiredEnum(valueOf(source, existing, "status", "active"), SUBSCRIPTION_STATUSES, "status"),
    noticeDays: requiredInteger(valueOf(source, existing, "noticeDays", 15), "noticeDays", 0, 365),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeInvoice(source, existing, businessId, db, now) {
  const projectId = optionalId(valueOf(source, existing, "projectId"), "projectId");
  const proposalId = optionalId(valueOf(source, existing, "proposalId"), "proposalId");
  if (projectId && !db.projects.some((item) => item.id === projectId && item.businessId === businessId)) throw httpError(404, "Project not found");
  if (proposalId && !db.proposals.some((item) => item.id === proposalId && item.businessId === businessId)) throw httpError(404, "Proposal not found");
  const issueDate = requiredDate(valueOf(source, existing, "issueDate", todayValue()), "issueDate");
  const dueDate = requiredDate(valueOf(source, existing, "dueDate"), "dueDate");
  if (dueDate < issueDate) throw httpError(400, "dueDate cannot be before issueDate");
  const subtotal = requiredMoney(valueOf(source, existing, "subtotal"), "subtotal");
  const taxRate = requiredPercentage(valueOf(source, existing, "taxRate", 21), "taxRate");
  const taxAmount = roundMoney(subtotal * taxRate / 100);
  return {
    id: existing?.id || `invoice_${randomUUID()}`,
    businessId,
    projectId,
    proposalId,
    number: existing?.number || nextInvoiceNumber(db, issueDate),
    concept: requiredText(valueOf(source, existing, "concept"), "concept", 500),
    issueDate,
    dueDate,
    subtotal,
    taxRate,
    taxAmount,
    total: roundMoney(subtotal + taxAmount),
    currency: requiredCurrency(valueOf(source, existing, "currency", "EUR")),
    status: requiredEnum(valueOf(source, existing, "status", "draft"), INVOICE_STATUSES, "status"),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizePayment(source, existing, invoice, now) {
  const amount = requiredMoney(valueOf(source, existing, "amount"), "amount");
  if (amount <= 0) throw httpError(400, "amount must be greater than zero");
  return {
    id: existing?.id || `payment_${randomUUID()}`,
    businessId: invoice.businessId,
    invoiceId: invoice.id,
    amount,
    paidAt: requiredIsoDate(valueOf(source, existing, "paidAt", now), "paidAt"),
    method: optionalText(valueOf(source, existing, "method", "transfer"), 80) || "transfer",
    reference: optionalText(valueOf(source, existing, "reference"), 240),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function assertPaymentWithinBalance(db, invoice, payment, excludedPaymentId = "") {
  const alreadyPaid = db.payments
    .filter((item) => item.invoiceId === invoice.id && item.id !== excludedPaymentId)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (alreadyPaid + payment.amount > Number(invoice.total || 0) + 0.001) {
    throw httpError(400, "Payment amount exceeds the outstanding invoice balance");
  }
}

function normalizeDocument(source, existing, businessId, db, now, clientMode) {
  const projectId = optionalId(valueOf(source, existing, "projectId"), "projectId");
  const invoiceId = optionalId(valueOf(source, existing, "invoiceId"), "invoiceId");
  const proposalId = optionalId(valueOf(source, existing, "proposalId"), "proposalId");
  if (projectId && !db.projects.some((item) => item.id === projectId && item.businessId === businessId)) throw httpError(404, "Project not found");
  if (invoiceId && !db.invoices.some((item) => item.id === invoiceId && item.businessId === businessId)) throw httpError(404, "Invoice not found");
  if (proposalId && !db.proposals.some((item) => item.id === proposalId && item.businessId === businessId)) throw httpError(404, "Proposal not found");
  return {
    id: existing?.id || `document_${randomUUID()}`,
    businessId,
    projectId,
    invoiceId,
    proposalId,
    name: requiredText(valueOf(source, existing, "name"), "name", 240),
    category: clientMode ? "client-file" : requiredEnum(valueOf(source, existing, "category", "other"), DOCUMENT_CATEGORIES, "category"),
    url: requiredHttpUrl(valueOf(source, existing, "url"), "url"),
    visibility: clientMode ? "client" : requiredEnum(valueOf(source, existing, "visibility", "client"), DOCUMENT_VISIBILITIES, "visibility"),
    uploadedBy: existing?.uploadedBy || (clientMode ? "client" : "admin"),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function decorateProject(db, project) {
  const tasks = db.projectTasks.filter((task) => task.projectId === project.id).sort(compareUpdated);
  const files = db.projectFiles.filter((file) => file.projectId === project.id).sort(compareUpdated);
  const comments = db.projectComments.filter((comment) => comment.projectId === project.id).sort(compareUpdated);
  const approvals = db.projectApprovals.filter((approval) => approval.projectId === project.id).sort(compareUpdated);
  return {
    ...project,
    overdue: isProjectOverdue(project, todayValue()),
    tasks,
    files,
    comments,
    approvals,
    progress: tasks.length ? Math.round(tasks.filter((task) => task.status === "done").length / tasks.length * 100) : 0
  };
}

function decorateInvoice(db, invoice) {
  const payments = db.payments.filter((payment) => payment.invoiceId === invoice.id).sort(comparePaymentDates);
  const paidAmount = roundMoney(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  return {
    ...invoice,
    payments,
    paidAmount,
    balance: roundMoney(Math.max(0, Number(invoice.total || 0) - paidAmount))
  };
}

function updateInvoicePaymentStatus(db, invoice, now) {
  if (invoice.status === "cancelled") return;
  const paidAmount = db.payments.filter((payment) => payment.invoiceId === invoice.id)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  if (paidAmount >= Number(invoice.total || 0) && Number(invoice.total || 0) > 0) {
    invoice.status = "paid";
  } else if (invoice.status === "paid") {
    invoice.status = invoice.dueDate < todayValue() ? "overdue" : "sent";
  }
  invoice.updatedAt = now;
}

function expireInvoices(db, businessId, now) {
  let expired = 0;
  db.invoices.filter((invoice) => (!businessId || invoice.businessId === businessId) && invoice.status === "sent" && invoice.dueDate < todayValue())
    .forEach((invoice) => {
      invoice.status = "overdue";
      invoice.updatedAt = now;
      expired += 1;
    });
  return expired;
}

function decorateSubscription(subscription) {
  const daysUntilRenewal = differenceInDays(todayValue(), subscription.nextRenewal);
  return {
    ...subscription,
    daysUntilRenewal,
    renewalAlert: subscription.status === "active" && daysUntilRenewal <= subscription.noticeDays
  };
}

function buildSummary(db, businessId) {
  const projects = db.projects.filter((item) => !businessId || item.businessId === businessId);
  const subscriptions = db.subscriptions.filter((item) => !businessId || item.businessId === businessId);
  const activeSubscriptions = subscriptions.filter((item) => item.status === "active");
  const renewalAlerts = activeSubscriptions.map(decorateSubscription).filter((item) => item.renewalAlert).sort(compareRenewals);
  const today = todayValue();
  expireInvoices(db, businessId, new Date().toISOString());
  const invoices = db.invoices.filter((item) => !businessId || item.businessId === businessId).map((item) => decorateInvoice(db, item));
  return {
    projects: projects.length,
    projectsByStatus: Object.fromEntries([...PROJECT_STATUSES].map((status) => [status, projects.filter((item) => item.status === status).length])),
    overdueProjects: projects.filter((item) => isProjectOverdue(item, today)).length,
    activeSubscriptions: activeSubscriptions.length,
    monthlyRecurringRevenue: roundMoney(activeSubscriptions.reduce((sum, item) => sum + Number(item.price || 0) / Number(item.intervalMonths || 1), 0)),
    renewalsNext30Days: activeSubscriptions.filter((item) => {
      const days = differenceInDays(today, item.nextRenewal);
      return days >= 0 && days <= 30;
    }).length,
    renewalAlerts,
    outstandingPayments: roundMoney(invoices.filter((item) => ["sent", "overdue"].includes(item.status)).reduce((sum, item) => sum + item.balance, 0)),
    overdueInvoices: invoices.filter((item) => item.status === "overdue").length,
    monthlyInvoiced: roundMoney(invoices.filter((item) => item.issueDate?.slice(0, 7) === today.slice(0, 7) && item.status !== "cancelled").reduce((sum, item) => sum + Number(item.total || 0), 0))
  };
}

async function loadDb(context) {
  const db = await loadBusinessStore(context);
  for (const key of ["businesses", "contacts", "proposals", "projects", "projectTasks", "projectFiles", "projectComments", "projectApprovals", "subscriptions", "invoices", "payments", "documents", "associations", "auditLog"]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  return db;
}

function syncProjectAssociations(db, project, now) {
  if (project.contactId) {
    upsertAssociation(db, {
      businessId: project.businessId,
      fromType: "contact",
      fromId: project.contactId,
      toType: "project",
      toId: project.id,
      kind: "customer",
      isPrimary: true,
      now
    });
  }
  if (project.proposalId) {
    upsertAssociation(db, {
      businessId: project.businessId,
      fromType: "proposal",
      fromId: project.proposalId,
      toType: "project",
      toId: project.id,
      kind: "related",
      isPrimary: false,
      now
    });
  }
}

function syncInvoiceAssociations(db, invoice, now) {
  if (invoice.projectId) {
    upsertAssociation(db, {
      businessId: invoice.businessId,
      fromType: "project",
      fromId: invoice.projectId,
      toType: "invoice",
      toId: invoice.id,
      kind: "related",
      isPrimary: false,
      now
    });
  }
  if (invoice.proposalId) {
    upsertAssociation(db, {
      businessId: invoice.businessId,
      fromType: "proposal",
      fromId: invoice.proposalId,
      toType: "invoice",
      toId: invoice.id,
      kind: "related",
      isPrimary: false,
      now
    });
  }
}

function requireBusiness(db, ref) {
  const business = db.businesses.find((item) => item.id === ref || item.slug === ref);
  if (!business) throw httpError(404, "Business not found");
  return business;
}

function requireProject(db, id, businessId) {
  const cleanId = requiredId(id, "projectId");
  const project = db.projects.find((item) => item.id === cleanId && (!businessId || item.businessId === businessId));
  if (!project) throw httpError(404, "Project not found");
  return project;
}

function requireSubscription(db, id, businessId) {
  const cleanId = requiredId(id, "subscriptionId");
  const subscription = db.subscriptions.find((item) => item.id === cleanId && (!businessId || item.businessId === businessId));
  if (!subscription) throw httpError(404, "Subscription not found");
  return subscription;
}

function requireInvoice(db, id, businessId) {
  const cleanId = requiredId(id, "invoiceId");
  const invoice = db.invoices.find((item) => item.id === cleanId && (!businessId || item.businessId === businessId));
  if (!invoice) throw httpError(404, "Invoice not found");
  return invoice;
}

function requireDocument(db, id, businessId, clientMode) {
  const cleanId = requiredId(id, "documentId");
  const document = db.documents.find((item) => item.id === cleanId && (!businessId || item.businessId === businessId) && (!clientMode || item.visibility === "client"));
  if (!document) throw httpError(404, "Document not found");
  return document;
}

function projectSearchText(db, project) {
  const business = db.businesses.find((item) => item.id === project.businessId) || {};
  return [project.name, project.description, project.responsible, project.status, project.priority, business.name, business.city]
    .map(clean).join(" ").toLowerCase();
}

function subscriptionSearchText(db, subscription) {
  const business = db.businesses.find((item) => item.id === subscription.businessId) || {};
  return [subscription.name, subscription.description, subscription.status, subscription.frequency, business.name]
    .map(clean).join(" ").toLowerCase();
}

function invoiceSearchText(db, invoice) {
  const business = db.businesses.find((item) => item.id === invoice.businessId) || {};
  return [invoice.number, invoice.concept, invoice.status, business.name].map(clean).join(" ").toLowerCase();
}

function canClientMutate(route, method) {
  if (method !== "POST" || !route.businessRef) return false;
  if (route.resource === "documents" && !route.resourceId) return true;
  return route.resource === "projects"
    && Boolean(route.resourceId)
    && !route.subresourceId
    && new Set(["files", "comments", "approvals"]).has(route.subresource);
}

function isProjectOverdue(project, today) {
  return Boolean(project.dueDate && project.dueDate < today && !new Set(["published", "maintenance"]).has(project.status));
}

function compareProjects(left, right) {
  if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
  return String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31")) || compareUpdated(left, right);
}

function compareRenewals(left, right) {
  return String(left.nextRenewal || "9999-12-31").localeCompare(String(right.nextRenewal || "9999-12-31")) || compareUpdated(left, right);
}

function comparePaymentDates(left, right) {
  return String(right.paidAt || right.createdAt || "").localeCompare(String(left.paidAt || left.createdAt || ""));
}

function compareUpdated(left, right) {
  return String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
}

function extractPayload(payload, wrapper) {
  if (!isPlainObject(payload)) throw httpError(400, "JSON body must be an object");
  if (Object.prototype.hasOwnProperty.call(payload, wrapper)) {
    if (Object.keys(payload).length !== 1 || !isPlainObject(payload[wrapper])) {
      throw httpError(400, `${wrapper} wrapper must be the only top-level field and contain an object`);
    }
    return payload[wrapper];
  }
  return payload;
}

function assertAllowedFields(source, fields, resource) {
  const unknown = Object.keys(source).filter((field) => !fields.has(field));
  if (unknown.length) throw httpError(400, `Unknown ${resource} field(s): ${unknown.join(", ")}`);
}

function assertHasFields(source, resource) {
  if (!Object.keys(source).length) throw httpError(400, `${capitalize(resource)} update needs at least one editable field`);
}

function valueOf(source, existing, field, fallback = "") {
  return Object.prototype.hasOwnProperty.call(source, field) ? source[field] : existing?.[field] ?? fallback;
}

function requiredEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.has(value)) throw httpError(400, `${field} has an invalid value`);
  return value;
}

function optionalEnum(value, allowed, field) {
  return value === null || value === undefined || value === "" ? "" : requiredEnum(value, allowed, field);
}

function requiredText(value, field, maxLength) {
  const result = optionalText(value, maxLength);
  if (!result) throw httpError(400, `${field} is required`);
  return result;
}

function optionalText(value, maxLength) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw httpError(400, "Text fields must be strings");
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function requiredId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) throw httpError(400, `${field} has an invalid format`);
  return value;
}

function optionalId(value, field) {
  return value === null || value === undefined || value === "" ? "" : requiredId(value, field);
}

function requiredDate(value, field) {
  const date = optionalDate(value, field);
  if (!date) throw httpError(400, `${field} is required`);
  return date;
}

function optionalDate(value, field) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw httpError(400, `${field} must use YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw httpError(400, `${field} must be a valid date`);
  return value;
}

function requiredMoney(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000000 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) {
    throw httpError(400, `${field} must be a non-negative amount with at most two decimals`);
  }
  return value;
}

function requiredPercentage(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) {
    throw httpError(400, `${field} must be between 0 and 100 with at most two decimals`);
  }
  return value;
}

function requiredIsoDate(value, field) {
  if (typeof value !== "string" || value.length > 80) throw httpError(400, `${field} must be an ISO date-time string`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw httpError(400, `${field} must be a valid ISO date-time`);
  return new Date(timestamp).toISOString();
}

function requiredInteger(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw httpError(400, `${field} must be an integer between ${min} and ${max}`);
  return value;
}

function optionalInteger(value, field, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return requiredInteger(parsed, field, min, max);
}

function requiredCurrency(value) {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) throw httpError(400, "currency must be a three-letter ISO code");
  return value;
}

function requiredHttpUrl(value, field) {
  if (typeof value !== "string" || value.length > 2000) throw httpError(400, `${field} must be a valid HTTP URL`);
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
    return url.toString();
  } catch {
    throw httpError(400, `${field} must be a valid HTTP URL`);
  }
}

async function readJsonBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, "Operations payload too large");
    raw += chunk.toString("utf8");
  }
  if (!raw.trim()) throw httpError(400, "JSON body is required");
  try { return JSON.parse(raw); } catch { throw httpError(400, "Invalid JSON body"); }
}

function appendAudit(db, type, entity, now, extra = {}) {
  db.auditLog.push({
    id: `audit_${randomUUID()}`,
    type,
    businessId: entity.businessId,
    entityId: entity.id,
    ...extra,
    createdAt: now
  });
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function differenceInDays(from, to) {
  return Math.ceil((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000);
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function nextInvoiceNumber(db, issueDate) {
  const year = issueDate.slice(0, 4);
  const prefix = `DLS-${year}-`;
  const sequence = db.invoices
    .map((invoice) => clean(invoice.number))
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

function requireMethod(actual, expected) {
  if (actual !== expected) throw methodNotAllowed(`${expected}, OPTIONS`);
}

function methodNotAllowed(allow) {
  const error = httpError(405, "Method not allowed");
  error.allow = allow;
  return error;
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
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: "GET, POST, PATCH, DELETE, OPTIONS" });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "Resource";
}

function clean(value) {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
