import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleBookingApi, isBookingApiRequest } from "./api/booking-api.mjs";
import { handleBusinessApi, isBusinessApiRequest } from "./api/business-api.mjs";
import { handleContactApi, isContactApiRequest } from "./api/contact-api.mjs";
import { handleEventApi, isEventApiRequest } from "./api/event-api.mjs";
import { handleHealthApi, isHealthApiRequest } from "./api/health-api.mjs";
import { handleGoogleApi, isGoogleApiRequest } from "./api/google-api.mjs";
import { handleReportApi, isReportApiRequest } from "./api/report-api.mjs";
import { handleStockImageApi, isStockImageApiRequest } from "./api/stock-image-api.mjs";
import { isAdminApiRequest, requireAdminApiAuth } from "./lib/admin-auth.mjs";
import { loadLocalEnv } from "./lib/load-env.mjs";
import { requirePublicApiRateLimit } from "./lib/public-rate-limit.mjs";

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

const baseHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store"
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
    const apiContext = {
      root,
      baseHeaders,
      requestOrigin: request.headers.origin || ""
    };

    if (isHealthApiRequest(requestUrl.pathname)) {
      await handleHealthApi(request, response, apiContext);
      return;
    }

    if (isStockImageApiRequest(requestUrl.pathname)) {
      await handleStockImageApi(request, response, apiContext);
      return;
    }

    if (!requirePublicApiRateLimit(request, response, apiContext, requestUrl.pathname)) {
      return;
    }

    if (isAdminApiRequest(requestUrl.pathname) && !requireAdminApiAuth(request, response, apiContext)) {
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

    if (isEventApiRequest(requestUrl.pathname)) {
      await handleEventApi(request, response, apiContext);
      return;
    }

    if (isContactApiRequest(requestUrl.pathname)) {
      await handleContactApi(request, response, apiContext);
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
    response.writeHead(404, { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found. Check the path or use / for the studio.");
  }
});

server.listen(port, host, () => {
  console.log(`LocalLift Studio running at http://${host}:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try PORT=5174 node server/server.mjs`);
    process.exit(1);
  }

  throw error;
});
