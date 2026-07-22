-- Descubre tu zona
-- DLS stores businesses in public.locallift_businesses with TEXT identifiers.
-- The four module tables otherwise preserve the closed schema from the plan.

create extension if not exists pgcrypto;

create table if not exists public.zone_points_of_interest (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('monumento', 'naturaleza', 'cultura', 'mirador', 'plaza', 'playa', 'parque', 'otro')),
  description_short text,
  description_long text,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  image_url text,
  source text check (source in ('osm', 'wikidata', 'wikipedia', 'manual')),
  external_ref text,
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.business_connections (
  id uuid primary key default gen_random_uuid(),
  business_a_id text not null references public.locallift_businesses(id) on delete cascade,
  business_b_id text not null references public.locallift_businesses(id) on delete cascade,
  connection_type text not null check (connection_type in ('complementario', 'competidor', 'neutro')),
  affinity_score numeric(5,2) not null default 0 check (affinity_score between 0 and 100),
  distance_meters integer not null check (distance_meters >= 0),
  clicks_generated integer default 0 check (clicks_generated >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (business_a_id, business_b_id),
  check (business_a_id <> business_b_id)
);

create table if not exists public.zone_discovery_settings (
  business_id text primary key references public.locallift_businesses(id) on delete cascade,
  is_enabled boolean default false,
  excluded_business_ids text[] default '{}',
  excluded_poi_ids uuid[] default '{}',
  radius_meters integer default 1500 check (radius_meters between 250 and 10000),
  updated_at timestamptz default now()
);

create table if not exists public.zone_discovery_events (
  id uuid primary key default gen_random_uuid(),
  host_business_id text not null references public.locallift_businesses(id) on delete cascade,
  event_type text not null check (event_type in ('opened', 'card_clicked', 'directions_clicked')),
  target_business_id text references public.locallift_businesses(id) on delete set null,
  target_poi_id uuid references public.zone_points_of_interest(id) on delete set null,
  created_at timestamptz default now(),
  check (not (target_business_id is not null and target_poi_id is not null))
);

create unique index if not exists zone_poi_external_ref_unique
  on public.zone_points_of_interest (source, external_ref)
  where external_ref is not null and external_ref <> '';
create index if not exists zone_poi_coordinates_idx
  on public.zone_points_of_interest (latitude, longitude);
create index if not exists business_connections_host_score_idx
  on public.business_connections (business_a_id, affinity_score desc);
create index if not exists zone_discovery_events_host_created_idx
  on public.zone_discovery_events (host_business_id, created_at desc);
create index if not exists zone_discovery_events_target_created_idx
  on public.zone_discovery_events (target_business_id, created_at desc)
  where target_business_id is not null;

create or replace function public.set_zone_discovery_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists zone_poi_updated_at on public.zone_points_of_interest;
create trigger zone_poi_updated_at
before update on public.zone_points_of_interest
for each row execute function public.set_zone_discovery_updated_at();

drop trigger if exists business_connections_updated_at on public.business_connections;
create trigger business_connections_updated_at
before update on public.business_connections
for each row execute function public.set_zone_discovery_updated_at();

drop trigger if exists zone_discovery_settings_updated_at on public.zone_discovery_settings;
create trigger zone_discovery_settings_updated_at
before update on public.zone_discovery_settings
for each row execute function public.set_zone_discovery_updated_at();

alter table public.zone_points_of_interest enable row level security;
alter table public.business_connections enable row level security;
alter table public.zone_discovery_settings enable row level security;
alter table public.zone_discovery_events enable row level security;

drop policy if exists "zone pois are publicly readable" on public.zone_points_of_interest;
create policy "zone pois are publicly readable"
on public.zone_points_of_interest for select
to anon, authenticated
using (true);

drop policy if exists "zone connections are publicly readable" on public.business_connections;
create policy "zone connections are publicly readable"
on public.business_connections for select
to anon, authenticated
using (true);

drop policy if exists "business reads own zone settings" on public.zone_discovery_settings;
create policy "business reads own zone settings"
on public.zone_discovery_settings for select
to authenticated
using (
  business_id = coalesce(
    auth.jwt() ->> 'business_id',
    auth.jwt() -> 'app_metadata' ->> 'business_id'
  )
);

drop policy if exists "business inserts own zone settings" on public.zone_discovery_settings;
create policy "business inserts own zone settings"
on public.zone_discovery_settings for insert
to authenticated
with check (
  business_id = coalesce(
    auth.jwt() ->> 'business_id',
    auth.jwt() -> 'app_metadata' ->> 'business_id'
  )
);

drop policy if exists "business updates own zone settings" on public.zone_discovery_settings;
create policy "business updates own zone settings"
on public.zone_discovery_settings for update
to authenticated
using (
  business_id = coalesce(
    auth.jwt() ->> 'business_id',
    auth.jwt() -> 'app_metadata' ->> 'business_id'
  )
)
with check (
  business_id = coalesce(
    auth.jwt() ->> 'business_id',
    auth.jwt() -> 'app_metadata' ->> 'business_id'
  )
);

grant select on public.zone_points_of_interest, public.business_connections to anon, authenticated;
grant select, insert, update on public.zone_discovery_settings to authenticated;
revoke insert, update, delete on public.zone_points_of_interest, public.business_connections from anon, authenticated;
revoke all on public.zone_discovery_events from anon, authenticated;
