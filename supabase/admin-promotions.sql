begin;
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

commit;
