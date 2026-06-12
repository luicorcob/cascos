import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = path.join(root, "docs", "referencia", "LOCAL_LIFT_STUDIO_MEMORIA_TFG.md");
const htmlPath = path.join(root, "docs", "referencia", "LOCAL_LIFT_STUDIO_MEMORIA_TFG.html");

const markdown = await readFile(sourcePath, "utf8");
const { body, toc } = renderMarkdown(markdown);

await writeFile(htmlPath, renderPage({ body, toc }), "utf8");
console.log(`Generated ${path.relative(root, htmlPath)}`);

function renderMarkdown(source) {
  const lines = source.split(/\r?\n/);
  const toc = [];
  const html = [];
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

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");

    if (code) {
      if (line.startsWith("```")) {
        flushCode();
      } else {
        code.push(rawLine);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      code = [];
      codeLang = line.replace(/^```/, "").trim();
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

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slug(text);
      if (level <= 3) toc.push({ level, text, id });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
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

function renderPage({ body, toc }) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>LocalLift Studio - Memoria TFG</title>
    <style>
      :root {
        --ink: #171513;
        --muted: #625b52;
        --paper: #fffdf7;
        --soft: #f4efe6;
        --line: #ded5c8;
        --accent: #c94432;
        --blue: #235f84;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        background: var(--soft);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        line-height: 1.58;
      }

      .page {
        width: min(1080px, calc(100% - 32px));
        margin: 24px auto;
        background: var(--paper);
        border: 1px solid var(--line);
        box-shadow: 0 18px 60px rgba(23, 21, 19, 0.08);
      }

      .cover {
        min-height: 92vh;
        display: grid;
        align-content: end;
        gap: 20px;
        padding: 88px 78px;
        color: #fffaf0;
        background:
          linear-gradient(135deg, rgba(23, 21, 19, 0.96), rgba(35, 95, 132, 0.88)),
          radial-gradient(circle at 82% 12%, rgba(201, 68, 50, 0.35), transparent 28%);
      }

      .cover .label {
        width: fit-content;
        padding: 7px 11px;
        border: 1px solid rgba(255, 250, 240, 0.35);
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .cover h1 {
        max-width: 860px;
        margin: 0;
        font-size: clamp(3rem, 8vw, 6.6rem);
        line-height: 0.92;
        letter-spacing: 0;
      }

      .cover p {
        max-width: 780px;
        margin: 0;
        color: rgba(255, 250, 240, 0.78);
        font-size: 1.1rem;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-top: 26px;
      }

      .meta-grid span {
        display: grid;
        gap: 4px;
        min-height: 78px;
        padding: 12px;
        border: 1px solid rgba(255, 250, 240, 0.2);
        border-radius: 8px;
        background: rgba(255, 250, 240, 0.08);
      }

      .meta-grid small {
        color: rgba(255, 250, 240, 0.6);
        font-weight: 800;
        text-transform: uppercase;
      }

      .layout {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        min-height: 100vh;
      }

      .toc {
        position: sticky;
        top: 0;
        height: 100vh;
        overflow: auto;
        padding: 28px 20px;
        border-right: 1px solid var(--line);
        background: #faf5ec;
      }

      .toc strong {
        display: block;
        margin-bottom: 12px;
        color: var(--accent);
        font-size: 0.8rem;
        font-weight: 950;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .toc a {
        display: block;
        padding: 5px 0;
        color: var(--muted);
        font-size: 0.82rem;
        text-decoration: none;
      }

      .toc a:hover { color: var(--accent); }
      .toc .l1 { color: var(--ink); font-weight: 900; }
      .toc .l2 { padding-left: 10px; }
      .toc .l3 { padding-left: 22px; font-size: 0.78rem; }

      main.content {
        padding: 48px 72px 80px;
      }

      h1, h2, h3, h4, h5, h6 {
        letter-spacing: 0;
        line-height: 1.08;
      }

      main.content h1 {
        margin: 0 0 18px;
        font-size: 2.75rem;
      }

      main.content h2 {
        margin: 52px 0 14px;
        padding-top: 14px;
        border-top: 2px solid var(--line);
        color: var(--ink);
        font-size: 2rem;
      }

      main.content h3 {
        margin: 32px 0 10px;
        color: var(--blue);
        font-size: 1.35rem;
      }

      p { margin: 0 0 14px; }
      ul, ol { margin: 0 0 18px 22px; padding: 0; }
      li { margin: 4px 0; }

      blockquote {
        margin: 22px 0;
        padding: 18px 20px;
        border-left: 5px solid var(--accent);
        background: #fff4eb;
        color: #4d2b22;
        font-weight: 800;
      }

      pre {
        overflow: auto;
        margin: 18px 0 22px;
        padding: 16px;
        border: 1px solid #2a2826;
        border-radius: 8px;
        background: #171513;
        color: #fffaf0;
        font-size: 0.83rem;
        line-height: 1.45;
      }

      code {
        font-family: "Cascadia Mono", Consolas, "Liberation Mono", monospace;
      }

      :not(pre) > code {
        padding: 0.1em 0.32em;
        border: 1px solid var(--line);
        border-radius: 5px;
        background: #f7efe4;
      }

      hr {
        margin: 30px 0;
        border: 0;
        border-top: 1px solid var(--line);
      }

      a { color: var(--blue); }

      @media print {
        @page { size: A4; margin: 14mm 15mm; }
        body { background: #fff; }
        .page { width: auto; margin: 0; border: 0; box-shadow: none; }
        .cover { min-height: 260mm; break-after: page; }
        .layout { display: block; }
        .toc { position: static; height: auto; border-right: 0; break-after: page; }
        main.content { padding: 0; }
        main.content h1 { break-before: page; }
        main.content h2 { break-after: avoid; }
        pre, blockquote, li { break-inside: avoid; }
        a { color: inherit; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="cover">
        <span class="label">Memoria tecnica y funcional</span>
        <h1>LocalLift Studio</h1>
        <p>Documentacion profesional tipo TFG sobre una plataforma de digitalizacion integral para negocios locales: web, CRM, reservas, tienda, chatbot, analitica, despliegue y roadmap.</p>
        <div class="meta-grid">
          <span><small>Fecha</small><b>26/05/2026</b></span>
          <span><small>Estado</small><b>MVP avanzado</b></span>
          <span><small>Entrega</small><b>Demo vendible</b></span>
          <span><small>Repo</small><b>GitHub</b></span>
        </div>
      </section>
      <div class="layout">
        <nav class="toc">
          <strong>Indice</strong>
          ${toc.map((item) => `<a class="l${item.level}" href="#${item.id}">${escapeHtml(item.text)}</a>`).join("\n")}
        </nav>
        <main class="content">
${body}
        </main>
      </div>
    </div>
  </body>
</html>`;
}

function inline(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
