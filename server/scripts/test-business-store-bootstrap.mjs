import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeBusinessBootstrapDefaults } from "../lib/business-store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const current = JSON.parse(await readFile(path.join(root, "data", "business-db.example.json"), "utf8"));
const bootstrap = JSON.parse(await readFile(path.join(root, "data", "business-db.json"), "utf8"));

current.businesses[0].settings.primaryGoal = "production-value";

const merged = mergeBusinessBootstrapDefaults(current, bootstrap);
const brasa = merged.businesses.find((business) => business.id === "biz_demo_brasa_norte");

assert.equal(merged.businesses.length, 2, "adds the missing seeded business");
assert.equal(merged.projects.length, 3, "adds the missing seeded projects");
assert.equal(brasa?.settings?.primaryGoal, "production-value", "preserves existing production values");
assert.ok(brasa?.settings?.portal?.passwordHash, "adds missing nested portal access fields");

console.log("Business store bootstrap checks passed: missing records are added and production values are preserved.");
