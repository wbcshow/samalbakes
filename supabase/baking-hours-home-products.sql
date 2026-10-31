-- Apply after approval. Existing schedules and home-page selections are preserved.
begin;
alter table public.settings add column if not exists featured_product_ids text[];

create or replace function public.valid_baking_hours(p_hours jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  day_index integer;
  h jsonb;
  open_days integer := 0;
begin
  if jsonb_typeof(p_hours) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_hours)) <> 7 then return false; end if;
  for day_index in 0..6 loop
    h := p_hours -> day_index::text;
    if h is null then return false; end if;
    if h = 'null'::jsonb then continue; end if;
    if jsonb_typeof(h) <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(h)) <> 2 then return false; end if;
    if coalesce(h->>'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(h->>'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or h->>'open' >= h->>'close' then return false; end if;
    open_days := open_days + 1;
  end loop;
  return open_days > 0;
end;
$$;

alter table public.settings drop constraint if exists settings_baking_hours_valid;
alter table public.settings add constraint settings_baking_hours_valid
  check (public.valid_baking_hours(working_hours));
alter table public.settings drop constraint if exists settings_featured_products_valid;
alter table public.settings add constraint settings_featured_products_valid check (
  featured_product_ids is null or (
    cardinality(featured_product_ids) = 3
    and array_ndims(featured_product_ids) = 1 and array_lower(featured_product_ids, 1) = 1
    and featured_product_ids[1] is not null and trim(featured_product_ids[1]) <> ''
    and featured_product_ids[2] is not null and trim(featured_product_ids[2]) <> ''
    and featured_product_ids[3] is not null and trim(featured_product_ids[3]) <> ''
    and featured_product_ids[1] <> featured_product_ids[2]
    and featured_product_ids[1] <> featured_product_ids[3]
    and featured_product_ids[2] <> featured_product_ids[3]
  )
);
commit;
