-- Install once in Supabase SQL Editor. Alerts remain OFF until configured.
create extension if not exists pg_net;
create extension if not exists pg_cron;
-- Network queues contain authorization headers. Only the private worker may
-- access them; clients must not read credentials or make arbitrary requests.
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all sequences in schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
create schema if not exists bakery_private;
revoke all on schema bakery_private from public, anon, authenticated;

create table if not exists public.order_email_settings (
  id integer primary key check (id=1),
  enabled boolean not null default false,
  recipient text not null check (recipient ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  sender text not null check (sender ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
insert into public.order_email_settings(id,recipient,sender)
values(1,'samalbakes@gmail.com','orders@notify.samalbakes.com') on conflict(id) do nothing;
alter table public.order_email_settings enable row level security;
drop policy if exists order_email_admin on public.order_email_settings;
create policy order_email_admin on public.order_email_settings to authenticated
  using(public.is_admin()) with check(public.is_admin());
revoke all on public.order_email_settings from anon, authenticated;
grant select, update on public.order_email_settings to authenticated;

create table if not exists public.order_email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_key text not null default 'new_order',
  unique(order_id,event_key),
  recipient text not null,
  sender text not null,
  state text not null default 'pending' check(state in ('pending','sending','accepted','failed','cancelled')),
  attempts integer not null default 0,
  request_id bigint,
  payload jsonb,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  detail text
);
alter table public.order_email_outbox enable row level security;
drop policy if exists order_email_outbox_admin on public.order_email_outbox;
create policy order_email_outbox_admin on public.order_email_outbox for select to authenticated using(public.is_admin());
revoke all on public.order_email_outbox from anon, authenticated;
grant select on public.order_email_outbox to authenticated;

-- Trigger only records intent. The minute worker sees committed order items.
create or replace function bakery_private.queue_order_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.order_email_outbox(order_id,recipient,sender)
    select new.id,recipient,sender from public.order_email_settings where id=1 and enabled
    on conflict(order_id,event_key) do nothing;
  return new;
end $$;
revoke all on function bakery_private.queue_order_email() from public,anon,authenticated;
drop trigger if exists queue_order_email on public.orders;
create trigger queue_order_email after insert on public.orders
for each row execute function bakery_private.queue_order_email();

-- Exposes readiness only, never the API key. Vault is not exposed to clients.
create or replace function public.order_email_ready() returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if public.is_admin() is distinct from true then raise exception 'Admin access required'; end if;
  return exists(select 1 from vault.decrypted_secrets where name='order_email_resend_api_key' and length(decrypted_secret)>0);
end $$;
revoke all on function public.order_email_ready() from public,anon;
grant execute on function public.order_email_ready() to authenticated;

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
        E'\nPayment: Cash on Delivery\nCustomer: '||coalesce(o.guest_name,'')||E'\nPhone: '||coalesce(o.guest_phone,'')||
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
revoke all on function bakery_private.send_order_emails() from public,anon,authenticated;
select cron.schedule('samalbakes-order-emails','* * * * *','select bakery_private.send_order_emails()');
