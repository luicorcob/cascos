import { createHash, randomUUID } from "node:crypto";
import { buildCustomer360 } from "./customer-360.mjs";
import { consentStateForContact, evaluateConsentState } from "./consent-model.mjs";

const CHANNELS = new Set(["email", "whatsapp"]);
const PURPOSES = new Set(["marketing", "reviews"]);
const STATUSES = new Set(["draft", "scheduled", "running", "paused", "completed", "cancelled"]);

export const LIFECYCLE_CAMPAIGN_TEMPLATES = Object.freeze([
  { key: "welcome", name: "Bienvenida", segmentKey: "new", purpose: "marketing", subject: "Bienvenido/a", body: "Hola {{contact.name}}, gracias por confiar en nosotros. Estamos aqui para ayudarte." },
  { key: "reactivation-30", name: "Reactivacion 30 dias", segmentKey: "inactive_30", purpose: "marketing", subject: "Te echamos de menos", body: "Hola {{contact.name}}, hace tiempo que no nos vemos. ¿Te ayudamos a volver?" },
  { key: "post-visit-review", name: "Opinion tras la visita", segmentKey: "recurring", purpose: "reviews", subject: "¿Que tal fue tu experiencia?", body: "Hola {{contact.name}}, nos encantaria conocer tu opinion sobre tu ultima visita." },
  { key: "win-back-90", name: "Win-back 90 dias", segmentKey: "inactive_90", purpose: "marketing", subject: "Tenemos novedades para ti", body: "Hola {{contact.name}}, queremos volver a verte. Descubre lo nuevo que hemos preparado." }
]);

export function ensureCampaignCollections(db) {
  for (const key of ["businesses", "contacts", "consentEvents", "campaigns", "campaignRecipients", "campaignEvents", "auditLog"]) db[key] = Array.isArray(db[key]) ? db[key] : [];
  return db;
}

export function createCampaign(db, businessId, source, now = new Date().toISOString()) {
  ensureCampaignCollections(db);
  const template = source.templateKey ? LIFECYCLE_CAMPAIGN_TEMPLATES.find((item) => item.key === source.templateKey) : null;
  const input = template ? { ...template, ...source } : source;
  const campaign = {
    id: `campaign_${randomUUID()}`,
    businessId,
    name: requiredText(input.name, "name", 180),
    description: optionalText(input.description, 1000),
    status: "draft",
    revision: 1,
    templateKey: optionalToken(input.templateKey, 120),
    channel: requiredEnum(input.channel || "email", CHANNELS, "channel"),
    purpose: requiredEnum(input.purpose || "marketing", PURPOSES, "purpose"),
    subject: optionalText(input.subject, 500),
    body: requiredText(input.body, "body", 20000),
    variants: normalizeVariants(input.variants, input.subject, input.body),
    audience: normalizeAudience(input),
    exclusions: normalizeExclusions(input.exclusions),
    timezone: optionalText(input.timezone, 120) || "Europe/Madrid",
    quietHours: normalizeQuietHours(input.quietHours),
    frequencyCapDays: clampInteger(input.frequencyCapDays, 0, 365, 7),
    batchSize: clampInteger(input.batchSize, 1, 500, 50),
    attributionWindowDays: clampInteger(input.attributionWindowDays, 1, 365, 30),
    scheduledAt: "",
    nextProcessAt: "",
    snapshot: null,
    createdAt: now,
    updatedAt: now,
    completedAt: ""
  };
  db.campaigns.push(campaign);
  appendEvent(db, campaign, "campaign.created", { revision: 1 }, now);
  appendAudit(db, businessId, "campaign.created", now, { campaignId: campaign.id });
  return decorateCampaign(db, campaign);
}

export function updateCampaign(db, businessId, campaignId, source, now = new Date().toISOString()) {
  const campaign = requireCampaign(db, businessId, campaignId);
  if (campaign.status !== "draft") throw modelError(409, "Only draft campaigns can be edited");
  if (Object.prototype.hasOwnProperty.call(source, "name")) campaign.name = requiredText(source.name, "name", 180);
  if (Object.prototype.hasOwnProperty.call(source, "description")) campaign.description = optionalText(source.description, 1000);
  if (Object.prototype.hasOwnProperty.call(source, "channel")) campaign.channel = requiredEnum(source.channel, CHANNELS, "channel");
  if (Object.prototype.hasOwnProperty.call(source, "purpose")) campaign.purpose = requiredEnum(source.purpose, PURPOSES, "purpose");
  if (Object.prototype.hasOwnProperty.call(source, "subject")) campaign.subject = optionalText(source.subject, 500);
  if (Object.prototype.hasOwnProperty.call(source, "body")) campaign.body = requiredText(source.body, "body", 20000);
  if (Object.prototype.hasOwnProperty.call(source, "variants")) campaign.variants = normalizeVariants(source.variants, campaign.subject, campaign.body);
  if (["audience", "segmentKey", "contactIds"].some((key) => Object.prototype.hasOwnProperty.call(source, key))) {
    const audienceSource = source.audience && typeof source.audience === "object" ? source.audience : source;
    campaign.audience = normalizeAudience(audienceSource);
  }
  if (Object.prototype.hasOwnProperty.call(source, "exclusions")) campaign.exclusions = normalizeExclusions(source.exclusions);
  if (Object.prototype.hasOwnProperty.call(source, "timezone")) campaign.timezone = optionalText(source.timezone, 120) || campaign.timezone;
  if (Object.prototype.hasOwnProperty.call(source, "quietHours")) campaign.quietHours = normalizeQuietHours(source.quietHours);
  if (Object.prototype.hasOwnProperty.call(source, "frequencyCapDays")) campaign.frequencyCapDays = clampInteger(source.frequencyCapDays, 0, 365, campaign.frequencyCapDays);
  if (Object.prototype.hasOwnProperty.call(source, "batchSize")) campaign.batchSize = clampInteger(source.batchSize, 1, 500, campaign.batchSize);
  campaign.revision += 1;
  campaign.updatedAt = now;
  appendEvent(db, campaign, "campaign.draft_updated", { revision: campaign.revision }, now);
  return decorateCampaign(db, campaign);
}

export function previewCampaign(db, businessId, campaignId, options = {}) {
  const campaign = requireCampaign(db, businessId, campaignId);
  const now = validIso(options.now) || new Date().toISOString();
  const contacts = resolveAudience(db, businessId, campaign, now);
  const eligible = [];
  const blocked = [];
  for (const contact of contacts) {
    const reason = campaignEligibilityReason(db, campaign, contact, now);
    const summary = summarizeContact(contact);
    if (reason) blocked.push({ contact: summary, reason });
    else eligible.push({ contact: summary, rendered: renderCampaignForContact(campaign, contact) });
  }
  const blockedReasons = blocked.reduce((result, item) => ({ ...result, [item.reason]: Number(result[item.reason] || 0) + 1 }), {});
  return {
    generatedAt: now,
    campaignId: campaign.id,
    revision: campaign.revision,
    channel: campaign.channel,
    purpose: campaign.purpose,
    audience: campaign.audience,
    total: contacts.length,
    eligible,
    blocked,
    blockedReasons,
    quietHours: campaign.quietHours,
    frequencyCapDays: campaign.frequencyCapDays,
    sample: eligible.slice(0, 10)
  };
}

export function scheduleCampaign(db, businessId, campaignId, source = {}, now = new Date().toISOString()) {
  const campaign = requireCampaign(db, businessId, campaignId);
  if (!new Set(["draft", "paused"]).has(campaign.status)) throw modelError(409, "Campaign cannot be scheduled from its current status");
  const preview = previewCampaign(db, businessId, campaignId, { now });
  if (!preview.eligible.length) throw modelError(409, "Campaign has no eligible recipients");
  const scheduledAt = validIso(source.scheduledAt) || now;
  db.campaignRecipients = db.campaignRecipients.filter((item) => item.campaignId !== campaign.id || !["queued", "blocked"].includes(item.status));
  for (const item of preview.eligible) db.campaignRecipients.push(makeRecipient(campaign, item.contact, "queued", "", now, item.rendered));
  for (const item of preview.blocked) db.campaignRecipients.push(makeRecipient(campaign, item.contact, "blocked", item.reason, now));
  campaign.status = "scheduled";
  campaign.scheduledAt = scheduledAt;
  campaign.nextProcessAt = scheduledAt;
  campaign.snapshot = { revision: campaign.revision, subject: campaign.subject, body: campaign.body, variants: campaign.variants, audience: campaign.audience, exclusions: campaign.exclusions, eligible: preview.eligible.length, blocked: preview.blocked.length, createdAt: now };
  campaign.updatedAt = now;
  appendEvent(db, campaign, "campaign.scheduled", { scheduledAt, eligible: preview.eligible.length, blocked: preview.blocked.length }, now);
  appendAudit(db, businessId, "campaign.scheduled", now, { campaignId, scheduledAt, eligible: preview.eligible.length });
  return { campaign: decorateCampaign(db, campaign), preview };
}

export function setCampaignStatus(db, businessId, campaignId, status, now = new Date().toISOString()) {
  const campaign = requireCampaign(db, businessId, campaignId);
  const normalized = requiredEnum(status, STATUSES, "status");
  if (normalized === "paused" && !["scheduled", "running"].includes(campaign.status)) throw modelError(409, "Only scheduled or running campaigns can be paused");
  if (normalized === "cancelled" && ["completed", "cancelled"].includes(campaign.status)) return decorateCampaign(db, campaign);
  if (normalized === "scheduled" && campaign.status !== "paused") throw modelError(409, "Only paused campaigns can resume");
  campaign.status = normalized;
  if (normalized === "scheduled") campaign.nextProcessAt = now;
  campaign.updatedAt = now;
  appendEvent(db, campaign, `campaign.${normalized}`, {}, now);
  return decorateCampaign(db, campaign);
}

export async function processCampaignBatch(db, businessId, campaignId, options = {}) {
  const now = validIso(options.now) || new Date().toISOString();
  const campaign = requireCampaign(db, businessId, campaignId);
  if (!["scheduled", "running"].includes(campaign.status)) return { campaign: decorateCampaign(db, campaign), processed: 0, results: [] };
  if (Date.parse(campaign.scheduledAt || now) > Date.parse(now)) return { campaign: decorateCampaign(db, campaign), processed: 0, results: [] };
  const allowedAt = nextAllowedAt(campaign, now);
  if (allowedAt !== now) {
    campaign.nextProcessAt = allowedAt;
    campaign.updatedAt = now;
    return { campaign: decorateCampaign(db, campaign), processed: 0, waitingForQuietHours: true, nextProcessAt: allowedAt, results: [] };
  }
  campaign.status = "running";
  const recipients = db.campaignRecipients.filter((item) => item.campaignId === campaign.id && item.status === "queued").slice(0, campaign.batchSize);
  const results = [];
  for (const recipient of recipients) {
    const contact = db.contacts.find((item) => item.businessId === businessId && item.id === recipient.contactId && !item.merged);
    if (!contact) { markRecipient(db, campaign, recipient, "failed", { error: "contact_not_found" }, now); results.push({ recipientId: recipient.id, status: "failed" }); continue; }
    const liveReason = campaignEligibilityReason(db, campaign, contact, now, { ignoreFrequency: true });
    if (liveReason) { markRecipient(db, campaign, recipient, "blocked", { reason: liveReason }, now); results.push({ recipientId: recipient.id, status: "blocked", reason: liveReason }); continue; }
    try {
      const delivery = await options.sendExecutor?.({ db, campaign, recipient, contact, now }) ?? { providerMessageId: `simulated_${randomUUID()}`, messageId: "", deliveryStatus: "sent" };
      recipient.providerMessageId = optionalText(delivery.providerMessageId, 500);
      recipient.messageId = optionalText(delivery.messageId, 180);
      recipient.sentAt = now;
      markRecipient(db, campaign, recipient, ["delivered", "read"].includes(delivery.deliveryStatus) ? "delivered" : "sent", { deliveryStatus: delivery.deliveryStatus || "sent" }, now);
      results.push({ recipientId: recipient.id, status: recipient.status, providerMessageId: recipient.providerMessageId });
    } catch (error) {
      markRecipient(db, campaign, recipient, "failed", { error: optionalText(error.message, 2000) }, now);
      results.push({ recipientId: recipient.id, status: "failed", error: recipient.error });
    }
  }
  const remaining = db.campaignRecipients.filter((item) => item.campaignId === campaign.id && item.status === "queued").length;
  if (!remaining) { campaign.status = "completed"; campaign.completedAt = now; appendEvent(db, campaign, "campaign.completed", {}, now); }
  else { campaign.status = "scheduled"; campaign.nextProcessAt = now; }
  campaign.updatedAt = now;
  return { campaign: decorateCampaign(db, campaign), processed: results.length, remaining, results };
}

export function recordCampaignDelivery(db, businessId, providerMessageId, status, now = new Date().toISOString()) {
  ensureCampaignCollections(db);
  const recipient = db.campaignRecipients.find((item) => item.businessId === businessId && item.providerMessageId === providerMessageId);
  if (!recipient) return null;
  const campaign = requireCampaign(db, businessId, recipient.campaignId);
  if (["delivered", "read"].includes(status)) { recipient.status = "delivered"; recipient.deliveredAt = recipient.deliveredAt || now; }
  if (["failed", "bounced", "complained"].includes(status)) { recipient.status = status === "failed" ? "failed" : status; recipient.error = status; }
  recipient.updatedAt = now;
  appendEvent(db, campaign, `recipient.${status}`, { recipientId: recipient.id, contactId: recipient.contactId, providerMessageId }, now);
  return recipient;
}

export function recordCampaignResponse(db, businessId, contactId, now = new Date().toISOString()) {
  return updateAttributedRecipient(db, businessId, contactId, now, (recipient, campaign) => { recipient.status = "responded"; recipient.respondedAt = now; appendEvent(db, campaign, "recipient.responded", { recipientId: recipient.id, contactId }, now); });
}

export function recordCampaignConversion(db, businessId, contactId, input = {}, now = new Date().toISOString()) {
  return updateAttributedRecipient(db, businessId, contactId, now, (recipient, campaign) => { recipient.status = "converted"; recipient.convertedAt = now; recipient.conversionType = optionalToken(input.type, 120) || "conversion"; recipient.attributedRevenue = money(input.revenue); appendEvent(db, campaign, "recipient.converted", { recipientId: recipient.id, contactId, type: recipient.conversionType, revenue: recipient.attributedRevenue }, now); });
}

export function recordCampaignUnsubscribe(db, businessId, contactId, input = {}, now = new Date().toISOString()) {
  ensureCampaignCollections(db);
  const recipients = db.campaignRecipients
    .filter((item) => item.businessId === businessId && item.contactId === contactId && item.sentAt)
    .filter((item) => !["blocked", "failed", "bounced", "complained", "unsubscribed"].includes(item.status))
    .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  const recipient = recipients[0];
  if (!recipient) return null;
  const campaign = requireCampaign(db, businessId, recipient.campaignId);
  recipient.status = "unsubscribed";
  recipient.unsubscribedAt = now;
  recipient.reason = optionalToken(input.reason, 120) || "consent_withdrawn";
  recipient.updatedAt = now;
  appendEvent(db, campaign, "recipient.unsubscribed", { recipientId: recipient.id, contactId, reason: recipient.reason }, now);
  return recipient;
}

export function listCampaigns(db, businessId) {
  ensureCampaignCollections(db);
  return db.campaigns.filter((item) => item.businessId === businessId).map((item) => decorateCampaign(db, item)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getCampaign(db, businessId, campaignId) { return decorateCampaign(db, requireCampaign(db, businessId, campaignId)); }

function decorateCampaign(db, campaign) {
  const recipients = db.campaignRecipients.filter((item) => item.campaignId === campaign.id);
  const counts = recipients.reduce((result, item) => ({ ...result, [item.status]: Number(result[item.status] || 0) + 1 }), {});
  const revenue = money(recipients.reduce((sum, item) => sum + Number(item.attributedRevenue || 0), 0));
  const variantMetrics = [...new Set(recipients.map((item) => item.variantKey).filter(Boolean))].map((variantKey) => {
    const items = recipients.filter((item) => item.variantKey === variantKey);
    return { variantKey, total: items.length, sent: items.filter((item) => item.sentAt).length, delivered: items.filter((item) => ["delivered", "responded", "converted", "unsubscribed"].includes(item.status)).length, responded: items.filter((item) => ["responded", "converted"].includes(item.status)).length, converted: items.filter((item) => item.status === "converted").length, attributedRevenue: money(items.reduce((sum, item) => sum + Number(item.attributedRevenue || 0), 0)) };
  });
  return { ...campaign, metrics: { total: recipients.length, eligible: recipients.filter((item) => item.status !== "blocked").length, blocked: Number(counts.blocked || 0), queued: Number(counts.queued || 0), sent: Number(counts.sent || 0) + Number(counts.delivered || 0) + Number(counts.responded || 0) + Number(counts.converted || 0) + Number(counts.unsubscribed || 0), delivered: Number(counts.delivered || 0) + Number(counts.responded || 0) + Number(counts.converted || 0) + Number(counts.unsubscribed || 0), responded: Number(counts.responded || 0) + Number(counts.converted || 0), converted: Number(counts.converted || 0), unsubscribed: Number(counts.unsubscribed || 0), failed: Number(counts.failed || 0) + Number(counts.bounced || 0) + Number(counts.complained || 0), attributedRevenue: revenue, variants: variantMetrics }, recipients: recipients.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 100), events: db.campaignEvents.filter((item) => item.campaignId === campaign.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 100) };
}

function resolveAudience(db, businessId, campaign, now) {
  if (campaign.audience.type === "static") return campaign.audience.contactIds.map((id) => db.contacts.find((item) => item.businessId === businessId && item.id === id && !item.merged)).filter(Boolean);
  const result = buildCustomer360(db, businessId, { segment: campaign.audience.segmentKey, limit: 500, now });
  return result.customers.map((profile) => db.contacts.find((item) => item.businessId === businessId && item.id === profile.contact.id)).filter(Boolean);
}

function campaignEligibilityReason(db, campaign, contact, now, options = {}) {
  if (contact.merged || contact.archivedAt) return "inactive_contact";
  if (campaign.exclusions.tags.some((tag) => (contact.tags || []).includes(tag))) return "excluded_tag";
  if (campaign.channel === "email" && !clean(contact.email)) return "missing_email";
  if (campaign.channel === "whatsapp" && !clean(contact.phone)) return "missing_phone";
  const consent = evaluateConsentState(consentStateForContact(db, campaign.businessId, contact.id), campaign.channel, campaign.purpose);
  if (!consent.allowed || consent.suppressed) return consent.reason || "consent_blocked";
  if (!options.ignoreFrequency && campaign.frequencyCapDays > 0) {
    const threshold = Date.parse(now) - campaign.frequencyCapDays * 86400000;
    const recent = db.campaignRecipients.some((item) => item.businessId === campaign.businessId && item.contactId === contact.id && item.channel === campaign.channel && Date.parse(item.sentAt || "") >= threshold);
    if (recent) return "frequency_cap";
  }
  return "";
}

function updateAttributedRecipient(db, businessId, contactId, now, updater) {
  ensureCampaignCollections(db);
  const recipient = db.campaignRecipients
    .filter((item) => item.businessId === businessId && item.contactId === contactId && item.sentAt && !["blocked", "failed", "bounced", "complained"].includes(item.status))
    .filter((item) => { const campaign = db.campaigns.find((campaignValue) => campaignValue.id === item.campaignId); return campaign && Date.parse(now) - Date.parse(item.sentAt) <= campaign.attributionWindowDays * 86400000; })
    .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))[0];
  if (!recipient) return null;
  const campaign = requireCampaign(db, businessId, recipient.campaignId);
  updater(recipient, campaign);
  recipient.updatedAt = now;
  return recipient;
}

function makeRecipient(campaign, contact, status, reason, now, rendered = {}) { return { id: `campaign_recipient_${randomUUID()}`, businessId: campaign.businessId, campaignId: campaign.id, contactId: contact.id, channel: campaign.channel, purpose: campaign.purpose, status, reason, variantKey: optionalToken(rendered.variantKey, 120), renderedSubject: optionalText(rendered.subject, 500), renderedBody: optionalText(rendered.body, 20000), providerMessageId: "", messageId: "", error: "", sentAt: "", deliveredAt: "", respondedAt: "", convertedAt: "", unsubscribedAt: "", conversionType: "", attributedRevenue: 0, createdAt: now, updatedAt: now }; }
function markRecipient(db, campaign, recipient, status, data, now) { recipient.status = status; recipient.reason = optionalText(data.reason, 500) || recipient.reason; recipient.error = optionalText(data.error, 2000); recipient.updatedAt = now; appendEvent(db, campaign, `recipient.${status}`, { recipientId: recipient.id, contactId: recipient.contactId, ...data }, now); }
function appendEvent(db, campaign, type, data, now) { const event = { id: `campaign_event_${randomUUID()}`, businessId: campaign.businessId, campaignId: campaign.id, type, data: data && typeof data === "object" ? structuredClone(data) : {}, createdAt: now }; db.campaignEvents.push(event); return event; }
function appendAudit(db, businessId, type, createdAt, extra = {}) { db.auditLog.push({ id: `audit_${randomUUID()}`, businessId, type, ...extra, createdAt }); }
function normalizeAudience(source) { const audience = source.audience && typeof source.audience === "object" ? source.audience : source; const contactIds = [...new Set((Array.isArray(audience.contactIds) ? audience.contactIds : []).map(clean).filter(Boolean))].slice(0, 500); if (contactIds.length) return { type: "static", segmentKey: "", contactIds }; return { type: "segment", segmentKey: optionalToken(audience.segmentKey, 120) || "marketing_reachable", contactIds: [] }; }
function normalizeExclusions(value) { const source = value && typeof value === "object" ? value : {}; return { tags: [...new Set((Array.isArray(source.tags) ? source.tags : ["do_not_contact"]).map(clean).filter(Boolean))].slice(0, 50) }; }
function normalizeQuietHours(value) { const source = value && typeof value === "object" ? value : {}; return { enabled: source.enabled !== false, start: /^([01]\d|2[0-3]):[0-5]\d$/.test(clean(source.start)) ? clean(source.start) : "09:00", end: /^([01]\d|2[0-3]):[0-5]\d$/.test(clean(source.end)) ? clean(source.end) : "20:00", days: Array.isArray(source.days) ? [...new Set(source.days.map(Number).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6))] : [1, 2, 3, 4, 5] }; }
function normalizeVariants(value, fallbackSubject, fallbackBody) { if (!Array.isArray(value) || value.length !== 2) return []; return value.map((item, index) => { const source = item && typeof item === "object" ? item : {}; return { key: optionalToken(source.key, 120) || (index === 0 ? "A" : "B"), name: optionalText(source.name, 120) || `Variante ${index === 0 ? "A" : "B"}`, weight: clampInteger(source.weight, 1, 99, 50), subject: optionalText(source.subject, 500) || optionalText(fallbackSubject, 500), body: requiredText(source.body || fallbackBody, `variants[${index}].body`, 20000) }; }); }
function renderCampaignForContact(campaign, contact) { const variant = selectVariant(campaign, contact.id); return { variantKey: variant?.key || "", subject: interpolate(variant?.subject ?? campaign.subject, contact), body: interpolate(variant?.body ?? campaign.body, contact) }; }
function selectVariant(campaign, contactId) { const variants = Array.isArray(campaign.variants) ? campaign.variants : []; if (variants.length !== 2) return null; const value = Number.parseInt(createHash("sha256").update(`${campaign.id}:${contactId}`).digest("hex").slice(0, 8), 16) % 100; const total = variants.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 100; return value < (Number(variants[0].weight || 50) / total) * 100 ? variants[0] : variants[1]; }
function nextAllowedAt(campaign, now) { if (!campaign.quietHours.enabled) return now; const timezone = campaign.timezone; const date = new Date(now); const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }; const partsFor = (value) => Object.fromEntries(formatter.formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])); const parts = partsFor(date); if (campaign.quietHours.days.includes(dayMap[parts.weekday]) && `${parts.hour}:${parts.minute}` >= campaign.quietHours.start && `${parts.hour}:${parts.minute}` < campaign.quietHours.end) return now; for (let minute = 1; minute <= 8 * 1440; minute += 1) { const candidate = new Date(date.getTime() + minute * 60000); const value = partsFor(candidate); if (campaign.quietHours.days.includes(dayMap[value.weekday]) && `${value.hour}:${value.minute}` === campaign.quietHours.start) return candidate.toISOString(); } return now; }
function interpolate(value, contact) { return String(value ?? "").replace(/\{\{\s*contact\.([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => String(contact?.[key] ?? "")); }
function summarizeContact(contact) { return { id: contact.id, name: contact.name || "", email: contact.email || "", phone: contact.phone || "", status: contact.status || "", tags: Array.isArray(contact.tags) ? contact.tags : [] }; }
function requireCampaign(db, businessId, campaignId) { ensureCampaignCollections(db); const campaign = db.campaigns.find((item) => item.businessId === businessId && item.id === campaignId); if (!campaign) throw modelError(404, "Campaign not found"); return campaign; }
function requiredEnum(value, values, field) { const result = clean(value); if (!values.has(result)) throw modelError(400, `Invalid ${field}`); return result; }
function validIso(value) { const timestamp = Date.parse(value || ""); return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : ""; }
function clampInteger(value, min, max, fallback) { const number = Number(value); return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function optionalToken(value, max) { const text = clean(value); return text && /^[A-Za-z0-9_.:-]+$/.test(text) ? text.slice(0, max) : ""; }
function requiredText(value, field, max) { const result = optionalText(value, max); if (!result) throw modelError(400, `${field} is required`); return result; }
function optionalText(value, max) { if (value === undefined || value === null || value === "") return ""; const result = String(value).replace(/[\u0000-\u001F\u007F]/g, "").trim(); if (result.length > max) throw modelError(400, `Text cannot exceed ${max} characters`); return result; }
function money(value) { const amount = Number(value); return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0; }
function modelError(statusCode, message, code = "campaign_error") { return Object.assign(new Error(message), { statusCode, code }); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
