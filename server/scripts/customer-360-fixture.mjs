export function seedCustomer360Fixture(db, options = {}) {
  const businessId = options.businessId || "biz_demo_brasa_norte";
  const now = new Date(options.now || "2026-07-17T12:00:00.000Z");
  const ids = {
    vip: "contact_customer_360_vip",
    risk: "contact_customer_360_risk",
    account: "account_customer_360",
    proposal: "proposal_customer_360",
    project: "project_customer_360",
    invoice: "invoice_customer_360",
    payment: "payment_customer_360",
    overdueInvoice: "hospitality_invoice_customer_360_overdue",
    paidHospitalityInvoice: "hospitality_invoice_customer_360_paid",
    conversation: "thread_customer_360",
    task: "task_customer_360"
  };
  const collections = [
    "contacts", "activities", "accounts", "associations", "deals", "tasks", "consentEvents", "proposals", "projects",
    "invoices", "payments", "hospitalityInvoices", "communicationThreads", "communicationMessages", "bookings"
  ];
  collections.forEach((key) => { db[key] = Array.isArray(db[key]) ? db[key] : []; });
  const business = (db.businesses || []).find((item) => item.id === businessId);
  if (!business) throw new Error(`Fixture business ${businessId} not found`);
  business.content = { ...(business.content || {}), currency: "EUR", commerce: { ...(business.content?.commerce || {}), currency: "EUR" } };

  const removeIds = new Set(Object.values(ids));
  collections.forEach((key) => { db[key] = db[key].filter((item) => !removeIds.has(item.id) && !String(item.id || "").startsWith("booking_customer_360_")); });

  db.contacts.push(
    { id: ids.vip, businessId, name: "Clara VIP 360", email: "clara360@example.com", phone: "+34611000111", status: "customer", type: "customer", source: "referral", tags: ["segment:Embajadores"], createdAt: iso(addDays(now, -240)), updatedAt: iso(addDays(now, -2)), lastInteractionAt: iso(addDays(now, -2)) },
    { id: ids.risk, businessId, name: "Ramon Riesgo 360", email: "ramon360@example.com", phone: "+34622000222", status: "customer", type: "customer", source: "web", createdAt: iso(addDays(now, -300)), updatedAt: iso(addDays(now, -30)), lastInteractionAt: iso(addDays(now, -30)) }
  );
  db.accounts.push({ id: ids.account, businessId, name: "Familia Clara 360", type: "household", status: "active", createdAt: iso(addDays(now, -200)), updatedAt: iso(addDays(now, -2)) });
  db.associations.push({ id: "association_customer_360_account", businessId, fromType: "contact", fromId: ids.vip, toType: "account", toId: ids.account, kind: "member", isPrimary: true, createdAt: iso(addDays(now, -200)), updatedAt: iso(addDays(now, -2)), archivedAt: "" });

  [-180, -150, -120, -90, -60, -20].forEach((days, index) => db.bookings.push(booking(`booking_customer_360_vip_${index + 1}`, businessId, ids.vip, "Clara VIP 360", "clara360@example.com", "+34611000111", "Menu degustacion", addDays(now, days), "completed")));
  db.bookings.push(booking("booking_customer_360_vip_future", businessId, ids.vip, "Clara VIP 360", "clara360@example.com", "+34611000111", "Menu degustacion", addDays(now, 10), "confirmed"));
  [-220, -140].forEach((days, index) => db.bookings.push(booking(`booking_customer_360_risk_${index + 1}`, businessId, ids.risk, "Ramon Riesgo 360", "ramon360@example.com", "+34622000222", "Cena para dos", addDays(now, days), "completed")));
  db.bookings.push(booking("booking_customer_360_risk_no_show", businessId, ids.risk, "Ramon Riesgo 360", "ramon360@example.com", "+34622000222", "Cena para dos", addDays(now, -30), "no-show"));

  db.deals.push({ id: "deal_customer_360", businessId, contactId: ids.vip, title: "Evento privado VIP", value: 3200, currency: "EUR", status: "open", stageId: "waiting", createdAt: iso(addDays(now, -15)), updatedAt: iso(addDays(now, -2)), archivedAt: "" });
  db.proposals.push({ id: ids.proposal, businessId, contactId: ids.vip, package: "custom", setupPrice: 1800, monthlyPrice: 0, conditions: "Evento privado", expiresAt: iso(addDays(now, 7)), status: "enviada", createdAt: iso(addDays(now, -5)), updatedAt: iso(addDays(now, -2)) });
  db.projects.push({ id: ids.project, businessId, proposalId: ids.proposal, contactId: ids.vip, name: "Experiencia VIP 360", status: "active", priority: "high", createdAt: iso(addDays(now, -5)), updatedAt: iso(addDays(now, -2)) });
  db.invoices.push({ id: ids.invoice, businessId, projectId: ids.project, proposalId: ids.proposal, number: "DLS-2026-0360", concept: "Evento VIP", issueDate: dateOnly(addDays(now, -12)), dueDate: dateOnly(addDays(now, -2)), subtotal: 1000, taxRate: 21, taxAmount: 210, total: 1210, currency: "EUR", status: "paid", createdAt: iso(addDays(now, -12)), updatedAt: iso(addDays(now, -3)) });
  db.payments.push({ id: ids.payment, businessId, invoiceId: ids.invoice, amount: 1210, paidAt: iso(addDays(now, -3)), method: "card", createdAt: iso(addDays(now, -3)), updatedAt: iso(addDays(now, -3)) });
  db.hospitalityInvoices.push(
    { id: ids.paidHospitalityInvoice, businessId, customerName: "Ramon Riesgo 360", concept: "Cena especial", issueDate: dateOnly(addDays(now, -135)), dueDate: dateOnly(addDays(now, -125)), subtotal: 272.73, taxRate: 10, taxAmount: 27.27, total: 300, status: "paid", createdAt: iso(addDays(now, -135)), updatedAt: iso(addDays(now, -125)) },
    { id: ids.overdueInvoice, businessId, customerName: "Ramon Riesgo 360", concept: "Reserva de grupo", issueDate: dateOnly(addDays(now, -45)), dueDate: dateOnly(addDays(now, -20)), subtotal: 227.27, taxRate: 10, taxAmount: 22.73, total: 250, status: "overdue", createdAt: iso(addDays(now, -45)), updatedAt: iso(addDays(now, -20)) }
  );
  db.communicationThreads.push({ id: ids.conversation, businessId, type: "commercial", title: "Preferencias VIP", contactId: ids.vip, status: "open", createdAt: iso(addDays(now, -10)), updatedAt: iso(addDays(now, -2)) });
  db.tasks.push({ id: ids.task, businessId, title: "Preparar detalle VIP", status: "pending", priority: "high", dueAt: iso(addDays(now, 2)), createdAt: iso(addDays(now, -1)), updatedAt: iso(addDays(now, -1)), archivedAt: "" });
  db.associations.push(
    { id: "association_customer_360_conversation", businessId, fromType: "contact", fromId: ids.vip, toType: "conversation", toId: ids.conversation, kind: "participant", isPrimary: true, createdAt: iso(addDays(now, -10)), updatedAt: iso(addDays(now, -2)), archivedAt: "" },
    { id: "association_customer_360_task", businessId, fromType: "contact", fromId: ids.vip, toType: "task", toId: ids.task, kind: "related", isPrimary: true, createdAt: iso(addDays(now, -1)), updatedAt: iso(addDays(now, -1)), archivedAt: "" }
  );
  db.activities.push(
    { id: "activity_customer_360_vip", businessId, contactId: ids.vip, type: "customer.note", title: "Preferencias confirmadas", note: "Mesa tranquila y menu degustacion", createdAt: iso(addDays(now, -2)) },
    { id: "activity_customer_360_risk", businessId, contactId: ids.risk, type: "booking.no_show", title: "No-show registrado", note: "No asistio a la reserva", createdAt: iso(addDays(now, -30)) }
  );
  db.consentEvents.push(
    consent("consent_customer_360_service", businessId, ids.vip, "any", "service", "acknowledged", "contract", addDays(now, -200)),
    consent("consent_customer_360_email_marketing", businessId, ids.vip, "email", "marketing", "granted", "consent", addDays(now, -60)),
    consent("consent_customer_360_email_reviews", businessId, ids.vip, "email", "reviews", "granted", "consent", addDays(now, -60)),
    consent("consent_customer_360_risk_service", businessId, ids.risk, "any", "service", "acknowledged", "contract", addDays(now, -250))
  );
  return ids;
}

function booking(id, businessId, contactId, customerName, email, phone, serviceName, startsAt, status) {
  const end = new Date(startsAt); end.setUTCHours(end.getUTCHours() + 2);
  return { id, businessId, contactId, customerName, email, phone, serviceId: "svc_customer_360", serviceName, durationMinutes: 120, startsAt: iso(startsAt), endsAt: iso(end), status, source: "fixture", createdAt: iso(addDays(startsAt, -5)), updatedAt: iso(startsAt) };
}
function consent(id, businessId, contactId, channel, purpose, action, lawfulBasis, at) { return { id, businessId, contactId, channel, purpose, action, lawfulBasis, source: "customer-360-fixture", textVersion: "v1", actorType: "system", actorId: "fixture", evidence: {}, occurredAt: iso(at), createdAt: iso(at) }; }
function addDays(value, days) { const date = new Date(value); date.setUTCDate(date.getUTCDate() + days); return date; }
function dateOnly(value) { return iso(value).slice(0, 10); }
function iso(value) { return new Date(value).toISOString(); }
