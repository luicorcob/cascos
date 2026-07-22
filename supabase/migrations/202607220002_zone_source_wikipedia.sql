alter table public.zone_points_of_interest
  drop constraint if exists zone_points_of_interest_source_check;

alter table public.zone_points_of_interest
  add constraint zone_points_of_interest_source_check
  check (source in ('osm', 'wikidata', 'wikipedia', 'manual'));
