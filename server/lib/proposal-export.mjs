const PACKAGE_LABELS = {
  presencia_local: "Presencia Local",
  conversion_pro: "Conversion Pro",
  growth_local: "Growth Local",
  custom: "A medida"
};

const STATUS_LABELS = {
  borrador: "Borrador",
  enviada: "Enviada",
  vista: "Vista",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  caducada: "Caducada"
};

export function renderProposalHtml({ proposal, business, contact, generatedAt = new Date().toISOString() }) {
  const currency = getCurrency(business);
  const packageName = packageLabel(proposal.package);
  const statusName = statusLabel(proposal.status);
  const conditions = escapeHtml(proposal.conditions).replace(/\r?\n/g, "<br>");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Propuesta ${escapeHtml(business.name || "DLS")} - ${escapeHtml(proposal.id)}</title>
    <style>
      :root { color-scheme: light; --ink: #17131d; --muted: #696370; --paper: #fff; --line: #ddd7e2; --accent: #b5229b; --soft: #f7f3f8; }
      * { box-sizing: border-box; }
      html { background: #efedf2; color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; }
      .sheet { width: min(920px, calc(100% - 32px)); margin: 32px auto; overflow: hidden; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); box-shadow: 0 20px 70px rgba(24, 17, 32, .12); }
      .accent { height: 10px; background: linear-gradient(90deg, #08c8ff, #7655ff, #b5229b, #ff7a18); }
      header, section, footer { padding: 28px 34px; }
      header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid var(--line); }
      .eyebrow { margin: 0 0 8px; color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      h1, h2, p { margin-top: 0; }
      h1 { margin-bottom: 8px; font-size: clamp(34px, 6vw, 62px); line-height: .96; }
      h2 { margin-bottom: 16px; font-size: 20px; }
      .muted, footer { color: var(--muted); }
      .status { height: fit-content; padding: 8px 12px; border: 1px solid color-mix(in srgb, var(--accent) 35%, white); border-radius: 999px; background: color-mix(in srgb, var(--accent) 9%, white); color: var(--accent); font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .card { min-height: 112px; padding: 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); }
      .card span { display: block; margin-bottom: 8px; color: var(--muted); font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
      .card strong { font-size: 24px; }
      .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; }
      .details div { padding-bottom: 12px; border-bottom: 1px solid var(--line); }
      .details dt { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .details dd { margin: 5px 0 0; font-weight: 700; overflow-wrap: anywhere; }
      .conditions { line-height: 1.7; overflow-wrap: anywhere; }
      footer { display: flex; justify-content: space-between; gap: 18px; border-top: 1px solid var(--line); font-size: 12px; }
      @media (max-width: 650px) { header, footer { display: grid; } .grid, .details { grid-template-columns: 1fr; } header, section, footer { padding: 22px; } }
      @media print { html { background: #fff; } .sheet { width: 100%; margin: 0; border: 0; border-radius: 0; box-shadow: none; } .card, section { break-inside: avoid; } }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="accent"></div>
      <header>
        <div>
          <p class="eyebrow">DLS · Digital Local Sites</p>
          <h1>Propuesta comercial</h1>
          <p class="muted">${escapeHtml(packageName)} para ${escapeHtml(business.name || "Negocio")}</p>
        </div>
        <span class="status">${escapeHtml(statusName)}</span>
      </header>
      <section>
        <div class="grid">
          <article class="card"><span>Implantación</span><strong>${escapeHtml(formatMoney(proposal.setupPrice, currency))}</strong></article>
          <article class="card"><span>Mantenimiento mensual</span><strong>${escapeHtml(formatMoney(proposal.monthlyPrice, currency))}</strong></article>
        </div>
      </section>
      <section>
        <h2>Datos de la propuesta</h2>
        <dl class="details">
          <div><dt>Referencia</dt><dd>${escapeHtml(proposal.id)}</dd></div>
          <div><dt>Válida hasta</dt><dd>${escapeHtml(formatDate(proposal.expiresAt))}</dd></div>
          <div><dt>Contacto</dt><dd>${escapeHtml(contact.name || "Sin nombre")}</dd></div>
          <div><dt>Datos de contacto</dt><dd>${escapeHtml([contact.email, contact.phone].filter(Boolean).join(" · ") || "No indicados")}</dd></div>
        </dl>
      </section>
      <section>
        <h2>Condiciones</h2>
        <div class="conditions">${conditions}</div>
      </section>
      <footer>
        <span>Generada el ${escapeHtml(formatDateTime(generatedAt))}</span>
        <span>DLS · Digital Local Sites</span>
      </footer>
    </main>
  </body>
</html>`;
}

export function renderProposalPdf({ proposal, business, contact, generatedAt = new Date().toISOString() }) {
  const currency = getCurrency(business);
  const items = [
    textItem("PROPUESTA COMERCIAL", "bold", 23, 32),
    textItem(`${packageLabel(proposal.package)} · ${business.name || "Negocio"}`, "regular", 13, 25, [0.38, 0.34, 0.42]),
    ruleItem(15),
    textItem(`Estado: ${statusLabel(proposal.status)}`, "bold", 11, 21, [0.71, 0.13, 0.61]),
    textItem(`Referencia: ${proposal.id}`, "regular", 10.5, 18),
    textItem(`Válida hasta: ${formatDate(proposal.expiresAt)}`, "regular", 10.5, 25),
    textItem(`Contacto: ${contact.name || "Sin nombre"}`, "bold", 11, 19),
    textItem(`Email: ${contact.email || "No indicado"}`, "regular", 10.5, 18),
    textItem(`Teléfono: ${contact.phone || "No indicado"}`, "regular", 10.5, 25),
    textItem(`Implantación: ${formatMoney(proposal.setupPrice, currency)}`, "bold", 14, 23),
    textItem(`Mantenimiento mensual: ${formatMoney(proposal.monthlyPrice, currency)}`, "bold", 14, 30),
    ruleItem(18),
    textItem("CONDICIONES", "bold", 14, 25)
  ];

  const conditionLines = wrapParagraphs(proposal.conditions, 88);
  conditionLines.forEach((line) => items.push(textItem(line || " ", "regular", 10.5, 15)));
  items.push(ruleItem(20));
  items.push(textItem(`Documento generado el ${formatDateTime(generatedAt)} · DLS Digital Local Sites`, "regular", 8.5, 14, [0.38, 0.34, 0.42]));

  return buildPdf(items, `Propuesta ${proposal.id}`);
}

function buildPdf(items, title) {
  const pages = paginate(items);
  const objectBodies = new Map();
  const pageIds = pages.map((_, index) => 5 + index * 2);
  const infoId = 5 + pages.length * 2;

  objectBodies.set(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  objectBodies.set(2, ascii(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`));
  objectBodies.set(3, ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  objectBodies.set(4, ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const content = ascii(renderPdfPage(page, index + 1, pages.length));
    objectBodies.set(pageId, ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`));
    objectBodies.set(contentId, Buffer.concat([
      ascii(`<< /Length ${content.length} >>\nstream\n`),
      content,
      ascii("\nendstream")
    ]));
  });

  objectBodies.set(infoId, ascii(`<< /Title <${toPdfHex(title)}> /Creator <${toPdfHex("DLS Digital Local Sites")}> >>`));
  return assemblePdf(objectBodies, infoId);
}

function paginate(items) {
  const pages = [];
  let page = [];
  let remaining = 710;

  items.forEach((item) => {
    if (item.height > remaining && page.length) {
      pages.push(page);
      page = [];
      remaining = 710;
    }

    page.push(item);
    remaining -= item.height;
  });

  if (page.length || !pages.length) {
    pages.push(page);
  }

  return pages;
}

function renderPdfPage(items, pageNumber, totalPages) {
  const commands = [
    "q",
    "0.71 0.13 0.61 rg",
    "0 814 595 28 re f",
    "Q",
    `BT /F2 9 Tf 0.15 0.12 0.18 rg 50 793 Td <${toPdfHex("DLS · DIGITAL LOCAL SITES")}> Tj ET`
  ];
  let y = 760;

  if (pageNumber > 1) {
    commands.push(`BT /F2 11 Tf 0.15 0.12 0.18 rg 50 ${y} Td <${toPdfHex("PROPUESTA COMERCIAL · CONTINUACIÓN")}> Tj ET`);
    y -= 28;
  }

  items.forEach((item) => {
    if (item.type === "rule") {
      commands.push(`q 0.84 0.81 0.86 RG 0.7 w 50 ${y} m 545 ${y} l S Q`);
      y -= item.height;
      return;
    }

    const font = item.font === "bold" ? "F2" : "F1";
    const color = item.color.join(" ");
    commands.push(`BT /${font} ${item.size} Tf ${color} rg 50 ${y} Td <${toPdfHex(item.text)}> Tj ET`);
    y -= item.height;
  });

  commands.push(`BT /F1 8 Tf 0.42 0.39 0.45 rg 50 28 Td <${toPdfHex(`Página ${pageNumber} de ${totalPages}`)}> Tj ET`);
  return `${commands.join("\n")}\n`;
}

function assemblePdf(objectBodies, infoId) {
  const maxId = Math.max(...objectBodies.keys());
  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = new Array(maxId + 1).fill(0);
  let offset = chunks[0].length;

  for (let id = 1; id <= maxId; id += 1) {
    const body = objectBodies.get(id);
    if (!body) {
      throw new Error(`Missing PDF object ${id}`);
    }

    offsets[id] = offset;
    const object = Buffer.concat([ascii(`${id} 0 obj\n`), body, ascii("\nendobj\n")]);
    chunks.push(object);
    offset += object.length;
  }

  const xrefOffset = offset;
  const xref = [
    "xref",
    `0 ${maxId + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${maxId + 1} /Root 1 0 R /Info ${infoId} 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    ""
  ].join("\n");
  chunks.push(ascii(xref));
  return Buffer.concat(chunks);
}

function wrapParagraphs(value, maxLength) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((paragraph) => wrapLine(paragraph.trim(), maxLength));
}

function wrapLine(value, maxLength) {
  if (!value) {
    return [""];
  }

  const words = value.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (word.length > maxLength) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxLength) {
        lines.push(word.slice(index, index + maxLength));
      }
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) {
    lines.push(current);
  }
  return lines;
}

function textItem(text, font, size, height, color = [0.09, 0.07, 0.11]) {
  return { type: "text", text, font, size, height, color };
}

function ruleItem(height) {
  return { type: "rule", height };
}

function toPdfHex(value) {
  const cp1252 = new Map([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
    [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
    [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
    [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
    [0x017e, 0x9e], [0x0178, 0x9f]
  ]);
  const bytes = [];

  for (const character of String(value ?? "")) {
    const codePoint = character.codePointAt(0);
    if (cp1252.has(codePoint)) {
      bytes.push(cp1252.get(codePoint));
    } else if ((codePoint >= 32 && codePoint <= 126) || (codePoint >= 160 && codePoint <= 255)) {
      bytes.push(codePoint);
    } else {
      bytes.push(0x3f);
    }
  }
  return Buffer.from(bytes).toString("hex").toUpperCase();
}

function ascii(value) {
  return Buffer.from(String(value), "ascii");
}

function getCurrency(business) {
  const candidate = String(business?.content?.commerce?.currency || business?.content?.currency || "EUR").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(candidate) ? candidate : "EUR";
}

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }
}

function formatDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(date);
}

function packageLabel(value) {
  return PACKAGE_LABELS[value] || String(value || "Propuesta");
}

function statusLabel(value) {
  return STATUS_LABELS[value] || String(value || "Borrador");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
