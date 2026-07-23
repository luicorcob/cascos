import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const index = await readFile(path.join(root, "workspace.html"), "utf8");
const appStats = await stat(path.join(root, "src", "app.js"));
const expectedScripts = [
  "src/shared/api-config.js",
  "src/studio/core-utils.js",
  "src/studio/button-style-editor.js",
  "src/studio/catalog.js",
  "src/studio/state-controller.js",
  "src/studio/layout-library.js",
  "src/studio/media-library.js",
  "src/studio/curated-stock-images.js",
  "src/studio/stock-images.js",
  "src/studio/data-client.js",
  "src/studio/validation.js",
  "src/studio/quality-control.js",
  "src/studio/commerce-model.js",
  "src/studio/business-model.js",
  "src/studio/public-runtime.js",
  "src/studio/chatbot-controller.js",
  "src/studio/storefront-controller.js",
  "src/studio/site-image-controller.js",
  "src/studio/intro-controller.js",
  "src/studio/zip-archive.js",
  "src/studio/delivery-controller.js",
  "src/studio/renderer.js",
  "src/studio/exporter.js",
  "src/app.js"
];

let previousIndex = -1;
for (const script of expectedScripts) {
  const scriptIndex = index.indexOf(script);
  assert.ok(scriptIndex > previousIndex, `${script} must exist and load after the previous Studio dependency`);
  previousIndex = scriptIndex;
}

assert.doesNotMatch(index, /id="introStartButton"/);
assert.doesNotMatch(index, /class="intro-gate-content"/);
assert.match(index, /data-intro-help-logo/);
assert.match(index, /id="introHelpButton"/);
assert.match(index, /class="intro-hub-brand-mark"[^>]*>[\s\S]*?<img src="Logo\.png"/);
assert.ok(appStats.size < 180_000, `src/app.js must remain below 180 KB; current size is ${appStats.size}`);

console.log(`Studio architecture checks passed. app.js: ${appStats.size} bytes.`);
