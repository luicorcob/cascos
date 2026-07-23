import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoots = ["src", "server", "cloudflare", "examples"];
const extensions = new Set([".js", ".mjs"]);
const files = [];

for (const sourceRoot of sourceRoots) {
  const directory = path.join(root, sourceRoot);
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true
  });

  entries
    .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name)))
    .forEach((entry) => {
      files.push(path.join(entry.parentPath, entry.name));
    });
}

files.sort((left, right) => left.localeCompare(right));

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`Syntax checks passed for ${files.length} JavaScript modules.`);
