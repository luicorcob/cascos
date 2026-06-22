import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("../../src/studio/catalog.js");
await import("../../src/studio/stock-images.js");

const { handleStockImageApi } = await import("../api/stock-image-api.mjs");
const { STOCK_IMAGE_CATEGORIES, createStockImageSearch } = globalThis.LocalLiftStudio.stockImages;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataPath = path.join(root, "data", "curated-stock-images.json");
const scriptPath = path.join(root, "src", "studio", "curated-stock-images.js");
const start = Math.max(0, Number(readArgument("start") || 0));
const count = Math.max(1, Math.min(10, Number(readArgument("count") || 10)));
const categories = STOCK_IMAGE_CATEGORIES.slice(start, start + count);

if (!categories.length) {
  throw new Error(`No stock categories found from index ${start}.`);
}

const search = createStockImageSearch({
  catalogConcurrency: 1,
  catalogPageSize: 24,
  fetcher: fetchThroughLocalApi
});
const targetItems = categories.length * 12;
const result = await search.discover({
  categoryIds: categories.map((category) => category.id),
  minItems: targetItems,
  targetItems,
  maxPages: 1
});

const minimumItems = categories.length * 8;
if (result.items.length < minimumItems) {
  throw new Error(`Only ${result.items.length} of at least ${minimumItems} curated images were found.`);
}

const existing = readArgument("reset") === "true" ? [] : await readExistingItems();
const merged = mergeByUrl(existing, result.items.map((item) => ({
  id: item.id,
  title: item.title,
  creator: item.creator,
  provider: item.provider,
  license: item.license,
  sourceUrl: item.sourceUrl,
  url: item.url,
  thumbnail: item.thumbnail,
  tags: item.tags,
  alt: item.alt,
  category: item.category,
  categoryLabel: item.categoryLabel,
  builtIn: true
}))).sort((left, right) => (
  STOCK_IMAGE_CATEGORIES.findIndex((category) => category.id === left.category)
  - STOCK_IMAGE_CATEGORIES.findIndex((category) => category.id === right.category)
));

await mkdir(path.dirname(dataPath), { recursive: true });
await writeFile(dataPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
await writeFile(scriptPath, `(function (global) {\n  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};\n  studio.curatedStockItems = ${JSON.stringify(merged, null, 2)};\n})(globalThis);\n`, "utf8");

console.log(JSON.stringify({
  added: result.items.length,
  total: merged.length,
  categories: [...new Set(merged.map((item) => item.category))].length
}, null, 2));

async function fetchThroughLocalApi(url) {
  const parsed = new URL(url);
  const response = createResponse();
  await handleStockImageApi({ method: "GET", url: `${parsed.pathname}${parsed.search}` }, response, {
    baseHeaders: {},
    requestOrigin: ""
  });
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: async () => JSON.parse(response.body || "{}")
  };
}

async function readExistingItems() {
  try {
    const parsed = JSON.parse(await readFile(dataPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function mergeByUrl(primary, secondary) {
  const known = new Set();
  return [...primary, ...secondary].filter((item) => {
    const identity = String(item.url || "").split("?")[0];
    if (!identity || known.has(identity)) {
      return false;
    }
    known.add(identity);
    return true;
  });
}

function readArgument(name) {
  return process.argv.slice(2)
    .map((argument) => argument.match(/^--([^=]+)=(.*)$/))
    .find((match) => match?.[1] === name)?.[2];
}

function createResponse() {
  return {
    status: 0,
    body: "",
    writeHead(status) {
      this.status = status;
    },
    end(body = "") {
      this.body = String(body);
    }
  };
}
