import { randomUUID } from "node:crypto";
import { ensureDefaultPipelineRecord } from "./deal-model.mjs";

const FIELD_TYPES = new Set(["text", "textarea", "number", "currency", "date", "datetime", "boolean", "select", "multiselect", "email", "phone", "url"]);
const ENTITY_TYPES = new Set(["contact", "account", "deal", "task", "proposal", "booking", "project", "invoice"]);
const FILTER_OPERATORS = new Set(["eq", "neq", "contains", "not_contains", "gt", "gte", "lt", "lte", "in", "not_in", "empty", "not_empty"]);

export function ensureCrmConfigCollections(db) {
  db.customFieldDefinitions = Array.isArray(db.customFieldDefinitions) ? db.customFieldDefinitions : [];
  db.savedViews = Array.isArray(db.savedViews) ? db.savedViews : [];
  db.pipelineRules = Array.isArray(db.pipelineRules) ? db.pipelineRules : [];
  db.pipelines = Array.isArray(db.pipelines) ? db.pipelines : [];
  return db;
}

export function buildCrmConfigCenter(db, businessId) {
  ensureCrmConfigCollections(db);
  return {
    fieldDefinitions: db.customFieldDefinitions.filter((item) => item.businessId === businessId && item.archived !== true).sort(configSort),
    savedViews: db.savedViews.filter((item) => item.businessId === businessId && item.archived !== true).sort(configSort),
    pipelineRules: db.pipelineRules.filter((item) => item.businessId === businessId && item.archived !== true).sort(configSort),
    pipelines: db.pipelines.filter((item) => item.businessId === businessId && item.archived !== true)
  };
}

export function upsertCustomFieldDefinition(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureCrmConfigCollections(db);
  const source = object(input);
  const entityType = clean(source.entityType || existing?.entityType).toLowerCase();
  const type = clean(source.type || existing?.type || "text").toLowerCase();
  if (!ENTITY_TYPES.has(entityType)) throw configError(400, "Unsupported custom field entity type");
  if (!FIELD_TYPES.has(type)) throw configError(400, "Unsupported custom field type");
  const key = fieldKey(source.key || existing?.key || source.label);
  if (!key) throw configError(400, "Custom field key is required");
  const duplicate = db.customFieldDefinitions.find((item) => item.businessId === businessId && item.entityType === entityType && item.key === key && item.id !== existing?.id && item.archived !== true);
  if (duplicate) throw configError(409, "Custom field key already exists for this entity");
  const options = ["select", "multiselect"].includes(type) ? normalizeOptions(source.options ?? existing?.options) : [];
  if (["select", "multiselect"].includes(type) && !options.length) throw configError(400, "Select fields require options");
  const definition = {
    id: existing?.id || `field_${randomUUID()}`,
    businessId,
    entityType,
    key,
    label: clean(source.label || existing?.label || key),
    description: clean(source.description ?? existing?.description),
    type,
    required: source.required === undefined ? Boolean(existing?.required) : source.required === true,
    options,
    min: finiteOrNull(source.min ?? existing?.min),
    max: finiteOrNull(source.max ?? existing?.max),
    readRoles: normalizeRoles(source.readRoles ?? existing?.readRoles, ["owner", "manager", "sales", "operations", "finance", "readonly"]),
    writeRoles: normalizeRoles(source.writeRoles ?? existing?.writeRoles, ["owner", "manager", "sales"]),
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    archived: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, definition);
  else db.customFieldDefinitions.push(definition);
  return definition;
}

export function validateCustomFieldValues(db, businessId, entityType, values, actorRole = "owner") {
  ensureCrmConfigCollections(db);
  const source = object(values);
  const definitions = db.customFieldDefinitions.filter((item) => item.businessId === businessId && item.entityType === entityType && item.active !== false && item.archived !== true);
  const output = {}; const errors = [];
  for (const definition of definitions) {
    const hasValue = Object.prototype.hasOwnProperty.call(source, definition.key);
    if (definition.required && (!hasValue || isEmpty(source[definition.key]))) { errors.push({ key: definition.key, message: `${definition.label} is required` }); continue; }
    if (!hasValue) continue;
    if (!definition.writeRoles.includes(actorRole) && actorRole !== "owner") { errors.push({ key: definition.key, message: `${definition.label} cannot be changed by this role` }); continue; }
    try { output[definition.key] = normalizeFieldValue(definition, source[definition.key]); } catch (error) { errors.push({ key: definition.key, message: error.message }); }
  }
  const known = new Set(definitions.map((item) => item.key));
  for (const key of Object.keys(source)) if (!known.has(key)) errors.push({ key, message: "Unknown custom field" });
  return { valid: errors.length === 0, values: output, errors };
}

export function upsertSavedView(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureCrmConfigCollections(db);
  const source = object(input);
  const entityType = clean(source.entityType || existing?.entityType).toLowerCase();
  if (!ENTITY_TYPES.has(entityType)) throw configError(400, "Unsupported saved view entity type");
  const filters = normalizeFilterGroup(source.filters ?? existing?.filters ?? { combinator: "and", conditions: [] });
  const view = {
    id: existing?.id || `view_${randomUUID()}`,
    businessId,
    entityType,
    name: clean(source.name || existing?.name),
    visibility: ["private", "team"].includes(clean(source.visibility || existing?.visibility)) ? clean(source.visibility || existing?.visibility) : "team",
    ownerId: clean(source.ownerId || existing?.ownerId),
    filters,
    columns: array(source.columns ?? existing?.columns).map(clean).filter(Boolean).slice(0, 50),
    sort: normalizeSort(source.sort ?? existing?.sort),
    bulkActions: array(source.bulkActions ?? existing?.bulkActions).map(clean).filter((item) => ["assign", "tag", "stage", "archive", "export"].includes(item)),
    archived: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (!view.name) throw configError(400, "Saved view name is required");
  if (existing) Object.assign(existing, view); else db.savedViews.push(view);
  return view;
}

export function upsertPipelineRule(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureCrmConfigCollections(db);
  const source = object(input);
  const pipelineId = clean(source.pipelineId || existing?.pipelineId);
  let pipeline = db.pipelines.find((item) => item.businessId === businessId && item.id === pipelineId && item.archived !== true);
  if (!pipeline) {
    const fallback = ensureDefaultPipelineRecord(db, businessId).pipeline;
    if (fallback.id === pipelineId) pipeline = fallback;
  }
  if (!pipeline) throw configError(404, "Pipeline not found");
  const stageId = clean(source.stageId || existing?.stageId);
  if (!array(pipeline.stages).some((item) => item.id === stageId)) throw configError(404, "Pipeline stage not found");
  const probability = Math.min(100, Math.max(0, Number(source.probability ?? existing?.probability ?? 0)));
  const rule = {
    id: existing?.id || `piperule_${randomUUID()}`,
    businessId,
    pipelineId,
    stageId,
    probability,
    entryConditions: normalizeFilterGroup(source.entryConditions ?? existing?.entryConditions ?? { combinator: "and", conditions: [] }),
    exitRequirements: array(source.exitRequirements ?? existing?.exitRequirements).map((item) => ({ field: clean(item.field), operator: FILTER_OPERATORS.has(clean(item.operator)) ? clean(item.operator) : "not_empty", value: item.value ?? null })).filter((item) => item.field),
    automaticTasks: array(source.automaticTasks ?? existing?.automaticTasks).map((item) => ({ title: clean(item.title), dueInHours: Math.max(0, Number(item.dueInHours || 0)), ownerStrategy: clean(item.ownerStrategy || "deal_owner") })).filter((item) => item.title),
    archived: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, rule); else db.pipelineRules.push(rule);
  return rule;
}

export function archiveCrmConfigRecord(db, businessId, collection, id, now = new Date().toISOString()) {
  ensureCrmConfigCollections(db);
  const allowed = new Set(["customFieldDefinitions", "savedViews", "pipelineRules"]);
  if (!allowed.has(collection)) throw configError(400, "Unsupported CRM config collection");
  const item = db[collection].find((candidate) => candidate.businessId === businessId && candidate.id === id);
  if (!item) throw configError(404, "CRM configuration record not found");
  item.archived = true; item.updatedAt = now; return item;
}

function normalizeFieldValue(definition, value) {
  if (isEmpty(value)) return definition.type === "boolean" ? false : "";
  if (["text", "textarea", "phone"].includes(definition.type)) return clean(value).slice(0, definition.type === "textarea" ? 10000 : 1000);
  if (definition.type === "email") { const email = clean(value).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${definition.label} must be a valid email`); return email; }
  if (definition.type === "url") { try { return new URL(clean(value)).toString(); } catch { throw new Error(`${definition.label} must be a valid URL`); } }
  if (["number", "currency"].includes(definition.type)) { const number = Number(value); if (!Number.isFinite(number)) throw new Error(`${definition.label} must be numeric`); if (definition.min !== null && number < definition.min) throw new Error(`${definition.label} is below the minimum`); if (definition.max !== null && number > definition.max) throw new Error(`${definition.label} is above the maximum`); return number; }
  if (definition.type === "boolean") return value === true || value === "true" || value === 1 || value === "1";
  if (definition.type === "date" || definition.type === "datetime") { const time = Date.parse(value); if (!Number.isFinite(time)) throw new Error(`${definition.label} must be a valid date`); return definition.type === "date" ? new Date(time).toISOString().slice(0, 10) : new Date(time).toISOString(); }
  if (definition.type === "select") { const selected = clean(value); if (!definition.options.some((item) => item.value === selected)) throw new Error(`${definition.label} has an unsupported option`); return selected; }
  if (definition.type === "multiselect") { const selected = array(value).map(clean); if (selected.some((item) => !definition.options.some((option) => option.value === item))) throw new Error(`${definition.label} has an unsupported option`); return [...new Set(selected)]; }
  return value;
}
function normalizeFilterGroup(value) {
  const source = object(value); const combinator = clean(source.combinator).toLowerCase() === "or" ? "or" : "and";
  const conditions = array(source.conditions).slice(0, 50).map((item) => ({ field: clean(item.field), operator: FILTER_OPERATORS.has(clean(item.operator)) ? clean(item.operator) : "eq", value: item.value ?? null })).filter((item) => item.field);
  const groups = array(source.groups).slice(0, 10).map(normalizeFilterGroup);
  return { combinator, conditions, groups };
}
function normalizeSort(value) { return array(value).slice(0, 5).map((item) => ({ field: clean(item.field), direction: clean(item.direction).toLowerCase() === "desc" ? "desc" : "asc" })).filter((item) => item.field); }
function normalizeOptions(value) { return array(value).map((item) => typeof item === "string" ? { value: fieldKey(item), label: clean(item) } : { value: fieldKey(item.value || item.label), label: clean(item.label || item.value) }).filter((item) => item.value && item.label).slice(0, 200); }
function normalizeRoles(value, fallback) { const allowed = new Set(["owner", "manager", "sales", "operations", "finance", "readonly"]); const roles = array(value).map(clean).filter((item) => allowed.has(item)); return roles.length ? [...new Set(roles)] : [...fallback]; }
function fieldKey(value) { return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80); }
function configSort(a, b) { return String(a.entityType || a.pipelineId).localeCompare(String(b.entityType || b.pipelineId)) || String(a.name || a.label).localeCompare(String(b.name || b.label), "es"); }
function finiteOrNull(value) { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function isEmpty(value) { return value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length); }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function clean(value) { return String(value ?? "").trim(); }
function configError(statusCode, message, code = "crm_config_error") { return Object.assign(new Error(message), { statusCode, code }); }
