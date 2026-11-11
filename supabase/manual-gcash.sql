-- Apply after product sizes, tasting requests and accepted-order confirmations.
-- Wrap the existing pricing function so all current pricing/partner rules survive.
begin;
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists payment_verified_at timestamptz;
alter table public.orders add column if not exists payment_verified_by uuid references auth.users(id);
alter table public.orders drop constraint if exists orders_payment_state;
alter table public.orders add constraint orders_payment_state check (
  (payment_method='cod' and payment_status='unpaid' and payment_verified_at is null and payment_verified_by is null)
  or (payment_method='gcash' and (
    (payment_status='awaiting_verification' and payment_verified_at is null and payment_verified_by is null)
    or (payment_status='paid' and payment_verified_at is not null and payment_verified_by is not null))));

create or replace function public.place_order_with_payment(
  p_items jsonb, p_payment_method text,
  p_promo_code text default null, p_guest_name text default null,
  p_guest_email text default null, p_guest_phone text default null,
  p_delivery_address text default null, p_notes text default null,
  p_distance_km double precision default null,
  p_estimated_ready_at timestamptz default null, p_estimated_delivery_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare order_id uuid; saved public.orders;
begin
  if p_payment_method is null or p_payment_method not in ('cod','gcash') then raise exception 'Choose Cash on Delivery or GCash'; end if;
  order_id:=public.place_order(p_items,p_promo_code,p_guest_name,p_guest_email,p_guest_phone,
    p_delivery_address,p_notes,p_distance_km,p_estimated_ready_at,p_estimated_delivery_at);
  update public.orders set payment_method=p_payment_method,
    payment_status=case when p_payment_method='gcash' then 'awaiting_verification' else 'unpaid' end
    where id=order_id returning * into saved;
  -- Guests receive only their new order's reference, server total and payment state.
  return jsonb_build_object('id',saved.id,'total',saved.total,'payment_method',saved.payment_method,'payment_status',saved.payment_status);
end $$;
revoke all on function public.place_order_with_payment(jsonb,text,text,text,text,text,text,text,double precision,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.place_order_with_payment(jsonb,text,text,text,text,text,text,text,double precision,timestamptz,timestamptz) to anon,authenticated;

-- Use the existing admin-only UPDATE policy, with an explicit authorization check.
grant update(payment_status,payment_verified_at,payment_verified_by) on public.orders to authenticated;
create or replace function public.verify_gcash_payment(p_order_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.orders;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin access required'; end if;
  update public.orders set payment_status='paid',payment_verified_at=clock_timestamp(),payment_verified_by=auth.uid(),updated_at=clock_timestamp()
    where id=p_order_id and payment_method='gcash' and payment_status='awaiting_verification'
    and updated_at is not distinct from p_expected_updated_at returning * into saved;
  if not found then raise exception 'This order has changed. Refresh and check its payment before trying again'; end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.verify_gcash_payment(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.verify_gcash_payment(uuid,timestamptz) to authenticated;
create or replace function bakery_private.send_order_emails() returns void
language plpgsql security definer set search_path='' as $$
declare
  notification record;
  response record;
  api_key text;
  email_body jsonb;
  order_text text;
  request bigint;
begin
  -- Avoid overlapping invocations.
  if not pg_try_advisory_xact_lock(722609061) then return; end if;
  -- Reconcile responses even when new sends have been disabled.
  for notification in select * from public.order_email_outbox where state='sending' loop
    select * into response from net._http_response where id=notification.request_id;
    if found and response.status_code between 200 and 299 then
      update public.order_email_outbox set state='accepted',detail='Email service accepted this alert.' where id=notification.id;
    elsif found or notification.last_attempt_at < now()-interval '5 minutes' then
      update public.order_email_outbox set
        state=case when attempts>=3 then 'failed' else 'pending' end,
        detail=case when response.status_code is not null then 'Email service returned HTTP '||response.status_code::text else 'No confirmation received from email service.' end
      where id=notification.id;
    end if;
  end loop;
  if not exists(select 1 from public.order_email_settings where id=1 and enabled) then
    update public.order_email_outbox set state='cancelled',detail='Email alerts were turned off.' where state='pending';
    return;
  end if;
  select decrypted_secret into api_key from vault.decrypted_secrets where name='order_email_resend_api_key' limit 1;
  if api_key is null or api_key='' then return; end if;
  for notification in select * from public.order_email_outbox
    where state='pending' and (last_attempt_at is null or last_attempt_at < now()-interval '5 minutes')
    order by created_at limit 20 for update skip locked loop
    -- Resend remembers idempotency keys for 24h. Never retry beyond that window.
    if notification.first_attempt_at < now()-interval '23 hours' then
      update public.order_email_outbox set state='failed',detail='Retry window expired. Check the email service before resending manually.' where id=notification.id;
      continue;
    end if;
    email_body:=notification.payload;
    if email_body is null then
      select 'New SamalBakes order: '||left(o.id::text,8)||E'\nPlaced: '||
        to_char(o.created_at at time zone 'Asia/Manila','Dy, Mon DD, YYYY HH12:MI AM')||E' (Philippine time)\n\n'||
        coalesce((select string_agg(i.product_name||' x '||i.qty||' = PHP '||i.line_total,E'\n' order by i.product_name) from public.order_items i where i.order_id=o.id),'No item details')||
        E'\n\nSubtotal: PHP '||o.subtotal||E'\nDiscount: PHP '||o.discount||E'\nDelivery: PHP '||o.delivery_fee||E'\nTotal: PHP '||o.total||
        E'\nPayment: '||case when o.payment_method='gcash' then 'GCash - '||replace(o.payment_status,'_',' ') else 'Cash on Delivery' end||E'\nCustomer: '||coalesce(o.guest_name,'')||E'\nPhone: '||coalesce(o.guest_phone,'')||
        E'\nEmail: '||coalesce(o.guest_email,'')||E'\nDelivery location:\n'||coalesce(o.delivery_address,'')||E'\nInstructions: '||coalesce(o.notes,'')||
        E'\nEstimated ready: '||coalesce(to_char(o.estimated_ready_at at time zone 'Asia/Manila','Dy, Mon DD HH12:MI AM'),'Not estimated')||
        E'\n\nManage orders: https://samalbakes.com/admin.html#orders'
      into order_text from public.orders o where o.id=notification.order_id;
      email_body:=jsonb_build_object('from','SamalBakes <'||notification.sender||'>','to',jsonb_build_array(notification.recipient),
        'subject','New SamalBakes order '||left(notification.order_id::text,8),'text',order_text);
    end if;
    request:=net.http_post(url:='https://api.resend.com/emails',body:=email_body,
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||api_key,'Idempotency-Key',case when notification.event_key='new_order' then 'order-email/'||notification.order_id::text else 'order-update/'||notification.id::text end),timeout_milliseconds:=10000);
    update public.order_email_outbox set state='sending',payload=email_body,request_id=request,attempts=attempts+1,
      first_attempt_at=coalesce(first_attempt_at,now()),last_attempt_at=now(),detail='Sending to email service.' where id=notification.id;
  end loop;
end $$;
create or replace function bakery_private.queue_customer_confirmation() returns trigger
language plpgsql security definer set search_path='' as $$
declare config public.order_email_settings; email_body jsonb; subject_text text; message_text text;
begin
  if new.status in ('new','cancelled','delivered') then return new; end if;
  if not ((old.status='new' and new.status='accepted') or new.confirmed_ready_at is distinct from old.confirmed_ready_at or new.confirmed_ready_note is distinct from old.confirmed_ready_note) then return new; end if;
  if new.confirmed_ready_at is null or coalesce(new.guest_email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return new; end if;
  select * into config from public.order_email_settings where id=1 and enabled;
  if not found then return new; end if;
  subject_text:=case when old.status='new' then 'Your SamalBakes order is accepted' else 'Your SamalBakes ready time was updated' end;
  message_text:=subject_text||E'.\n\nOrder reference: '||left(new.id::text,8)||E'\nConfirmed ready: '||
    to_char(new.confirmed_ready_at at time zone 'Asia/Manila','Dy, Mon DD, YYYY HH12:MI AM')||E' (Philippine time)\n'||
    case when coalesce(new.confirmed_ready_note,'')<>'' then E'Note from the bakery: '||new.confirmed_ready_note||E'\n' else '' end||
    E'\nThis is the ready time at the bakery, not the delivery arrival time.\nPayment: '||case when new.payment_method='gcash' then 'GCash - '||replace(new.payment_status,'_',' ') else 'Cash on Delivery' end||E'\n\nIf you have an account, view your order at https://samalbakes.com/my-orders.html';
  email_body:=jsonb_build_object('from','SamalBakes <'||config.sender||'>','to',jsonb_build_array(new.guest_email),'subject',subject_text||' - '||left(new.id::text,8),'text',message_text);
  insert into public.order_email_outbox(order_id,event_key,recipient,sender,payload)
    values(new.id,'confirmation/'||gen_random_uuid()::text,new.guest_email,config.sender,email_body);
  return new;
end $$;
commit;
