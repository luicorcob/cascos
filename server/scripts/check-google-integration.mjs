import { loadLocalEnv } from "../lib/load-env.mjs";

loadLocalEnv();

const checks = [
  {
    name: "GOOGLE_OAUTH_CLIENT_ID",
    ok: Boolean(clean(process.env.GOOGLE_OAUTH_CLIENT_ID)),
    message: "Crea un cliente OAuth tipo Web application en Google Cloud."
  },
  {
    name: "GOOGLE_OAUTH_CLIENT_SECRET",
    ok: Boolean(clean(process.env.GOOGLE_OAUTH_CLIENT_SECRET)),
    message: "Configura el secreto del cliente OAuth solo en backend."
  },
  {
    name: "GOOGLE_OAUTH_REDIRECT_URI",
    ok: validRedirectUri(process.env.GOOGLE_OAUTH_REDIRECT_URI),
    message: "Debe ser una URL absoluta terminada en /api/google/oauth/callback y coincidir exactamente con Google Cloud."
  },
  {
    name: "GOOGLE_TOKEN_ENCRYPTION_KEY",
    ok: clean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY).length >= 32,
    message: "Usa un secreto aleatorio estable de al menos 32 caracteres."
  },
  {
    name: "GOOGLE_MAPS_API_KEY",
    ok: Boolean(clean(process.env.GOOGLE_MAPS_API_KEY)),
    message: "Necesaria para sincronizar Places; restringela a Places API (New) y al backend."
  }
];

const optional = [
  ["GOOGLE_AUTH_DB_FILE", process.env.GOOGLE_AUTH_DB_FILE || "data/google-auth-db.json"],
  ["GOOGLE_CALENDAR_ID", process.env.GOOGLE_CALENDAR_ID || "primary"],
  ["GOOGLE_OAUTH_PROMPT", process.env.GOOGLE_OAUTH_PROMPT || "consent"]
];
const failed = checks.filter((check) => !check.ok);

console.log("Google integration readiness:");
checks.forEach((check) => {
  console.log(`- ${check.ok ? "OK" : "PENDING"} ${check.name}${check.ok ? "" : `: ${check.message}`}`);
});
optional.forEach(([name, value]) => {
  console.log(`- INFO ${name}=${value}`);
});

if (failed.length) {
  console.error(`Google integration is not ready: ${failed.length} required setting(s) pending.`);
  process.exit(1);
}

console.log("Google integration environment is ready for OAuth consent.");

function validRedirectUri(value) {
  try {
    const url = new URL(clean(value));
    return ["http:", "https:"].includes(url.protocol) && url.pathname === "/api/google/oauth/callback";
  } catch (error) {
    return false;
  }
}

function clean(value) {
  return String(value || "").trim();
}
