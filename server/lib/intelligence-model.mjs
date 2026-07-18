import { randomUUID } from "node:crypto";
import { buildOperationalPlanning } from "./vertical-operations-model.mjs";

const FUNNEL_ENTITIES = new Set(["contact", "deal", "proposal", "booking", "money"]);
const GOAL_SCOPES = new Set(["business", "team", "user"]);
const SENSITIVE_ACTIONS = new Set(["send", "delete", "charge", "publish", "change_permissions"]);

export function ensureIntelligenceCollections(db) {
  for (const key of ["analyticsFunnels", "businessGoals", "predictionSettings", "copilotActionDrafts", "copilotActionEvents"]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  for (const key of [
    "contacts", "deals", "pipelines", "proposals", "bookings", "moneyRecords", "invoices", "hospitalityInvoices",
    "payments", "campaigns", "campaignRecipients", "campaignEvents", "tasks", "communicationThreads",
    "communicationMessages", "activities", "hospitalityInventory", "operationalAlerts"
  ]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  return db;
}

export function upsertAnalyticsFunnel(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureIntelligenceCollections(db);
  const source = object(input?.funnel || input);
  const steps = array(source.steps ?? existing?.steps).map((item, index) => {
    const entity = clean(item?.entity).toLowerCase();
    if (!FUNNEL_ENTITIES.has(entity)) throw intelligenceError(400, "Unsupported funnel entity");
    return {
      id: clean(item.id) || `step_${index + 1}`,
      label: required(item.label, "Funnel step label is required").slice(0, 100),
      entity,
      statuses: strings(item.statuses),
      timestampField: clean(item.timestampField).slice(0, 80)
    };
  });
  if (steps.length < 2) throw intelligenceError(400, "A funnel needs at least two steps");
  const funnel = {
    id: existing?.id || `funnel_${randomUUID()}`,
    businessId,
    name: required(source.name || existing?.name, "Funnel name is required").slice(0, 160),
    description: clean(source.description ?? existing?.description).slice(0, 1000),
    steps,
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, funnel); else db.analyticsFunnels.push(funnel);
  return funnel;
}

export function upsertBusinessGoal(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureIntelligenceCollections(db);
  const source = object(input?.goal || input);
  const scope = clean(source.scope || existing?.scope || "business");
  if (!GOAL_SCOPES.has(scope)) throw intelligenceError(400, "Unsupported goal scope");
  const goal = {
    id: existing?.id || `goal_${randomUUID()}`,
    businessId,
    name: required(source.name || existing?.name, "Goal name is required").slice(0, 160),
    metricKey: required(source.metricKey || existing?.metricKey, "Goal metric is required").slice(0, 100),
    target: positive(source.target ?? existing?.target, "Goal target"),
    scope,
    scopeId: clean(source.scopeId || existing?.scopeId).slice(0, 180),
    periodStart: dateOnly(source.periodStart || existing?.periodStart || monthStart(now)),
    periodEnd: dateOnly(source.periodEnd || existing?.periodEnd || monthEnd(now)),
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (goal.periodEnd < goal.periodStart) throw intelligenceError(400, "Goal periodEnd cannot precede periodStart");
  if (existing) Object.assign(existing, goal); else db.businessGoals.push(goal);
  return goal;
}

export function upsertPredictionSettings(db, businessId, input, now = new Date().toISOString()) {
  ensureIntelligenceCollections(db);
  const source = object(input?.settings || input);
  let settings = db.predictionSettings.find((item) => item.businessId === businessId);
  const normalized = {
    id: settings?.id || `prediction_settings_${businessId}`,
    businessId,
    enabled: source.enabled === undefined ? settings?.enabled !== false : source.enabled === true,
    minSampleSize: integer(source.minSampleSize ?? settings?.minSampleSize ?? 10, 1, 10000),
    churnDays: integer(source.churnDays ?? settings?.churnDays ?? 90, 7, 730),
    compareBaseline: source.compareBaseline === undefined ? settings?.compareBaseline !== false : source.compareBaseline === true,
    updatedAt: now,
    createdAt: settings?.createdAt || now
  };
  if (settings) Object.assign(settings, normalized); else {
    settings = normalized;
    db.predictionSettings.push(settings);
  }
  return settings;
}

export function buildIntelligenceCenter(db, businessId, options = {}) {
  ensureIntelligenceCollections(db);
  const now = options.now || new Date().toISOString();
  const metrics = buildMetricDictionary(db, businessId, now);
  const funnels = activeFunnels(db, businessId).map((item) => evaluateFunnel(db, businessId, item));
  const cohorts = buildCustomerCohorts(db, businessId, now);
  const revenue = buildRevenueBreakdowns(db, businessId);
  const goals = db.businessGoals.filter((item) => item.businessId === businessId && item.active !== false).map((item) => evaluateGoal(item, metrics));
  const predictions = buildPredictions(db, businessId, now);
  const copilot = buildCopilotCenter(db, businessId, { now, metrics, predictions });
  return {
    generatedAt: now,
    analytics: {
      funnels,
      cohorts,
      revenue,
      goals,
      metrics: Object.values(metrics)
    },
    predictions,
    copilot,
    configuration: {
      funnelDefinitions: activeFunnels(db, businessId),
      goals: db.businessGoals.filter((item) => item.businessId === businessId && item.active !== false),
      predictionSettings: predictionSettings(db, businessId)
    }
  };
}

export function buildMetricDictionary(db, businessId, now = new Date().toISOString()) {
  ensureIntelligenceCollections(db);
  const contacts = db.contacts.filter((item) => item.businessId === businessId && !item.merged);
  const deals = db.deals.filter((item) => item.businessId === businessId && !item.archived);
  const bookings = db.bookings.filter((item) => item.businessId === businessId);
  const paidRevenue = normalizedRevenueRecords(db, businessId).reduce((sum, item) => sum + item.revenue, 0);
  const completed = bookings.filter((item) => item.status === "completed");
  const repeatCustomers = new Set(completed.map(contactKey).filter((key) => key && completed.filter((item) => contactKey(item) === key).length >= 2)).size;
  const overdueTasks = db.tasks.filter((item) => item.businessId === businessId && !["completed", "canceled"].includes(item.status) && item.dueAt && item.dueAt < now).length;
  const values = [
    metric("contacts.total", "Contactos", contacts.length, "Personas activas en el CRM.", "?tab=customers", "contacts"),
    metric("deals.open", "Oportunidades abiertas", deals.filter((item) => !isWon(item) && !isLost(item)).length, "Oportunidades no cerradas.", "?tab=leads", "deals"),
    metric("deals.won", "Oportunidades ganadas", deals.filter(isWon).length, "Oportunidades con resultado ganado.", "?tab=leads&status=won", "deals"),
    metric("bookings.total", "Reservas", bookings.length, "Reservas registradas en todos los estados.", "?tab=bookings", "bookings"),
    metric("bookings.completed", "Visitas completadas", completed.length, "Reservas marcadas como completadas.", "?tab=bookings&status=completed", "bookings"),
    metric("customers.repeat", "Clientes recurrentes", repeatCustomers, "Clientes con dos o más visitas completadas.", "?tab=customers&segment=recurring", "bookings"),
    metric("revenue.total", "Ingresos", round(paidRevenue), "Cobros conciliados o documentos pagados.", "?tab=finance", "moneyRecords"),
    metric("tasks.overdue", "Tareas vencidas", overdueTasks, "Tareas abiertas cuya fecha ya pasó.", "?tab=today&queue=overdue", "tasks")
  ];
  return Object.fromEntries(values.map((item) => [item.key, item]));
}

export function answerMetricQuery(db, businessId, question, now = new Date().toISOString()) {
  const metrics = buildMetricDictionary(db, businessId, now);
  const normalized = clean(question).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const aliases = [
    { terms: ["ingreso", "facturacion", "revenue", "venta"], key: "revenue.total" },
    { terms: ["reserva", "booking"], key: "bookings.total" },
    { terms: ["visita", "completad"], key: "bookings.completed" },
    { terms: ["recurrent", "repet"], key: "customers.repeat" },
    { terms: ["oportunidad", "deal", "ganad"], key: normalized.includes("ganad") ? "deals.won" : "deals.open" },
    { terms: ["contacto", "cliente"], key: "contacts.total" },
    { terms: ["tarea", "vencid"], key: "tasks.overdue" }
  ];
  const match = aliases.find((item) => item.terms.some((term) => normalized.includes(term)));
  if (!match) {
    return {
      answered: false,
      answer: "No he encontrado una métrica autorizada para esa pregunta.",
      suggestions: ["¿Cuántos ingresos hay?", "¿Cuántas reservas tenemos?", "¿Qué tareas están vencidas?"],
      citations: []
    };
  }
  const selected = metrics[match.key];
  return {
    answered: true,
    metric: selected,
    answer: `${selected.label}: ${selected.key === "revenue.total" ? formatMoneyValue(selected.value) : selected.value}.`,
    citations: [{ metricKey: selected.key, sourceCollection: selected.sourceCollection, sourceUrl: selected.sourceUrl, description: selected.description }]
  };
}

export function createCopilotDraft(db, businessId, input, actor = {}, now = new Date().toISOString()) {
  ensureIntelligenceCollections(db);
  const source = object(input?.draft || input);
  const type = enumValue(source.type || "next_action", ["response", "next_action", "task", "message"], "Unsupported copilot draft type");
  const draft = {
    id: `copilot_draft_${randomUUID()}`,
    businessId,
    type,
    title: required(source.title, "Draft title is required").slice(0, 180),
    content: required(source.content, "Draft content is required").slice(0, 10000),
    targetType: clean(source.targetType).slice(0, 80),
    targetId: clean(source.targetId).slice(0, 180),
    suggestedAction: clean(source.suggestedAction || (type === "message" ? "send" : "")).slice(0, 80),
    citations: array(source.citations).map(normalizeCitation).filter((item) => item.sourceId || item.sourceUrl).slice(0, 20),
    status: "draft",
    createdBy: clean(actor.id || actor.userId || "admin"),
    createdAt: now,
    updatedAt: now
  };
  db.copilotActionDrafts.push(draft);
  return draft;
}

export function confirmCopilotAction(db, businessId, input, actor = {}, now = new Date().toISOString()) {
  ensureIntelligenceCollections(db);
  const source = object(input);
  const action = clean(source.action);
  if (!SENSITIVE_ACTIONS.has(action)) throw intelligenceError(400, "Unsupported sensitive action");
  if (source.confirm !== true) throw intelligenceError(400, "Explicit confirmation is required");
  const draft = db.copilotActionDrafts.find((item) => item.businessId === businessId && item.id === clean(source.draftId));
  if (!draft) throw intelligenceError(404, "Copilot draft not found");
  const duplicate = db.copilotActionEvents.find((item) => item.businessId === businessId && item.draftId === draft.id && item.action === action && item.idempotencyKey === clean(source.idempotencyKey));
  if (duplicate) return { event: duplicate, draft, duplicate: true };
  const event = {
    id: `copilot_action_${randomUUID()}`,
    businessId,
    draftId: draft.id,
    action,
    targetType: draft.targetType,
    targetId: draft.targetId,
    status: "confirmed",
    confirmationText: clean(source.confirmationText || `Confirmo ${action}`).slice(0, 500),
    idempotencyKey: clean(source.idempotencyKey),
    actorType: clean(actor.type || "admin"),
    actorId: clean(actor.id || actor.userId || "admin"),
    automated: false,
    createdAt: now
  };
  db.copilotActionEvents.push(event);
  draft.status = "confirmed";
  draft.updatedAt = now;
  return { event, draft, duplicate: false };
}

export function buildPredictions(db, businessId, now = new Date().toISOString()) {
  ensureIntelligenceCollections(db);
  const settings = predictionSettings(db, businessId);
  const pipelines = db.pipelines.filter((item) => item.businessId === businessId && item.archived !== true);
  const deals = db.deals.filter((item) => item.businessId === businessId && !item.archived);
  const stagePredictions = pipelines.flatMap((pipeline) => array(pipeline.stages).map((stage) => {
    const stageDeals = deals.filter((item) => item.pipelineId === pipeline.id && item.stageId === stage.id);
    const observed = stageDeals.filter((item) => isWon(item) || isLost(item));
    const wins = observed.filter(isWon).length;
    const baseline = clampProbability(stage.probability ?? defaultStageProbability(stage));
    const calibrated = round((wins + 2 * baseline / 100) / (observed.length + 2) * 100);
    const reliable = observed.length >= settings.minSampleSize;
    return {
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      stageId: stage.id,
      stageName: stage.name || stage.label || stage.id,
      baselineProbability: baseline,
      calibratedProbability: settings.enabled && reliable ? calibrated : baseline,
      observedWinRate: observed.length ? round(wins / observed.length * 100) : null,
      sampleSize: observed.length,
      minSampleSize: settings.minSampleSize,
      reliable,
      modelUsed: settings.enabled && reliable ? "calibrated" : "baseline",
      explanation: reliable
        ? `${wins} ganadas de ${observed.length} cierres observados.`
        : `Muestra insuficiente (${observed.length}/${settings.minSampleSize}); se conserva la regla simple.`
    };
  }));
  const bookings = db.bookings.filter((item) => item.businessId === businessId && ["pending", "confirmed"].includes(item.status));
  const noShow = bookings.map((booking) => noShowPrediction(db, booking));
  const churn = churnPredictions(db, businessId, settings, now);
  const planning = buildOperationalPlanning(db, businessId, { startDate: now.slice(0, 10), days: 7 });
  const stock = planning.stock.map((item) => ({
    ...item,
    baselineRisk: Number(item.currentStock || 0) <= Number(item.minStock || 0),
    modelRisk: item.critical,
    factors: [
      { label: "Stock actual", value: item.currentStock },
      { label: "Consumo previsto", value: item.projectedUse },
      { label: "Stock proyectado", value: item.projectedStock },
      { label: "Mínimo", value: item.minStock }
    ]
  }));
  return {
    enabled: settings.enabled,
    settings,
    closeProbability: stagePredictions,
    churn,
    noShow,
    stock,
    comparison: {
      baselineOnly: !settings.enabled,
      calibratedStages: stagePredictions.filter((item) => item.modelUsed === "calibrated").length,
      fallbackStages: stagePredictions.filter((item) => item.modelUsed === "baseline").length,
      explanation: settings.enabled ? "El modelo solo sustituye la regla base cuando alcanza la muestra mínima." : "Predicción desactivada: se muestran únicamente reglas simples."
    }
  };
}

function buildCopilotCenter(db, businessId, options) {
  const now = options.now;
  const planning = buildOperationalPlanning(db, businessId, { startDate: now.slice(0, 10), days: 3 });
  const priorities = [];
  const overdue = db.tasks.filter((item) => item.businessId === businessId && !["completed", "canceled"].includes(item.status) && item.dueAt && item.dueAt < now);
  if (overdue.length) priorities.push(priority("Tareas vencidas", `${overdue.length} tarea(s) requieren revisión.`, "high", "?tab=today&queue=overdue", overdue.slice(0, 5).map((item) => citation("task", item.id, item.title || "Tarea", `?tab=today&task=${item.id}`))));
  const todayBookings = db.bookings.filter((item) => item.businessId === businessId && String(item.startsAt || "").slice(0, 10) === now.slice(0, 10) && !["canceled", "no-show"].includes(item.status));
  if (todayBookings.length) priorities.push(priority("Servicio de hoy", `${todayBookings.length} reserva(s), ${todayBookings.reduce((sum, item) => sum + Number(item.partySize || 1), 0)} cubiertos.`, "medium", `?tab=bookings&date=${now.slice(0, 10)}`, todayBookings.slice(0, 5).map((item) => citation("booking", item.id, item.customerName || "Reserva", `?tab=bookings&booking=${item.id}`))));
  for (const alertItem of planning.alerts.slice(0, 5)) priorities.push(priority(alertItem.title, alertItem.reason, alertItem.severity, alertItem.sourceUrl, [citation(alertItem.type, alertItem.id, alertItem.title, alertItem.sourceUrl)]));
  const conversations = db.communicationThreads.filter((item) => item.businessId === businessId).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))).slice(0, 5).map((thread) => {
    const messages = db.communicationMessages.filter((item) => item.businessId === businessId && (item.threadId === thread.id || item.conversationId === thread.id)).sort((a, b) => String(a.occurredAt || a.createdAt).localeCompare(String(b.occurredAt || b.createdAt)));
    const latest = messages.at(-1);
    return {
      threadId: thread.id,
      summary: latest ? `${messages.length} mensaje(s). Último: ${clean(latest.body || latest.text).slice(0, 180)}` : "Conversación sin mensajes.",
      citations: [citation("conversation", thread.id, thread.subject || thread.contactName || "Conversación", `?tab=messages&thread=${thread.id}`), ...messages.slice(-2).map((item) => citation("message", item.id, clean(item.body || item.text).slice(0, 80), `?tab=messages&thread=${thread.id}&message=${item.id}`))]
    };
  });
  const suggestedDrafts = conversations.slice(0, 3).map((item) => ({
    type: "response",
    title: "Borrador de respuesta",
    content: "Gracias por escribirnos. Hemos revisado tu mensaje y te confirmamos los siguientes pasos en cuanto validemos la disponibilidad.",
    targetType: "conversation",
    targetId: item.threadId,
    suggestedAction: "send",
    citations: item.citations
  }));
  return {
    brief: {
      generatedAt: now,
      headline: priorities.length ? `${priorities.length} prioridad(es) explicadas para hoy.` : "No hay incidencias críticas detectadas.",
      priorities
    },
    conversationSummaries: conversations,
    suggestedDrafts,
    drafts: db.copilotActionDrafts.filter((item) => item.businessId === businessId).slice(-50).reverse(),
    actionEvents: db.copilotActionEvents.filter((item) => item.businessId === businessId).slice(-50).reverse(),
    safety: {
      requiresConfirmation: [...SENSITIVE_ACTIONS],
      statement: "El copiloto prepara borradores; enviar, borrar, cobrar, publicar o cambiar permisos requiere confirmación humana explícita."
    }
  };
}

function evaluateFunnel(db, businessId, funnel) {
  const evaluated = funnel.steps.map((step) => {
    const records = recordsForFunnelStep(db, businessId, step);
    const byContact = new Map();
    for (const record of records) {
      const key = funnelContactKey(record, step.entity);
      if (!key) continue;
      const timestamp = recordTimestamp(record, step);
      if (!byContact.has(key) || timestamp < byContact.get(key)) byContact.set(key, timestamp);
    }
    return { ...step, records: records.length, contacts: byContact.size, byContact };
  });
  const first = evaluated[0]?.contacts || 0;
  const steps = evaluated.map((step, index) => {
    const previous = evaluated[index - 1];
    let transitionHours = null;
    if (previous) {
      const durations = [];
      for (const [contactId, timestamp] of step.byContact) {
        const prior = previous.byContact.get(contactId);
        if (prior && timestamp >= prior) durations.push((Date.parse(timestamp) - Date.parse(prior)) / 3600000);
      }
      transitionHours = durations.length ? round(median(durations)) : null;
    }
    const { byContact, ...publicStep } = step;
    return {
      ...publicStep,
      conversionFromPrevious: previous?.contacts ? round(step.contacts / previous.contacts * 100) : index === 0 ? 100 : 0,
      conversionFromStart: first ? round(step.contacts / first * 100) : 0,
      medianTransitionHours: transitionHours,
      sourceUrl: funnelSourceUrl(step.entity, step.statuses)
    };
  });
  return { ...funnel, steps, totalConversion: steps.at(-1)?.conversionFromStart || 0 };
}

function buildCustomerCohorts(db, businessId, now) {
  const completed = db.bookings.filter((item) => item.businessId === businessId && item.status === "completed" && contactKey(item)).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  const visits = new Map();
  for (const booking of completed) {
    const key = contactKey(booking);
    if (!visits.has(key)) visits.set(key, []);
    visits.get(key).push(booking);
  }
  const cohorts = new Map();
  for (const [key, items] of visits) {
    const cohortMonth = String(items[0].startsAt).slice(0, 7);
    if (!cohorts.has(cohortMonth)) cohorts.set(cohortMonth, []);
    cohorts.get(cohortMonth).push({ key, items });
  }
  const rows = [...cohorts.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([month, members]) => {
    const retention = [0, 1, 2, 3].map((offset) => {
      const target = addMonths(month, offset);
      const retained = members.filter((member) => member.items.some((item) => String(item.startsAt).startsWith(target))).length;
      return { period: `M${offset}`, retained, rate: members.length ? round(retained / members.length * 100) : 0 };
    });
    return { cohort: month, customers: members.length, retention, sourceUrl: `?tab=customers&cohort=${month}` };
  });
  const churned = [...visits.values()].filter((items) => daysBetween(items.at(-1).startsAt, now) >= 90).length;
  return {
    rows,
    summary: {
      customers: visits.size,
      repeated: [...visits.values()].filter((items) => items.length >= 2).length,
      churned,
      repeatRate: visits.size ? round([...visits.values()].filter((items) => items.length >= 2).length / visits.size * 100) : 0
    }
  };
}

function buildRevenueBreakdowns(db, businessId) {
  const records = normalizedRevenueRecords(db, businessId);
  const contacts = db.contacts.filter((item) => item.businessId === businessId);
  const bookings = db.bookings.filter((item) => item.businessId === businessId);
  const breakdown = (resolver, sourceUrl) => groupRevenue(records, resolver).map((item) => ({ ...item, sourceUrl: `${sourceUrl}${encodeURIComponent(item.key)}` }));
  return {
    total: round(records.reduce((sum, item) => sum + item.revenue, 0)),
    currency: records[0]?.currency || "EUR",
    byChannel: breakdown((item) => contacts.find((contact) => contact.id === item.contactId)?.source || "sin_atribuir", "?tab=finance&channel="),
    byCampaign: groupCampaignRevenue(db, businessId),
    byService: breakdown((item) => bookings.find((booking) => booking.contactId && booking.contactId === item.contactId)?.serviceName || "sin_servicio", "?tab=finance&service="),
    byDeal: breakdown((item) => item.dealId || "sin_oportunidad", "?tab=finance&deal="),
    byCustomer: breakdown((item) => contacts.find((contact) => contact.id === item.contactId)?.name || item.customerName || "sin_cliente", "?tab=finance&customer=")
  };
}

function evaluateGoal(goal, metrics) {
  const metricValue = Number(metrics[goal.metricKey]?.value || 0);
  return {
    ...goal,
    current: round(metricValue),
    progressPercent: round(Math.min(100, metricValue / goal.target * 100)),
    remaining: round(Math.max(0, goal.target - metricValue)),
    status: metricValue >= goal.target ? "achieved" : new Date(goal.periodEnd) < new Date() ? "missed" : metricValue / goal.target >= .75 ? "on_track" : "at_risk",
    sourceUrl: metrics[goal.metricKey]?.sourceUrl || "?tab=reports"
  };
}

function noShowPrediction(db, booking) {
  const prior = db.bookings.filter((item) => item.businessId === booking.businessId && item.id !== booking.id && contactKey(item) && contactKey(item) === contactKey(booking));
  const priorNoShows = prior.filter((item) => item.status === "no-show").length;
  const factors = [
    { key: "prior_no_shows", label: "No-shows previos", value: priorNoShows, impact: Math.min(60, priorNoShows * 30) },
    { key: "deposit", label: "Señal pendiente", value: booking.depositRequired && booking.depositStatus !== "paid", impact: booking.depositRequired && booking.depositStatus !== "paid" ? 20 : 0 },
    { key: "reminder", label: "Sin recordatorio", value: !booking.lastReminderAt, impact: booking.lastReminderAt ? 0 : 10 },
    { key: "confirmation", label: "Sin confirmación", value: booking.customerConfirmationStatus !== "confirmed", impact: booking.customerConfirmationStatus === "confirmed" ? 0 : 10 }
  ];
  const score = Math.min(100, factors.reduce((sum, item) => sum + item.impact, 0));
  const baselineRisk = priorNoShows > 0;
  return {
    bookingId: booking.id,
    customerName: booking.customerName || "",
    score,
    level: score >= 70 ? "high" : score >= 35 ? "medium" : "low",
    baselineRisk,
    modelRisk: score >= 35,
    factors,
    sourceUrl: `?tab=bookings&booking=${booking.id}`
  };
}

function churnPredictions(db, businessId, settings, now) {
  const contacts = db.contacts.filter((item) => item.businessId === businessId && !item.merged);
  const bookings = db.bookings.filter((item) => item.businessId === businessId && item.status === "completed");
  return contacts.map((contact) => {
    const visits = bookings.filter((item) => item.contactId === contact.id || (!item.contactId && ((contact.email && item.email === contact.email) || (contact.phone && item.phone === contact.phone)))).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    if (!visits.length) return null;
    const daysSince = daysBetween(visits.at(-1).startsAt, now);
    const averageGap = visits.length >= 2 ? average(visits.slice(1).map((item, index) => daysBetween(visits[index].startsAt, item.startsAt))) : settings.churnDays;
    const threshold = Math.max(settings.churnDays, averageGap * 1.5);
    const noShows = db.bookings.filter((item) => item.businessId === businessId && item.contactId === contact.id && item.status === "no-show").length;
    const factors = [
      { label: "Días desde visita", value: daysSince, threshold, impact: daysSince >= threshold ? 55 : round(daysSince / threshold * 40) },
      { label: "Frecuencia histórica", value: round(averageGap), impact: visits.length < 2 ? 15 : 0 },
      { label: "No-shows", value: noShows, impact: Math.min(20, noShows * 10) }
    ];
    const score = Math.min(100, round(factors.reduce((sum, item) => sum + item.impact, 0)));
    return {
      contactId: contact.id,
      contactName: contact.name || contact.email || contact.phone || contact.id,
      score,
      level: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
      baselineRisk: daysSince >= settings.churnDays,
      modelRisk: score >= 40,
      factors,
      sourceUrl: `?tab=customers&contact=${contact.id}`
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}

function activeFunnels(db, businessId) {
  const configured = db.analyticsFunnels.filter((item) => item.businessId === businessId && item.active !== false);
  if (configured.length) return configured;
  return [upsertAnalyticsFunnel(db, businessId, {
    name: "Ciclo completo",
    description: "De contacto captado a ingreso conciliado.",
    steps: [
      { id: "contact", label: "Contactos", entity: "contact" },
      { id: "deal", label: "Oportunidades", entity: "deal" },
      { id: "proposal", label: "Propuestas aceptadas", entity: "proposal", statuses: ["accepted", "aceptada"] },
      { id: "booking", label: "Visitas completadas", entity: "booking", statuses: ["completed"] },
      { id: "money", label: "Ingreso cobrado", entity: "money", statuses: ["paid", "partially_paid"] }
    ]
  })];
}

function predictionSettings(db, businessId) {
  return db.predictionSettings.find((item) => item.businessId === businessId) || upsertPredictionSettings(db, businessId, {});
}

function recordsForFunnelStep(db, businessId, step) {
  const collection = step.entity === "contact" ? db.contacts
    : step.entity === "deal" ? db.deals
      : step.entity === "proposal" ? db.proposals
        : step.entity === "booking" ? db.bookings
          : db.moneyRecords;
  return collection.filter((item) => item.businessId === businessId)
    .filter((item) => !step.statuses.length || step.statuses.includes(clean(item.status).toLowerCase()))
    .filter((item) => !item.merged && !item.archived);
}

function funnelContactKey(record, entity) {
  if (entity === "contact") return record.id;
  return clean(record.contactId || record.customerId || record.email || record.phone || record.customerName);
}

function recordTimestamp(record, step) {
  const field = step.timestampField;
  const candidate = field ? record[field] : record.paidAt || record.completedAt || record.acceptedAt || record.startsAt || record.createdAt || record.updatedAt;
  const time = Date.parse(candidate || "");
  return Number.isFinite(time) ? new Date(time).toISOString() : "9999-12-31T23:59:59.999Z";
}

function normalizedRevenueRecords(db, businessId) {
  const records = db.moneyRecords.filter((item) => item.businessId === businessId).map((item) => ({
    ...item,
    revenue: Number(item.paidAmount || (item.status === "paid" ? item.total : 0)),
    currency: item.currency || "EUR"
  })).filter((item) => item.revenue > 0);
  if (records.length) return records;
  return [...db.invoices, ...db.hospitalityInvoices].filter((item) => item.businessId === businessId && item.status === "paid").map((item) => ({
    ...item,
    revenue: Number(item.total || item.amount || 0),
    currency: item.currency || "EUR"
  }));
}

function groupRevenue(records, resolver) {
  const groups = new Map();
  for (const record of records) {
    const key = clean(resolver(record)) || "sin_atribuir";
    groups.set(key, round((groups.get(key) || 0) + record.revenue));
  }
  return [...groups.entries()].map(([key, revenue]) => ({ key, revenue })).sort((a, b) => b.revenue - a.revenue);
}

function groupCampaignRevenue(db, businessId) {
  return db.campaigns.filter((item) => item.businessId === businessId).map((item) => ({
    key: item.name || item.id,
    revenue: Number(item.metrics?.attributedRevenue || 0),
    sourceUrl: `?tab=customers&campaign=${encodeURIComponent(item.id)}`
  })).filter((item) => item.revenue > 0).sort((a, b) => b.revenue - a.revenue);
}

function metric(key, label, value, description, sourceUrl, sourceCollection) { return { key, label, value: round(value), description, sourceUrl, sourceCollection }; }
function priority(title, reason, severity, sourceUrl, citations) { return { id: `priority_${clean(title).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, title, reason, severity, sourceUrl, citations }; }
function citation(sourceType, sourceId, label, sourceUrl) { return { sourceType, sourceId, label: clean(label).slice(0, 180), sourceUrl }; }
function normalizeCitation(value) { const item = object(value); return citation(item.sourceType, item.sourceId, item.label, item.sourceUrl); }
function funnelSourceUrl(entity, statuses) { return entity === "contact" ? "?tab=customers" : entity === "deal" ? "?tab=leads" : entity === "proposal" ? "?tab=proposals" : entity === "booking" ? `?tab=bookings${statuses.length ? `&status=${encodeURIComponent(statuses[0])}` : ""}` : "?tab=finance"; }
function contactKey(item) { return clean(item.contactId || item.email || item.phone || item.customerName); }
function isWon(item) { return ["won", "closed_won", "accepted", "ganada"].includes(clean(item.status).toLowerCase()) || item.won === true; }
function isLost(item) { return ["lost", "closed_lost", "rejected", "perdida"].includes(clean(item.status).toLowerCase()) || item.lost === true; }
function defaultStageProbability(stage) { const normalized = clean(stage.id || stage.name).toLowerCase(); return normalized.includes("won") || normalized.includes("gan") ? 100 : normalized.includes("lost") || normalized.includes("perd") ? 0 : 25; }
function clampProbability(value) { return Math.min(100, Math.max(0, number(value))); }
function median(values) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function daysBetween(left, right) { return Math.max(0, Math.floor((Date.parse(right) - Date.parse(left)) / 86400000)); }
function addMonths(month, offset) { const [year, monthNumber] = month.split("-").map(Number); return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7); }
function monthStart(value) { return `${String(value).slice(0, 7)}-01`; }
function monthEnd(value) { const [year, month] = String(value).slice(0, 7).split("-").map(Number); return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10); }
function formatMoneyValue(value) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(number(value)); }
function dateOnly(value) { const result = clean(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T12:00:00Z`))) throw intelligenceError(400, "Date must use YYYY-MM-DD"); return result; }
function positive(value, field) { const result = number(value); if (!(result > 0)) throw intelligenceError(400, `${field} must be positive`); return round(result); }
function required(value, message) { const result = clean(value); if (!result) throw intelligenceError(400, message); return result; }
function enumValue(value, allowed, message) { const result = clean(value); if (!allowed.includes(result)) throw intelligenceError(400, message); return result; }
function strings(value) { return [...new Set(array(value).map((item) => clean(item).toLowerCase()).filter(Boolean))]; }
function integer(value, min, max) { return Math.min(max, Math.max(min, Math.round(number(value)))); }
function average(values) { return values.length ? values.reduce((sum, item) => sum + number(item), 0) / values.length : 0; }
function round(value) { return Math.round((number(value) + Number.EPSILON) * 100) / 100; }
function number(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function clean(value) { return String(value ?? "").trim(); }
function intelligenceError(statusCode, message, code = "intelligence_error") { return Object.assign(new Error(message), { statusCode, code }); }
