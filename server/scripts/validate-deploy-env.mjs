import { loadLocalEnv } from "../lib/load-env.mjs";

loadLocalEnv();

const MIN_TOKEN_LENGTH = 32;
const googleOAuthRequested = [
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI
].some((value) => Boolean(clean(value)));
const postgresRequested = clean(process.env.BUSINESS_STORE || process.env.BUSINESS_DB_DRIVER).toLowerCase() === "postgres";
const postgresConfigured = Boolean(clean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCALLIFT_DATABASE_URL));

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
    ok: hasProductionOrigins(process.env.CORS_ORIGIN || process.env.LOCALLIFT_CORS_ORIGIN),
    message: "CORS_ORIGIN debe incluir solo dominios HTTPS reales del frontend, sin * ni localhost."
  },
  {
    name: "BUSINESS_STORE",
    ok: postgresConfigured || Boolean(clean(process.env.BUSINESS_DB_FILE)),
    message: "Configura DATABASE_URL para PostgreSQL o BUSINESS_DB_FILE para persistencia JSON."
  },
  {
    name: "DATABASE_URL",
    ok: !postgresRequested || postgresConfigured,
    message: "BUSINESS_STORE=postgres requiere DATABASE_URL, POSTGRES_URL o LOCALLIFT_DATABASE_URL."
  },
  {
    name: "GOOGLE_OAUTH",
    ok: !googleOAuthRequested || googleOAuthReady(),
    message: "Si activas OAuth Google, configura client id, client secret, redirect URI exacta y clave de cifrado de 32+ caracteres."
  }
];

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error("DLS deploy env check failed:");
  failed.forEach((check) => {
    console.error(`- ${check.name}: ${check.message}`);
  });
  process.exit(1);
}

console.log("DLS deploy env check passed.");

function hasLongToken(value) {
  return clean(value).length >= MIN_TOKEN_LENGTH;
}

function hasProductionOrigins(value) {
  const origins = clean(value)
    .split(",")
    .map((origin) => clean(origin))
    .filter(Boolean);

  return origins.length > 0 && origins.every(isProductionOrigin);
}

function isProductionOrigin(origin) {
  if (origin === "*" || origin.toLowerCase() === "null") {
    return false;
  }

  try {
    const url = new URL(origin);
    return url.origin === origin
      && url.protocol === "https:"
      && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch (error) {
    return false;
  }
}

function googleOAuthReady() {
  return Boolean(
    clean(process.env.GOOGLE_OAUTH_CLIENT_ID)
      && clean(process.env.GOOGLE_OAUTH_CLIENT_SECRET)
      && validGoogleRedirect(process.env.GOOGLE_OAUTH_REDIRECT_URI)
      && clean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY).length >= MIN_TOKEN_LENGTH
  );
}

function validGoogleRedirect(value) {
  try {
    const url = new URL(clean(value));
    return url.protocol === "https:" && url.pathname === "/api/google/oauth/callback";
  } catch (error) {
    return false;
  }
}

function clean(value) {
  return String(value || "").trim();
}
