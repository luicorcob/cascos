let poolPromise;

export async function findZoneBusiness(reference) {
  const value = clean(reference);
  if (!value) return null;
  return withClient(async (client) => {
    const result = await client.query(
      `select id, slug, data
       from public.locallift_businesses
       where id = $1 or slug = $1
       limit 1`,
      [value]
    );
    return result.rows[0] ? normalizeBusinessRow(result.rows[0]) : null;
  });
}

export async function listZoneBusinesses() {
  return withClient(async (client) => {
    const result = await client.query(
      `select id, slug, data
       from public.locallift_businesses
       where coalesce(data->>'status', '') not in ('archived', 'paused')
       order by position`
    );
    return result.rows.map(normalizeBusinessRow);
  });
}

export async function saveBusinessZoneLocation(businessId, coordinates, zoneName = "") {
  const payload = {
    coordinates: {
      lat: roundCoordinate(coordinates?.lat),
      lng: roundCoordinate(coordinates?.lng)
    }
  };
  if (clean(zoneName)) payload.zone = clean(zoneName);
  return withClient(async (client) => {
    const result = await client.query(
      `update public.locallift_businesses
       set data = data || $2::jsonb,
           updated_at = now(),
           stored_at = now()
       where id = $1
       returning id, slug, data`,
      [clean(businessId), JSON.stringify(payload)]
    );
    return result.rows[0] ? normalizeBusinessRow(result.rows[0]) : null;
  });
}

export async function getZoneSettings(businessId) {
  return withClient(async (client) => {
    const result = await client.query(
      `select business_id, is_enabled, excluded_business_ids, excluded_poi_ids, radius_meters, updated_at
       from public.zone_discovery_settings
       where business_id = $1`,
      [clean(businessId)]
    );
    return normalizeSettings(result.rows[0], businessId);
  });
}

export async function upsertZoneSettings(businessId, input = {}) {
  const current = await getZoneSettings(businessId);
  const next = {
    isEnabled: input.isEnabled === undefined ? current.isEnabled : input.isEnabled === true,
    excludedBusinessIds: input.excludedBusinessIds === undefined
      ? current.excludedBusinessIds
      : uniqueText(input.excludedBusinessIds),
    excludedPoiIds: input.excludedPoiIds === undefined
      ? current.excludedPoiIds
      : uniqueUuids(input.excludedPoiIds),
    radiusMeters: input.radiusMeters === undefined
      ? current.radiusMeters
      : clampNumber(input.radiusMeters, 250, 10000, 1500)
  };
  return withClient(async (client) => {
    const result = await client.query(
      `insert into public.zone_discovery_settings
        (business_id, is_enabled, excluded_business_ids, excluded_poi_ids, radius_meters)
       values ($1, $2, $3::text[], $4::uuid[], $5)
       on conflict (business_id) do update set
         is_enabled = excluded.is_enabled,
         excluded_business_ids = excluded.excluded_business_ids,
         excluded_poi_ids = excluded.excluded_poi_ids,
         radius_meters = excluded.radius_meters
       returning business_id, is_enabled, excluded_business_ids, excluded_poi_ids, radius_meters, updated_at`,
      [clean(businessId), next.isEnabled, next.excludedBusinessIds, next.excludedPoiIds, next.radiusMeters]
    );
    return normalizeSettings(result.rows[0], businessId);
  });
}

export async function listZonePois() {
  return withClient(async (client) => {
    const result = await client.query(
      `select id, name, category, description_short, description_long, latitude, longitude,
              image_url, source, external_ref, verified, created_at, updated_at
       from public.zone_points_of_interest`
    );
    return result.rows.map(normalizePoiRow);
  });
}

export async function upsertZonePois(pois = []) {
  if (!Array.isArray(pois) || !pois.length) return [];
  return withTransaction(async (client) => {
    const stored = [];
    for (const poi of pois) {
      const result = await client.query(
        `insert into public.zone_points_of_interest
          (name, category, description_short, description_long, latitude, longitude,
           image_url, source, external_ref, verified)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (source, external_ref) where external_ref is not null and external_ref <> ''
         do update set
           name = excluded.name,
           category = excluded.category,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           image_url = coalesce(nullif(excluded.image_url, ''), public.zone_points_of_interest.image_url),
           verified = public.zone_points_of_interest.verified or excluded.verified
         returning id, name, category, description_short, description_long, latitude, longitude,
                   image_url, source, external_ref, verified, created_at, updated_at`,
        [
          clean(poi.name), clean(poi.category) || "otro", nullableText(poi.descriptionShort),
          nullableText(poi.descriptionLong), roundCoordinate(poi.latitude), roundCoordinate(poi.longitude),
          nullableText(poi.imageUrl), clean(poi.source) || "osm", nullableText(poi.externalRef), poi.verified === true
        ]
      );
      stored.push(normalizePoiRow(result.rows[0]));
    }
    return stored;
  });
}

export async function updateZonePoiDescription(poiId, description = {}) {
  return withClient(async (client) => {
    const result = await client.query(
      `update public.zone_points_of_interest
       set description_short = $2,
           description_long = $3,
           image_url = case when $7::boolean then null else coalesce(nullif($4, ''), image_url) end,
           source = coalesce(nullif($5, ''), source),
           external_ref = coalesce(nullif($6, ''), external_ref)
       where id = $1::uuid
       returning id, name, category, description_short, description_long, latitude, longitude,
                 image_url, source, external_ref, verified, created_at, updated_at`,
      [
        clean(poiId), nullableText(description.descriptionShort), nullableText(description.descriptionLong),
        clean(description.imageUrl), clean(description.source), clean(description.externalRef), description.clearImage === true
      ]
    );
    return result.rows[0] ? normalizePoiRow(result.rows[0]) : null;
  });
}

export async function upsertBusinessConnections(connections = []) {
  if (!Array.isArray(connections) || !connections.length) return [];
  return withTransaction(async (client) => {
    const stored = [];
    for (const connection of connections) {
      const result = await client.query(
        `insert into public.business_connections
          (business_a_id, business_b_id, connection_type, affinity_score, distance_meters)
         values ($1, $2, $3, $4, $5)
         on conflict (business_a_id, business_b_id) do update set
           connection_type = excluded.connection_type,
           affinity_score = excluded.affinity_score,
           distance_meters = excluded.distance_meters
         returning id, business_a_id, business_b_id, connection_type, affinity_score,
                   distance_meters, clicks_generated, created_at, updated_at`,
        [
          clean(connection.businessAId), clean(connection.businessBId), clean(connection.connectionType),
          Number(connection.affinityScore || 0), Math.max(0, Math.round(Number(connection.distanceMeters || 0)))
        ]
      );
      stored.push(normalizeConnectionRow(result.rows[0]));
    }
    return stored;
  });
}

export async function pruneBusinessConnections(businessId, targetBusinessIds = []) {
  const ids = uniqueText(targetBusinessIds);
  return withClient(async (client) => {
    const result = ids.length
      ? await client.query(
          `delete from public.business_connections
           where business_a_id = $1 and not (business_b_id = any($2::text[]))`,
          [clean(businessId), ids]
        )
      : await client.query(
          `delete from public.business_connections where business_a_id = $1`,
          [clean(businessId)]
        );
    return Number(result.rowCount || 0);
  });
}

export async function listBusinessConnections(businessId) {
  return withClient(async (client) => {
    const result = await client.query(
      `select c.id, c.business_a_id, c.business_b_id, c.connection_type, c.affinity_score,
              c.distance_meters, c.clicks_generated, c.created_at, c.updated_at,
              b.slug as target_slug, b.data as target_data,
              s.is_enabled as target_zone_enabled
       from public.business_connections c
       join public.locallift_businesses b on b.id = c.business_b_id
       left join public.zone_discovery_settings s on s.business_id = c.business_b_id
       where c.business_a_id = $1
       order by c.affinity_score desc, c.distance_meters asc`,
      [clean(businessId)]
    );
    return result.rows.map((row) => ({
      ...normalizeConnectionRow(row),
      target: normalizeBusinessRow({ id: row.business_b_id, slug: row.target_slug, data: row.target_data }),
      targetZoneEnabled: row.target_zone_enabled === true
    }));
  });
}

export async function insertZoneEvent(input = {}) {
  return withClient(async (client) => {
    const result = await client.query(
      `insert into public.zone_discovery_events
        (host_business_id, event_type, target_business_id, target_poi_id)
       values ($1, $2, $3, $4::uuid)
       returning id, host_business_id, event_type, target_business_id, target_poi_id, created_at`,
      [clean(input.hostBusinessId), clean(input.eventType), nullableText(input.targetBusinessId), nullableUuid(input.targetPoiId)]
    );
    if (clean(input.targetBusinessId) && ["card_clicked", "directions_clicked"].includes(clean(input.eventType))) {
      await client.query(
        `update public.business_connections
         set clicks_generated = clicks_generated + 1
         where business_a_id = $1 and business_b_id = $2`,
        [clean(input.hostBusinessId), clean(input.targetBusinessId)]
      );
    }
    return normalizeEventRow(result.rows[0]);
  });
}

export async function getZoneMetrics(businessId) {
  return withClient(async (client) => {
    const result = await client.query(
      `select
         count(*) filter (
           where host_business_id = $1 and event_type = 'opened'
             and created_at >= date_trunc('week', now())
         )::int as opens_week,
         count(*) filter (
           where host_business_id = $1 and event_type = 'opened'
             and created_at >= date_trunc('month', now())
         )::int as opens_month,
         count(*) filter (
           where target_business_id = $1 and event_type in ('card_clicked', 'directions_clicked')
             and created_at >= date_trunc('week', now())
         )::int as visits_received_week,
         count(*) filter (
           where target_business_id = $1 and event_type in ('card_clicked', 'directions_clicked')
             and created_at >= date_trunc('month', now())
         )::int as visits_received_month
       from public.zone_discovery_events`,
      [clean(businessId)]
    );
    const row = result.rows[0] || {};
    return {
      opensWeek: Number(row.opens_week || 0),
      opensMonth: Number(row.opens_month || 0),
      visitsReceivedWeek: Number(row.visits_received_week || 0),
      visitsReceivedMonth: Number(row.visits_received_month || 0)
    };
  });
}

export async function closeZoneStore() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  poolPromise = null;
  await pool.end();
}

async function withClient(callback) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

async function withTransaction(callback) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const result = await callback(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    }
  });
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = import("pg").then(({ Pool }) => new Pool(postgresConfig()));
  }
  return poolPromise;
}

function postgresConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCALLIFT_DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for Descubre tu zona.");
  const mode = clean(process.env.PGSSLMODE).toLowerCase();
  let ssl = { rejectUnauthorized: false };
  if (["disable", "false", "off", "0"].includes(mode)) ssl = false;
  try {
    if (["localhost", "127.0.0.1", "::1"].includes(new URL(connectionString).hostname)) ssl = false;
  } catch {}
  return {
    connectionString,
    ssl,
    max: clampNumber(process.env.BUSINESS_DB_POOL_MAX, 1, 30, 6),
    connectionTimeoutMillis: clampNumber(process.env.BUSINESS_DB_CONNECT_TIMEOUT_MS, 1000, 60000, 10000)
  };
}

function normalizeBusinessRow(row = {}) {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const content = data.content && typeof data.content === "object" ? data.content : {};
  const coordinates = normalizeCoordinates(data.coordinates || content.coordinates || data.locationCoordinates);
  return {
    ...data,
    id: clean(row.id || data.id),
    slug: clean(row.slug || data.slug),
    name: clean(data.name || content.name),
    category: clean(data.category || content.category || "General"),
    city: clean(data.city || content.location),
    zone: clean(data.zone || content.zone || data.neighborhood || data.city || content.location),
    address: clean(data.address || content.address),
    coordinates
  };
}

function normalizeSettings(row, businessId) {
  return {
    businessId: clean(row?.business_id || businessId),
    isEnabled: row?.is_enabled === true,
    excludedBusinessIds: uniqueText(row?.excluded_business_ids),
    excludedPoiIds: uniqueUuids(row?.excluded_poi_ids),
    radiusMeters: clampNumber(row?.radius_meters, 250, 10000, 1500),
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : ""
  };
}

function normalizePoiRow(row = {}) {
  return {
    id: clean(row.id),
    name: clean(row.name),
    category: clean(row.category),
    descriptionShort: clean(row.description_short),
    descriptionLong: clean(row.description_long),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    imageUrl: clean(row.image_url),
    source: clean(row.source),
    externalRef: clean(row.external_ref),
    verified: row.verified === true,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
  };
}

function normalizeConnectionRow(row = {}) {
  return {
    id: clean(row.id),
    businessAId: clean(row.business_a_id),
    businessBId: clean(row.business_b_id),
    connectionType: clean(row.connection_type),
    affinityScore: Number(row.affinity_score || 0),
    distanceMeters: Number(row.distance_meters || 0),
    clicksGenerated: Number(row.clicks_generated || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
  };
}

function normalizeEventRow(row = {}) {
  return {
    id: clean(row.id),
    hostBusinessId: clean(row.host_business_id),
    eventType: clean(row.event_type),
    targetBusinessId: clean(row.target_business_id),
    targetPoiId: clean(row.target_poi_id),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : ""
  };
}

function normalizeCoordinates(value = {}) {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.lon ?? value?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function uniqueText(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

function uniqueUuids(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)))];
}

function nullableText(value) { return clean(value) || null; }
function nullableUuid(value) { return uniqueUuids([value])[0] || null; }
function roundCoordinate(value) { return Number(Number(value).toFixed(6)); }
function clean(value) { return String(value ?? "").trim(); }
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}
