import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { routeApiRequest, routeHealthRequest } from "./http/api-router.mjs";
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

    if (await routeHealthRequest(request, response, apiContext, requestUrl.pathname)) {
      return;
    }

    if (!requireApiRequestGuards(request, response, apiContext, requestUrl.pathname)) {
      return;
    }

    if (!requirePublicApiRateLimit(request, response, apiContext, requestUrl.pathname)) {
      return;
    }

    if (await routeApiRequest(request, response, apiContext, requestUrl.pathname)) {
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
