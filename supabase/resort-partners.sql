begin;

-- Account IDs, rather than checkout contact details, establish partner eligibility.
create table if not exists public.resort_partners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resort_name text not null check (length(trim(resort_name)) between 1 and 200),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.resort_partners enable row level security;
drop policy if exists resort_partners_read on public.resort_partners;
create policy resort_partners_read on public.resort_partners for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
revoke all on public.resort_partners from anon, authenticated;
grant select on public.resort_partners to authenticated;

-- Only these explicitly admin-gated functions may manage approvals.
create or replace function public.list_resort_partners()
returns table(user_id uuid, email text, resort_name text, active boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Admin access required.'; end if;
  return query select p.user_id, u.email::text, p.resort_name, p.active
    from public.resort_partners p join auth.users u on u.id=p.user_id
    order by p.resort_name, u.email;
end;
$$;
create or replace function public.save_resort_partner(p_email text, p_resort_name text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Admin access required.'; end if;
  if p_resort_name is null or length(trim(p_resort_name)) not between 1 and 200 or p_active is null then
    raise exception 'Enter a resort name (up to 200 characters) and approval status.';
  end if;
  select id into v_user from auth.users where lower(email)=lower(trim(p_email));
  if v_user is null then raise exception 'No account found. Ask the partner to register on the Account page first.'; end if;
  if p_active and not exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null) then
    raise exception 'The partner must verify their account email before approval.';
  end if;
  insert into public.resort_partners(user_id,resort_name,active) values(v_user,trim(p_resort_name),p_active)
    on conflict(user_id) do update set resort_name=excluded.resort_name,active=excluded.active,updated_at=now();
end;
$$;
revoke all on function public.list_resort_partners() from public, anon;
revoke all on function public.save_resort_partner(text,text,boolean) from public, anon;
grant execute on function public.list_resort_partners() to authenticated;
grant execute on function public.save_resort_partner(text,text,boolean) to authenticated;

-- Invoked inside place_order: the existing pricing code still enforces the
-- admin-configured minimum and applies the discount on every eligible order.
create or replace function public.require_resort_partner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if upper(trim(coalesce(new.promo_code,'')))='RESORT50' then
    if auth.uid() is null then raise exception 'Sign in to your approved resort partner account to use RESORT50.'; end if;
    if not exists(select 1 from public.resort_partners where user_id=auth.uid() and active) then
      raise exception 'RESORT50 is only for approved resort partner accounts. Contact SamalBakes for approval.';
    end if;
    -- Keep a revocation from racing the current order transaction.
    perform 1 from public.resort_partners where user_id=auth.uid() and active for share;
    if not found then raise exception 'Your resort partner approval is no longer active.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.require_resort_partner() from public, anon, authenticated;
drop trigger if exists orders_require_resort_partner on public.orders;
create trigger orders_require_resort_partner before insert or update of promo_code on public.orders
  for each row execute function public.require_resort_partner();

-- Remove hardcoded minimum wording; storefront cards display the saved minimum.
update public.settings set promotions=(select jsonb_agg(case when upper(p->>'code')='RESORT50'
  then p || '{"description":"₱50 off for approved resort / hotel partner accounts. Sign in to use RESORT50 on every qualifying order."}'::jsonb
  else p end order by n) from jsonb_array_elements(promotions) with ordinality as x(p,n))
where id=1 and exists(select 1 from jsonb_array_elements(promotions) p where upper(p->>'code')='RESORT50');
commit;
