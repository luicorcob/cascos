import { getGoogleAccessToken, googleJsonRequest } from "./google-auth.mjs";

export async function fetchBusinessProfileReviews(context, business, options = {}) {
  const config = googleConfig(business);
  const accountId = resourceId(options.accountId || config.accountId, "accounts");
  const locationId = resourceId(options.locationId || config.locationId, "locations");
  if (!accountId || !locationId) throw providerError(400, "Google Business Profile account and location IDs are required", "google_profile_ids_missing");
  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const reviews = []; let pageToken = ""; let pages = 0;
  do {
    const endpoint = new URL(`https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews`);
    endpoint.searchParams.set("pageSize", "50"); if (pageToken) endpoint.searchParams.set("pageToken", pageToken);
    const result = await googleJsonRequest(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
    reviews.push(...(Array.isArray(result.reviews) ? result.reviews : [])); pageToken = clean(result.nextPageToken); pages += 1;
  } while (pageToken && pages < 10);
  return { provider: "google-business-profile", accountId, locationId, reviews, averageRating: null, totalReviewCount: reviews.length };
}

export async function publishBusinessProfileReply(context, business, input) {
  const config = googleConfig(business); const accountId = resourceId(input.accountId || config.accountId, "accounts"); const locationId = resourceId(input.locationId || config.locationId, "locations"); const reviewId = resourceId(input.reviewId, "reviews");
  if (!accountId || !locationId || !reviewId || !clean(input.comment)) throw providerError(400, "Google account, location, review and comment are required", "google_reply_invalid");
  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews/${encodeURIComponent(reviewId)}/reply`;
  const result = await googleJsonRequest(endpoint, { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ comment: clean(input.comment) }) });
  return { provider: "google-business-profile", accountId, locationId, reviewId, result };
}

function googleConfig(business) { const content = business.content?.google || {}; const integration = business.integrations?.google || {}; return { accountId: clean(content.businessProfileAccountId || integration.businessProfileAccountId), locationId: clean(content.businessProfileLocationId || integration.businessProfileLocationId) }; }
function resourceId(value, prefix) { const text = clean(value).replace(/^\/+|\/+$/g, ""); return text.startsWith(`${prefix}/`) ? text.slice(prefix.length + 1) : text; }
function providerError(statusCode, message, code) { return Object.assign(new Error(message), { statusCode, code }); }
function clean(value) { return String(value ?? "").trim(); }
