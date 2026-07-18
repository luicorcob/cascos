import { createHash, randomBytes, randomUUID } from "node:crypto";

const PROGRAM_MODES = new Set(["points", "balance", "bonus"]);
const MOVEMENT_TYPES = new Set(["earn", "redeem", "expire", "correction", "reward", "referral"]);

export function ensureLoyaltyCollections(db) {
  for (const key of [
    "loyaltyPrograms",
    "loyaltyAccounts",
    "loyaltyMovements",
    "loyaltyRewards",
    "loyaltyRedemptions",
    "referralCodes",
    "referralAttributions"
  ]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  return db;
}

export function upsertLoyaltyProgram(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const source = object(input?.program || input);
  const mode = clean(source.mode || existing?.mode || "points").toLowerCase();
  if (!PROGRAM_MODES.has(mode)) throw loyaltyError(400, "Unsupported loyalty program mode");
  const program = {
    id: existing?.id || `loyalty_program_${businessId}`,
    businessId,
    name: clean(source.name || existing?.name || "Club de fidelidad").slice(0, 160),
    mode,
    unitLabel: clean(source.unitLabel || existing?.unitLabel || (mode === "points" ? "puntos" : mode === "balance" ? "EUR" : "bonos")).slice(0, 40),
    earnPerCurrency: positiveNumber(source.earnPerCurrency ?? existing?.earnPerCurrency ?? 1, "earnPerCurrency"),
    currency: currency(source.currency || existing?.currency || "EUR"),
    expirationDays: integer(source.expirationDays ?? existing?.expirationDays ?? 365, 0, 3650),
    levels: normalizeLevels(source.levels ?? existing?.levels),
    referral: normalizeReferral(source.referral ?? existing?.referral),
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, program);
  else db.loyaltyPrograms.push(program);
  return program;
}

export function upsertLoyaltyReward(db, businessId, input, existing = null, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const source = object(input?.reward || input);
  const reward = {
    id: existing?.id || `reward_${randomUUID()}`,
    businessId,
    name: required(source.name || existing?.name, "Reward name is required").slice(0, 160),
    description: clean(source.description ?? existing?.description).slice(0, 800),
    cost: positiveNumber(source.cost ?? existing?.cost, "reward cost"),
    stock: integer(source.stock ?? existing?.stock ?? 0, 0, 1000000),
    unlimited: source.unlimited === undefined ? Boolean(existing?.unlimited) : source.unlimited === true,
    expiresAt: isoOrEmpty(source.expiresAt ?? existing?.expiresAt),
    active: source.active === undefined ? existing?.active !== false : source.active !== false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, reward);
  else db.loyaltyRewards.push(reward);
  return reward;
}

export function ensureLoyaltyAccount(db, businessId, contactId, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const contact = db.contacts.find((item) => item.businessId === businessId && item.id === contactId && !item.merged);
  if (!contact) throw loyaltyError(404, "Contact not found");
  let account = db.loyaltyAccounts.find((item) => item.businessId === businessId && item.contactId === contactId);
  if (!account) {
    account = {
      id: `loyalty_${randomUUID()}`,
      businessId,
      contactId,
      status: "active",
      joinedAt: now,
      createdAt: now,
      updatedAt: now
    };
    db.loyaltyAccounts.push(account);
  }
  return account;
}

export function addLoyaltyMovement(db, businessId, input, actor = {}, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const source = object(input?.movement || input);
  const account = source.accountId
    ? db.loyaltyAccounts.find((item) => item.businessId === businessId && item.id === clean(source.accountId))
    : ensureLoyaltyAccount(db, businessId, clean(source.contactId), now);
  if (!account) throw loyaltyError(404, "Loyalty account not found");
  const type = clean(source.type || "earn").toLowerCase();
  if (!MOVEMENT_TYPES.has(type)) throw loyaltyError(400, "Unsupported loyalty movement type");
  let amount = number(source.amount);
  if (!amount) throw loyaltyError(400, "Movement amount cannot be zero");
  if (["redeem", "expire", "reward"].includes(type)) amount = -Math.abs(amount);
  if (["earn", "referral"].includes(type)) amount = Math.abs(amount);
  const program = activeProgram(db, businessId);
  expireLoyaltyMovements(db, businessId, now);
  if (amount < 0 && loyaltyBalance(db, account.id) + amount < 0 && type !== "correction") {
    throw loyaltyError(409, "Insufficient loyalty balance");
  }
  const idempotencyKey = clean(source.idempotencyKey);
  if (idempotencyKey) {
    const duplicate = db.loyaltyMovements.find((item) => item.businessId === businessId && item.idempotencyKey === idempotencyKey);
    if (duplicate) return { movement: duplicate, account: decorateAccount(db, account, program, now), duplicate: true };
  }
  const occurredAt = isoOrNow(source.occurredAt, now);
  const movement = {
    id: `loyalty_movement_${randomUUID()}`,
    businessId,
    accountId: account.id,
    contactId: account.contactId,
    type,
    amount: round(amount),
    reason: required(source.reason, "Movement reason is required").slice(0, 300),
    sourceType: clean(source.sourceType || "manual").slice(0, 80),
    sourceId: clean(source.sourceId).slice(0, 180),
    sourceMovementId: clean(source.sourceMovementId).slice(0, 180),
    idempotencyKey,
    expiresAt: amount > 0 && program.expirationDays > 0
      ? new Date(new Date(occurredAt).getTime() + program.expirationDays * 86400000).toISOString()
      : "",
    actorType: clean(actor.type || "admin"),
    actorId: clean(actor.id || actor.userId || "admin"),
    occurredAt,
    createdAt: now
  };
  db.loyaltyMovements.push(movement);
  account.updatedAt = now;
  return { movement, account: decorateAccount(db, account, program, now), duplicate: false };
}

export function redeemLoyaltyReward(db, businessId, rewardId, input, actor = {}, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const reward = db.loyaltyRewards.find((item) => item.businessId === businessId && item.id === rewardId && item.active !== false);
  if (!reward || (reward.expiresAt && reward.expiresAt <= now)) throw loyaltyError(404, "Reward not available");
  if (!reward.unlimited && reward.stock <= 0) throw loyaltyError(409, "Reward is out of stock");
  const source = object(input);
  const account = source.accountId
    ? db.loyaltyAccounts.find((item) => item.businessId === businessId && item.id === clean(source.accountId))
    : ensureLoyaltyAccount(db, businessId, clean(source.contactId), now);
  if (!account) throw loyaltyError(404, "Loyalty account not found");
  const idempotencyKey = clean(source.idempotencyKey) || `reward:${reward.id}:${account.id}:${clean(source.externalReference)}`;
  const duplicate = db.loyaltyRedemptions.find((item) => item.businessId === businessId && item.idempotencyKey === idempotencyKey);
  if (duplicate) return { redemption: duplicate, account: decorateAccount(db, account, activeProgram(db, businessId), now), duplicate: true };
  const result = addLoyaltyMovement(db, businessId, {
    accountId: account.id,
    type: "reward",
    amount: reward.cost,
    reason: `Recompensa: ${reward.name}`,
    sourceType: "reward",
    sourceId: reward.id,
    idempotencyKey
  }, actor, now);
  const redemption = {
    id: `redemption_${randomUUID()}`,
    businessId,
    accountId: account.id,
    contactId: account.contactId,
    rewardId: reward.id,
    movementId: result.movement.id,
    status: "issued",
    code: randomBytes(6).toString("hex").toUpperCase(),
    idempotencyKey,
    createdAt: now
  };
  db.loyaltyRedemptions.push(redemption);
  if (!reward.unlimited) reward.stock -= 1;
  reward.updatedAt = now;
  return { redemption, account: result.account, duplicate: false };
}

export function issueReferralCode(db, businessId, contactId, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  ensureLoyaltyAccount(db, businessId, contactId, now);
  let code = db.referralCodes.find((item) => item.businessId === businessId && item.contactId === contactId && item.active !== false);
  if (!code) {
    code = {
      id: `refcode_${randomUUID()}`,
      businessId,
      contactId,
      code: uniqueReferralCode(db, businessId),
      uses: 0,
      active: true,
      createdAt: now,
      updatedAt: now
    };
    db.referralCodes.push(code);
  }
  return code;
}

export function attributeReferral(db, businessId, input, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const source = object(input);
  const code = db.referralCodes.find((item) => item.businessId === businessId && item.code === clean(source.code).toUpperCase() && item.active !== false);
  if (!code) throw loyaltyError(404, "Referral code not found");
  const referredContactId = clean(source.referredContactId);
  ensureLoyaltyAccount(db, businessId, referredContactId, now);
  if (referredContactId === code.contactId) throw loyaltyError(409, "Self-referrals are not allowed");
  if (db.referralAttributions.some((item) => item.businessId === businessId && item.referredContactId === referredContactId)) {
    throw loyaltyError(409, "This contact already has a referrer");
  }
  const program = activeProgram(db, businessId);
  if (code.uses >= program.referral.maxConversionsPerReferrer) throw loyaltyError(409, "Referral limit reached");
  const fingerprintHash = source.fingerprint ? hash(source.fingerprint) : "";
  if (fingerprintHash && db.referralAttributions.some((item) => item.businessId === businessId && item.fingerprintHash === fingerprintHash)) {
    throw loyaltyError(409, "Referral abuse signal detected");
  }
  const attribution = {
    id: `referral_${randomUUID()}`,
    businessId,
    referralCodeId: code.id,
    referrerContactId: code.contactId,
    referredContactId,
    fingerprintHash,
    source: clean(source.source || "direct").slice(0, 80),
    status: "attributed",
    convertedAt: "",
    rewardMovementIds: [],
    createdAt: now,
    updatedAt: now
  };
  db.referralAttributions.push(attribution);
  return attribution;
}

export function convertReferral(db, businessId, attributionId, actor = {}, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const attribution = db.referralAttributions.find((item) => item.businessId === businessId && item.id === attributionId);
  if (!attribution) throw loyaltyError(404, "Referral attribution not found");
  if (attribution.status === "converted") return { attribution, duplicate: true };
  const program = activeProgram(db, businessId);
  const referrer = addLoyaltyMovement(db, businessId, {
    contactId: attribution.referrerContactId,
    type: "referral",
    amount: program.referral.referrerReward,
    reason: "Referido convertido",
    sourceType: "referral",
    sourceId: attribution.id,
    idempotencyKey: `referral:${attribution.id}:referrer`
  }, actor, now);
  const referred = addLoyaltyMovement(db, businessId, {
    contactId: attribution.referredContactId,
    type: "referral",
    amount: program.referral.referredReward,
    reason: "Bienvenida por referido",
    sourceType: "referral",
    sourceId: attribution.id,
    idempotencyKey: `referral:${attribution.id}:referred`
  }, actor, now);
  attribution.status = "converted";
  attribution.convertedAt = now;
  attribution.updatedAt = now;
  attribution.rewardMovementIds = [referrer.movement.id, referred.movement.id];
  const code = db.referralCodes.find((item) => item.id === attribution.referralCodeId);
  if (code) {
    code.uses += 1;
    code.updatedAt = now;
  }
  return { attribution, duplicate: false };
}

export function buildLoyaltyCenter(db, businessId, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const program = activeProgram(db, businessId);
  expireLoyaltyMovements(db, businessId, now);
  const accounts = db.loyaltyAccounts
    .filter((item) => item.businessId === businessId)
    .map((item) => decorateAccount(db, item, program, now))
    .sort((a, b) => b.balance - a.balance);
  const rewards = db.loyaltyRewards.filter((item) => item.businessId === businessId && item.active !== false);
  const referrals = db.referralAttributions.filter((item) => item.businessId === businessId);
  const movements = db.loyaltyMovements.filter((item) => item.businessId === businessId).sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
  return {
    program,
    accounts,
    rewards,
    movements: movements.slice(0, 100),
    referralCodes: db.referralCodes.filter((item) => item.businessId === businessId && item.active !== false),
    referrals,
    redemptions: db.loyaltyRedemptions.filter((item) => item.businessId === businessId),
    summary: {
      members: accounts.length,
      issued: round(movements.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0)),
      available: round(accounts.reduce((sum, item) => sum + item.balance, 0)),
      rewardsIssued: db.loyaltyRedemptions.filter((item) => item.businessId === businessId).length,
      referralsAttributed: referrals.length,
      referralsConverted: referrals.filter((item) => item.status === "converted").length
    }
  };
}

export function expireLoyaltyMovements(db, businessId, now = new Date().toISOString()) {
  ensureLoyaltyCollections(db);
  const expirable = db.loyaltyMovements.filter((item) =>
    item.businessId === businessId
    && item.amount > 0
    && item.expiresAt
    && item.expiresAt <= now
    && !db.loyaltyMovements.some((candidate) => candidate.businessId === businessId && candidate.type === "expire" && candidate.sourceMovementId === item.id)
  );
  for (const movement of expirable) {
    db.loyaltyMovements.push({
      id: `loyalty_movement_${randomUUID()}`,
      businessId,
      accountId: movement.accountId,
      contactId: movement.contactId,
      type: "expire",
      amount: -movement.amount,
      reason: `Caducidad de ${movement.id}`,
      sourceType: "expiration",
      sourceId: "",
      sourceMovementId: movement.id,
      idempotencyKey: `expire:${movement.id}`,
      expiresAt: "",
      actorType: "system",
      actorId: "loyalty-expiration",
      occurredAt: now,
      createdAt: now
    });
  }
  return expirable.length;
}

function activeProgram(db, businessId) {
  return db.loyaltyPrograms.find((item) => item.businessId === businessId && item.active !== false)
    || upsertLoyaltyProgram(db, businessId, {});
}

function decorateAccount(db, account, program, now) {
  const contact = db.contacts.find((item) => item.id === account.contactId && item.businessId === account.businessId);
  const balance = loyaltyBalance(db, account.id);
  const level = [...program.levels].sort((a, b) => b.threshold - a.threshold).find((item) => balance >= item.threshold) || program.levels[0];
  const expiring = db.loyaltyMovements.filter((item) => item.accountId === account.id && item.amount > 0 && item.expiresAt && item.expiresAt > now).sort((a, b) => itemDate(a).localeCompare(itemDate(b)))[0];
  return {
    ...account,
    contactName: clean(contact?.name || contact?.email || contact?.phone || account.contactId),
    balance,
    level: level?.name || "",
    nextExpirationAt: expiring?.expiresAt || ""
  };
}

function loyaltyBalance(db, accountId) {
  return round(db.loyaltyMovements.filter((item) => item.accountId === accountId).reduce((sum, item) => sum + number(item.amount), 0));
}

function normalizeLevels(value) {
  const levels = array(value).map((item) => ({
    name: required(item?.name, "Loyalty level name is required").slice(0, 80),
    threshold: Math.max(0, number(item?.threshold)),
    multiplier: Math.max(1, number(item?.multiplier || 1))
  })).sort((a, b) => a.threshold - b.threshold);
  return levels.length ? levels : [
    { name: "Base", threshold: 0, multiplier: 1 },
    { name: "Frecuente", threshold: 500, multiplier: 1.1 },
    { name: "VIP", threshold: 1500, multiplier: 1.25 }
  ];
}

function normalizeReferral(value) {
  const source = object(value);
  return {
    enabled: source.enabled !== false,
    referrerReward: positiveNumber(source.referrerReward ?? 100, "referrerReward"),
    referredReward: positiveNumber(source.referredReward ?? 50, "referredReward"),
    maxConversionsPerReferrer: integer(source.maxConversionsPerReferrer ?? 20, 1, 10000),
    attributionDays: integer(source.attributionDays ?? 30, 1, 365)
  };
}

function uniqueReferralCode(db, businessId) {
  for (let index = 0; index < 20; index += 1) {
    const code = randomBytes(5).toString("base64url").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);
    if (!db.referralCodes.some((item) => item.businessId === businessId && item.code === code)) return code;
  }
  throw loyaltyError(503, "Could not generate a referral code");
}

function itemDate(item) { return String(item.expiresAt || ""); }
function hash(value) { return createHash("sha256").update(clean(value)).digest("hex"); }
function currency(value) { const result = clean(value).toUpperCase(); if (!/^[A-Z]{3}$/.test(result)) throw loyaltyError(400, "Currency must use ISO 4217"); return result; }
function isoOrEmpty(value) { if (!value) return ""; const time = Date.parse(value); if (!Number.isFinite(time)) throw loyaltyError(400, "Invalid date"); return new Date(time).toISOString(); }
function isoOrNow(value, now) { return value ? isoOrEmpty(value) : now; }
function positiveNumber(value, field) { const result = number(value); if (!(result > 0)) throw loyaltyError(400, `${field} must be positive`); return round(result); }
function required(value, message) { const result = clean(value); if (!result) throw loyaltyError(400, message); return result; }
function integer(value, min, max) { const result = Math.round(number(value)); return Math.min(max, Math.max(min, result)); }
function round(value) { return Math.round((number(value) + Number.EPSILON) * 100) / 100; }
function number(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function clean(value) { return String(value ?? "").trim(); }
function loyaltyError(statusCode, message, code = "loyalty_error") { return Object.assign(new Error(message), { statusCode, code }); }
