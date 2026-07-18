import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const index = await readFile(path.join(root, "index.html"), "utf8");
const workspace = await readFile(path.join(root, "workspace.html"), "utf8");
const stylesSource = await readFile(path.join(root, "src", "landing-tailwind.css"), "utf8");
const styles = await readFile(path.join(root, "src", "landing.css"), "utf8");
const runtime = await readFile(path.join(root, "src", "landing-experience.js"), "utf8");
const server = await readFile(path.join(root, "server", "server.mjs"), "utf8");

const orderedSections = [
  'id="inicio"',
  'id="demostracion"',
  'id="servicios"',
  'id="como-funciona"',
  'id="impacto"',
  'id="contacto"',
  'class="dls-footer"'
];
let previousSection = -1;
for (const section of orderedSections) {
  const sectionIndex = index.indexOf(section);
  assert.ok(sectionIndex > previousSection, `${section} must exist after the previous landing section`);
  previousSection = sectionIndex;
}

assert.match(index, /workspace\.html\?hub=1&amp;mode=developer/);
assert.match(index, /workspace\.html\?hub=1&amp;mode=client/);
assert.match(workspace, /id="introGate"/);
assert.match(workspace, /id="studioWorkspace"/);
assert.match(workspace, /data-client-login-form/);

for (const localAsset of [
  "src/landing.css",
  "assets/vendor/lenis.min.js",
  "assets/vendor/gsap.min.js",
  "assets/vendor/ScrollTrigger.min.js",
  "assets/vendor/SplitText.min.js",
  "src/landing-experience.js"
]) {
  assert.ok(index.includes(localAsset), `${localAsset} must load locally`);
}
assert.doesNotMatch(index, /<(?:script|link)[^>]+(?:src|href)="https?:\/\//i);
assert.match(index, /TODO: sustituir todas las cifras por datos reales/);
assert.match(index, /<noscript>/);

assert.match(stylesSource, /tailwindcss\/theme\.css/);
assert.match(stylesSource, /tailwindcss\/utilities\.css/);
assert.match(stylesSource, /@theme/);
assert.match(stylesSource, /prefers-reduced-motion:\s*reduce/);
assert.ok(styles.length > 20_000, "Compiled landing CSS should contain the complete design system");

assert.match(runtime, /lenis\.raf\(time\s*\*\s*1000\)/);
assert.match(runtime, /gsap\.ticker\.lagSmoothing\(0\)/);
assert.match(runtime, /ScrollTrigger/);
assert.match(runtime, /SplitText/);
assert.match(runtime, /WebGLRenderer/);
assert.match(runtime, /prefers-reduced-motion:\s*reduce/);
assert.match(runtime, /frame-\$\{String\(.+padStart\(3/);

const frameDirectory = path.join(root, "assets", "landing", "sequence");
const frames = (await readdir(frameDirectory))
  .filter((name) => /^frame-\d{3}\.webp$/.test(name))
  .sort();
assert.equal(frames.length, 90, "The landing sequence must contain exactly 90 WebP frames");
assert.equal(frames[0], "frame-001.webp");
assert.equal(frames.at(-1), "frame-090.webp");
for (const frame of frames) {
  const frameStats = await stat(path.join(frameDirectory, frame));
  assert.ok(frameStats.size > 2_000, `${frame} is unexpectedly small`);
  assert.ok(frameStats.size < 100_000, `${frame} is not sufficiently optimized`);
}

assert.match(server, /public, max-age=31536000, immutable/);
assert.match(server, /Content-Encoding/);

console.log(`Landing architecture checks passed. ${frames.length} WebP frames ready.`);
