const MIN_TOKEN_LENGTH = 32;

const checks = [
  {
    name: "NODE_ENV",
    ok: process.env.NODE_ENV === "production",
    message: "NODE_ENV debe ser production para usar start:prod."
  },
  {
    name: "HOST",
    ok: ["0.0.0.0", "::"].includes(process.env.HOST || ""),
    message: "HOST debe ser 0.0.0.0 en cloud para aceptar trafico externo."
  },
  {
    name: "LOCALLIFT_ADMIN_TOKEN",
    ok: hasLongToken(process.env.LOCALLIFT_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN),
    message: `LOCALLIFT_ADMIN_TOKEN o ADMIN_API_TOKEN debe tener al menos ${MIN_TOKEN_LENGTH} caracteres.`
  },
  {
    name: "CORS_ORIGIN",
    ok: hasProductionOrigin(process.env.CORS_ORIGIN || process.env.LOCALLIFT_CORS_ORIGIN),
    message: "CORS_ORIGIN debe incluir el dominio HTTPS del frontend."
  },
  {
    name: "BUSINESS_DB_FILE",
    ok: Boolean(clean(process.env.BUSINESS_DB_FILE)),
    message: "BUSINESS_DB_FILE debe apuntar a la base persistente."
  }
];

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error("LocalLift deploy env check failed:");
  failed.forEach((check) => {
    console.error(`- ${check.name}: ${check.message}`);
  });
  process.exit(1);
}

console.log("LocalLift deploy env check passed.");

function hasLongToken(value) {
  return clean(value).length >= MIN_TOKEN_LENGTH;
}

function hasProductionOrigin(value) {
  return clean(value)
    .split(",")
    .map((origin) => clean(origin))
    .some((origin) => origin.startsWith("https://"));
}

function clean(value) {
  return String(value || "").trim();
}
