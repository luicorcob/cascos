import { randomUUID } from "node:crypto";

export const ASSOCIATION_ENTITY_COLLECTIONS = Object.freeze({
  contact: "contacts",
  account: "accounts",
  deal: "deals",
  task: "tasks",
  proposal: "proposals",
  booking: "bookings",
  invoice: "invoices",
  hospitalityInvoice: "hospitalityInvoices",
  project: "projects",
  conversation: "communicationThreads"
});

export const ASSOCIATION_KINDS = Object.freeze([
  "related",
  "primary",
  "member",
  "decision_maker",
  "billing",
  "owner",
  "guest",
  "customer",
  "supplier",
  "participant"
]);

export function normalizeAssociationEntityType(value) {
  const type = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(ASSOCIATION_ENTITY_COLLECTIONS, type) ? type : "";
}

export function findBusinessEntity(db, businessId, type, id, options = {}) {
  const normalizedType = normalizeAssociationEntityType(type);
  const collection = ASSOCIATION_ENTITY_COLLECTIONS[normalizedType];
  if (!collection) return null;
  return (Array.isArray(db[collection]) ? db[collection] : []).find((record) => (
    record?.businessId === businessId
    && record?.id === id
    && (options.includeArchived || (!record.archivedAt && !record.merged))
  )) || null;
}

export function upsertAssociation(db, input) {
  db.associations = Array.isArray(db.associations) ? db.associations : [];
  const now = input.now || new Date().toISOString();
  const existing = db.associations.find((association) => (
    association.businessId === input.businessId
    && association.fromType === input.fromType
    && association.fromId === input.fromId
    && association.toType === input.toType
    && association.toId === input.toId
    && association.kind === input.kind
  ));

  if (existing) {
    existing.isPrimary = input.isPrimary === true;
    existing.archivedAt = "";
    existing.updatedAt = now;
    return { association: existing, created: false };
  }

  const association = {
    id: input.id || `association_${randomUUID()}`,
    businessId: input.businessId,
    fromType: input.fromType,
    fromId: input.fromId,
    toType: input.toType,
    toId: input.toId,
    kind: input.kind || "related",
    isPrimary: input.isPrimary === true,
    createdAt: now,
    updatedAt: now,
    archivedAt: ""
  };
  db.associations.push(association);
  return { association, created: true };
}

export function listEntityAssociations(db, businessId, entityType, entityId, options = {}) {
  return (Array.isArray(db.associations) ? db.associations : [])
    .filter((association) => association.businessId === businessId)
    .filter((association) => options.includeArchived || !association.archivedAt)
    .filter((association) => (
      (association.fromType === entityType && association.fromId === entityId)
      || (association.toType === entityType && association.toId === entityId)
    ))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}

export function archiveDealAccountAssociations(db, businessId, dealId, now = new Date().toISOString()) {
  let changed = 0;
  (Array.isArray(db.associations) ? db.associations : []).forEach((association) => {
    const isDealAccount = association.businessId === businessId
      && association.fromType === "deal"
      && association.fromId === dealId
      && association.toType === "account"
      && association.kind === "primary"
      && !association.archivedAt;
    if (isDealAccount) {
      association.archivedAt = now;
      association.updatedAt = now;
      changed += 1;
    }
  });
  return changed;
}

export function archiveEntityAssociations(db, businessId, entityType, entityId, now = new Date().toISOString()) {
  let changed = 0;
  (Array.isArray(db.associations) ? db.associations : []).forEach((association) => {
    const touchesEntity = association.businessId === businessId && !association.archivedAt && (
      (association.fromType === entityType && association.fromId === entityId)
      || (association.toType === entityType && association.toId === entityId)
    );
    if (touchesEntity) {
      association.archivedAt = now;
      association.updatedAt = now;
      changed += 1;
    }
  });
  return changed;
}

export function moveAssociationEntity(db, businessId, entityType, oldIds, survivorId, now = new Date().toISOString()) {
  const oldIdSet = new Set(oldIds);
  (Array.isArray(db.associations) ? db.associations : []).forEach((association) => {
    if (association.businessId !== businessId) return;
    let changed = false;
    if (association.fromType === entityType && oldIdSet.has(association.fromId)) {
      association.fromId = survivorId;
      changed = true;
    }
    if (association.toType === entityType && oldIdSet.has(association.toId)) {
      association.toId = survivorId;
      changed = true;
    }
    if (changed) association.updatedAt = now;
  });
  deduplicateAssociations(db, businessId, now);
}

export function deduplicateAssociations(db, businessId, now = new Date().toISOString()) {
  const seen = new Map();
  (Array.isArray(db.associations) ? db.associations : []).forEach((association) => {
    if (association.businessId !== businessId || association.archivedAt) return;
    if (association.fromType === association.toType && association.fromId === association.toId) {
      association.archivedAt = now;
      association.updatedAt = now;
      return;
    }
    const key = [association.fromType, association.fromId, association.toType, association.toId, association.kind].join(":");
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, association);
      return;
    }
    existing.isPrimary = existing.isPrimary || association.isPrimary;
    existing.updatedAt = now;
    association.archivedAt = now;
    association.updatedAt = now;
  });
}

export function associationCounterpart(association, entityType, entityId) {
  if (association.fromType === entityType && association.fromId === entityId) {
    return { type: association.toType, id: association.toId, direction: "outgoing" };
  }
  return { type: association.fromType, id: association.fromId, direction: "incoming" };
}

export function summarizeAssociatedEntity(type, record) {
  if (!record) return null;
  const name = record.name || record.title || record.concept || record.customerName || record.email || record.phone || record.id;
  return {
    type,
    id: record.id,
    name: String(name || "").trim(),
    status: record.status || "",
    email: record.email || "",
    phone: record.phone || "",
    value: Number(record.value || record.total || record.amount || 0),
    updatedAt: record.updatedAt || record.createdAt || ""
  };
}
