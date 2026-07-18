import { createHash, randomBytes, randomUUID } from "node:crypto";
import { upsertAssociation } from "./association-model.mjs";
import { applyAcceptedProposalAutomation } from "./crm-automation.mjs";
import { ensureProjectForAcceptedProposal } from "./project-automation.mjs";

const DECISIONS = new Set(["accepted", "rejected", "changes_requested"]);
const SIGNATURE_TYPES = new Set(["typed", "drawn", "none"]);
const DEPOSIT_MODES = new Set(["none", "fixed", "percent", "full"]);
const BILLING_TYPES = new Set(["one_time", "recurring"]);

export function ensureQuoteCollections(db) {
  for (const key of ["businesses", "contacts", "activities", "associations", "proposals", "proposalVersions", "proposalShares", "proposalViews", "proposalComments", "proposalDecisions", "proposalPaymentSchedules", "quoteCheckouts", "projects", "projectTasks", "projectFiles", "projectComments", "projectApprovals", "subscriptions", "invoices", "payments", "auditLog"]) db[key] = Array.isArray(db[key]) ? db[key] : [];
  return db;
}

export function initializeProposalQuote(proposal, source = {}, now = new Date().toISOString()) {
  proposal.title = optionalText(source.title, 240) || proposalPackageLabel(proposal.package);
  proposal.currency = currency(source.currency || "EUR");
  proposal.lineItems = normalizeLineItems(source.lineItems, proposal);
  proposal.signatureRequired = source.signatureRequired !== false;
  proposal.deposit = normalizeDeposit(source.deposit, proposal.lineItems);
  proposal.paymentTerms = normalizePaymentTerms(source.paymentTerms, proposal);
  proposal.approval = normalizeApproval(source.approval, proposal.lineItems, now);
  proposal.revision = Number(proposal.revision || 1);
  proposal.publicState = proposal.publicState || { firstViewedAt: "", lastViewedAt: "", viewCount: 0, acceptedAt: "", rejectedAt: "", paidAt: "" };
  applyProposalTotals(proposal);
  return proposal;
}

export function updateProposalQuote(proposal, source = {}, now = new Date().toISOString()) {
  if (Object.prototype.hasOwnProperty.call(source, "title")) proposal.title = requiredText(source.title, "title", 240);
  if (Object.prototype.hasOwnProperty.call(source, "currency")) proposal.currency = currency(source.currency);
  if (Object.prototype.hasOwnProperty.call(source, "lineItems")) proposal.lineItems = normalizeLineItems(source.lineItems, proposal);
  if (Object.prototype.hasOwnProperty.call(source, "signatureRequired")) proposal.signatureRequired = Boolean(source.signatureRequired);
  if (Object.prototype.hasOwnProperty.call(source, "deposit")) proposal.deposit = normalizeDeposit(source.deposit, proposal.lineItems);
  if (Object.prototype.hasOwnProperty.call(source, "paymentTerms")) proposal.paymentTerms = normalizePaymentTerms(source.paymentTerms, proposal);
  if (Object.prototype.hasOwnProperty.call(source, "approval")) proposal.approval = normalizeApproval(source.approval, proposal.lineItems, now, proposal.approval);
  proposal.revision = Number(proposal.revision || 1) + 1;
  applyProposalTotals(proposal);
  return proposal;
}

export function createProposalVersion(db, proposal, input = {}, now = new Date().toISOString()) {
  ensureQuoteCollections(db);
  const number = db.proposalVersions.filter((item) => item.proposalId === proposal.id).reduce((max, item) => Math.max(max, Number(item.number || 0)), 0) + 1;
  const snapshot = proposalSnapshot(proposal);
  const version = {
    id: `proposal_version_${randomUUID()}`, businessId: proposal.businessId, proposalId: proposal.id, number,
    label: optionalText(input.label, 160) || `Version ${number}`, snapshot, contentHash: stableHash(snapshot),
    actorType: optionalToken(input.actorType, 80) || "admin", actorId: optionalText(input.actorId, 160), createdAt: now
  };
  db.proposalVersions.push(version);
  proposal.currentVersionId = version.id;
  proposal.revision = number;
  proposal.updatedAt = now;
  appendAudit(db, proposal.businessId, "proposal.version_created", now, { proposalId: proposal.id, versionId: version.id, number });
  return version;
}

export function ensureCurrentProposalVersion(db, proposal, now = new Date().toISOString()) {
  ensureQuoteCollections(db);
  const current = db.proposalVersions.find((item) => item.id === proposal.currentVersionId && item.proposalId === proposal.id);
  if (current && current.contentHash === stableHash(proposalSnapshot(proposal))) return current;
  return createProposalVersion(db, proposal, {}, now);
}

export function listProposalVersions(db, businessId, proposalId) {
  ensureQuoteCollections(db);
  return db.proposalVersions.filter((item) => item.businessId === businessId && item.proposalId === proposalId).sort((a, b) => Number(b.number) - Number(a.number));
}

export function approveProposalDiscount(db, businessId, proposalId, input = {}, now = new Date().toISOString()) {
  const proposal = requireProposal(db, businessId, proposalId);
  proposal.approval = { ...(proposal.approval || {}), required: true, status: input.approved === false ? "rejected" : "approved", approvedBy: optionalText(input.actorId, 160) || "admin", note: optionalText(input.note, 1000), decidedAt: now };
  proposal.updatedAt = now;
  appendAudit(db, businessId, "proposal.discount_approval", now, { proposalId, status: proposal.approval.status, actorId: proposal.approval.approvedBy });
  return decorateQuoteProposal(db, proposal);
}

export function createProposalShare(db, business, proposal, input = {}, now = new Date().toISOString()) {
  ensureQuoteCollections(db);
  if (proposal.approval?.required && proposal.approval.status !== "approved") throw modelError(409, "Proposal requires internal discount approval before sharing");
  const version = ensureCurrentProposalVersion(db, proposal, now);
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = validIso(input.expiresAt) || proposal.expiresAt;
  if (Date.parse(expiresAt) <= Date.parse(now)) throw modelError(400, "Share expiration must be in the future");
  db.proposalShares.filter((item) => item.proposalId === proposal.id && !item.revokedAt).forEach((item) => { item.revokedAt = now; item.updatedAt = now; });
  const share = { id: `proposal_share_${randomUUID()}`, businessId: proposal.businessId, proposalId: proposal.id, versionId: version.id, tokenHash: tokenHash(rawToken), expiresAt, revokedAt: "", createdBy: optionalText(input.actorId, 160) || "admin", createdAt: now, updatedAt: now };
  db.proposalShares.push(share);
  if (proposal.status === "borrador") proposal.status = "enviada";
  proposal.sharedAt = now;
  proposal.updatedAt = now;
  appendAudit(db, proposal.businessId, "proposal.shared", now, { proposalId: proposal.id, shareId: share.id, versionId: version.id });
  const baseUrl = optionalText(input.publicBaseUrl, 1000).replace(/\/$/, "");
  return { share: publicShare(share), token: rawToken, url: `${baseUrl || ""}/pages/proposal.html?quote=${encodeURIComponent(rawToken)}` };
}

export function revokeProposalShare(db, businessId, proposalId, shareId, now = new Date().toISOString()) {
  ensureQuoteCollections(db);
  const share = db.proposalShares.find((item) => item.businessId === businessId && item.proposalId === proposalId && item.id === shareId);
  if (!share) throw modelError(404, "Proposal share not found");
  share.revokedAt = share.revokedAt || now;
  share.updatedAt = now;
  appendAudit(db, businessId, "proposal.share_revoked", now, { proposalId, shareId });
  return publicShare(share);
}

export function resolveProposalShare(db, rawToken, now = new Date().toISOString()) {
  ensureQuoteCollections(db);
  const hash = tokenHash(requiredText(rawToken, "token", 200));
  const share = db.proposalShares.find((item) => item.tokenHash === hash);
  if (!share || share.revokedAt) throw modelError(404, "Proposal link not found or revoked");
  if (Date.parse(share.expiresAt) <= Date.parse(now)) throw modelError(410, "Proposal link has expired");
  const proposal = requireProposal(db, share.businessId, share.proposalId);
  const version = db.proposalVersions.find((item) => item.id === share.versionId && item.proposalId === proposal.id);
  if (!version) throw modelError(409, "Shared proposal version is unavailable");
  const business = db.businesses.find((item) => item.id === proposal.businessId) || {};
  const contact = db.contacts.find((item) => item.businessId === proposal.businessId && item.id === proposal.contactId) || {};
  return { share, proposal, version, business, contact };
}

export function recordProposalView(db, context, requestMeta = {}, now = new Date().toISOString()) {
  const fingerprint = stableHash({ ip: requestMeta.ip || "", userAgent: requestMeta.userAgent || "" }).slice(0, 32);
  const view = { id: `proposal_view_${randomUUID()}`, businessId: context.proposal.businessId, proposalId: context.proposal.id, shareId: context.share.id, versionId: context.version.id, fingerprint, referrer: optionalText(requestMeta.referrer, 1000), userAgent: optionalText(requestMeta.userAgent, 500), viewedAt: now, createdAt: now };
  db.proposalViews.push(view);
  const state = context.proposal.publicState || (context.proposal.publicState = {});
  state.firstViewedAt = state.firstViewedAt || now;
  state.lastViewedAt = now;
  state.viewCount = Number(state.viewCount || 0) + 1;
  if (context.proposal.status === "enviada") context.proposal.status = "vista";
  context.proposal.updatedAt = now;
  appendAudit(db, context.proposal.businessId, "proposal.viewed", now, { proposalId: context.proposal.id, shareId: context.share.id, versionId: context.version.id, viewId: view.id });
  return view;
}

export function addProposalComment(db, context, input = {}, now = new Date().toISOString()) {
  const comment = { id: `proposal_comment_${randomUUID()}`, businessId: context.proposal.businessId, proposalId: context.proposal.id, shareId: context.share.id, versionId: context.version.id, authorName: requiredText(input.authorName, "authorName", 160), authorEmail: optionalEmail(input.authorEmail), message: requiredText(input.message, "message", 4000), status: "open", createdAt: now, updatedAt: now };
  db.proposalComments.push(comment);
  appendActivity(db, context.proposal, "proposal.comment_received", "Comentario recibido en la propuesta", comment.message, now, { commentId: comment.id, versionId: context.version.id });
  appendAudit(db, context.proposal.businessId, "proposal.comment_received", now, { proposalId: context.proposal.id, commentId: comment.id });
  return comment;
}

export function decideProposal(db, context, input = {}, requestMeta = {}, now = new Date().toISOString()) {
  const decisionValue = requiredEnum(input.decision, DECISIONS, "decision");
  const idempotencyKey = optionalText(input.idempotencyKey, 240) || stableHash({ proposalId: context.proposal.id, decisionValue, signerEmail: input.signerEmail, versionId: context.version.id });
  const duplicate = db.proposalDecisions.find((item) => item.proposalId === context.proposal.id && item.idempotencyKey === idempotencyKey);
  if (duplicate) return { decision: duplicate, duplicate: true, outputs: ensureAcceptedQuoteOutputs(db, context.business, context.contact, context.proposal, now) };
  if (["aceptada", "rechazada", "caducada"].includes(context.proposal.status)) throw modelError(409, "Proposal already has a final decision");
  if (input.acceptedTerms !== true) throw modelError(400, "Terms must be explicitly accepted before submitting a decision");
  const signerName = requiredText(input.signerName, "signerName", 160);
  const signerEmail = optionalEmail(input.signerEmail) || optionalEmail(context.contact.email);
  const signatureType = requiredEnum(input.signatureType || (context.proposal.signatureRequired ? "typed" : "none"), SIGNATURE_TYPES, "signatureType");
  if (decisionValue === "accepted" && context.proposal.signatureRequired && signatureType === "none") throw modelError(400, "Signature is required");
  const signatureValue = signatureType === "none" ? "" : requiredText(input.signatureValue || signerName, "signatureValue", signatureType === "drawn" ? 200000 : 500);
  const decision = {
    id: `proposal_decision_${randomUUID()}`, businessId: context.proposal.businessId, proposalId: context.proposal.id, shareId: context.share.id, versionId: context.version.id,
    decision: decisionValue, signerName, signerEmail, signatureType, signatureValue, note: optionalText(input.note, 2000), acceptedTerms: true,
    termsSnapshot: context.version.snapshot.conditions, contentHash: context.version.contentHash, idempotencyKey,
    evidenceHash: stableHash({ proposalId: context.proposal.id, versionId: context.version.id, fingerprint: requestMeta.fingerprint || "", userAgent: requestMeta.userAgent || "", occurredAt: now }), occurredAt: now, createdAt: now
  };
  db.proposalDecisions.push(decision);
  const state = context.proposal.publicState || (context.proposal.publicState = {});
  let outputs = { project: null, invoice: null, subscription: null, paymentSchedule: [] };
  if (decisionValue === "accepted") {
    context.proposal.status = "aceptada";
    context.proposal.acceptedDecisionId = decision.id;
    context.proposal.acceptedVersionId = context.version.id;
    state.acceptedAt = now;
    applyAcceptedProposalAutomation(db, context.proposal, { now });
    outputs = ensureAcceptedQuoteOutputs(db, context.business, context.contact, context.proposal, now);
    appendActivity(db, context.proposal, "proposal.accepted", "Propuesta aceptada y firmada", `Firmada por ${signerName}.`, now, { decisionId: decision.id, versionId: context.version.id, invoiceId: outputs.invoice?.id || "", projectId: outputs.project?.id || "" });
  } else if (decisionValue === "rejected") {
    context.proposal.status = "rechazada";
    state.rejectedAt = now;
    appendActivity(db, context.proposal, "proposal.rejected", "Propuesta rechazada", decision.note || `Rechazada por ${signerName}.`, now, { decisionId: decision.id, versionId: context.version.id });
  } else {
    appendActivity(db, context.proposal, "proposal.changes_requested", "Cambios solicitados en la propuesta", decision.note || "El cliente solicita cambios.", now, { decisionId: decision.id, versionId: context.version.id });
  }
  context.proposal.updatedAt = now;
  appendAudit(db, context.proposal.businessId, `proposal.${decisionValue}`, now, { proposalId: context.proposal.id, decisionId: decision.id, versionId: context.version.id, evidenceHash: decision.evidenceHash });
  return { decision, duplicate: false, outputs };
}

export function ensureAcceptedQuoteOutputs(db, business, contact, proposal, now = new Date().toISOString()) {
  ensureQuoteCollections(db);
  if (proposal.status !== "aceptada") return { project: null, invoice: null, subscription: null, paymentSchedule: [] };
  const projectResult = ensureProjectForAcceptedProposal(db, proposal, { business, contact, now });
  const project = projectResult.project;
  let invoice = db.invoices.find((item) => item.businessId === proposal.businessId && item.proposalId === proposal.id);
  if (!invoice) {
    invoice = { id: `invoice_${randomUUID()}`, businessId: proposal.businessId, projectId: project?.id || "", proposalId: proposal.id, number: nextQuoteInvoiceNumber(db, now), concept: proposal.title || `Propuesta ${proposal.id}`, issueDate: now.slice(0, 10), dueDate: addDays(now.slice(0, 10), 7), subtotal: money(proposal.total || proposal.setupPrice + proposal.monthlyPrice), taxRate: 0, taxAmount: 0, total: money(proposal.total || proposal.setupPrice + proposal.monthlyPrice), currency: proposal.currency || "EUR", status: "sent", createdAt: now, updatedAt: now };
    db.invoices.push(invoice);
  }
  let subscription = null;
  if (Number(proposal.recurringTotal || proposal.monthlyPrice || 0) > 0) {
    subscription = db.subscriptions.find((item) => item.businessId === proposal.businessId && item.proposalId === proposal.id) || null;
    if (!subscription) {
      subscription = { id: `subscription_${randomUUID()}`, businessId: proposal.businessId, proposalId: proposal.id, contactId: proposal.contactId, projectId: project?.id || "", name: proposal.title || proposalPackageLabel(proposal.package), description: proposal.conditions || "", price: money(proposal.recurringTotal || proposal.monthlyPrice), currency: proposal.currency || "EUR", frequency: "monthly", intervalMonths: 1, nextRenewal: addMonths(now.slice(0, 10), 1), status: "active", noticeDays: 15, createdAt: now, updatedAt: now };
      db.subscriptions.push(subscription);
    }
  }
  let schedule = db.proposalPaymentSchedules.filter((item) => item.proposalId === proposal.id);
  if (!schedule.length) {
    const total = money(invoice.total);
    const depositAmount = Math.min(total, money(proposal.deposit?.amount));
    const rows = depositAmount > 0 && depositAmount < total
      ? [{ label: "Señal", amount: depositAmount, dueAt: now }, { label: "Saldo", amount: money(total - depositAmount), dueAt: new Date(Date.parse(now) + 7 * 86400000).toISOString() }]
      : [{ label: depositAmount >= total ? "Pago completo" : "Primer pago", amount: total, dueAt: now }];
    schedule = rows.map((row, index) => ({ id: `proposal_schedule_${randomUUID()}`, businessId: proposal.businessId, proposalId: proposal.id, invoiceId: invoice.id, order: index + 1, label: row.label, amount: row.amount, currency: invoice.currency, dueAt: row.dueAt, status: "pending", paymentId: "", paidAt: "", createdAt: now, updatedAt: now }));
    db.proposalPaymentSchedules.push(...schedule);
  }
  syncQuoteAssociations(db, proposal, project, invoice, subscription, now);
  appendAudit(db, proposal.businessId, "proposal.outputs_ensured", now, { proposalId: proposal.id, projectId: project?.id || "", invoiceId: invoice.id, subscriptionId: subscription?.id || "" });
  return { project, invoice: decorateInvoice(db, invoice), subscription, paymentSchedule: schedule };
}

export function createQuoteCheckoutRecord(db, context, input = {}, now = new Date().toISOString()) {
  const outputs = ensureAcceptedQuoteOutputs(db, context.business, context.contact, context.proposal, now);
  if (context.proposal.status !== "aceptada") throw modelError(409, "Proposal must be accepted before payment");
  const scheduleId = optionalText(input.scheduleId, 180);
  const schedule = (scheduleId ? outputs.paymentSchedule.find((item) => item.id === scheduleId) : outputs.paymentSchedule.find((item) => item.status === "pending")) || null;
  const invoice = db.invoices.find((item) => item.id === outputs.invoice.id);
  const paid = db.payments.filter((item) => item.invoiceId === invoice.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = money(Math.max(0, invoice.total - paid));
  const amount = money(Math.min(balance, Number(input.amount || schedule?.amount || balance)));
  if (!(amount > 0)) throw modelError(409, "Proposal has no outstanding amount");
  const idempotencyKey = optionalText(input.idempotencyKey, 240) || `quote_checkout_${context.proposal.id}_${schedule?.id || "balance"}`;
  const existing = db.quoteCheckouts.find((item) => item.proposalId === context.proposal.id && item.idempotencyKey === idempotencyKey && !["expired", "failed"].includes(item.status));
  if (existing) return { checkout: existing, duplicate: true, invoice: decorateInvoice(db, invoice), schedule };
  const checkout = { id: `quote_checkout_${randomUUID()}`, businessId: context.proposal.businessId, proposalId: context.proposal.id, shareId: context.share.id, versionId: context.version.id, invoiceId: invoice.id, scheduleId: schedule?.id || "", amount, currency: invoice.currency, provider: "", providerSessionId: "", providerPaymentId: "", checkoutUrl: "", idempotencyKey, status: "pending", expiresAt: new Date(Date.parse(now) + 24 * 3600000).toISOString(), paidAt: "", createdAt: now, updatedAt: now };
  db.quoteCheckouts.push(checkout);
  return { checkout, duplicate: false, invoice: decorateInvoice(db, invoice), schedule };
}

export function applyCheckoutProviderResult(db, checkoutId, providerResult = {}, now = new Date().toISOString()) {
  ensureQuoteCollections(db);
  const checkout = db.quoteCheckouts.find((item) => item.id === checkoutId);
  if (!checkout) throw modelError(404, "Checkout not found");
  checkout.provider = optionalToken(providerResult.provider, 80) || checkout.provider;
  checkout.providerSessionId = optionalText(providerResult.providerSessionId, 240) || checkout.providerSessionId;
  checkout.checkoutUrl = optionalText(providerResult.checkoutUrl, 2000) || checkout.checkoutUrl;
  checkout.expiresAt = validIso(providerResult.expiresAt) || checkout.expiresAt;
  checkout.updatedAt = now;
  return checkout;
}

export function completeQuoteCheckout(db, input = {}, now = new Date().toISOString()) {
  ensureQuoteCollections(db);
  const checkout = db.quoteCheckouts.find((item) => item.providerSessionId === input.providerSessionId || item.id === input.checkoutId);
  if (!checkout) return { completed: false, reason: "checkout_not_found" };
  if (checkout.status === "paid") return { completed: false, duplicate: true, checkout, payment: db.payments.find((item) => item.reference === checkout.providerSessionId) || null };
  const invoice = db.invoices.find((item) => item.id === checkout.invoiceId && item.businessId === checkout.businessId);
  if (!invoice) throw modelError(409, "Checkout invoice not found");
  const payment = { id: `payment_${randomUUID()}`, businessId: checkout.businessId, invoiceId: invoice.id, amount: checkout.amount, paidAt: validIso(input.paidAt) || now, method: optionalToken(input.method, 80) || "stripe", reference: optionalText(input.providerPaymentId, 240) || checkout.providerSessionId || checkout.id, createdAt: now, updatedAt: now };
  db.payments.push(payment);
  checkout.status = "paid";
  checkout.providerPaymentId = payment.reference;
  checkout.paidAt = payment.paidAt;
  checkout.updatedAt = now;
  const schedule = db.proposalPaymentSchedules.find((item) => item.id === checkout.scheduleId);
  if (schedule) { schedule.status = "paid"; schedule.paymentId = payment.id; schedule.paidAt = payment.paidAt; schedule.updatedAt = now; }
  const paidAmount = db.payments.filter((item) => item.invoiceId === invoice.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (paidAmount >= invoice.total - 0.001) invoice.status = "paid";
  invoice.updatedAt = now;
  const proposal = requireProposal(db, checkout.businessId, checkout.proposalId);
  const state = proposal.publicState || (proposal.publicState = {});
  if (invoice.status === "paid") state.paidAt = now;
  proposal.updatedAt = now;
  appendActivity(db, proposal, "proposal.payment_received", "Pago recibido", `${money(payment.amount)} ${invoice.currency}.`, now, { checkoutId: checkout.id, paymentId: payment.id, invoiceId: invoice.id });
  appendAudit(db, checkout.businessId, "proposal.payment_received", now, { proposalId: proposal.id, checkoutId: checkout.id, paymentId: payment.id, invoiceId: invoice.id, amount: payment.amount });
  return { completed: true, checkout, payment, invoice: decorateInvoice(db, invoice), proposal: decorateQuoteProposal(db, proposal) };
}

export function publicProposalPayload(db, context) {
  const proposal = context.version.snapshot;
  const decisions = db.proposalDecisions.filter((item) => item.proposalId === context.proposal.id).map(publicDecision);
  const invoice = db.invoices.find((item) => item.proposalId === context.proposal.id);
  const paymentSchedule = db.proposalPaymentSchedules.filter((item) => item.proposalId === context.proposal.id).sort((a, b) => a.order - b.order);
  return {
    business: { id: context.business.id, name: context.business.name || "", logo: context.business.content?.logo || "", email: context.business.ownerEmail || "", phone: context.business.ownerPhone || "" },
    customer: { name: context.contact.name || "Cliente", company: context.contact.company || "", email: context.contact.email || "" },
    proposal: { ...proposal, id: context.proposal.id, status: context.proposal.status, revision: context.version.number, publicState: context.proposal.publicState || {}, signatureRequired: context.proposal.signatureRequired !== false },
    share: publicShare(context.share), comments: db.proposalComments.filter((item) => item.proposalId === context.proposal.id).map(publicComment), decisions,
    invoice: invoice ? decorateInvoice(db, invoice) : null, paymentSchedule,
    checkout: db.quoteCheckouts.filter((item) => item.proposalId === context.proposal.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null
  };
}

export function decorateQuoteProposal(db, proposal) {
  ensureQuoteCollections(db);
  const views = db.proposalViews.filter((item) => item.proposalId === proposal.id);
  const comments = db.proposalComments.filter((item) => item.proposalId === proposal.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const decisions = db.proposalDecisions.filter((item) => item.proposalId === proposal.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const shares = db.proposalShares.filter((item) => item.proposalId === proposal.id).map(publicShare).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const versions = listProposalVersions(db, proposal.businessId, proposal.id);
  const project = db.projects.find((item) => item.proposalId === proposal.id) || null;
  const invoice = db.invoices.find((item) => item.proposalId === proposal.id) || null;
  const subscription = db.subscriptions.find((item) => item.proposalId === proposal.id) || null;
  const paymentSchedule = db.proposalPaymentSchedules.filter((item) => item.proposalId === proposal.id).sort((a, b) => a.order - b.order);
  return { ...proposal, versions: versions.map((item) => ({ id: item.id, number: item.number, label: item.label, contentHash: item.contentHash, createdAt: item.createdAt })), shares, views: { count: views.length, firstAt: views.map((item) => item.viewedAt).sort()[0] || "", lastAt: views.map((item) => item.viewedAt).sort().at(-1) || "" }, comments, decisions: decisions.map(publicDecision), projectId: project?.id || "", invoice: invoice ? decorateInvoice(db, invoice) : null, subscription, paymentSchedule, quoteStage: quoteStage(proposal, invoice, db) };
}

function applyProposalTotals(proposal) {
  const items = Array.isArray(proposal.lineItems) ? proposal.lineItems : [];
  proposal.subtotal = money(items.reduce((sum, item) => sum + item.netAmount, 0));
  proposal.discountAmount = money(items.reduce((sum, item) => sum + item.discountAmount, 0));
  proposal.taxAmount = money(items.reduce((sum, item) => sum + item.taxAmount, 0));
  proposal.total = money(items.reduce((sum, item) => sum + item.total, 0));
  proposal.oneTimeTotal = money(items.filter((item) => item.billing === "one_time").reduce((sum, item) => sum + item.total, 0));
  proposal.recurringTotal = money(items.filter((item) => item.billing === "recurring").reduce((sum, item) => sum + item.total, 0));
  proposal.deposit = normalizeDeposit(proposal.deposit, items, proposal.total);
}

function normalizeLineItems(value, proposal) {
  const source = Array.isArray(value) && value.length ? value : [
    ...(Number(proposal.setupPrice || 0) > 0 ? [{ description: `Alta ${proposalPackageLabel(proposal.package)}`, quantity: 1, unitPrice: proposal.setupPrice, discountPercent: 0, taxRate: 21, billing: "one_time" }] : []),
    ...(Number(proposal.monthlyPrice || 0) > 0 ? [{ description: `Cuota mensual ${proposalPackageLabel(proposal.package)}`, quantity: 1, unitPrice: proposal.monthlyPrice, discountPercent: 0, taxRate: 21, billing: "recurring" }] : [])
  ];
  if (!source.length || source.length > 100) throw modelError(400, "lineItems must contain between 1 and 100 items");
  return source.map((item, index) => {
    const row = item && typeof item === "object" ? item : {};
    const quantity = decimal(row.quantity, `lineItems[${index}].quantity`, 0.01, 100000);
    const unitPrice = decimal(row.unitPrice, `lineItems[${index}].unitPrice`, 0, 100000000);
    const discountPercent = decimal(row.discountPercent || 0, `lineItems[${index}].discountPercent`, 0, 100);
    const taxRate = decimal(row.taxRate ?? 21, `lineItems[${index}].taxRate`, 0, 100);
    const gross = money(quantity * unitPrice);
    const discountAmount = money(gross * discountPercent / 100);
    const netAmount = money(gross - discountAmount);
    const taxAmount = money(netAmount * taxRate / 100);
    return { id: optionalToken(row.id, 160) || `line_${index + 1}`, description: requiredText(row.description, `lineItems[${index}].description`, 500), quantity, unitPrice, discountPercent, discountAmount, netAmount, taxRate, taxAmount, total: money(netAmount + taxAmount), billing: requiredEnum(row.billing || "one_time", BILLING_TYPES, `lineItems[${index}].billing`) };
  });
}

function normalizeDeposit(value, items, knownTotal = null) { const source = value && typeof value === "object" ? value : {}; const mode = requiredEnum(source.mode || "none", DEPOSIT_MODES, "deposit.mode"); const total = knownTotal === null ? money((items || []).reduce((sum, item) => sum + Number(item.total || 0), 0)) : money(knownTotal); let amount = 0; if (mode === "fixed") amount = Math.min(total, decimal(source.value, "deposit.value", 0, total)); if (mode === "percent") amount = money(total * decimal(source.value, "deposit.value", 0, 100) / 100); if (mode === "full") amount = total; return { mode, value: mode === "full" ? 100 : Number(source.value || 0), amount }; }
function normalizePaymentTerms(value, proposal) { if (!Array.isArray(value)) return []; return value.slice(0, 24).map((item, index) => ({ label: requiredText(item?.label, `paymentTerms[${index}].label`, 160), amount: decimal(item?.amount, `paymentTerms[${index}].amount`, 0, 100000000), dueOffsetDays: integer(item?.dueOffsetDays || 0, `paymentTerms[${index}].dueOffsetDays`, 0, 3650) })); }
function normalizeApproval(value, items, now, existing = {}) { const maxDiscount = Math.max(0, ...(items || []).map((item) => Number(item.discountPercent || 0))); const threshold = decimal(value?.thresholdPercent ?? existing.thresholdPercent ?? 20, "approval.thresholdPercent", 0, 100); const required = maxDiscount > threshold; return { required, thresholdPercent: threshold, maxDiscountPercent: maxDiscount, status: required ? (value?.status === "approved" ? "approved" : existing.status === "approved" ? "approved" : "pending") : "not_required", approvedBy: required ? optionalText(value?.approvedBy || existing.approvedBy, 160) : "", note: optionalText(value?.note || existing.note, 1000), decidedAt: required && (value?.status === "approved" || existing.status === "approved") ? (validIso(value?.decidedAt) || existing.decidedAt || now) : "" }; }
function proposalSnapshot(proposal) { return { title: proposal.title, package: proposal.package, currency: proposal.currency, lineItems: structuredClone(proposal.lineItems || []), subtotal: proposal.subtotal, discountAmount: proposal.discountAmount, taxAmount: proposal.taxAmount, total: proposal.total, oneTimeTotal: proposal.oneTimeTotal, recurringTotal: proposal.recurringTotal, setupPrice: proposal.setupPrice, monthlyPrice: proposal.monthlyPrice, conditions: proposal.conditions, expiresAt: proposal.expiresAt, signatureRequired: proposal.signatureRequired !== false, deposit: structuredClone(proposal.deposit || {}), paymentTerms: structuredClone(proposal.paymentTerms || []) }; }
function syncQuoteAssociations(db, proposal, project, invoice, subscription, now) { const links = [["contact", proposal.contactId, "proposal", proposal.id, "primary", true], ...(project ? [["proposal", proposal.id, "project", project.id, "related", false], ["contact", proposal.contactId, "project", project.id, "customer", true]] : []), ...(invoice ? [["proposal", proposal.id, "invoice", invoice.id, "related", false], ["contact", proposal.contactId, "invoice", invoice.id, "customer", true]] : []), ...(subscription ? [["proposal", proposal.id, "subscription", subscription.id, "related", false], ["contact", proposal.contactId, "subscription", subscription.id, "customer", true]] : [])]; for (const [fromType, fromId, toType, toId, kind, isPrimary] of links) upsertAssociation(db, { businessId: proposal.businessId, fromType, fromId, toType, toId, kind, isPrimary, now }); }
function decorateInvoice(db, invoice) { const payments = db.payments.filter((item) => item.invoiceId === invoice.id); const paidAmount = money(payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)); return { ...invoice, payments, paidAmount, balance: money(Math.max(0, invoice.total - paidAmount)) }; }
function quoteStage(proposal, invoice, db) { if (proposal.status === "caducada") return "expired"; if (proposal.status === "rechazada") return "rejected"; if (proposal.status !== "aceptada") return ({ borrador: "draft", enviada: "sent", vista: "viewed" })[proposal.status] || proposal.status; if (!invoice) return "accepted"; const decorated = decorateInvoice(db, invoice); if (decorated.status === "paid") return "paid"; if (decorated.paidAmount > 0) return "partially_paid"; return "accepted"; }
function publicShare(share) { return { id: share.id, proposalId: share.proposalId, versionId: share.versionId, expiresAt: share.expiresAt, revokedAt: share.revokedAt, createdAt: share.createdAt }; }
function publicDecision(item) { return { id: item.id, decision: item.decision, signerName: item.signerName, signerEmail: item.signerEmail, signatureType: item.signatureType, note: item.note, evidenceHash: item.evidenceHash, occurredAt: item.occurredAt }; }
function publicComment(item) { return { id: item.id, authorName: item.authorName, message: item.message, status: item.status, createdAt: item.createdAt }; }
function appendActivity(db, proposal, type, title, note, now, metadata = {}) { const item = { id: `activity_${randomUUID()}`, businessId: proposal.businessId, contactId: proposal.contactId, type, title, note: optionalText(note, 4000), source: "quote-to-cash", metadata: { proposalId: proposal.id, ...metadata }, createdAt: now }; db.activities.push(item); return item; }
function appendAudit(db, businessId, type, createdAt, extra = {}) { db.auditLog.push({ id: `audit_${randomUUID()}`, businessId, type, ...extra, createdAt }); }
function requireProposal(db, businessId, proposalId) { ensureQuoteCollections(db); const proposal = db.proposals.find((item) => item.businessId === businessId && item.id === proposalId); if (!proposal) throw modelError(404, "Proposal not found"); return proposal; }
function nextQuoteInvoiceNumber(db, now) { const year = new Date(now).getUTCFullYear(); const count = db.invoices.filter((item) => String(item.number || "").startsWith(`QTC-${year}-`)).length + 1; return `QTC-${year}-${String(count).padStart(4, "0")}`; }
function addDays(value, days) { const date = new Date(`${value}T12:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function addMonths(value, months) { const date = new Date(`${value}T12:00:00.000Z`); date.setUTCMonth(date.getUTCMonth() + months); return date.toISOString().slice(0, 10); }
function tokenHash(value) { return createHash("sha256").update(String(value)).digest("hex"); }
function stableHash(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function proposalPackageLabel(value) { return ({ presencia_local: "Presencia local", conversion_pro: "Conversion Pro", growth_local: "Growth local", custom: "Proyecto personalizado" })[value] || "Propuesta personalizada"; }
function optionalEmail(value) { const text = optionalText(value, 320).toLowerCase(); if (!text) return ""; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw modelError(400, "Invalid email"); return text; }
function currency(value) { const text = String(value || "").trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(text)) throw modelError(400, "Invalid currency"); return text; }
function requiredEnum(value, allowed, field) { const result = String(value || "").trim(); if (!allowed.has(result)) throw modelError(400, `Invalid ${field}`); return result; }
function requiredText(value, field, max) { const result = optionalText(value, max); if (!result) throw modelError(400, `${field} is required`); return result; }
function optionalText(value, max) { if (value === undefined || value === null || value === "") return ""; const result = String(value).replace(/[\u0000-\u001F\u007F]/g, "").trim(); if (result.length > max) throw modelError(400, `Text cannot exceed ${max} characters`); return result; }
function optionalToken(value, max) { const text = String(value || "").trim(); return /^[A-Za-z0-9_.:-]+$/.test(text) ? text.slice(0, max) : ""; }
function validIso(value) { const timestamp = Date.parse(value || ""); return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : ""; }
function decimal(value, field, min, max) { const number = Number(value); if (!Number.isFinite(number) || number < min || number > max) throw modelError(400, `${field} must be between ${min} and ${max}`); return money(number); }
function integer(value, field, min, max) { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw modelError(400, `${field} must be an integer between ${min} and ${max}`); return number; }
function money(value) { const amount = Number(value); return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0; }
function modelError(statusCode, message, code = "quote_to_cash_error") { return Object.assign(new Error(message), { statusCode, code }); }
