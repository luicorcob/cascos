import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleBookingApi, isBookingApiRequest } from "./api/booking-api.mjs";
import { handleBusinessApi, isBusinessApiRequest } from "./api/business-api.mjs";
import { handleClientAuthApi, isClientAuthApiRequest } from "./lib/client-auth.mjs";
import { handleContactApi, isContactApiRequest } from "./api/contact-api.mjs";
import { handleDemoPublishApi, isDemoPublishApiRequest } from "./api/demo-publish-api.mjs";
import { handleDiscoveryApi, isDiscoveryApiRequest } from "./api/discovery-api.mjs";
import { handleEventApi, isEventApiRequest } from "./api/event-api.mjs";
import { handleHealthApi, isHealthApiRequest } from "./api/health-api.mjs";
import { handleGoogleApi, isGoogleApiRequest } from "./api/google-api.mjs";
import { handleReportApi, isReportApiRequest } from "./api/report-api.mjs";
import { handleSiteImageApi, isSiteImageApiRequest } from "./api/site-image-api.mjs";
import { handleStockImageApi, isStockImageApiRequest } from "./api/stock-image-api.mjs";
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

    if (isAdminApiRequest(requestUrl.pathname) && !(await requireAdminApiAuth(request, response, apiContext, requestUrl.pathname))) {
      return;
    }

    if (isBookingApiRequest(requestUrl.pathname)) {
      await handleBookingApi(request, response, apiContext);
      return;
    }

    if (isGoogleApiRequest(requestUrl.pathname)) {
      await handleGoogleApi(request, response, apiContext);
      return;
    }

    if (isReportApiRequest(requestUrl.pathname)) {
      await handleReportApi(request, response, apiContext);
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

    response.writeHead(200, {
      ...baseHeaders,
      "Content-Type": contentTypes[path.extname(resolvedPath)] || "application/octet-stream"
    });
    response.end(request.method === "HEAD" ? undefined : file);
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
