export const MESSAGE_TEMPLATE_TYPES = Object.freeze([
  "primer_contacto",
  "envio_demo",
  "seguimiento_48h",
  "envio_propuesta",
  "reactivacion_lead_frio",
  "solicitud_resena"
]);

export const SAFE_MESSAGE_PLACEHOLDERS = Object.freeze([
  "nombre",
  "negocio",
  "telefono",
  "email",
  "demo_url",
  "propuesta_url",
  "review_url"
]);

export const DEFAULT_MESSAGE_TEMPLATES = Object.freeze([
  defaultTemplate({
    type: "primer_contacto",
    label: "Primer contacto",
    subject: "Gracias por contactar con {{negocio}}",
    body: "Hola {{nombre}}, gracias por contactar con {{negocio}}. He revisado tu consulta y me gustaria conocer un poco mejor lo que necesitas. ¿Te viene bien que lo comentemos hoy?"
  }),
  defaultTemplate({
    type: "envio_demo",
    label: "Envio de demo",
    subject: "Tu demo de {{negocio}} ya esta lista",
    body: "Hola {{nombre}}, ya puedes revisar la demo que hemos preparado para {{negocio}}: {{demo_url}}. Cuando la veas, dime que te encaja y que ajustarias para dejarla lista."
  }),
  defaultTemplate({
    type: "seguimiento_48h",
    label: "Seguimiento 48 h",
    subject: "¿Has podido revisar la demo de {{negocio}}?",
    body: "Hola {{nombre}}, queria confirmar si has podido revisar la demo de {{negocio}}: {{demo_url}}. Si te parece, resolvemos dudas y concretamos el siguiente paso."
  }),
  defaultTemplate({
    type: "envio_propuesta",
    label: "Envio de propuesta",
    subject: "Propuesta para {{negocio}}",
    body: "Hola {{nombre}}, te envio la propuesta preparada para {{negocio}}: {{propuesta_url}}. Incluye alcance, condiciones y proximos pasos. Estoy disponible para revisar cualquier punto contigo."
  }),
  defaultTemplate({
    type: "reactivacion_lead_frio",
    label: "Reactivacion de lead frio",
    subject: "Retomamos la conversacion sobre {{negocio}}",
    body: "Hola {{nombre}}, hace un tiempo hablamos sobre {{negocio}} y queria saber si sigue teniendo sentido retomarlo. Si tus prioridades han cambiado, puedo adaptar el planteamiento al momento actual."
  }),
  defaultTemplate({
    type: "solicitud_resena",
    label: "Solicitud de resena",
    subject: "Tu opinion sobre {{negocio}}",
    body: "Hola {{nombre}}, gracias por confiar en {{negocio}}. Tu opinion nos ayuda mucho. Puedes compartir tu experiencia aqui: {{review_url}}"
  })
]);

const SAFE_PLACEHOLDER_SET = new Set(SAFE_MESSAGE_PLACEHOLDERS);
const PLACEHOLDER_PATTERN = /{{\s*([^{}\r\n]+?)\s*}}/g;

export function getDefaultMessageTemplate(type) {
  const normalizedType = normalizeKey(type);
  return DEFAULT_MESSAGE_TEMPLATES.find((template) => template.type === normalizedType) || null;
}

export function renderMessageTemplate(template, variables = {}) {
  if (!isPlainObject(template)) {
    throw new TypeError("Message template must be an object");
  }

  const safeVariables = normalizeVariables(variables);
  const unknownPlaceholders = new Set();
  const missingPlaceholders = new Set();
  const usedPlaceholders = new Set();
  const renderText = (value) => String(value ?? "").replace(PLACEHOLDER_PATTERN, (token, rawKey) => {
    const originalKey = String(rawKey || "").trim();
    const key = normalizeKey(originalKey);

    if (!SAFE_PLACEHOLDER_SET.has(key)) {
      unknownPlaceholders.add(originalKey || key);
      return token;
    }

    usedPlaceholders.add(key);
    const replacement = safeVariables[key];

    if (!replacement) {
      missingPlaceholders.add(key);
      return token;
    }

    return replacement;
  });

  return {
    subject: renderText(template.subject),
    message: renderText(template.body),
    unknownPlaceholders: Array.from(unknownPlaceholders),
    missingPlaceholders: Array.from(missingPlaceholders),
    usedPlaceholders: Array.from(usedPlaceholders)
  };
}

export function buildMessageLinks({ phone = "", email = "", subject = "", message = "" } = {}) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);
  const text = String(message ?? "");
  const mailSubject = String(subject ?? "");
  const whatsappUrl = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`
    : "";
  const mailtoUrl = normalizedEmail
    ? `mailto:${encodeURIComponent(normalizedEmail)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(text)}`
    : "";

  return { whatsappUrl, mailtoUrl };
}

function defaultTemplate(template) {
  return Object.freeze({
    id: `default_${template.type}`,
    businessId: "",
    type: template.type,
    label: template.label,
    subject: template.subject,
    body: template.body,
    createdAt: "",
    updatedAt: ""
  });
}

function normalizeVariables(variables) {
  const source = isPlainObject(variables) ? variables : {};
  return Object.fromEntries(
    SAFE_MESSAGE_PLACEHOLDERS.map((key) => [key, clean(source[key])])
  );
}

function normalizeKey(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizePhone(value) {
  const phone = clean(value).replace(/\D/g, "");
  return phone.length >= 6 && phone.length <= 18 ? phone : "";
}

function normalizeEmail(value) {
  const email = clean(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
