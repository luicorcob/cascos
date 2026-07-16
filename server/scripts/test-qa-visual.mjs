import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const token = `qa-visual-fixture-${Date.now().toString(36)}`;
const fixtureName = `.${token}.html`;
const fixturePath = path.join(root, fixtureName);
const outDir = await mkdtemp(path.join(os.tmpdir(), "dls-qa-visual-test-"));

try {
  await writeFile(fixturePath, fixtureHtml(), "utf8");
  const result = await run(process.execPath, [
    "server/scripts/qa-visual-accessibility.mjs",
    "--path",
    `/${fixtureName}`,
    "--out",
    outDir
  ]);

  assert.equal(result.exitCode, 1, `The intentionally broken fixture must fail QA.\n${result.stderr}`);
  const report = JSON.parse(await readFile(path.join(outDir, "qa-visual-report.json"), "utf8"));
  assert.deepEqual(report.viewports.map((run) => run.viewport.name), ["desktop", "tablet", "mobile", "mobile-narrow"]);

  report.viewports.forEach((run) => {
    assert.ok(run.metrics.renderedContrastChecked > 0, `${run.viewport.name} must use rendered-pixel contrast checks`);
  });

  ["desktop", "tablet"].forEach((name) => {
    const run = report.viewports.find((candidate) => candidate.viewport.name === name);
    assert.ok(!run.issues.some((issue) => issue.code === "contrast-rendered-low"), `${name} must preserve the valid desktop/tablet color`);
  });
  ["mobile", "mobile-narrow"].forEach((name) => {
    const run = report.viewports.find((candidate) => candidate.viewport.name === name);
    assert.ok(run.issues.some((issue) => issue.code === "contrast-rendered-low" && issue.severity === "blocker"), `${name} must block text that turns white only on mobile`);
    assert.ok(run.issues.some((issue) => issue.code === "text-covered"), `${name} must flag a text layer covered only on mobile`);
    assert.ok(run.issues.some((issue) => issue.code === "image-covered"), `${name} must flag an image covered only on mobile`);
  });

  assert.ok(report.viewports.some((run) => run.issues.some((issue) => issue.code === "image-cover-severe-crop")), "The image crop check must flag a severe cover crop");
  console.log("QA visual profundo: test superado.");
} finally {
  await rm(fixturePath, { force: true }).catch(() => {});
  await rm(outDir, { recursive: true, force: true }).catch(() => {});
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (exitCode, signal) => resolve({ exitCode, signal, stdout, stderr }));
  });
}

function fixtureHtml() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QA visual fixture</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #17202a; font-family: Arial, sans-serif; }
    main { min-height: 1500px; padding: 28px; }
    .mobile-contrast { color: #17202a; font-size: 20px; line-height: 1.4; }
    .covered-zone { position: relative; min-height: 100px; }
    .image-zone { position: relative; width: min(100%, 640px); margin-top: 28px; }
    img { display: block; width: 100%; height: 90px; object-fit: cover; }
    .mobile-overlay { display: none; }
    .mobile-image-overlay { display: none; }
    @media (max-width: 760px) {
      .mobile-contrast { color: #fff; }
      .mobile-overlay { display: block; position: absolute; z-index: 4; inset: 0; background: #004f6e; }
      .mobile-image-overlay { display: block; position: absolute; z-index: 4; inset: 0; background: rgba(0, 79, 110, .72); }
    }
  </style>
</head>
<body>
  <main>
    <h1 class="mobile-contrast">Este titular solo se vuelve blanco en movil.</h1>
    <p>En escritorio y tablet este texto conserva un contraste correcto.</p>
    <div class="covered-zone"><p>Este texto queda tapado solo en movil.</p><div class="mobile-overlay" aria-hidden="true"></div></div>
    <div class="image-zone"><img alt="Imagen de prueba" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23004f6e'/%3E%3C/svg%3E"><div class="mobile-image-overlay" aria-hidden="true"></div></div>
  </main>
</body>
</html>`;
}
