import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const localOnly = process.argv.includes("--local");

const localChecks = await buildLocalChecks();
const externalChecks = buildExternalChecks();
const localFailed = localChecks.filter((check) => !check.ok);
const externalFailed = externalChecks.filter((check) => !check.ok);

printGroup("Preparacion local", localChecks);
printGroup("Firmas y evidencias externas", externalChecks);

if (localFailed.length) {
  console.error(`\nFase 0 no esta preparada localmente: ${localFailed.length} comprobaciones fallan.`);
  process.exitCode = 1;
} else if (localOnly) {
  console.log("\nPreparacion local de Fase 0 aprobada.");
} else if (externalFailed.length) {
  console.error(`\nFase 0 NO CERRADA: quedan ${externalFailed.length} evidencias externas.`);
  console.error("Completa docs/activo/CIERRE_FASE_0.md y vuelve a ejecutar npm.cmd run phase0:check.");
  process.exitCode = 1;
} else {
  console.log("\nFase 0 CERRADA: preparacion local y evidencias externas completas.");
}

async function buildLocalChecks() {
  const requiredFiles = [
    "docs/AHORA.md",
    "docs/activo/FASE_0_EJECUCION.md",
    "docs/activo/CIERRE_FASE_0.md",
    "docs/activo/PROSPECTOS_FUNDADORES.csv",
    "docs/ventas/OFERTA_LOCAL_LIFT_RESERVAS.md",
    "docs/ventas/CONDICIONES_SERVICIO_FUNDADORES_BORRADOR.md",
    "docs/ventas/FACTURA_ANTICIPO_PLANTILLA.md",
    "docs/ventas/INSTRUCCIONES_COBRO_DEPOSITO.md",
    "docs/ventas/PAQUETE_REVISION_PROFESIONAL.md",
    "docs/operaciones/OPERATIONS_RUNBOOK.md",
    "docs/operaciones/PILOT_LAUNCH.md",
    "docs/producto/COMPATIBILITY_CHECKLIST.md",
    "pages/privacy-demo.html",
    "server/scripts/accept-public-pilot.mjs",
    "render.yaml"
  ];
  const fileResults = await Promise.all(requiredFiles.map(fileExists));
  const prospects = await readText("docs/activo/PROSPECTOS_FUNDADORES.csv");
  const render = await readText("render.yaml");
  const privacy = await readText("pages/privacy-demo.html");
  const compatibility = await readText("docs/producto/COMPATIBILITY_CHECKLIST.md");
  const packageJson = JSON.parse(await readText("package.json"));
  const prospectRows = prospects.split(/\r?\n/).filter((line) => /^"\d{3}",/.test(line));
  const qualifiedRows = prospectRows.filter((line) => line.includes('"Cualificado"'));

  return [
    {
      name: "Archivos obligatorios",
      ok: fileResults.every(Boolean),
      detail: `${fileResults.filter(Boolean).length}/${requiredFiles.length} presentes`
    },
    {
      name: "Base comercial inicial",
      ok: prospectRows.length >= 100 && qualifiedRows.length >= 20,
      detail: `${prospectRows.length} huecos; ${qualifiedRows.length} cualificados`
    },
    {
      name: "Blueprint persistente",
      ok: render.includes("healthCheckPath: /api/health")
        && render.includes("generateValue: true")
        && render.includes("mountPath: /data"),
      detail: "healthcheck, token generado y disco /data"
    },
    {
      name: "Privacidad de demo identificada",
      ok: privacy.includes("Solo para demostracion."),
      detail: "evita publicar datos ficticios como texto real"
    },
    {
      name: "QA local documentado",
      ok: ["Chrome 148", "Edge 149", "Firefox 149"].every((browser) => compatibility.includes(browser)),
      detail: "Chrome, Edge y Firefox"
    },
    {
      name: "Scripts de cierre",
      ok: Boolean(packageJson.scripts?.["phase0:verify-local"])
        && Boolean(packageJson.scripts?.["phase0:check"])
        && Boolean(packageJson.scripts?.["accept:public"]),
      detail: "verificacion local, gate final y aceptacion publica"
    }
  ];
}

function buildExternalChecks() {
  return [
    envUrlCheck("URL publica de demo", "PHASE0_PUBLIC_DEMO_URL"),
    envUrlCheck("URL publica de API", "PHASE0_PUBLIC_API_URL"),
    {
      name: "Token admin real",
      ok: hasRealToken(process.env.LOCALLIFT_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN),
      detail: "LOCALLIFT_ADMIN_TOKEN de al menos 32 caracteres"
    },
    envUrlCheck("CORS real", "CORS_ORIGIN"),
    envBooleanCheck("Aceptacion publica aprobada", "PHASE0_PUBLIC_ACCEPTANCE_PASSED"),
    envBooleanCheck("Medio de cobro operativo", "PHASE0_PAYMENT_READY"),
    envBooleanCheck("Revision legal aprobada", "PHASE0_LEGAL_REVIEWED"),
    envBooleanCheck("Revision fiscal aprobada", "PHASE0_FISCAL_REVIEWED"),
    envBooleanCheck("Safari iOS aprobado", "PHASE0_SAFARI_IOS_PASSED"),
    envBooleanCheck("Demo comercial ensayada", "PHASE0_DEMO_REHEARSED")
  ];
}

function envUrlCheck(name, key) {
  const value = clean(process.env[key]);
  return {
    name,
    ok: value.split(",").some(hasRealHttpsUrl),
    detail: `${key}=https://...`
  };
}

function envBooleanCheck(name, key) {
  return {
    name,
    ok: clean(process.env[key]).toLowerCase() === "true",
    detail: `${key}=true`
  };
}

function printGroup(title, checks) {
  console.log(`\n${title}:`);
  checks.forEach((check) => {
    console.log(`${check.ok ? "[x]" : "[ ]"} ${check.name} - ${check.detail}`);
  });
}

async function fileExists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function clean(value) {
  return String(value || "").trim();
}

function hasRealToken(value) {
  const token = clean(value);
  return token.length >= 32
    && !token.includes("<")
    && !/change-me|example|placeholder/i.test(token);
}

function hasRealHttpsUrl(value) {
  const text = clean(value);

  try {
    const url = new URL(text);
    return url.protocol === "https:"
      && !["example.com", "localhost", "127.0.0.1"].includes(url.hostname)
      && !url.hostname.endsWith(".example.com")
      && !url.hostname.endsWith(".invalid")
      && !text.includes("<");
  } catch {
    return false;
  }
}
