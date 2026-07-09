import assert from "node:assert/strict";

await import("../../src/studio/data-client.js");

const { createBusinessDataClient, toApiRecordMeta } = globalThis.LocalLiftStudio.data;
const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
};
const client = createBusinessDataClient({ storage, storageKey: "record" });
const record = { id: "biz_1", slug: "luma", name: "Luma", status: "active", publishedUrl: "" };

client.storeRecord(record);
assert.deepEqual(client.getStoredRecord(), record);
client.storeRecord(null);
assert.equal(client.getStoredRecord(), null);
assert.deepEqual(toApiRecordMeta(record), {
  id: "biz_1",
  slug: "luma",
  name: "Luma",
  plan: undefined,
  status: "active",
  publishedUrl: "",
  activeDemo: null
});

const requests = [];
globalThis.fetch = async (url, options) => {
  requests.push({ url, options });
  return {
    ok: false,
    status: 404,
    json: async () => ({ error: "Business not found" })
  };
};

await assert.rejects(
  () => client.save({ name: "Luma" }, record),
  /Business not found/
);
assert.equal(requests.length, 1);
assert.equal(requests[0].options.method, "PUT");
assert.match(String(requests[0].url), /\/api\/businesses\/biz_1$/);

console.log("Studio data client tests passed.");
