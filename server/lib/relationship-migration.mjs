import { findBusinessEntity, upsertAssociation } from "./association-model.mjs";

export function backfillBusinessAssociations(db, options = {}) {
  const now = options.now || new Date().toISOString();
  db.associations = Array.isArray(db.associations) ? db.associations : [];
  const summary = { candidates: 0, created: 0, existing: 0, skipped: 0 };

  const link = (businessId, fromType, fromId, toType, toId, kind = "related", isPrimary = false) => {
    if (!businessId || !fromId || !toId) return;
    summary.candidates += 1;
    if (!findBusinessEntity(db, businessId, fromType, fromId, { includeArchived: true })
      || !findBusinessEntity(db, businessId, toType, toId, { includeArchived: true })) {
      summary.skipped += 1;
      return;
    }
    const result = upsertAssociation(db, { businessId, fromType, fromId, toType, toId, kind, isPrimary, now });
    if (result.created) summary.created += 1;
    else summary.existing += 1;
  };

  for (const deal of array(db.deals)) {
    link(deal.businessId, "contact", deal.contactId, "deal", deal.id, "primary", true);
    link(deal.businessId, "deal", deal.id, "account", deal.accountId, "primary", true);
    link(deal.businessId, "contact", deal.contactId, "account", deal.accountId, "member", false);
  }
  for (const proposal of array(db.proposals)) {
    link(proposal.businessId, "contact", proposal.contactId, "proposal", proposal.id, "primary", true);
    link(proposal.businessId, "proposal", proposal.id, "deal", proposal.dealId, "related", false);
    link(proposal.businessId, "proposal", proposal.id, "account", proposal.accountId, "related", false);
  }
  for (const booking of array(db.bookings)) {
    link(booking.businessId, "contact", booking.contactId, "booking", booking.id, "customer", true);
    link(booking.businessId, "booking", booking.id, "account", booking.accountId, "related", false);
  }
  for (const project of array(db.projects)) {
    link(project.businessId, "contact", project.contactId, "project", project.id, "customer", true);
    link(project.businessId, "proposal", project.proposalId, "project", project.id, "related", false);
    link(project.businessId, "project", project.id, "account", project.accountId, "related", false);
  }
  for (const invoice of array(db.invoices)) {
    link(invoice.businessId, "project", invoice.projectId, "invoice", invoice.id, "related", false);
    link(invoice.businessId, "proposal", invoice.proposalId, "invoice", invoice.id, "related", false);
    link(invoice.businessId, "contact", invoice.contactId, "invoice", invoice.id, "billing", true);
    link(invoice.businessId, "invoice", invoice.id, "account", invoice.accountId, "billing", true);
  }
  for (const invoice of array(db.hospitalityInvoices)) {
    link(invoice.businessId, "contact", invoice.contactId, "hospitalityInvoice", invoice.id, "billing", true);
    link(invoice.businessId, "hospitalityInvoice", invoice.id, "account", invoice.accountId, "billing", true);
  }
  for (const conversation of array(db.communicationThreads)) {
    link(conversation.businessId, "contact", conversation.contactId, "conversation", conversation.id, "participant", true);
    link(conversation.businessId, "conversation", conversation.id, "account", conversation.accountId, "related", false);
    link(conversation.businessId, "conversation", conversation.id, "deal", conversation.dealId, "related", false);
  }

  return summary;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}
