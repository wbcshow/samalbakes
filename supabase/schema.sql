-- SamalBakes.com — Supabase schema
-- Run in Supabase SQL Editor (or supabase db push) after creating a project.
-- Requires: Auth enabled (email/password; magic link optional).

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  delivery_address text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger function: not callable from the API. Already applied on the live project.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Products
create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  bake_time_minutes int not null default 30 check (bake_time_minutes >= 0),
  prep_minutes int not null default 0 check (prep_minutes >= 0),
  min_lead_minutes int not null default 60 check (min_lead_minutes >= 0),
  slots int not null default 1 check (slots >= 1),
  category text not null default 'Breads',
  wholesale_note text,
  image_url text not null default '',
  photo_real boolean not null default false,
  active boolean not null default true,
  example boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

-- Migrations for existing projects:
-- alter table public.products add column if not exists image_url text not null default '';
-- alter table public.products add column if not exists photo_real boolean not null default false;
-- Delivery address for accounts created before that column: supabase/profile-delivery-address.sql

-- Site settings (single row id = 1)
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  delivery_center_lat double precision not null default 7.1280,
  delivery_center_lng double precision not null default 125.6930,
  delivery_radius_km double precision not null default 25,
  delivery_fee_type text not null default 'flat'
    check (delivery_fee_type in ('flat', 'per_km', 'flat_plus_per_km')),
  delivery_fee_flat numeric(12,2) not null default 80,
  delivery_fee_per_km numeric(12,2) not null default 15,
  free_delivery_min_order numeric(12,2) not null default 1500,
  packing_buffer_minutes int not null default 15,
  delivery_buffer_minutes int not null default 30,
  oven_batch_slots int not null default 12,
  allow_mixed_batches boolean not null default true,
  global_min_lead_minutes int not null default 60,
  working_hours jsonb not null default '{
    "0": null,
    "1": {"open":"08:00","close":"18:00"},
    "2": {"open":"08:00","close":"18:00"},
    "3": {"open":"08:00","close":"18:00"},
    "4": {"open":"08:00","close":"18:00"},
    "5": {"open":"08:00","close":"18:00"},
    "6": {"open":"08:00","close":"16:00"}
  }'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Baking hours and home-page product selection
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

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  guest_name text,
  guest_email text,
  guest_phone text,
  status text not null default 'new'
    check (status in ('new','baking','ready','out_for_delivery','delivered','cancelled')),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null default 'cod',
  promo_code text,
  estimated_ready_at timestamptz,
  estimated_delivery_at timestamptz,
  delivery_address text,
  notes text,
  distance_km double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text references public.products (id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  qty int not null check (qty > 0),
  line_total numeric(12,2) not null,
  bake_time_minutes int,
  slots int
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- Helper: is current user admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.normalize_customer_phone(p_phone text)
returns text language sql immutable set search_path = public as $$
  select case
    when digits ~ '^09[0-9]{9}$' then '63' || substr(digits, 2)
    when digits ~ '^9[0-9]{9}$' then '63' || digits
    when digits ~ '^00639[0-9]{9}$' then substr(digits, 3)
    else nullif(digits, '')
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as digits) n;
$$;

-- place_order: server-side totals from products + settings (prevents price tampering)
alter table public.settings add column if not exists promotions jsonb not null default '[{"id":"welcome10","code":"SAMALWELCOME","title":"First-order welcome","description":"10% off your first online order. First orders only, one per customer. Use code SAMALWELCOME at checkout.","type":"percent","percentOff":10,"audience":"new customers","active":true,"minSubtotal":0,"startsAt":null,"endsAt":null},{"id":"free-del","code":"FREESHIP1500","title":"Free delivery over ₱1,500","description":"Orders of ₱1,500 or more qualify for free delivery within our area.","type":"free_delivery","minSubtotal":1500,"audience":"everyone","active":true,"startsAt":null,"endsAt":null},{"id":"cafe-wholesale","code":null,"title":"Coffee shop & resort wholesale","description":"Standing orders and wholesale pricing for cafés and resorts on Samal & Davao. Message us for a custom quote.","type":"info","audience":"B2B","active":true,"minSubtotal":0,"startsAt":null,"endsAt":null},{"id":"tasting-box","code":"TASTEBOX","title":"Free tasting box for businesses","description":"New café or resort partners: request a complimentary tasting box (subject to availability). Mention TASTEBOX when you message us.","type":"info","audience":"B2B","active":true,"minSubtotal":0,"startsAt":null,"endsAt":null},{"id":"resort50","code":"RESORT50","title":"Resort partner intro","description":"₱50 off orders ₱800+ for verified resort / hotel partners. Use code RESORT50.","type":"fixed","amountOff":50,"minSubtotal":800,"audience":"resorts","active":true,"startsAt":null,"endsAt":null}]'::jsonb;
create or replace function public.valid_promotions(list jsonb) returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare p jsonb;codes text[]:=array[]::text[];c text;t text;
begin
if jsonb_typeof(list)<>'array' or jsonb_array_length(list)>100 then return false;end if;
for p in select * from jsonb_array_elements(list) loop
 c:=upper(trim(coalesce(p->>'code','')));t:=p->>'type';
 if jsonb_typeof(p)<>'object' or nullif(trim(p->>'title'),'') is null or t is null or t not in ('percent','fixed','free_delivery','info') or jsonb_typeof(p->'active') is distinct from 'boolean' then return false;end if;
 if (t<>'info' and c='') or (c<>'' and (c !~ '^[A-Z0-9_-]{1,40}$' or c=any(codes))) then return false;end if;
 if c<>'' then codes:=array_append(codes,c);end if;
 if coalesce((p->>'minSubtotal')::numeric,0)<0 then return false;end if;
 if t='percent' and (coalesce((p->>'percentOff')::numeric,0)<=0 or (p->>'percentOff')::numeric>100) then return false;end if;
 if t='fixed' and coalesce((p->>'amountOff')::numeric,0)<=0 then return false;end if;
 if nullif(p->>'startsAt','')::timestamptz >= nullif(p->>'endsAt','')::timestamptz then return false;end if;
end loop;return true;
exception when others then return false;
end;$$;
alter table public.settings drop constraint if exists settings_promotions_valid;
alter table public.settings add constraint settings_promotions_valid check(public.valid_promotions(promotions));
create or replace function public.place_order(
  p_items jsonb,               -- [{"product_id":"…","qty":2},…]
  p_promo_code text default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_delivery_address text default null,
  p_notes text default null,
  p_distance_km double precision default null,
  p_estimated_ready_at timestamptz default null,
  p_estimated_delivery_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_total numeric(12,2);
  v_settings public.settings%rowtype;
  v_item jsonb;
  v_prod public.products%rowtype;
  v_qty int;
  v_line numeric(12,2);
  v_code text;
  v_email text;
  v_phone text;
  v_auth_email text;
  v_promo jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must include at least one item';
  end if;

  select * into v_settings from public.settings where id = 1;
  if not found then
    raise exception 'Settings missing';
  end if;

  -- A measured distance past the delivery radius cannot be ordered.
  -- A null distance is allowed: an in-area choice from the area list has no kilometers.
  if p_distance_km is not null and p_distance_km > v_settings.delivery_radius_km then
    raise exception 'That location is outside our delivery area';
  end if;

  -- Serialize order creation so concurrent checkouts cannot both claim a first order.
  -- Every order takes this lock, including orders without a promotion.
  lock table public.orders in share row exclusive mode;
  v_code := upper(trim(coalesce(p_promo_code, '')));
  if v_code <> '' then
    select p into v_promo from jsonb_array_elements(v_settings.promotions) p where upper(p->>'code')=v_code;
    if v_promo is null or not (v_promo->>'active')::boolean or v_promo->>'type'='info'
      or (nullif(v_promo->>'startsAt','')::timestamptz > now())
      or (nullif(v_promo->>'endsAt','')::timestamptz <= now()) then raise exception 'This promotion is unavailable.';end if;
  end if;
  if v_code = 'SAMALWELCOME' then
    select lower(trim(email)) into v_auth_email from auth.users where id = auth.uid();
    v_email := nullif(lower(trim(coalesce(p_guest_email, ''))), '');
    v_phone := public.normalize_customer_phone(p_guest_phone);
    if auth.uid() is null and v_email is null and v_phone is null then
      raise exception 'Enter an email or phone number to use SAMALWELCOME on your first order.';
    end if;
    if exists (
      select 1 from public.orders o
      left join auth.users u on u.id = o.user_id
      where (auth.uid() is not null and o.user_id = auth.uid())
        or (v_email is not null and
          (lower(trim(o.guest_email)) = v_email or lower(trim(u.email)) = v_email))
        or (v_auth_email is not null and
          (lower(trim(o.guest_email)) = v_auth_email or lower(trim(u.email)) = v_auth_email))
        or (v_phone is not null and public.normalize_customer_phone(o.guest_phone) = v_phone)
    ) then
      raise exception 'SAMALWELCOME is for first orders only, one per customer. Please remove the code to continue.';
    end if;
  end if;

  -- Create order shell
  insert into public.orders (
    user_id, guest_name, guest_email, guest_phone,
    status, payment_method, promo_code,
    delivery_address, notes, distance_km,
    estimated_ready_at, estimated_delivery_at
  ) values (
    auth.uid(), p_guest_name, p_guest_email, p_guest_phone,
    'new', 'cod', nullif(trim(coalesce(p_promo_code,'')), ''),
    p_delivery_address, p_notes, p_distance_km,
    p_estimated_ready_at, p_estimated_delivery_at
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 then
      raise exception 'Invalid qty';
    end if;
    select * into v_prod from public.products
      where id = v_item->>'product_id' and active = true;
    if not found then
      raise exception 'Unknown or inactive product: %', v_item->>'product_id';
    end if;
    v_line := round(v_prod.price * v_qty, 2);
    v_subtotal := v_subtotal + v_line;
    insert into public.order_items (
      order_id, product_id, product_name, unit_price, qty, line_total,
      bake_time_minutes, slots
    ) values (
      v_order_id, v_prod.id, v_prod.name, v_prod.price, v_qty, v_line,
      v_prod.bake_time_minutes, v_prod.slots
    );
  end loop;

  if v_promo is not null then
    if v_subtotal < coalesce((v_promo->>'minSubtotal')::numeric,0) then raise exception 'Promotion minimum order has not been met.';end if;
    if v_promo->>'type'='percent' then v_discount:=round(v_subtotal*(v_promo->>'percentOff')::numeric/100,2);
    elsif v_promo->>'type'='fixed' then v_discount:=(v_promo->>'amountOff')::numeric;end if;
    v_discount:=least(v_subtotal,v_discount);
  end if;

  -- Delivery fee from settings
  if v_subtotal - v_discount >= v_settings.free_delivery_min_order then
    v_delivery_fee := 0;
  elsif v_settings.delivery_fee_type = 'flat' then
    v_delivery_fee := v_settings.delivery_fee_flat;
  elsif v_settings.delivery_fee_type = 'per_km' then
    v_delivery_fee := round(coalesce(p_distance_km, 0)::numeric * v_settings.delivery_fee_per_km, 2);
  else -- flat_plus_per_km
    v_delivery_fee := round(
      v_settings.delivery_fee_flat + coalesce(p_distance_km, 0)::numeric * v_settings.delivery_fee_per_km,
      2
    );
  end if;

  if v_promo->>'type'='free_delivery' then v_delivery_fee:=0;end if;

  v_total := greatest(0, v_subtotal - v_discount) + v_delivery_fee;

  update public.orders set
    subtotal = v_subtotal,
    discount = v_discount,
    delivery_fee = v_delivery_fee,
    total = v_total,
    promo_code = nullif(v_code, ''),
    updated_at = now()
  where id = v_order_id;

  return v_order_id;
end;
$$;

grant execute on function public.place_order to anon, authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles
create policy profiles_select_own_or_admin on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from public.profiles p where p.id = auth.uid()));
-- Admins can update any profile (e.g. grant admin carefully via SQL recommended)
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin());

-- Products: anyone can read active; admins read all; only admins write
create policy products_select_active on public.products
  for select using (active = true or public.is_admin());
create policy products_admin_insert on public.products
  for insert with check (public.is_admin());
create policy products_admin_update on public.products
  for update using (public.is_admin());
create policy products_admin_delete on public.products
  for delete using (public.is_admin());

-- Settings: public read; admin write
create policy settings_select_all on public.settings
  for select using (true);
create policy settings_admin_update on public.settings
  for update using (public.is_admin());

-- Orders: customers see own; guests cannot re-read via RLS (they get id from place_order);
-- admins see all. Inserts go through place_order (security definer).
create policy orders_select_own on public.orders
  for select using (auth.uid() = user_id or public.is_admin());
create policy orders_admin_update on public.orders
  for update using (public.is_admin());

create policy order_items_select on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- No direct inserts into orders/order_items for clients (use place_order)
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
grant select on public.orders to anon, authenticated;
grant select on public.order_items to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.settings to anon, authenticated;
grant select, update on public.profiles to authenticated;
