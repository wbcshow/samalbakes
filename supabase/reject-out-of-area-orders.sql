-- Reject orders whose measured distance is outside the delivery radius.
-- Safe to re-run. Run once in the Supabase SQL editor:
--   supabase/reject-out-of-area-orders.sql
--
-- A null distance is still accepted. Picking an in-area place from the
-- area list does not produce a kilometer measurement, so the database
-- cannot tell that apart from a missing check. The storefront blocks
-- checkout until the check is inside the area.

-- place_order: server-side totals from products + settings (prevents price tampering)
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

  -- Simple promo mirrors of static site (optional)
  v_code := upper(trim(coalesce(p_promo_code, '')));
  if v_code = 'SAMALWELCOME' then
    v_discount := round(v_subtotal * 0.10, 2);
  elsif v_code = 'RESORT50' and v_subtotal >= 800 then
    v_discount := 50;
  end if;

  -- Delivery fee from settings
  if v_subtotal - v_discount >= v_settings.free_delivery_min_order then
    v_delivery_fee := 0;
  elsif v_settings.delivery_fee_type = 'flat' then
    v_delivery_fee := v_settings.delivery_fee_flat;
  elsif v_settings.delivery_fee_type = 'per_km' then
    v_delivery_fee := round(coalesce(p_distance_km, 0) * v_settings.delivery_fee_per_km, 2);
  else -- flat_plus_per_km
    v_delivery_fee := round(
      v_settings.delivery_fee_flat + coalesce(p_distance_km, 0) * v_settings.delivery_fee_per_km,
      2
    );
  end if;

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
