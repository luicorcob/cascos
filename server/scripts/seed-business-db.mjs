import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPostgresBusinessStore, loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { loadLocalEnv } from "../lib/load-env.mjs";

loadLocalEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "data", "business-db.example.json");
const target = path.join(root, "data", "business-db.json");
const force = process.argv.includes("--force");

async function main() {
  if (isPostgresBusinessStore()) {
    const current = await loadBusinessStore({ root }, { businesses: [] });

    if (!force && current.businesses.length) {
      console.log("PostgreSQL business store already has data. Use --force to overwrite it.");
      return;
    }

    const db = JSON.parse(await readFile(source, "utf8"));
    await saveBusinessStore(db, { root }, force ? "seed-force" : "seed");
    console.log("Seeded PostgreSQL business store from data/business-db.example.json");
    return;
  }

  if (!force) {
    try {
      await access(target);
      console.log("data/business-db.json already exists. Use --force to overwrite it.");
      return;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log("Seeded data/business-db.json from data/business-db.example.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
