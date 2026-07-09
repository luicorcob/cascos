-- DLS Studio - Supabase RLS, fase 2
--
-- Ejecutar en el SQL editor de Supabase despues de crear o migrar las tablas
-- locallift_* usadas por server/lib/business-store.mjs.
--
-- Modelo aplicado:
-- - anon: solo lectura de negocios publicados y de servicios/horarios activos.
-- - authenticated: lectura de sus negocios asignados; escritura limitada por rol.
-- - service_role/backend: operaciones completas desde servidor de confianza.
-- - leads, reservas publicas, eventos, auditoria y recordatorios pasan por backend.

begin;

create table if not exists public.locallift_business_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id text not null,
  role text not null default 'viewer'
    check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

create index if not exists locallift_business_members_business_id_idx
on public.locallift_business_members (business_id);

create or replace function public.locallift_role_rank(role_name text)
returns integer
language sql
immutable
as $$
  select case role_name
    when 'owner' then 40
    when 'admin' then 30
    when 'editor' then 20
    when 'viewer' then 10
    else 0
  end;
$$;

create or replace function public.locallift_is_business_member(
  target_business_id text,
  minimum_role text default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.locallift_business_members members
    where members.business_id = target_business_id
      and members.user_id = (select auth.uid())
      and public.locallift_role_rank(members.role) >= public.locallift_role_rank(minimum_role)
  );
$$;

create or replace function public.locallift_is_public_business(target_business_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.locallift_businesses businesses
    where businesses.id = target_business_id
      and coalesce(businesses.data->>'status', '') = 'published'
  );
$$;

revoke all on function public.locallift_role_rank(text) from public;
revoke all on function public.locallift_is_business_member(text, text) from public;
revoke all on function public.locallift_is_public_business(text) from public;

grant execute on function public.locallift_role_rank(text) to anon, authenticated, service_role;
grant execute on function public.locallift_is_business_member(text, text) to authenticated, service_role;
grant execute on function public.locallift_is_public_business(text) to anon, authenticated, service_role;

alter table public.locallift_business_members enable row level security;
alter table public.locallift_business_members force row level security;

alter table if exists public.locallift_business_meta enable row level security;
alter table if exists public.locallift_business_meta force row level security;
alter table if exists public.locallift_businesses enable row level security;
alter table if exists public.locallift_businesses force row level security;
alter table if exists public.locallift_contacts enable row level security;
alter table if exists public.locallift_contacts force row level security;
alter table if exists public.locallift_activities enable row level security;
alter table if exists public.locallift_activities force row level security;
alter table if exists public.locallift_services enable row level security;
alter table if exists public.locallift_services force row level security;
alter table if exists public.locallift_bookings enable row level security;
alter table if exists public.locallift_bookings force row level security;
alter table if exists public.locallift_availability enable row level security;
alter table if exists public.locallift_availability force row level security;
alter table if exists public.locallift_booking_blocks enable row level security;
alter table if exists public.locallift_booking_blocks force row level security;
alter table if exists public.locallift_booking_reminders enable row level security;
alter table if exists public.locallift_booking_reminders force row level security;
alter table if exists public.locallift_business_events enable row level security;
alter table if exists public.locallift_business_events force row level security;
alter table if exists public.locallift_audit_log enable row level security;
alter table if exists public.locallift_audit_log force row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.locallift_businesses to anon;
grant select on public.locallift_services to anon;
grant select on public.locallift_availability to anon;

grant select on public.locallift_business_members to authenticated;
grant select, update on public.locallift_businesses to authenticated;
grant select, insert, update, delete on public.locallift_contacts to authenticated;
grant select, insert, update, delete on public.locallift_activities to authenticated;
grant select, insert, update, delete on public.locallift_services to authenticated;
grant select, insert, update, delete on public.locallift_bookings to authenticated;
grant select, insert, update, delete on public.locallift_availability to authenticated;
grant select, insert, update, delete on public.locallift_booking_blocks to authenticated;
grant select, insert, update, delete on public.locallift_booking_reminders to authenticated;
grant select on public.locallift_business_events to authenticated;
grant select on public.locallift_audit_log to authenticated;

grant all on public.locallift_business_members to service_role;
grant all on public.locallift_business_meta to service_role;
grant all on public.locallift_businesses to service_role;
grant all on public.locallift_contacts to service_role;
grant all on public.locallift_activities to service_role;
grant all on public.locallift_services to service_role;
grant all on public.locallift_bookings to service_role;
grant all on public.locallift_availability to service_role;
grant all on public.locallift_booking_blocks to service_role;
grant all on public.locallift_booking_reminders to service_role;
grant all on public.locallift_business_events to service_role;
grant all on public.locallift_audit_log to service_role;

drop policy if exists locallift_members_select_own on public.locallift_business_members;
drop policy if exists locallift_members_select_admin on public.locallift_business_members;
drop policy if exists locallift_members_insert_admin on public.locallift_business_members;
drop policy if exists locallift_members_update_admin on public.locallift_business_members;
drop policy if exists locallift_members_delete_admin on public.locallift_business_members;

create policy locallift_members_select_own
on public.locallift_business_members
for select
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy locallift_members_select_admin
on public.locallift_business_members
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

create policy locallift_members_insert_admin
on public.locallift_business_members
for insert
to authenticated
with check (public.locallift_is_business_member(business_id, 'admin'));

create policy locallift_members_update_admin
on public.locallift_business_members
for update
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'))
with check (public.locallift_is_business_member(business_id, 'admin'));

create policy locallift_members_delete_admin
on public.locallift_business_members
for delete
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

drop policy if exists locallift_businesses_select_public on public.locallift_businesses;
drop policy if exists locallift_businesses_select_member on public.locallift_businesses;
drop policy if exists locallift_businesses_update_editor on public.locallift_businesses;
drop policy if exists locallift_businesses_delete_owner on public.locallift_businesses;

create policy locallift_businesses_select_public
on public.locallift_businesses
for select
to anon, authenticated
using (public.locallift_is_public_business(id));

create policy locallift_businesses_select_member
on public.locallift_businesses
for select
to authenticated
using (public.locallift_is_business_member(id, 'viewer'));

create policy locallift_businesses_update_editor
on public.locallift_businesses
for update
to authenticated
using (public.locallift_is_business_member(id, 'editor'))
with check (public.locallift_is_business_member(id, 'editor'));

create policy locallift_businesses_delete_owner
on public.locallift_businesses
for delete
to authenticated
using (public.locallift_is_business_member(id, 'owner'));

drop policy if exists locallift_services_select_public on public.locallift_services;
drop policy if exists locallift_services_select_member on public.locallift_services;
drop policy if exists locallift_services_insert_editor on public.locallift_services;
drop policy if exists locallift_services_update_editor on public.locallift_services;
drop policy if exists locallift_services_delete_admin on public.locallift_services;

create policy locallift_services_select_public
on public.locallift_services
for select
to anon, authenticated
using (
  public.locallift_is_public_business(business_id)
  and coalesce(data->>'active', 'true') <> 'false'
);

create policy locallift_services_select_member
on public.locallift_services
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'viewer'));

create policy locallift_services_insert_editor
on public.locallift_services
for insert
to authenticated
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_services_update_editor
on public.locallift_services
for update
to authenticated
using (public.locallift_is_business_member(business_id, 'editor'))
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_services_delete_admin
on public.locallift_services
for delete
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

drop policy if exists locallift_availability_select_public on public.locallift_availability;
drop policy if exists locallift_availability_select_member on public.locallift_availability;
drop policy if exists locallift_availability_insert_editor on public.locallift_availability;
drop policy if exists locallift_availability_update_editor on public.locallift_availability;
drop policy if exists locallift_availability_delete_admin on public.locallift_availability;

create policy locallift_availability_select_public
on public.locallift_availability
for select
to anon, authenticated
using (
  public.locallift_is_public_business(business_id)
  and coalesce(data->>'active', 'true') <> 'false'
);

create policy locallift_availability_select_member
on public.locallift_availability
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'viewer'));

create policy locallift_availability_insert_editor
on public.locallift_availability
for insert
to authenticated
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_availability_update_editor
on public.locallift_availability
for update
to authenticated
using (public.locallift_is_business_member(business_id, 'editor'))
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_availability_delete_admin
on public.locallift_availability
for delete
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

drop policy if exists locallift_contacts_select_member on public.locallift_contacts;
drop policy if exists locallift_contacts_insert_editor on public.locallift_contacts;
drop policy if exists locallift_contacts_update_editor on public.locallift_contacts;
drop policy if exists locallift_contacts_delete_admin on public.locallift_contacts;

create policy locallift_contacts_select_member
on public.locallift_contacts
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'viewer'));

create policy locallift_contacts_insert_editor
on public.locallift_contacts
for insert
to authenticated
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_contacts_update_editor
on public.locallift_contacts
for update
to authenticated
using (public.locallift_is_business_member(business_id, 'editor'))
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_contacts_delete_admin
on public.locallift_contacts
for delete
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

drop policy if exists locallift_activities_select_member on public.locallift_activities;
drop policy if exists locallift_activities_insert_editor on public.locallift_activities;
drop policy if exists locallift_activities_update_editor on public.locallift_activities;
drop policy if exists locallift_activities_delete_admin on public.locallift_activities;

create policy locallift_activities_select_member
on public.locallift_activities
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'viewer'));

create policy locallift_activities_insert_editor
on public.locallift_activities
for insert
to authenticated
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_activities_update_editor
on public.locallift_activities
for update
to authenticated
using (public.locallift_is_business_member(business_id, 'editor'))
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_activities_delete_admin
on public.locallift_activities
for delete
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

drop policy if exists locallift_bookings_select_member on public.locallift_bookings;
drop policy if exists locallift_bookings_insert_editor on public.locallift_bookings;
drop policy if exists locallift_bookings_update_editor on public.locallift_bookings;
drop policy if exists locallift_bookings_delete_admin on public.locallift_bookings;

create policy locallift_bookings_select_member
on public.locallift_bookings
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'viewer'));

create policy locallift_bookings_insert_editor
on public.locallift_bookings
for insert
to authenticated
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_bookings_update_editor
on public.locallift_bookings
for update
to authenticated
using (public.locallift_is_business_member(business_id, 'editor'))
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_bookings_delete_admin
on public.locallift_bookings
for delete
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

drop policy if exists locallift_booking_blocks_select_member on public.locallift_booking_blocks;
drop policy if exists locallift_booking_blocks_insert_editor on public.locallift_booking_blocks;
drop policy if exists locallift_booking_blocks_update_editor on public.locallift_booking_blocks;
drop policy if exists locallift_booking_blocks_delete_admin on public.locallift_booking_blocks;

create policy locallift_booking_blocks_select_member
on public.locallift_booking_blocks
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'viewer'));

create policy locallift_booking_blocks_insert_editor
on public.locallift_booking_blocks
for insert
to authenticated
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_booking_blocks_update_editor
on public.locallift_booking_blocks
for update
to authenticated
using (public.locallift_is_business_member(business_id, 'editor'))
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_booking_blocks_delete_admin
on public.locallift_booking_blocks
for delete
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

drop policy if exists locallift_booking_reminders_select_member on public.locallift_booking_reminders;
drop policy if exists locallift_booking_reminders_insert_editor on public.locallift_booking_reminders;
drop policy if exists locallift_booking_reminders_update_editor on public.locallift_booking_reminders;
drop policy if exists locallift_booking_reminders_delete_admin on public.locallift_booking_reminders;

create policy locallift_booking_reminders_select_member
on public.locallift_booking_reminders
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'viewer'));

create policy locallift_booking_reminders_insert_editor
on public.locallift_booking_reminders
for insert
to authenticated
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_booking_reminders_update_editor
on public.locallift_booking_reminders
for update
to authenticated
using (public.locallift_is_business_member(business_id, 'editor'))
with check (public.locallift_is_business_member(business_id, 'editor'));

create policy locallift_booking_reminders_delete_admin
on public.locallift_booking_reminders
for delete
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

drop policy if exists locallift_business_events_select_member on public.locallift_business_events;

create policy locallift_business_events_select_member
on public.locallift_business_events
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'viewer'));

drop policy if exists locallift_audit_log_select_admin on public.locallift_audit_log;

create policy locallift_audit_log_select_admin
on public.locallift_audit_log
for select
to authenticated
using (public.locallift_is_business_member(business_id, 'admin'));

commit;

-- Verificacion posterior:
--
-- select
--   c.relname as table_name,
--   c.relrowsecurity as rls_enabled,
--   c.relforcerowsecurity as rls_forced
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relkind = 'r'
--   and c.relname like 'locallift_%'
-- order by c.relname;
--
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename like 'locallift_%'
-- order by tablename, policyname;
