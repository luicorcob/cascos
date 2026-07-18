import assert from "node:assert/strict";
import {
  addProposalComment,
  applyCheckoutProviderResult,
  approveProposalDiscount,
  completeQuoteCheckout,
  createProposalShare,
  createProposalVersion,
  createQuoteCheckoutRecord,
  decideProposal,
  decorateQuoteProposal,
  ensureAcceptedQuoteOutputs,
  ensureQuoteCollections,
  initializeProposalQuote,
  publicProposalPayload,
  recordProposalView,
  resolveProposalShare,
  updateProposalQuote
} from "../lib/quote-to-cash.mjs";

const now = "2026-07-17T12:00:00.000Z";
const business = { id: "biz_quote", slug: "quote", name: "DLS Quote", ownerName: "Ana", ownerEmail: "hola@example.com" };
const contact = { id: "contact_quote", businessId: business.id, name: "Laura Cliente", email: "laura@example.com", status: "won", tags: [], createdAt: now, updatedAt: now };
const proposal = { id: "proposal_quote", businessId: business.id, contactId: contact.id, package: "custom", setupPrice: 1000, monthlyPrice: 100, conditions: "Pago seguro y entrega en treinta dias.", expiresAt: "2026-08-17T12:00:00.000Z", status: "borrador", createdAt: now, updatedAt: now };
const db = ensureQuoteCollections({ businesses: [business], contacts: [contact], proposals: [proposal] });

initializeProposalQuote(proposal, {
  title: "Transformacion digital completa", currency: "EUR", signatureRequired: true,
  lineItems: [
    { description: "Implantacion", quantity: 1, unitPrice: 1000, discountPercent: 25, taxRate: 21, billing: "one_time" },
    { description: "Soporte mensual", quantity: 1, unitPrice: 100, discountPercent: 0, taxRate: 21, billing: "recurring" }
  ],
  deposit: { mode: "percent", value: 50 }
}, now);
assert.equal(proposal.total, 1028.5);
assert.equal(proposal.deposit.amount, 514.25);
assert.equal(proposal.approval.required, true);
const v1 = createProposalVersion(db, proposal, { label: "Oferta inicial" }, now);
assert.equal(v1.number, 1);
assert.throws(() => createProposalShare(db, business, proposal, {}, now), /discount approval/);
approveProposalDiscount(db, business.id, proposal.id, { actorId: "director", note: "Descuento aprobado" }, now);

updateProposalQuote(proposal, { title: "Transformacion digital completa 2026" }, "2026-07-17T12:05:00.000Z");
const v2 = createProposalVersion(db, proposal, { label: "Oferta final" }, "2026-07-17T12:05:00.000Z");
assert.equal(v2.number, 2);
assert.notEqual(v1.contentHash, v2.contentHash);
const shared = createProposalShare(db, business, proposal, { publicBaseUrl: "https://crm.example.com" }, "2026-07-17T12:06:00.000Z");
assert.match(shared.url, /^https:\/\/crm\.example\.com\/pages\/proposal\.html\?quote=/);
assert.ok(!db.proposalShares[0].tokenHash.includes(shared.token));
const context = resolveProposalShare(db, shared.token, "2026-07-17T12:07:00.000Z");
recordProposalView(db, context, { ip: "127.0.0.1", userAgent: "test" }, "2026-07-17T12:07:00.000Z");
recordProposalView(db, context, { ip: "127.0.0.1", userAgent: "test" }, "2026-07-17T12:08:00.000Z");
assert.equal(proposal.status, "vista");
assert.equal(proposal.publicState.viewCount, 2);
addProposalComment(db, context, { authorName: "Laura Cliente", authorEmail: "laura@example.com", message: "Quiero confirmar el calendario." }, "2026-07-17T12:09:00.000Z");
const accepted = decideProposal(db, context, { decision: "accepted", signerName: "Laura Cliente", signerEmail: "laura@example.com", signatureType: "typed", signatureValue: "Laura Cliente", acceptedTerms: true, idempotencyKey: "accept-quote-1" }, { fingerprint: "test-fingerprint", userAgent: "test" }, "2026-07-17T12:10:00.000Z");
assert.equal(proposal.status, "aceptada");
assert.ok(accepted.outputs.project);
assert.ok(accepted.outputs.invoice);
assert.ok(accepted.outputs.subscription);
assert.equal(accepted.outputs.paymentSchedule.length, 2);
assert.equal(ensureAcceptedQuoteOutputs(db, business, contact, proposal, "2026-07-17T12:11:00.000Z").invoice.id, accepted.outputs.invoice.id, "Outputs must be idempotent");
assert.equal(db.projects.filter((item) => item.proposalId === proposal.id).length, 1);
assert.equal(db.invoices.filter((item) => item.proposalId === proposal.id).length, 1);
assert.equal(db.subscriptions.filter((item) => item.proposalId === proposal.id).length, 1);

const firstCheckout = createQuoteCheckoutRecord(db, context, { idempotencyKey: "deposit-checkout" }, "2026-07-17T12:12:00.000Z");
assert.equal(firstCheckout.checkout.amount, 514.25);
applyCheckoutProviderResult(db, firstCheckout.checkout.id, { provider: "stripe", providerSessionId: "cs_test_deposit", checkoutUrl: "https://checkout.stripe.com/test" }, "2026-07-17T12:12:30.000Z");
const firstPayment = completeQuoteCheckout(db, { providerSessionId: "cs_test_deposit", providerPaymentId: "pi_deposit", method: "stripe" }, "2026-07-17T12:13:00.000Z");
assert.equal(firstPayment.completed, true);
assert.equal(firstPayment.invoice.balance, 514.25);
assert.equal(decorateQuoteProposal(db, proposal).quoteStage, "partially_paid");
assert.equal(completeQuoteCheckout(db, { providerSessionId: "cs_test_deposit" }, "2026-07-17T12:13:30.000Z").duplicate, true);

const secondCheckout = createQuoteCheckoutRecord(db, context, { idempotencyKey: "balance-checkout" }, "2026-07-17T12:14:00.000Z");
applyCheckoutProviderResult(db, secondCheckout.checkout.id, { provider: "stripe", providerSessionId: "cs_test_balance", checkoutUrl: "https://checkout.stripe.com/test2" }, "2026-07-17T12:14:30.000Z");
const finalPayment = completeQuoteCheckout(db, { providerSessionId: "cs_test_balance", providerPaymentId: "pi_balance", method: "stripe" }, "2026-07-17T12:15:00.000Z");
assert.equal(finalPayment.invoice.status, "paid");
assert.equal(finalPayment.invoice.balance, 0);
assert.equal(decorateQuoteProposal(db, proposal).quoteStage, "paid");
const publicPayload = publicProposalPayload(db, context);
assert.equal(publicPayload.proposal.revision, 2);
assert.equal(publicPayload.decisions[0].evidenceHash.length, 64);
assert.equal(publicPayload.invoice.status, "paid");
assert.ok(db.auditLog.some((item) => item.type === "proposal.payment_received"));
console.log("Quote-to-cash model checks passed: line items, tax, discount approval, immutable versions, secure shares, views, comments, signature evidence, idempotent project/invoice/subscription, schedules and partial/full payments.");
