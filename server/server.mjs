import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { handleAccountApi, isAccountApiRequest } from "./api/account-api.mjs";
import { handleAutomationApi, isAutomationApiRequest } from "./api/automation-api.mjs";
import { handleBookingApi, isBookingApiRequest } from "./api/booking-api.mjs";
import { handleBookingResourceApi, isBookingResourceApiRequest } from "./api/booking-resource-api.mjs";
import { handleBusinessApi, isBusinessApiRequest } from "./api/business-api.mjs";
import { handleBusinessUserAuthApi, isBusinessUserAuthApiRequest } from "./api/business-user-auth-api.mjs";
import { handleChannelApi, isChannelApiRequest } from "./api/channel-api.mjs";
import { handleCampaignApi, isCampaignApiRequest } from "./api/campaign-api.mjs";
import { handleCrmConfigApi, isCrmConfigApiRequest } from "./api/crm-config-api.mjs";
import { handleClientAuthApi, isClientAuthApiRequest } from "./lib/client-auth.mjs";
import { handleContactApi, isContactApiRequest } from "./api/contact-api.mjs";
import { handleCommunicationsApi, isCommunicationsApiRequest } from "./api/communications-api.mjs";
import { handleCommerceApi, isCommerceApiRequest } from "./api/commerce-api.mjs";
import { handleConsentApi, isConsentApiRequest } from "./api/consent-api.mjs";
import { handleCustomer360Api, isCustomer360ApiRequest } from "./api/customer-360-api.mjs";
import { handleDealApi, isDealApiRequest } from "./api/deal-api.mjs";
import { handleDemoPublishApi, isDemoPublishApiRequest } from "./api/demo-publish-api.mjs";
import { handleDiscoveryApi, isDiscoveryApiRequest } from "./api/discovery-api.mjs";
import { handleEventApi, isEventApiRequest } from "./api/event-api.mjs";
import { handleHealthApi, isHealthApiRequest } from "./api/health-api.mjs";
import { handleGoogleApi, isGoogleApiRequest } from "./api/google-api.mjs";
import { handleHospitalityApi, isHospitalityApiRequest } from "./api/hospitality-api.mjs";
import { handleInboxApi, isInboxApiRequest } from "./api/inbox-api.mjs";
import { handleIntelligenceApi, isIntelligenceApiRequest } from "./api/intelligence-api.mjs";
import { handleLoyaltyApi, isLoyaltyApiRequest } from "./api/loyalty-api.mjs";
import { handleMessageTemplateApi, isMessageTemplateApiRequest } from "./api/message-template-api.mjs";
import { handleMoneyApi, isMoneyApiRequest } from "./api/money-api.mjs";
import { handleOperationsApi, isOperationsApiRequest } from "./api/operations-api.mjs";
import { handleProposalApi, isProposalApiRequest } from "./api/proposal-api.mjs";
import { handleQuoteApi, isQuoteApiRequest } from "./api/quote-api.mjs";
import { handleReportApi, isReportApiRequest } from "./api/report-api.mjs";
import { handleReputationApi, isReputationApiRequest } from "./api/reputation-api.mjs";
import { handleSecurityApi, isSecurityApiRequest } from "./api/security-api.mjs";
import { handleQaVisualApi, isQaVisualApiRequest } from "./api/qa-visual-api.mjs";
import { handleSiteImageApi, isSiteImageApiRequest } from "./api/site-image-api.mjs";
import { handleStockImageApi, isStockImageApiRequest } from "./api/stock-image-api.mjs";
import { handleTaskApi, isTaskApiRequest } from "./api/task-api.mjs";
import { handleVerticalOperationsApi, isVerticalOperationsApiRequest } from "./api/vertical-operations-api.mjs";
import { handleZoneDiscoveryApi, isZoneDiscoveryApiRequest } from "./api/zone-discovery-api.mjs";
import { isAdminApiRequest, requireAdminApiAuth } from "./lib/admin-auth.mjs";
import { loadLocalEnv } from "./lib/load-env.mjs";
import { requirePublicApiRateLimit } from "./lib/public-rate-limit.mjs";
import { requireApiRequestGuards } from "./lib/request-guards.mjs";
import { securityHeaders } from "./lib/security-headers.mjs";
import { attachAccessLogger, createRequestLogContext, logError, logInfo, logWarn } from "./lib/structured-logger.mjs";

loadLocalEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};
const compressibleStaticExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".svg"]);

const baseHeaders = securityHeaders();

const server = createServer(async (request, response) => {
  let requestLog = null;

  try {
    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
    requestLog = createRequestLogContext(request, requestUrl);
    response.setHeader("X-Request-Id", requestLog.requestId);
    attachAccessLogger(request, response, requestLog);

    const apiContext = {
      root,
      baseHeaders,
      requestOrigin: request.headers.origin || "",
      requestLog
    };

    if (isHealthApiRequest(requestUrl.pathname)) {
      await handleHealthApi(request, response, apiContext);
      return;
    }

    if (!requireApiRequestGuards(request, response, apiContext, requestUrl.pathname)) {
      return;
    }

    if (!requirePublicApiRateLimit(request, response, apiContext, requestUrl.pathname)) {
      return;
    }

    if (isStockImageApiRequest(requestUrl.pathname)) {
      await handleStockImageApi(request, response, apiContext);
      return;
    }

    if (isClientAuthApiRequest(requestUrl.pathname)) {
      await handleClientAuthApi(request, response, apiContext);
      return;
    }

    if (isBusinessUserAuthApiRequest(requestUrl.pathname)) {
      await handleBusinessUserAuthApi(request, response, apiContext);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/public/booking-reminders/") && isVerticalOperationsApiRequest(requestUrl.pathname)) {
      await handleVerticalOperationsApi(request, response, apiContext);
      return;
    }

    if (isAdminApiRequest(requestUrl.pathname) && !(await requireAdminApiAuth(request, response, apiContext, requestUrl.pathname))) {
      return;
    }

    if (isBookingApiRequest(requestUrl.pathname)) {
      await handleBookingApi(request, response, apiContext);
      return;
    }

    if (isZoneDiscoveryApiRequest(requestUrl.pathname)) {
      await handleZoneDiscoveryApi(request, response, apiContext);
      return;
    }

    if (isSecurityApiRequest(requestUrl.pathname)) {
      await handleSecurityApi(request, response, apiContext);
      return;
    }

    if (isBookingResourceApiRequest(requestUrl.pathname)) {
      await handleBookingResourceApi(request, response, apiContext);
      return;
    }

    if (isAccountApiRequest(requestUrl.pathname)) {
      await handleAccountApi(request, response, apiContext);
      return;
    }

    if (isAutomationApiRequest(requestUrl.pathname)) {
      await handleAutomationApi(request, response, apiContext);
      return;
    }

    if (isCampaignApiRequest(requestUrl.pathname)) {
      await handleCampaignApi(request, response, apiContext);
      return;
    }

    if (isCommerceApiRequest(requestUrl.pathname)) {
      await handleCommerceApi(request, response, apiContext);
      return;
    }

    if (isCrmConfigApiRequest(requestUrl.pathname)) {
      await handleCrmConfigApi(request, response, apiContext);
      return;
    }

    if (isMoneyApiRequest(requestUrl.pathname)) {
      await handleMoneyApi(request, response, apiContext);
      return;
    }

    if (isLoyaltyApiRequest(requestUrl.pathname)) {
      await handleLoyaltyApi(request, response, apiContext);
      return;
    }

    if (isIntelligenceApiRequest(requestUrl.pathname)) {
      await handleIntelligenceApi(request, response, apiContext);
      return;
    }

    if (isVerticalOperationsApiRequest(requestUrl.pathname)) {
      await handleVerticalOperationsApi(request, response, apiContext);
      return;
    }

    if (isQuoteApiRequest(requestUrl.pathname)) {
      await handleQuoteApi(request, response, apiContext);
      return;
    }

    if (isConsentApiRequest(requestUrl.pathname)) {
      await handleConsentApi(request, response, apiContext);
      return;
    }

    if (isChannelApiRequest(requestUrl.pathname)) {
      await handleChannelApi(request, response, apiContext);
      return;
    }

    if (isCustomer360ApiRequest(requestUrl.pathname)) {
      await handleCustomer360Api(request, response, apiContext);
      return;
    }

    if (isGoogleApiRequest(requestUrl.pathname)) {
      await handleGoogleApi(request, response, apiContext);
      return;
    }

    if (isMessageTemplateApiRequest(requestUrl.pathname)) {
      await handleMessageTemplateApi(request, response, apiContext);
      return;
    }

    if (isProposalApiRequest(requestUrl.pathname)) {
      await handleProposalApi(request, response, apiContext);
      return;
    }

    if (isDealApiRequest(requestUrl.pathname)) {
      await handleDealApi(request, response, apiContext);
      return;
    }

    if (isTaskApiRequest(requestUrl.pathname)) {
      await handleTaskApi(request, response, apiContext);
      return;
    }

    if (isCommunicationsApiRequest(requestUrl.pathname)) {
      await handleCommunicationsApi(request, response, apiContext);
      return;
    }

    if (isOperationsApiRequest(requestUrl.pathname)) {
      await handleOperationsApi(request, response, apiContext);
      return;
    }

    if (isHospitalityApiRequest(requestUrl.pathname)) {
      await handleHospitalityApi(request, response, apiContext);
      return;
    }

    if (isInboxApiRequest(requestUrl.pathname)) {
      await handleInboxApi(request, response, apiContext);
      return;
    }

    if (isReportApiRequest(requestUrl.pathname)) {
      await handleReportApi(request, response, apiContext);
      return;
    }

    if (isReputationApiRequest(requestUrl.pathname)) {
      await handleReputationApi(request, response, apiContext);
      return;
    }

    if (isQaVisualApiRequest(requestUrl.pathname)) {
      await handleQaVisualApi(request, response, apiContext);
      return;
    }

    if (isSiteImageApiRequest(requestUrl.pathname)) {
      await handleSiteImageApi(request, response, apiContext);
      return;
    }

    if (isDemoPublishApiRequest(requestUrl.pathname)) {
      await handleDemoPublishApi(request, response, apiContext);
      return;
    }

    if (isEventApiRequest(requestUrl.pathname)) {
      await handleEventApi(request, response, apiContext);
      return;
    }

    if (isContactApiRequest(requestUrl.pathname)) {
      await handleContactApi(request, response, apiContext);
      return;
    }

    if (isDiscoveryApiRequest(requestUrl.pathname)) {
      await handleDiscoveryApi(request, response, apiContext);
      return;
    }

    if (isBusinessApiRequest(requestUrl.pathname)) {
      await handleBusinessApi(request, response, apiContext);
      return;
    }

    if (!["GET", "HEAD"].includes(request.method || "GET")) {
      response.writeHead(405, {
        ...baseHeaders,
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("Method not allowed");
      return;
    }

    let pathname;

    try {
      pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    } catch (error) {
      response.writeHead(400, { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }

    const filePath = path.normalize(path.join(root, pathname));

    if (filePath !== root && !filePath.startsWith(rootWithSeparator)) {
      response.writeHead(403, { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    let resolvedPath = filePath;
    let file;

    try {
      file = await readFile(resolvedPath);
    } catch (error) {
      if (path.extname(resolvedPath)) {
        throw error;
      }

      resolvedPath = path.join(root, "index.html");
      file = await readFile(resolvedPath);
    }

    const extension = path.extname(resolvedPath);
    const staticPayload = encodeStaticPayload(file, extension, request.headers["accept-encoding"]);
    response.writeHead(200, {
      ...baseHeaders,
      "Cache-Control": staticCacheControl(resolvedPath),
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Content-Length": staticPayload.payload.byteLength,
      ...(staticPayload.encoding
        ? {
            "Content-Encoding": staticPayload.encoding,
            Vary: "Accept-Encoding"
          }
        : {})
    });
    response.end(request.method === "HEAD" ? undefined : staticPayload.payload);
  } catch (error) {
    if (error.code === "ENOENT") {
      logWarn("not_found", { request: requestLog });
    } else {
      logError(error, { request: requestLog });
    }

    if (!response.headersSent && !response.writableEnded) {
      response.writeHead(404, { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found. Check the path or use / for the studio.");
    } else if (!response.writableEnded) {
      response.end();
    }
  }
});

server.listen(port, host, () => {
  logInfo("server_start", {
    service: "locallift-studio",
    url: `http://${host}:${port}`,
    host,
    port,
    environment: process.env.NODE_ENV || "development"
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logError(error, {
      component: "server",
      port,
      hint: "Port is already in use. Try PORT=5174 node server/server.mjs"
    });
    process.exit(1);
  }

  logError(error, { component: "server", port });
  throw error;
});

function staticCacheControl(filePath) {
  const relativePath = path.relative(root, filePath).split(path.sep).join("/");

  if (relativePath.endsWith(".html")) {
    return "no-cache";
  }

  if (
    /^assets\/landing\/sequence\/frame-\d{3}\.webp$/i.test(relativePath)
    || relativePath.startsWith("assets/vendor/")
  ) {
    return "public, max-age=31536000, immutable";
  }

  if (/\.(?:css|ico|jpe?g|js|mjs|png|svg|webp)$/i.test(relativePath)) {
    return "public, max-age=86400, stale-while-revalidate=604800";
  }

  return "no-cache";
}

function encodeStaticPayload(file, extension, acceptEncoding = "") {
  if (!compressibleStaticExtensions.has(extension) || file.byteLength < 1024) {
    return { encoding: "", payload: file };
  }

  const accepted = String(acceptEncoding || "").toLowerCase();
  if (accepted.includes("br")) {
    return {
      encoding: "br",
      payload: brotliCompressSync(file, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 5
        }
      })
    };
  }

  if (accepted.includes("gzip")) {
    return {
      encoding: "gzip",
      payload: gzipSync(file, { level: 6 })
    };
  }

  return { encoding: "", payload: file };
}
