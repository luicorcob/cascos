import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { loadBusinessStore } from "./business-store.mjs";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ROLES = Object.freeze({
  owner: {
    id: "owner",
    name: "Propietario",
    description: "Control total, usuarios, permisos, finanzas y acciones sensibles.",
    permissions: ["*:*"]
  },
  manager: {
    id: "manager",
    name: "Responsable",
    description: "Gestion operativa y comercial completa, sin administrar identidades ni suplantaciones.",
    permissions: ["business:read", "crm:*", "operations:*", "finance:*", "communications:*", "marketing:*", "reputation:*", "analytics:*", "configuration:*"]
  },
  sales: {
    id: "sales",
    name: "Comercial",
    description: "Clientes, oportunidades, propuestas, tareas y conversaciones.",
    permissions: ["business:read", "crm:*", "communications:*", "marketing:read", "reputation:read", "operations:read", "analytics:read"]
  },
  operations: {
    id: "operations",
    name: "Operaciones",
    description: "Reservas, recursos, equipo, turnos e inventario sin acceso a margenes ni permisos.",
    permissions: ["business:read", "operations:*", "crm:read", "communications:read", "communications:write", "reputation:read", "analytics:read"]
  },
  finance: {
    id: "finance",
    name: "Finanzas",
    description: "Facturacion, cobros, gastos, suscripciones y lectura del contexto comercial.",
    permissions: ["business:read", "finance:*", "crm:read", "operations:read", "analytics:read"]
  },
  readonly: {
    id: "readonly",
    name: "Solo lectura",
    description: "Consulta autorizada sin mutaciones, exportaciones ni acciones sensibles.",
    permissions: ["business:read", "crm:read", "operations:read", "finance:read", "communications:read", "marketing:read", "reputation:read", "analytics:read", "configuration:read"]
  }
});

export function listBusinessRoles() {
  return Object.values(ROLES).map((role) => ({ ...role, permissions: [...role.permissions] }));
}

export function normalizeBusinessRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (!ROLES[role]) throw accessError(400, "Unknown business role", "business_role_invalid");
  return role;
}

export async function hashBusinessUserPassword(password) {
  const value = String(password || "");
  if (value.length < 10) throw accessError(400, "Password must have at least 10 characters", "business_password_weak");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(value, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyBusinessUserPassword(password, passwordHash) {
  const [algorithm, salt, expectedHex] = String(passwordHash || "").split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(String(password || ""), salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createBusinessUser(db, business, input, actor = {}, now = new Date().toISOString()) {
  ensureBusinessAccessCollections(db);
  const email = normalizeEmail(input.email);
  if (!email) throw accessError(400, "Valid email is required", "business_user_email_invalid");
  if (db.businessUsers.some((item) => item.businessId === business.id && item.email === email && item.active !== false)) {
    throw accessError(409, "An active user already has this email", "business_user_duplicate");
  }
  const role = normalizeBusinessRole(input.role || "readonly");
  const user = {
    id: `buser_${randomUUID()}`,
    businessId: business.id,
    name: clean(input.name) || email,
    email,
    role,
    passwordHash: await hashBusinessUserPassword(input.password),
    active: input.active !== false,
    tokenVersion: 1,
    createdBy: clean(actor.id || actor.userId || "admin"),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: ""
  };
  db.businessUsers.push(user);
  appendSecurityAudit(db, business.id, actor, "security.user_created", "businessUser", user.id, { role }, now);
  return user;
}

export async function updateBusinessUser(db, businessId, userId, input, actor = {}, now = new Date().toISOString()) {
  ensureBusinessAccessCollections(db);
  const user = requireBusinessUser(db, businessId, userId);
  if (input.role !== undefined) user.role = normalizeBusinessRole(input.role);
  if (input.name !== undefined) user.name = clean(input.name) || user.name;
  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (!email) throw accessError(400, "Valid email is required", "business_user_email_invalid");
    if (db.businessUsers.some((item) => item.businessId === businessId && item.id !== user.id && item.email === email && item.active !== false)) throw accessError(409, "An active user already has this email", "business_user_duplicate");
    user.email = email;
  }
  if (input.password !== undefined) {
    user.passwordHash = await hashBusinessUserPassword(input.password);
    user.tokenVersion = Number(user.tokenVersion || 1) + 1;
  }
  if (input.active !== undefined) {
    if (input.active === false && user.role === "owner" && activeOwnerCount(db, businessId) <= 1) throw accessError(409, "The last active owner cannot be disabled", "business_last_owner");
    user.active = input.active === true;
    if (!user.active) user.tokenVersion = Number(user.tokenVersion || 1) + 1;
  }
  user.updatedAt = now;
  appendSecurityAudit(db, businessId, actor, "security.user_updated", "businessUser", user.id, { role: user.role, active: user.active }, now);
  return user;
}

export async function authenticateBusinessUser(db, businessRef, email, password, now = new Date().toISOString()) {
  ensureBusinessAccessCollections(db);
  const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
  if (!business) throw accessError(401, "Invalid business user credentials", "business_user_invalid_credentials");
  const user = db.businessUsers.find((item) => item.businessId === business.id && item.email === normalizeEmail(email) && item.active !== false);
  if (!user || !(await verifyBusinessUserPassword(password, user.passwordHash))) throw accessError(401, "Invalid business user credentials", "business_user_invalid_credentials");
  user.lastLoginAt = now;
  user.updatedAt = now;
  appendSecurityAudit(db, business.id, { type: "businessUser", id: user.id }, "security.user_login", "businessUser", user.id, {}, now);
  return { business, user };
}

export function issueBusinessUserSession(business, user, options = {}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    role: "business-user",
    businessId: business.id,
    businessSlug: business.slug || "",
    userId: user.id,
    userRole: user.role,
    tokenVersion: Number(user.tokenVersion || 1),
    impersonatedBy: clean(options.impersonatedBy),
    iat: issuedAt,
    exp: issuedAt + Number(options.ttlSeconds || SESSION_TTL_SECONDS)
  };
  return signSession(payload);
}

export async function getBusinessUserSessionForRequest(request, context) {
  const token = getProvidedBusinessUserToken(request);
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  const db = ensureBusinessAccessCollections(await loadBusinessStore(context));
  const user = db.businessUsers.find((item) => item.id === payload.userId && item.businessId === payload.businessId && item.active !== false);
  if (!user || Number(user.tokenVersion || 1) !== Number(payload.tokenVersion || 0) || user.role !== payload.userRole) return null;
  const business = db.businesses.find((item) => item.id === user.businessId);
  if (!business) return null;
  return { ...payload, businessSlug: business.slug || payload.businessSlug || "", user: publicBusinessUser(user) };
}

export function getRequestBusinessUserSession(request) {
  return request.localLiftBusinessUserSession || null;
}

export function getProvidedBusinessUserToken(request) {
  return clean(request.headers["x-locallift-user-token"]);
}

export function authorizeBusinessUserRequest(pathname, method, session) {
  if (!session?.businessId || !session.userRole) return false;
  const segments = String(pathname || "").split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== "api" || segments[1] !== "businesses") return false;
  if (segments.length === 2) return method === "GET" && hasPermission(session.userRole, "business", "read");
  const businessRef = segments[2] || "";
  if (businessRef !== session.businessId && businessRef !== session.businessSlug) return false;
  const { resource, action } = accessTarget(segments, method);
  return hasPermission(session.userRole, resource, action);
}

export function hasPermission(roleId, resource, action) {
  const permissions = ROLES[roleId]?.permissions || [];
  return permissions.includes("*:*")
    || permissions.includes(`${resource}:*`)
    || permissions.includes(`${resource}:${action}`)
    || (action === "read" && permissions.includes(`${resource}:write`));
}

export function appendSecurityAudit(db, businessId, actor, action, resource, subjectId, metadata = {}, now = new Date().toISOString()) {
  ensureBusinessAccessCollections(db);
  const event = {
    id: `secaudit_${randomUUID()}`,
    businessId,
    actorType: clean(actor?.type || (actor?.userId ? "businessUser" : "admin")) || "system",
    actorId: clean(actor?.id || actor?.userId || "admin"),
    impersonatedBy: clean(actor?.impersonatedBy),
    action: clean(action),
    resource: clean(resource),
    subjectId: clean(subjectId),
    metadata: clone(metadata),
    createdAt: now
  };
  db.securityAuditEvents.push(event);
  return event;
}

export function ensureBusinessAccessCollections(db) {
  db.businessUsers = Array.isArray(db.businessUsers) ? db.businessUsers : [];
  db.securityAuditEvents = Array.isArray(db.securityAuditEvents) ? db.securityAuditEvents : [];
  return db;
}

export function publicBusinessUser(user) {
  const { passwordHash, ...result } = user;
  return { ...result };
}

export function requireBusinessUser(db, businessId, userId) {
  const user = db.businessUsers.find((item) => item.businessId === businessId && item.id === userId);
  if (!user) throw accessError(404, "Business user not found", "business_user_not_found");
  return user;
}

function accessTarget(segments, method) {
  const area = segments[3] || "";
  const detail = segments[4] || "";
  const normalizedMethod = String(method || "GET").toUpperCase();
  const action = normalizedMethod === "GET" || normalizedMethod === "HEAD" ? "read" : normalizedMethod === "DELETE" ? "delete" : "write";
  if (area === "security") {
    if (detail === "audit") return { resource: "security", action: "audit" };
    if (detail === "impersonations") return { resource: "security", action: "impersonate" };
    return { resource: "security", action: "manage" };
  }
  if (area === "hospitality") {
    if (["invoices", "expenses", "suppliers", "summary"].includes(detail)) return { resource: "finance", action };
    return { resource: "operations", action };
  }
  if (["invoices", "payments", "subscriptions", "money"].includes(area)) return { resource: "finance", action };
  if (["services", "bookings", "availability", "blocks", "reminders", "resources", "resource-availability", "booking-resource-summary", "waitlist", "operations"].includes(area)) return { resource: "operations", action };
  if (["contacts", "customers", "accounts", "associations", "pipelines", "deals", "tasks", "proposals", "next-actions"].includes(area)) return { resource: "crm", action };
  if (["communications", "channels", "message-templates", "inbox"].includes(area)) return { resource: "communications", action };
  if (["automations", "sequences", "campaigns"].includes(area)) return { resource: "marketing", action };
  if (area === "loyalty") return { resource: "marketing", action };
  if (area === "vertical") return { resource: "operations", action };
  if (area === "reputation" || area === "google") return { resource: "reputation", action };
  if (area === "intelligence" && detail === "query") return { resource: "analytics", action: "read" };
  if (area === "reports" || area === "analytics" || area === "intelligence") return { resource: "analytics", action };
  if (["crm-config", "settings"].includes(area)) return { resource: "configuration", action };
  return { resource: "business", action };
}

function activeOwnerCount(db, businessId) { return db.businessUsers.filter((item) => item.businessId === businessId && item.role === "owner" && item.active !== false).length; }
function normalizeEmail(value) { const email = clean(value).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""; }
function signSession(payload) { const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url"); const signature = createHmac("sha256", sessionSecret()).update(encoded).digest("base64url"); return `${encoded}.${signature}`; }
function verifySession(token) {
  const [encoded, signature] = clean(token).split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", sessionSecret()).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.role !== "business-user" || !payload.businessId || !payload.userId || Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
function sessionSecret() {
  const secret = clean(process.env.BUSINESS_USER_SESSION_SECRET || process.env.CLIENT_SESSION_SECRET || process.env.LOCALLIFT_ADMIN_TOKEN);
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw accessError(503, "Business user session secret is not configured", "business_user_secret_missing");
  return "locallift-development-business-user-session-secret";
}
function clone(value) { return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : {}; }
function clean(value) { return String(value ?? "").trim(); }
function accessError(statusCode, message, code = "business_access_error") { return Object.assign(new Error(message), { statusCode, code }); }
