import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiRouteManifest } from "../http/api-router.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const entryPath = path.join(root, "server", "server.mjs");
const entry = await readFile(entryPath, "utf8");
const entryStats = await stat(entryPath);
const routeNames = [...apiRouteManifest.public, ...apiRouteManifest.protected];

assert.ok(apiRouteManifest.public.includes("client-auth"));
assert.ok(apiRouteManifest.public.includes("business-user-auth"));
assert.ok(apiRouteManifest.protected.includes("businesses"));
assert.ok(apiRouteManifest.protected.includes("bookings"));
assert.ok(apiRouteManifest.protected.includes("google"));
assert.equal(new Set(routeNames).size, routeNames.length, "API route names must be unique");
assert.ok(routeNames.length >= 35, "The API manifest must cover the connected domain handlers");
assert.match(entry, /routeApiRequest/);
assert.doesNotMatch(entry, /handle[A-Z][A-Za-z]+Api/);
assert.ok(
  entryStats.size < 12_000,
  `server/server.mjs must remain a composition root below 12 KB; current size is ${entryStats.size}`
);

console.log(
  `Server architecture checks passed. entry: ${entryStats.size} bytes; routes: ${routeNames.length}.`
);
