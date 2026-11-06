-- Requires order-email-notifications.sql. Preserves original ready estimates.
alter table public.orders add column if not exists confirmed_ready_at timestamptz;
alter table public.orders add column if not exists confirmed_ready_note text;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check(status in ('new','accepted','baking','ready','out_for_delivery','delivered','cancelled'));
grant update(confirmed_ready_at,confirmed_ready_note) on public.orders to authenticated;

-- Multiple events per order; existing pending/accepted bakery alerts survive.
alter table public.order_email_outbox add column if not exists id uuid not null default gen_random_uuid();
alter table public.order_email_outbox add column if not exists event_key text not null default 'new_order';
alter table public.order_email_outbox drop constraint if exists order_email_outbox_pkey;
alter table public.order_email_outbox add primary key(id);
create unique index if not exists order_email_order_event on public.order_email_outbox(order_id,event_key);

create or replace function bakery_private.validate_order_confirmation() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.status='new' and new.status not in ('new','accepted','cancelled') then
    raise exception 'Accept the order and confirm its ready time before starting work';
  end if;
  if old.status<>'new' and new.status='new' then raise exception 'An accepted order cannot be reset to new'; end if;
  if new.status='accepted' and new.confirmed_ready_at is null then raise exception 'Confirm a ready time when accepting this order'; end if;
  if new.confirmed_ready_at is distinct from old.confirmed_ready_at or (old.status='new' and new.status='accepted') then
    if old.status in ('cancelled','delivered') then raise exception 'This order is already closed'; end if;
    if new.confirmed_ready_at is null or new.confirmed_ready_at<=now() then raise exception 'The confirmed ready time must be in the future'; end if;
    if old.status='ready' and new.status='ready' and new.confirmed_ready_at is distinct from old.confirmed_ready_at then
      new.status:='accepted';
    end if;
  end if;
  if length(coalesce(new.confirmed_ready_note,''))>1000 then raise exception 'Customer note must be 1000 characters or fewer'; end if;
  if old.status='new' and new.status='accepted' then new.accepted_at:=now(); end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
revoke all on function bakery_private.validate_order_confirmation() from public,anon,authenticated;
drop trigger if exists validate_order_confirmation on public.orders;
create trigger validate_order_confirmation before update on public.orders for each row execute function bakery_private.validate_order_confirmation();

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
    E'\nThis is the ready time at the bakery, not the delivery arrival time.\nPayment: Cash on Delivery\n\nIf you have an account, view your order at https://samalbakes.com/my-orders.html';
  email_body:=jsonb_build_object('from','SamalBakes <'||config.sender||'>','to',jsonb_build_array(new.guest_email),'subject',subject_text||' - '||left(new.id::text,8),'text',message_text);
  insert into public.order_email_outbox(order_id,event_key,recipient,sender,payload)
    values(new.id,'confirmation/'||gen_random_uuid()::text,new.guest_email,config.sender,email_body);
  return new;
end $$;
revoke all on function bakery_private.queue_customer_confirmation() from public,anon,authenticated;
drop trigger if exists queue_customer_confirmation on public.orders;
create trigger queue_customer_confirmation after update on public.orders for each row execute function bakery_private.queue_customer_confirmation();

create or replace function public.confirm_order_ready(p_order_id uuid,p_ready_at timestamptz,p_note text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare changed public.orders; queued boolean; previous_email_count bigint;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin access required'; end if;
  if p_ready_at is null or p_ready_at<=now() then raise exception 'The confirmed ready time must be in the future'; end if;
  select count(*) into previous_email_count from public.order_email_outbox where order_id=p_order_id;
  update public.orders set status=case when status='new' then 'accepted' else status end,
    confirmed_ready_at=p_ready_at,confirmed_ready_note=trim(coalesce(p_note,'')),updated_at=clock_timestamp()
    where id=p_order_id and updated_at is not distinct from p_expected_updated_at and status not in ('cancelled','delivered')
    returning * into changed;
  if not found then raise exception 'This order has changed or is closed. Refresh the orders page and try again'; end if;
  select count(*)>previous_email_count into queued from public.order_email_outbox where order_id=p_order_id;
  return to_jsonb(changed)||jsonb_build_object('customer_email_queued',queued);
end $$;
revoke all on function public.confirm_order_ready(uuid,timestamptz,text,timestamptz) from public,anon;
grant execute on function public.confirm_order_ready(uuid,timestamptz,text,timestamptz) to authenticated;
