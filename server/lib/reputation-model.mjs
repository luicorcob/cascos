import { createHash, randomBytes, randomUUID } from "node:crypto";
import { consentStateForContact, evaluateConsentState } from "./consent-model.mjs";

const RATING_MAP = Object.freeze({ ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, STAR_RATING_UNSPECIFIED: 0 });
const TOPICS = Object.freeze([
  ["service", ["servicio", "trato", "atencion", "attention", "service", "staff", "personal"]],
  ["quality", ["calidad", "quality", "producto", "comida", "food", "resultado"]],
  ["speed", ["rapido", "rápido", "lento", "espera", "wait", "slow", "fast", "tiempo"]],
  ["price", ["precio", "caro", "barato", "price", "expensive", "value"]],
  ["cleanliness", ["limpio", "sucio", "clean", "dirty", "higiene"]],
  ["booking", ["reserva", "cita", "booking", "appointment", "mesa"]],
  ["ambience", ["ambiente", "local", "decoracion", "atmosphere", "noise", "ruido"]]
]);

export function ensureReputationCollections(db) {
  for (const key of ["reputationReviews", "reputationReplies", "reputationSyncRuns", "reviewRequests"]) db[key] = Array.isArray(db[key]) ? db[key] : [];
  db.bookings = Array.isArray(db.bookings) ? db.bookings : []; db.contacts = Array.isArray(db.contacts) ? db.contacts : []; db.consentEvents = Array.isArray(db.consentEvents) ? db.consentEvents : [];
  return db;
}

export function syncReputationReviews(db, business, input, now = new Date().toISOString()) {
  ensureReputationCollections(db); const source = object(input); const provider = clean(source.provider || "google-business-profile"); const incoming = array(source.reviews); let created = 0; let updated = 0;
  for (const raw of incoming) {
    const normalized = normalizeReview(raw, business.id, provider, source.accountId, source.locationId, now); if (!normalized.providerReviewId) continue;
    const existing = db.reputationReviews.find((item) => item.businessId === business.id && item.provider === provider && item.providerReviewId === normalized.providerReviewId);
    if (existing) { Object.assign(existing, { ...normalized, id: existing.id, firstSyncedAt: existing.firstSyncedAt, updatedAt: now }); updated += 1; attributeReview(db, existing, now); }
    else { db.reputationReviews.push(normalized); created += 1; attributeReview(db, normalized, now); }
  }
  const run = { id: `repsync_${randomUUID()}`, businessId: business.id, provider, status: "completed", received: incoming.length, created, updated, createdAt: now, completedAt: now };
  db.reputationSyncRuns.push(run); return { run, center: buildReputationCenter(db, business.id, new Date(now)) };
}

export function buildReputationCenter(db, businessId, now = new Date()) {
  ensureReputationCollections(db); const reviews = db.reputationReviews.filter((item) => item.businessId === businessId).map((review) => decorateReview(db, review, now)).sort((a, b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt)));
  const requests = db.reviewRequests.filter((item) => item.businessId === businessId).map(publicRequest).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const ratings = reviews.filter((item) => item.rating > 0); const replied = reviews.filter((item) => item.reply?.status === "published" || item.providerReply?.comment); const responseMinutes = reviews.map((item) => item.responseMinutes).filter(Number.isFinite);
  const topicCounts = new Map(); for (const review of reviews) for (const topic of review.topics || []) topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
  return { summary: { total: reviews.length, averageRating: ratings.length ? round(ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length, 2) : 0, responseRate: reviews.length ? round(replied.length * 100 / reviews.length, 1) : 0, averageResponseHours: responseMinutes.length ? round(responseMinutes.reduce((sum, item) => sum + item, 0) / responseMinutes.length / 60, 1) : 0, pending: reviews.filter((item) => item.status === "pending").length, overdue: reviews.filter((item) => item.sla.breached).length, requestsSent: requests.filter((item) => ["sent", "clicked", "reviewed"].includes(item.status)).length, requestClicks: requests.filter((item) => ["clicked", "reviewed"].includes(item.status)).length, reviewsAttributed: requests.filter((item) => item.status === "reviewed").length }, topics: [...topicCounts].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count), reviews, requests, eligibleRequests: listEligibleReviewRequests(db, businessId, now), lastSync: db.reputationSyncRuns.filter((item) => item.businessId === businessId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null };
}

export function createReviewReplyDraft(db, businessId, reviewId, input, now = new Date().toISOString()) {
  ensureReputationCollections(db); const review = requireReview(db, businessId, reviewId); const source = object(input); const comment = clean(source.comment || suggestedReply(review)); if (!comment) throw modelError(400, "Reply comment is required");
  const reply = { id: `repreply_${randomUUID()}`, businessId, reviewId: review.id, providerReviewId: review.providerReviewId, comment: comment.slice(0, 4096), status: "draft", authorId: clean(source.authorId), approvedById: "", approvedAt: "", publishedAt: "", providerReply: null, createdAt: now, updatedAt: now };
  db.reputationReplies.push(reply); return reply;
}

export function approveReviewReply(db, businessId, reviewId, replyId, input, now = new Date().toISOString()) { const reply = requireReply(db, businessId, reviewId, replyId); if (reply.status === "published") throw modelError(409, "Published reply cannot be changed"); reply.status = "approved"; reply.approvedById = clean(input?.actorId || input?.approvedById || "admin"); reply.approvedAt = now; reply.updatedAt = now; return reply; }
export function markReviewReplyPublished(db, businessId, reviewId, replyId, providerResult, now = new Date().toISOString()) { const reply = requireReply(db, businessId, reviewId, replyId); if (reply.status !== "approved") throw modelError(409, "Reply requires approval before publishing"); reply.status = "published"; reply.publishedAt = now; reply.providerReply = providerResult || null; reply.updatedAt = now; const review = requireReview(db, businessId, reviewId); review.providerReply = { comment: reply.comment, updateTime: now }; review.updatedAt = now; return reply; }

export function listEligibleReviewRequests(db, businessId, now = new Date()) {
  ensureReputationCollections(db); const cutoff = new Date(now.getTime() - 45 * 86400000); const recentRequestCutoff = new Date(now.getTime() - 90 * 86400000);
  return db.bookings.filter((booking) => booking.businessId === businessId && booking.status === "completed" && new Date(booking.endsAt || booking.startsAt) >= cutoff)
    .filter((booking) => !db.reviewRequests.some((item) => item.businessId === businessId && (item.bookingId === booking.id || (item.contactId === booking.contactId && new Date(item.createdAt) >= recentRequestCutoff))))
    .map((booking) => { const contact = db.contacts.find((item) => item.businessId === businessId && item.id === booking.contactId && !item.merged); if (!contact) return null; const email = evaluateConsentState(consentStateForContact(db, businessId, contact.id), "email", "reviews"); const whatsapp = evaluateConsentState(consentStateForContact(db, businessId, contact.id), "whatsapp", "reviews"); const channels = []; if (contact.email && email.allowed && !email.suppressed) channels.push("email"); if (contact.phone && whatsapp.allowed && !whatsapp.suppressed) channels.push("whatsapp"); if (!channels.length) return null; return { bookingId: booking.id, contactId: contact.id, customerName: contact.name || booking.customerName, serviceName: booking.serviceName, completedAt: booking.endsAt || booking.startsAt, channels, recommendedChannel: channels.includes("whatsapp") ? "whatsapp" : channels[0] }; }).filter(Boolean).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
}

export function createReviewRequest(db, business, input, options = {}, now = new Date().toISOString()) {
  ensureReputationCollections(db); const source = object(input); const booking = db.bookings.find((item) => item.businessId === business.id && item.id === clean(source.bookingId)); if (!booking || booking.status !== "completed") throw modelError(409, "Only completed bookings are eligible for review requests"); const contact = db.contacts.find((item) => item.businessId === business.id && item.id === (clean(source.contactId) || booking.contactId) && !item.merged); if (!contact) throw modelError(404, "Contact not found");
  if (db.reviewRequests.some((item) => item.businessId === business.id && item.bookingId === booking.id)) throw modelError(409, "Review request already exists for this booking");
  const eligible = listEligibleReviewRequests(db, business.id, new Date(now)).find((item) => item.bookingId === booking.id); if (!eligible) throw modelError(409, "Review request is blocked by consent or frequency policy"); const channel = clean(source.channel || eligible.recommendedChannel); if (!eligible.channels.includes(channel)) throw modelError(409, "Selected review channel is not consented");
  const token = randomBytes(24).toString("base64url"); const reviewUrl = clean(source.reviewUrl || business.content?.google?.reviewUrl || business.integrations?.google?.reviewUrl); if (!reviewUrl) throw modelError(409, "Review URL is not configured"); const trackingUrl = `${clean(options.publicBaseUrl).replace(/\/$/, "")}/api/public/review-requests/${encodeURIComponent(token)}`;
  const message = clean(source.message || `Gracias por visitar ${business.name}. Tu opinion nos ayuda a mejorar: ${trackingUrl}`).slice(0, 4000);
  if (hasProhibitedReviewIncentive(message)) throw modelError(409, "Review requests cannot offer discounts, gifts or rewards");
  const request = { id: `reviewreq_${randomUUID()}`, businessId: business.id, bookingId: booking.id, contactId: contact.id, channel, status: "draft", reviewUrl, trackingTokenHash: hash(token), trackingToken: token, trackingUrl, message, providerMessageId: "", sentAt: "", clickedAt: "", reviewedAt: "", attributedReviewId: "", createdAt: now, updatedAt: now };
  db.reviewRequests.push(request); return { request, contact, booking };
}

export function markReviewRequestSent(request, providerMessageId, now = new Date().toISOString()) { request.status = "sent"; request.providerMessageId = clean(providerMessageId); request.sentAt = now; request.updatedAt = now; return request; }
export function recordReviewRequestClick(db, token, now = new Date().toISOString()) { ensureReputationCollections(db); const request = db.reviewRequests.find((item) => item.trackingTokenHash === hash(token)); if (!request) throw modelError(404, "Review request not found"); request.status = request.status === "reviewed" ? "reviewed" : "clicked"; request.clickedAt ||= now; request.updatedAt = now; return request; }

function normalizeReview(raw, businessId, provider, accountId, locationId, now) { const source = object(raw); const providerReviewId = clean(source.reviewId || source.id || String(source.name || "").split("/").pop()); const rating = normalizeRating(source.starRating ?? source.rating); const comment = clean(source.comment || source.text); const reviewedAt = validIso(source.createTime || source.reviewedAt || source.createdAt) || now; const providerReply = source.reviewReply || source.reply || null; const classification = classifyReview(rating, comment, reviewedAt); return { id: `repreview_${createHash("sha256").update(`${businessId}:${provider}:${providerReviewId}`).digest("hex").slice(0, 24)}`, businessId, provider, providerReviewId, providerName: clean(source.name), accountId: clean(accountId), locationId: clean(locationId), reviewerName: clean(source.reviewer?.displayName || source.reviewerName || "Cliente de Google"), reviewerProfileUrl: clean(source.reviewer?.profilePhotoUrl || source.reviewerProfileUrl), rating, comment: comment.slice(0, 10000), reviewedAt, providerUpdatedAt: validIso(source.updateTime || source.updatedAt) || reviewedAt, providerReply: providerReply ? { comment: clean(providerReply.comment), updateTime: validIso(providerReply.updateTime) || "" } : null, sentiment: classification.sentiment, urgency: classification.urgency, topics: classification.topics, slaDueAt: classification.slaDueAt, firstSyncedAt: now, updatedAt: now }; }
function decorateReview(db, review, now) { const replies = db.reputationReplies.filter((item) => item.reviewId === review.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); const reply = replies[0] || null; const publishedAt = reply?.publishedAt || review.providerReply?.updateTime || ""; return { ...review, reply, replies, status: publishedAt ? "replied" : "pending", responseMinutes: publishedAt ? Math.max(0, Math.round((Date.parse(publishedAt) - Date.parse(review.reviewedAt)) / 60000)) : null, sla: { dueAt: review.slaDueAt, breached: !publishedAt && new Date(review.slaDueAt) < now, remainingMinutes: publishedAt ? 0 : Math.round((Date.parse(review.slaDueAt) - now.getTime()) / 60000) } }; }
function classifyReview(rating, comment, reviewedAt) { const lower = normalize(comment); const topics = TOPICS.filter(([, words]) => words.some((word) => lower.includes(normalize(word)))).map(([topic]) => topic); const sentiment = rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative"; const urgentWords = ["denuncia", "peligro", "alerg", "estafa", "fraud", "unsafe", "intoxic", "discrimin", "robo"]; const urgency = rating <= 1 || urgentWords.some((word) => lower.includes(word)) ? "critical" : rating <= 2 ? "high" : rating === 3 ? "medium" : "normal"; const hours = urgency === "critical" ? 2 : urgency === "high" ? 4 : urgency === "medium" ? 24 : 72; return { sentiment, urgency, topics, slaDueAt: new Date(Date.parse(reviewedAt) + hours * 3600000).toISOString() }; }
function suggestedReply(review) { if (review.rating >= 4) return `Gracias, ${review.reviewerName || ""}. Nos alegra saber que tu experiencia fue positiva. Esperamos verte de nuevo pronto.`; if (review.rating === 3) return `Gracias por compartir tu experiencia, ${review.reviewerName || ""}. Tomamos nota para mejorar. Si quieres, escribenos para conocer mejor lo ocurrido.`; return `Sentimos que tu experiencia no estuviera a la altura, ${review.reviewerName || ""}. Queremos revisarlo contigo y darte una respuesta concreta. Por favor, contactanos directamente.`; }
function attributeReview(db, review, now) { const name = normalize(review.reviewerName); if (!name) return; const candidates = db.reviewRequests.filter((item) => item.businessId === review.businessId && ["sent", "clicked"].includes(item.status) && Date.parse(item.sentAt || item.createdAt) <= Date.parse(review.reviewedAt) && Date.parse(review.reviewedAt) - Date.parse(item.sentAt || item.createdAt) <= 45 * 86400000).filter((item) => normalize(db.contacts.find((contact) => contact.id === item.contactId)?.name) === name); if (candidates.length !== 1) return; const request = candidates[0]; request.status = "reviewed"; request.reviewedAt = review.reviewedAt; request.attributedReviewId = review.id; request.attributionMethod = "name_and_time_window"; request.updatedAt = now; review.attributedRequestId = request.id; review.attributionInferred = true; }
function requireReview(db, businessId, reviewId) { const review = db.reputationReviews.find((item) => item.businessId === businessId && item.id === reviewId); if (!review) throw modelError(404, "Review not found"); return review; }
function requireReply(db, businessId, reviewId, replyId) { const reply = db.reputationReplies.find((item) => item.businessId === businessId && item.reviewId === reviewId && item.id === replyId); if (!reply) throw modelError(404, "Review reply not found"); return reply; }
function publicRequest(request) { const { trackingToken, trackingTokenHash, ...result } = request; return result; }
function normalizeRating(value) { if (typeof value === "string" && RATING_MAP[value.toUpperCase()] !== undefined) return RATING_MAP[value.toUpperCase()]; const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(5, number)) : 0; }
function validIso(value) { const time = Date.parse(value || ""); return Number.isFinite(time) ? new Date(time).toISOString() : ""; }
function normalize(value) { return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function hasProhibitedReviewIncentive(value) { const text = normalize(value); return ["descuento", "cupon", "regalo", "premio", "gratis", "incentivo", "discount", "coupon", "gift", "reward", "freebie"].some((word) => new RegExp(`\\b${word}\\b`).test(text)); }
function hash(value) { return createHash("sha256").update(clean(value)).digest("hex"); }
function round(value, decimals) { const factor = 10 ** decimals; return Math.round((Number(value) + Number.EPSILON) * factor) / factor; }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function modelError(statusCode, message, code = "reputation_error") { return Object.assign(new Error(message), { statusCode, code }); }
