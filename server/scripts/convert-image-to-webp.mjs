import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [inputArg, outputArg, qualityArg = "0.74"] = process.argv.slice(2);
assert.ok(inputArg && outputArg, "Usage: node server/scripts/convert-image-to-webp.mjs <input> <output> [quality]");

const input = path.resolve(inputArg);
const output = path.resolve(outputArg);
const quality = Math.max(0.1, Math.min(1, Number(qualityArg) || 0.74));
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "dls-webp-"));
const documentPath = path.join(profile, "convert.html");
const sourceUrl = pathToFileURL(input).href;

const document = `<!doctype html>
<html>
  <body>
    <img id="source" alt="">
    <script>
      const source = document.querySelector("#source");
      source.addEventListener("load", () => {
        const canvas = document.createElement("canvas");
        canvas.width = source.naturalWidth;
        canvas.height = source.naturalHeight;
        canvas.getContext("2d", { alpha: true }).drawImage(source, 0, 0);
        document.body.textContent = canvas.toDataURL("image/webp", ${quality});
        document.documentElement.dataset.ready = "true";
      }, { once: true });
      source.src = ${JSON.stringify(sourceUrl)};
    </script>
  </body>
</html>`;

await writeFile(documentPath, document, "utf8");

try {
  const result = await runChrome([
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--allow-file-access-from-files",
    "--virtual-time-budget=10000",
    `--user-data-dir=${profile}`,
    "--dump-dom",
    pathToFileURL(documentPath).href
  ]);
  assert.equal(result.code, 0, `Chrome exited with code ${result.code}: ${result.stderr.slice(-600)}`);
  const match = result.stdout.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match, `Chrome did not return a WebP payload: ${result.stdout.slice(0, 300)}`);
  const payload = Buffer.from(match[1], "base64");
  assert.ok(payload.byteLength > 100, "Encoded WebP payload is unexpectedly small");
  await writeFile(output, payload);
  console.log(`WebP written: ${path.relative(process.cwd(), output)} (${payload.byteLength} bytes)`);
} finally {
  await rm(profile, { recursive: true, force: true });
}

function runChrome(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}
