import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(evidenceDir, "..");
const sourcePath = path.join(outputDir, "memoria_tfg.md");
const htmlPath = path.join(outputDir, "memoria_tfg.html");
const pdfPath = path.join(outputDir, "memoria_tfg.pdf");
const paginationPath = path.join(evidenceDir, "paginacion.json");

const markdown = await readFile(sourcePath, "utf8");
const pagination = await readOptionalJson(paginationPath);
const rendered = renderMarkdown(markdown);
const html = renderPage(rendered, pagination);
await writeFile(htmlPath, html, "utf8");
await printPdf(htmlPath, pdfPath);
console.log(`HTML: ${path.relative(outputDir, htmlPath)}`);
console.log(`PDF:  ${path.relative(outputDir, pdfPath)}`);

function renderMarkdown(source) {
  const lines = source.replace(/<!--[^]*?-->/g, "").split(/\r?\n/);
  const html = [];
  const toc = [];
  let paragraph = [];
  let list = null;
  let code = null;
  let codeLang = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    html.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  const flushCode = () => {
    if (!code) return;
    html.push(`<pre><code class="language-${escapeAttr(codeLang)}">${escapeHtml(code.join("\n"))}</code></pre>`);
    code = null;
    codeLang = "";
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.replace(/\s+$/g, "");

    if (code) {
      if (line.startsWith("```")) flushCode();
      else code.push(rawLine);
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      code = [];
      codeLang = line.slice(3).trim();
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      html.push("<hr>");
      continue;
    }

    const image = /^!\[(.+?)\]\((.+?)\)$/.exec(line.trim());
    if (image) {
      flushParagraph();
      flushList();
      const caption = image[1].trim();
      const src = image[2].trim().replace(/\\/g, "/");
      const portrait = /16-web-cliente-movil/i.test(src) ? " is-portrait" : "";
      html.push(`<figure class="document-figure${portrait}"><img src="${escapeAttr(src)}" alt="${escapeAttr(caption)}"><figcaption>${inline(caption)}</figcaption></figure>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = uniqueSlug(text, toc);
      if (level === 1) toc.push({ level, text: stripInline(text), id });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }

    if (line.trim().startsWith("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      flushParagraph();
      flushList();
      const headers = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push(renderTable(headers, rows));
      continue;
    }

    const quote = /^>\s+(.+)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    const bullet = /^-\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();
  return { body: html.join("\n"), toc };
}

function renderPage({ body, toc }, pagination) {
  const pageMap = pagination?.headings || {};
  const tocHtml = toc.map((item) => {
    const page = pageMap[item.id] || "—";
    return `<a class="toc-level-${item.level}" href="#${item.id}"><span>${escapeHtml(item.text)}</span><i></i><b>${escapeHtml(page)}</b></a>`;
  }).join("\n");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Memoria técnica · DLS Digital Local Sites</title>
  <style>${styles()}</style>
</head>
<body>
  <section class="cover">
    <div class="cover-mark">DLS</div>
    <p class="cover-kicker">Trabajo Fin de Grado · Memoria técnica</p>
    <h1>DLS · Digital<br>Local Sites</h1>
    <p class="cover-subtitle">Diseño, generación y operación de presencia digital para negocios locales</p>
    <div class="cover-rule"></div>
    <dl class="cover-meta">
      <div><dt>Autor</dt><dd>[pendiente de confirmar]</dd></div>
      <div><dt>Tutor/a</dt><dd>[pendiente de confirmar]</dd></div>
      <div><dt>Titulación y centro</dt><dd>[pendiente de confirmar]</dd></div>
      <div><dt>Corte técnico</dt><dd>23 de julio de 2026 · base 9eba886 + refactor modular</dd></div>
    </dl>
    <p class="cover-note">Documento construido a partir del código, pruebas y ejecución del repositorio.</p>
  </section>
  <section class="toc-sheet">
    <p class="section-kicker">Contenido</p>
    <h1>Índice</h1>
    <div class="toc-list">${tocHtml}</div>
    <p class="toc-note">Los guiones indican paginación pendiente de fijar. La versión final se genera con la tabla de paginación validada tras la primera revisión.</p>
  </section>
  <main>${body}</main>
</body>
</html>`;
}

function styles() {
  return `
    :root { --ink:#142038; --muted:#637087; --paper:#fff; --soft:#f2f5fa; --line:#dbe1ea; --cyan:#20c8e9; --magenta:#c83caa; --violet:#6b63e8; --green:#138f6a; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:#e9edf3; color:var(--ink); font-family:"Segoe UI",Arial,sans-serif; font-size:10.35pt; line-height:1.52; }
    .cover, .toc-sheet, main { width:210mm; margin:0 auto 8mm; background:var(--paper); box-shadow:0 12px 50px rgba(20,32,56,.08); }
    .cover { min-height:297mm; padding:25mm 22mm 20mm; display:flex; flex-direction:column; color:#fff; background:radial-gradient(circle at 82% 18%,rgba(200,60,170,.35),transparent 31%),radial-gradient(circle at 16% 72%,rgba(32,200,233,.25),transparent 34%),linear-gradient(145deg,#06101b 0%,#111022 63%,#1d1020 100%); }
    .cover-mark { width:25mm; height:16mm; display:grid; place-items:center; border:1px solid rgba(255,255,255,.25); border-radius:5mm; background:linear-gradient(110deg,rgba(32,200,233,.18),rgba(200,60,170,.22)); font-weight:900; letter-spacing:.14em; }
    .cover-kicker,.section-kicker { margin:31mm 0 6mm; color:#77e6fa; font-weight:800; text-transform:uppercase; letter-spacing:.15em; font-size:9pt; }
    .cover h1 { margin:0; color:#fff; font-size:47pt; line-height:.94; letter-spacing:-.045em; }
    .cover-subtitle { width:138mm; margin:9mm 0 0; color:#cdd5e2; font-size:16pt; line-height:1.35; }
    .cover-rule { width:100%; height:1.2mm; margin:17mm 0 10mm; background:linear-gradient(90deg,var(--cyan),var(--violet),var(--magenta),#ff8758); }
    .cover-meta { display:grid; grid-template-columns:1fr 1fr; gap:6mm 10mm; margin:auto 0 0; }
    .cover-meta div { padding-top:4mm; border-top:1px solid rgba(255,255,255,.18); }
    .cover-meta dt { color:#8898af; font-size:8pt; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
    .cover-meta dd { margin:1.5mm 0 0; color:#fff; font-size:10pt; font-weight:650; }
    .cover-note { margin:8mm 0 0; color:#8793a5; font-size:8.5pt; }
    .toc-sheet { min-height:297mm; padding:20mm 20mm 18mm; }
    .toc-sheet .section-kicker { margin:0 0 2mm; color:var(--magenta); }
    .toc-sheet h1 { margin:0 0 8mm; font-size:30pt; letter-spacing:-.035em; }
    .toc-list { display:grid; gap:1.15mm; }
    .toc-list a { display:flex; align-items:baseline; gap:2mm; color:var(--ink); text-decoration:none; font-size:9.2pt; line-height:1.25; }
    .toc-list a i { flex:1; border-bottom:1px dotted #b6c0cf; transform:translateY(-1.5px); }
    .toc-list a b { width:8mm; text-align:right; font-variant-numeric:tabular-nums; }
    .toc-level-1 { margin-top:1.5mm; font-weight:800; }
    .toc-level-2 { padding-left:6mm; color:var(--muted)!important; font-size:8.5pt!important; }
    .toc-note { margin-top:8mm; padding:4mm; border-left:1mm solid var(--cyan); background:var(--soft); color:var(--muted); font-size:8.4pt; }
    main { padding:16mm 18mm 20mm; }
    main > h1 { margin:0 0 7mm; padding-top:2mm; color:var(--ink); font-size:27pt; line-height:1.04; letter-spacing:-.036em; break-before:page; page-break-before:always; }
    main > h1:first-child { break-before:auto; page-break-before:auto; }
    h2 { margin:10mm 0 3.5mm; padding-top:2.5mm; border-top:.5mm solid var(--line); font-size:17pt; line-height:1.14; letter-spacing:-.025em; break-after:avoid; page-break-after:avoid; }
    h3 { margin:7mm 0 2.5mm; color:#3e51a2; font-size:12.8pt; break-after:avoid; page-break-after:avoid; }
    h4 { margin:5mm 0 2mm; font-size:11pt; break-after:avoid; }
    p { margin:0 0 3.4mm; orphans:3; widows:3; }
    ul,ol { margin:0 0 4mm 6mm; padding-left:4mm; }
    li { margin:1.2mm 0; orphans:2; widows:2; }
    strong { font-weight:750; }
    a { color:#4055b5; }
    code { font-family:"Cascadia Mono",Consolas,monospace; font-size:.9em; }
    :not(pre)>code { padding:.25mm 1mm; border:1px solid #d5dce8; border-radius:1mm; background:#f2f5fa; }
    pre { margin:5mm 0; padding:4.5mm; overflow:hidden; white-space:pre-wrap; border-radius:3mm; background:#0a111d; color:#e9f1fb; font-size:7.8pt; line-height:1.42; break-inside:avoid; page-break-inside:avoid; }
    blockquote { margin:5mm 0; padding:4mm 5mm; border-left:1.2mm solid var(--magenta); background:#fbf2f9; color:#4a3550; break-inside:avoid; }
    hr { border:0; border-top:.4mm solid var(--line); margin:8mm 0; }
    table { width:100%; margin:4.5mm 0 6mm; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:2.5mm; overflow:hidden; font-size:8.15pt; line-height:1.35; break-inside:auto; }
    thead { display:table-header-group; }
    tr { break-inside:avoid; page-break-inside:avoid; }
    th,td { padding:2.6mm 3mm; text-align:left; vertical-align:top; border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
    th:last-child,td:last-child { border-right:0; }
    tbody tr:last-child td { border-bottom:0; }
    th { background:#eef2f8; color:#31405a; font-size:7.8pt; letter-spacing:.02em; }
    tbody tr:nth-child(even) td { background:#fafbfd; }
    .document-figure { margin:6mm 0 7mm; padding:3mm; border:1px solid var(--line); border-radius:3.5mm; background:#f8fafc; break-inside:avoid; page-break-inside:avoid; }
    .document-figure img { display:block; width:100%; height:auto; max-height:174mm; object-fit:contain; border-radius:2mm; background:#0a101a; }
    .document-figure.is-portrait { text-align:center; }
    .document-figure.is-portrait img { width:auto; max-width:72mm; max-height:190mm; margin:0 auto; }
    figcaption { margin-top:2.5mm; padding:0 1mm 1mm; color:#526078; font-size:8.1pt; line-height:1.38; }
    figcaption strong { color:var(--ink); }
    @media screen and (max-width:900px) { .cover,.toc-sheet,main { width:min(100%,210mm); } }
    @media print {
      @page { size:A4; margin:15mm 16mm 17mm; }
      html,body { background:#fff; }
      body { font-size:9.7pt; }
      .cover,.toc-sheet,main { width:auto; margin:0; box-shadow:none; }
      .cover { height:265mm; min-height:265mm; margin:-15mm -16mm -17mm; padding:22mm 20mm 17mm; break-after:page; page-break-after:always; }
      .toc-sheet { min-height:auto; padding:0; break-after:page; page-break-after:always; }
      main { padding:0; }
      a { color:inherit; text-decoration:none; }
      .toc-note { display:none; }
    }
  `;
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function renderTable(headers, rows) {
  const head = headers.map((cell) => `<th>${inline(cell)}</th>`).join("");
  const body = rows.map((row) => `<tr>${headers.map((_, index) => `<td>${inline(row[index] || "")}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function inline(value) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/  $/g, "<br>");
}

function stripInline(value) {
  return String(value || "").replace(/\*\*|`/g, "");
}

function uniqueSlug(value, items) {
  const base = slug(value) || "section";
  let candidate = base;
  let index = 2;
  const used = new Set(items.map((item) => item.id));
  while (used.has(candidate)) candidate = `${base}-${index++}`;
  return candidate;
}

function slug(value) {
  return stripInline(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function readOptionalJson(filePath) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch { return {}; }
}

async function printPdf(inputPath, outputPath) {
  const chrome = await findChrome();
  const profile = await mkdtemp(path.join(os.tmpdir(), "dls-tfg-pdf-"));
  const debugPort = 9743 + Math.floor(Math.random() * 100);
  const browser = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    pathToFileURL(inputPath).href
  ], { stdio: "ignore", windowsHide: true });
  let cdp;
  try {
    const page = await waitForPage(debugPort, 20_000);
    cdp = await createCdpClient(page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await waitForExpression(cdp, "document.readyState === 'complete'", 15_000);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const result = await cdp.send("Page.printToPDF", {
      printBackground: true,
      displayHeaderFooter: true,
      preferCSSPageSize: true,
      marginTop: 0.52,
      marginBottom: 0.58,
      marginLeft: 0.63,
      marginRight: 0.63,
      headerTemplate: '<div style="width:100%;font:7px Segoe UI,Arial;color:#7a8495;padding:0 16mm"><span>DLS · Digital Local Sites — Memoria técnica</span></div>',
      footerTemplate: '<div style="width:100%;font:7px Segoe UI,Arial;color:#7a8495;padding:0 16mm;display:flex;justify-content:space-between"><span>TFG · corte 23/07/2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
    });
    await writeFile(outputPath, Buffer.from(result.data, "base64"));
  } finally {
    try { await cdp?.send("Browser.close"); } catch { browser.kill(); }
    cdp?.close();
    browser.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error("No se encontró Chrome o Edge para generar el PDF.");
}

async function waitForPage(port, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const page = pages.find((item) => item.type === "page");
      if (page) return page;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("Chrome no expuso una página CDP.");
}

async function waitForExpression(cdp, expression, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const result = await cdp.send("Runtime.evaluate", { expression: `Boolean(${expression})`, returnByValue: true });
      if (result.result?.value) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timeout esperando ${expression}`);
}

async function createCdpClient(socketUrl) {
  const socket = new WebSocket(socketUrl);
  const pending = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); }
  };
}
