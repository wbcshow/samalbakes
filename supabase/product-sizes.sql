begin;
alter table public.products add column if not exists sizes jsonb not null default '[]'::jsonb;
alter table public.order_items add column if not exists size_id text;
alter table public.order_items add column if not exists size_label text;
create or replace function public.valid_product_sizes(list jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare s jsonb;ids text[]:=array[]::text[];labels text[]:=array[]::text[];b numeric;
begin
  if jsonb_typeof(list) <> 'array' or jsonb_array_length(list)>30 then return false;end if;
  for s in select * from jsonb_array_elements(list) loop
    if jsonb_typeof(s)<>'object' or coalesce(s->>'id','') !~ '^[a-zA-Z0-9_-]{1,100}$'
      or s->>'id'=any(ids) or nullif(trim(s->>'label'),'') is null or length(s->>'label')>80
      or lower(trim(s->>'label'))=any(labels) or jsonb_typeof(s->'price') is distinct from 'number'
      or (s->>'price')::numeric<0 or (s->>'price')::numeric>9999999999.99
      or round((s->>'price')::numeric,2)<>(s->>'price')::numeric then return false;end if;
    if s->>'bake_time_minutes' is not null then
      b:=(s->>'bake_time_minutes')::numeric;
      if b<0 or b>10080 or b<>trunc(b) then return false;end if;
    end if;
    ids:=array_append(ids,s->>'id');labels:=array_append(labels,lower(trim(s->>'label')));
  end loop;
  return true;
exception when others then return false;
end;$$;
do $begin
  if not exists(select 1 from pg_constraint where conrelid='public.products'::regclass and conname='products_sizes_valid') then
    alter table public.products add constraint products_sizes_valid check(public.valid_product_sizes(sizes));
  end if;
end;$;
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
  v_size jsonb;
  v_size_id text;
  v_unit_price numeric(12,2);
  v_bake int;
  v_name text;
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
    v_size := null;
    v_size_id := nullif(v_item->>'size_id','');
    v_unit_price := v_prod.price;
    v_bake := v_prod.bake_time_minutes;
    v_name := v_prod.name;
    if jsonb_array_length(v_prod.sizes)>0 then
      select s into v_size from jsonb_array_elements(v_prod.sizes) s where s->>'id'=v_size_id;
      if v_size is null then raise exception 'Choose an available size for %.',v_prod.name;end if;
      v_unit_price := (v_size->>'price')::numeric;
      v_bake := coalesce((v_size->>'bake_time_minutes')::int,v_prod.bake_time_minutes);
      v_name := v_prod.name || ' — ' || (v_size->>'label');
    elsif v_size_id is not null then
      raise exception 'This size is no longer available.';
    end if;
    v_line := round(v_unit_price * v_qty, 2);
    v_subtotal := v_subtotal + v_line;
    insert into public.order_items (
      order_id, product_id, product_name, unit_price, qty, line_total,
      bake_time_minutes, slots, size_id, size_label
    ) values (
      v_order_id, v_prod.id, v_name, v_unit_price, v_qty, v_line,
      v_bake, v_prod.slots, v_size_id, v_size->>'label'
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

commit;
