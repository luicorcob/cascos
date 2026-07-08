import { randomBytes } from "node:crypto";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "cloudflare", "wrangler.demo-publisher.toml");
const templatePath = path.join(root, "cloudflare", "wrangler.demo-publisher.toml.example");
const envPath = path.join(root, ".env");
const workerUrlPattern = /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev/i;
const kvIdPattern = /(?:id\s*=\s*"|\"id\"\s*:\s*\")([a-f0-9]{20,})/i;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

await ensureConfigFile();
await ensureWranglerAuth();

const currentConfig = await readFile(configPath, "utf8");
const kvId = hasKvId(currentConfig)
  ? readKvId(currentConfig)
  : await createKvNamespace();

await writeConfig(kvId);

const publishToken = process.env.DEMO_PUBLISH_TOKEN || process.env.DEMO_REMOTE_PUBLISH_TOKEN || createToken();
await putSecret("DEMO_PUBLISH_TOKEN", publishToken);

const deployOutput = runWrangler(["deploy", "--config", relative(configPath)], {
  label: "Desplegando Worker"
});
const workerUrl = readWorkerUrl(deployOutput);

if (workerUrl) {
  await upsertEnvFile({
    DEMO_REMOTE_PUBLISH_URL: workerUrl,
    DEMO_REMOTE_PUBLISH_TOKEN: publishToken,
    DEMO_PUBLISH_TTL_HOURS: cleanNumber(process.env.DEMO_PUBLISH_TTL_HOURS || process.env.DEMO_TTL_HOURS || "24", "24")
  });
}

console.log("");
console.log("Demo publisher listo.");
console.log("");
console.log(`DEMO_REMOTE_PUBLISH_URL=${workerUrl || "https://TU-WORKER.workers.dev"}`);
console.log(`DEMO_REMOTE_PUBLISH_TOKEN=${publishToken}`);
console.log("DEMO_PUBLISH_TTL_HOURS=24");
console.log("");
console.log(workerUrl
  ? "He actualizado .env. Arranca npm.cmd start y el boton Publicar demo online subira enlaces publicos con caducidad."
  : "No pude detectar la URL del Worker en la salida de Wrangler. Copia la URL manualmente en .env como DEMO_REMOTE_PUBLISH_URL.");

async function ensureConfigFile() {
  if (existsSync(configPath)) {
    return;
  }

  await copyFile(templatePath, configPath);
}

async function ensureWranglerAuth() {
  const result = run(npx, ["wrangler", "whoami"], {
    label: "Comprobando sesion Cloudflare",
    allowFailure: true
  });

  if (result.status === 0) {
    return;
  }

  throw new Error([
    "Wrangler no esta autenticado en Cloudflare.",
    "Ejecuta una vez: npx wrangler login",
    "Despues vuelve a lanzar: npm.cmd run setup:demo-online"
  ].join("\n"));
}

async function createKvNamespace() {
  const output = runWrangler(["kv", "namespace", "create", "DEMOS", "--config", relative(configPath)], {
    label: "Creando namespace KV DEMOS"
  });
  const id = readKvId(output);

  if (!id) {
    throw new Error("No pude leer el id del namespace KV desde la salida de Wrangler.");
  }

  return id;
}

async function writeConfig(kvId) {
  const source = await readFile(templatePath, "utf8");
  const config = source
    .replace('main = "cloudflare/demo-publisher-worker.js"', 'main = "demo-publisher-worker.js"')
    .replace('id = "REPLACE_WITH_KV_NAMESPACE_ID"', `id = "${kvId}"`)
    .replace('DEMO_TTL_HOURS = "24"', `DEMO_TTL_HOURS = "${cleanNumber(process.env.DEMO_PUBLISH_TTL_HOURS || process.env.DEMO_TTL_HOURS || "24", "24")}"`);

  await writeFile(configPath, config, "utf8");
}

async function putSecret(name, value) {
  runWrangler(["secret", "put", name, "--config", relative(configPath)], {
    input: `${value}\n`,
    label: `Guardando secret ${name}`
  });
}

async function upsertEnvFile(values) {
  let source = "";

  try {
    source = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const next = new Map(Object.entries(values));
  const lines = source.split(/\r?\n/);
  const updated = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);

    if (!match || !next.has(match[1])) {
      return line;
    }

    const key = match[1];
    const value = next.get(key);
    next.delete(key);
    return `${key}=${value}`;
  });

  if (next.size) {
    if (updated.some((line) => line.trim())) {
      updated.push("");
    }

    updated.push("# Publicador online de demos temporales");
    for (const [key, value] of next.entries()) {
      updated.push(`${key}=${value}`);
    }
  }

  await writeFile(envPath, `${updated.join("\n").replace(/\n+$/g, "")}\n`, "utf8");
}

function runWrangler(args, options = {}) {
  return run(npx, ["wrangler", ...args], options);
}

function run(command, args, options = {}) {
  if (options.label) {
    console.log(options.label + "...");
  }

  const result = spawn(command, args, options.input);
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(output.trim() || `${command} ${args.join(" ")} failed`);
  }

  return options.allowFailure ? result : output;
}

function spawn(command, args, input) {
  if (process.platform !== "win32") {
    return spawnSync(command, args, {
      cwd: root,
      input,
      encoding: "utf8",
      shell: false
    });
  }

  const commandLine = [command, ...args].map(quoteCmdArg).join(" ");
  return spawnSync("cmd.exe", ["/d", "/s", "/c", commandLine], {
    cwd: root,
    input,
    encoding: "utf8",
    shell: false
  });
}

function quoteCmdArg(value) {
  const raw = String(value);

  if (/^[A-Za-z0-9_./:=@-]+$/.test(raw)) {
    return raw;
  }

  return `"${raw.replace(/"/g, '\\"')}"`;
}

function hasKvId(config) {
  return !config.includes("REPLACE_WITH_KV_NAMESPACE_ID") && Boolean(readKvId(config));
}

function readKvId(value) {
  return String(value || "").match(kvIdPattern)?.[1] || "";
}

function readWorkerUrl(value) {
  return String(value || "").match(workerUrlPattern)?.[0] || "";
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function cleanNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : fallback;
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}
