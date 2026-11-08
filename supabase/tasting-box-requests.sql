begin;

create table if not exists public.tasting_box_requests (
  id uuid primary key,
  business_name text not null check(length(trim(business_name)) between 1 and 200),
  email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text not null check(length(phone)<=40 and length(regexp_replace(phone,'[^0-9]','','g')) between 7 and 15),
  status text not null default 'new' check(status in ('new','contacted','approved','declined')),
  created_at timestamptz not null default now()
);
create index if not exists tasting_requests_recent on public.tasting_box_requests(created_at desc);
create index if not exists tasting_requests_email on public.tasting_box_requests(email,created_at desc);
alter table public.tasting_box_requests enable row level security;
drop policy if exists tasting_requests_admin_read on public.tasting_box_requests;
create policy tasting_requests_admin_read on public.tasting_box_requests for select to authenticated using((select public.is_admin()));
drop policy if exists tasting_requests_admin_update on public.tasting_box_requests;
create policy tasting_requests_admin_update on public.tasting_box_requests for update to authenticated
  using((select public.is_admin())) with check((select public.is_admin()));
revoke all on public.tasting_box_requests from public,anon,authenticated;
grant select on public.tasting_box_requests to authenticated;
grant update(status) on public.tasting_box_requests to authenticated;

-- Reuse the existing asynchronous email worker, retries, provider credentials,
-- and admin-configured recipient. A request is never represented as an order.
alter table public.order_email_outbox alter column order_id drop not null;
alter table public.order_email_outbox add column if not exists tasting_request_id uuid references public.tasting_box_requests(id) on delete cascade;
create unique index if not exists tasting_request_notification on public.order_email_outbox(tasting_request_id) where tasting_request_id is not null;
alter table public.order_email_outbox drop constraint if exists notification_target;
alter table public.order_email_outbox add constraint notification_target check(
  (order_id is not null and tasting_request_id is null) or
  (order_id is null and tasting_request_id is not null and payload is not null and event_key='tasting_request')
);

create or replace function public.request_tasting_box(p_id uuid,p_business_name text,p_email text,p_phone text,p_website text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare
  business text:=trim(p_business_name);
  contact_email text:=lower(trim(p_email));
  contact_phone text:=trim(p_phone);
  prior public.tasting_box_requests;
  config public.order_email_settings;
  email_body jsonb;
begin
  if p_id is null or length(coalesce(p_website,''))>0 then raise exception 'Invalid request. Please refresh and try again.'; end if;
  if business is null or length(business) not between 1 and 200 then raise exception 'Enter your business name (up to 200 characters).'; end if;
  if contact_email is null or length(contact_email)>254 or contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  if contact_phone is null or length(contact_phone)>40 or length(regexp_replace(contact_phone,'[^0-9]','','g')) not between 7 and 15 then raise exception 'Enter a valid phone number.'; end if;
  if not exists(select 1 from public.settings,jsonb_array_elements(promotions) p where id=1 and p->>'id'='tasting-box'
    and (p->>'active')::boolean and (nullif(p->>'startsAt','')::timestamptz is null or (p->>'startsAt')::timestamptz<=now())
    and (nullif(p->>'endsAt','')::timestamptz is null or (p->>'endsAt')::timestamptz>now())) then
    raise exception 'Tasting box requests are currently unavailable. Please contact the bakery.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tasting/'||contact_email,0));
  select * into prior from public.tasting_box_requests where id=p_id;
  if found then
    if prior.email=contact_email and prior.business_name=business and prior.phone=contact_phone then return p_id; end if;
    raise exception 'Request details changed. Please refresh and try again.';
  end if;
  if exists(select 1 from public.tasting_box_requests where email=contact_email and created_at>now()-interval '24 hours') then
    raise exception 'A tasting box request was already received for this email in the past 24 hours. Please contact the bakery for updates.';
  end if;
  insert into public.tasting_box_requests(id,business_name,email,phone) values(p_id,business,contact_email,contact_phone);
  select * into config from public.order_email_settings where id=1 and enabled;
  if found then
    email_body:=jsonb_build_object('from','SamalBakes <'||config.sender||'>','to',jsonb_build_array(config.recipient),
      'subject','New SamalBakes tasting box request',
      'text','New tasting box request'||E'\n\nBusiness: '||business||E'\nEmail: '||contact_email||E'\nPhone: '||contact_phone||
        E'\n\nSubject to availability and bakery approval.\nReview requests: https://samalbakes.com/admin.html#tastings');
    insert into public.order_email_outbox(tasting_request_id,event_key,recipient,sender,payload)
      values(p_id,'tasting_request',config.recipient,config.sender,email_body);
  end if;
  return p_id;
end;
$$;
revoke all on function public.request_tasting_box(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.request_tasting_box(uuid,text,text,text,text) to anon,authenticated;

-- Keep the single automatic-delivery threshold in settings, never in a code.
-- Existing saved discount amounts and all unrelated offers are preserved.
update public.settings set promotions=(select jsonb_agg(case
  when p->>'id'='free-del' or upper(p->>'code')='FREESHIP1500' then
    (p - 'minSubtotal') || '{"id":"free-del","type":"info","code":null,"title":"Automatic free delivery","description":"Free delivery automatically applies when your total after discounts reaches the delivery minimum. No code needed."}'::jsonb
  when p->>'id'='tasting-box' or upper(p->>'code')='TASTEBOX' then
    p || '{"id":"tasting-box","type":"info","code":null,"description":"New café or resort partners: request a complimentary tasting box. Subject to availability and bakery approval."}'::jsonb
  else p end order by n) from jsonb_array_elements(promotions) with ordinality as x(p,n)) where id=1;

commit;
