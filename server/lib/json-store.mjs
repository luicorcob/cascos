import { access, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readJsonStore(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const initial = cloneJson(fallback);
    await writeJsonStore(filePath, initial);
    return initial;
  }
}

export async function writeJsonStore(filePath, data) {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);

  await mkdir(dir, { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function backupJsonStore(filePath, backupDir, label = "backup") {
  try {
    await access(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeLabel = String(label).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const backupPath = path.join(backupDir, `${path.basename(filePath, ".json")}.${timestamp}.${safeLabel}.json`);

  await mkdir(backupDir, { recursive: true });
  await copyFile(filePath, backupPath);
  return backupPath;
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
