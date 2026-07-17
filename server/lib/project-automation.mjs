import { randomUUID } from "node:crypto";

const ACCEPTED_STATUS = "aceptada";

export function ensureProjectForAcceptedProposal(db, proposal, options = {}) {
  if (!proposal || proposal.status !== ACCEPTED_STATUS) {
    return { created: false, project: null };
  }

  db.projects = Array.isArray(db.projects) ? db.projects : [];
  db.projectTasks = Array.isArray(db.projectTasks) ? db.projectTasks : [];
  db.projectFiles = Array.isArray(db.projectFiles) ? db.projectFiles : [];
  db.projectComments = Array.isArray(db.projectComments) ? db.projectComments : [];
  db.projectApprovals = Array.isArray(db.projectApprovals) ? db.projectApprovals : [];

  const existing = db.projects.find((project) => (
    project.businessId === proposal.businessId && project.proposalId === proposal.id
  ));
  if (existing) {
    return { created: false, project: existing };
  }

  const now = validIso(options.now) || new Date().toISOString();
  const business = options.business || db.businesses?.find((item) => item.id === proposal.businessId) || {};
  const contact = options.contact || db.contacts?.find((item) => (
    item.businessId === proposal.businessId && item.id === proposal.contactId
  )) || {};
  const startDate = now.slice(0, 10);
  const dueDate = addDays(startDate, Number(options.deliveryDays || 30));
  const packageLabel = packageName(proposal.package);
  const customerName = clean(contact.name || contact.company || business.name || "Cliente");
  const project = {
    id: `project_${randomUUID()}`,
    businessId: proposal.businessId,
    proposalId: proposal.id,
    contactId: proposal.contactId || "",
    name: `${packageLabel} - ${customerName}`.slice(0, 160),
    description: clean(proposal.conditions).slice(0, 4000),
    responsible: clean(options.responsible || business.ownerName || "Equipo DLS").slice(0, 120),
    priority: "medium",
    status: "pending",
    startDate,
    dueDate,
    createdAt: now,
    updatedAt: now
  };

  db.projects.push(project);
  return { created: true, project };
}

function packageName(value) {
  return ({
    presencia_local: "Presencia local",
    conversion_pro: "Conversion Pro",
    growth_local: "Growth local",
    custom: "Proyecto personalizado"
  })[value] || "Proyecto web";
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(1, Math.min(365, Math.round(days || 30))));
  return date.toISOString().slice(0, 10);
}

function validIso(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function clean(value) {
  return String(value || "").trim();
}
