export const DEAL_PRIORITIES = Object.freeze(["alta", "media", "baja"]);
export const DEAL_STAGE_TYPES = Object.freeze(["open", "won", "lost"]);

export const DEFAULT_DEAL_STAGES = Object.freeze([
  Object.freeze({ id: "new", name: "Nuevo", type: "open", order: 100, probability: 10 }),
  Object.freeze({ id: "contacted", name: "Contactado", type: "open", order: 200, probability: 25 }),
  Object.freeze({ id: "waiting", name: "En espera", type: "open", order: 300, probability: 40 }),
  Object.freeze({ id: "reserved", name: "Reserva / reunion", type: "open", order: 400, probability: 60 }),
  Object.freeze({ id: "won", name: "Ganada", type: "won", order: 500, probability: 100 }),
  Object.freeze({ id: "lost", name: "Perdida", type: "lost", order: 600, probability: 0 })
]);

export function defaultPipelineId(businessId) {
  const suffix = String(businessId || "business")
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 120) || "business";
  return `pipeline_sales_${suffix}`;
}

export function createDefaultPipeline(businessId, now = new Date().toISOString()) {
  return {
    id: defaultPipelineId(businessId),
    businessId,
    name: "Ventas",
    kind: "sales",
    isDefault: true,
    stages: DEFAULT_DEAL_STAGES.map((stage) => ({ ...stage })),
    createdAt: now,
    updatedAt: now
  };
}

export function ensureDefaultPipelineRecord(db, businessId, now = new Date().toISOString()) {
  db.pipelines = Array.isArray(db.pipelines) ? db.pipelines : [];
  const scoped = db.pipelines.filter((pipeline) => pipeline.businessId === businessId && !pipeline.archivedAt);
  const existing = scoped.find((pipeline) => pipeline.isDefault)
    || scoped.find((pipeline) => pipeline.id === defaultPipelineId(businessId));

  if (existing) {
    return { pipeline: existing, created: false };
  }

  const pipeline = createDefaultPipeline(businessId, now);
  db.pipelines.push(pipeline);
  return { pipeline, created: true };
}

export function getBusinessPipelines(db, businessId, options = {}) {
  const pipelines = (Array.isArray(db.pipelines) ? db.pipelines : [])
    .filter((pipeline) => pipeline.businessId === businessId)
    .filter((pipeline) => options.includeArchived || !pipeline.archivedAt)
    .sort(comparePipelines);

  return pipelines.length ? pipelines : [createDefaultPipeline(businessId, options.now)];
}

export function sortedPipelineStages(pipeline) {
  return (Array.isArray(pipeline?.stages) ? pipeline.stages : [])
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0) || String(left.id).localeCompare(String(right.id)));
}

export function findPipelineStage(pipeline, stageId) {
  return sortedPipelineStages(pipeline).find((stage) => stage.id === stageId) || null;
}

export function dealStatusForStage(stage) {
  if (stage?.type === "won") return "won";
  if (stage?.type === "lost") return "lost";
  return "open";
}

export function legacyStageId(contactStatus) {
  const value = String(contactStatus || "new").trim().toLowerCase();
  if (value === "customer") return "won";
  return DEFAULT_DEAL_STAGES.some((stage) => stage.id === value) ? value : "new";
}

export function compareDeals(left, right) {
  const leftOrder = Number(left?.order);
  const rightOrder = Number(right?.order);
  if (Number.isFinite(leftOrder) || Number.isFinite(rightOrder)) {
    const orderDifference = (Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER)
      - (Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER);
    if (orderDifference) return orderDifference;
  }

  const updatedDifference = Date.parse(right?.updatedAt || right?.createdAt || "")
    - Date.parse(left?.updatedAt || left?.createdAt || "");
  if (Number.isFinite(updatedDifference) && updatedDifference) return updatedDifference;
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function comparePipelines(left, right) {
  if (Boolean(left?.isDefault) !== Boolean(right?.isDefault)) {
    return left?.isDefault ? -1 : 1;
  }
  return String(left?.name || "").localeCompare(String(right?.name || ""), "es");
}
