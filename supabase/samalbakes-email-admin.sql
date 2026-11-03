begin;
-- The owner authorized this exact email for bakery administration.
-- Require verified Auth email; user-editable profile data never grants access.
create or replace function public.grant_samalbakes_email_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) = 'samalbakes@gmail.com' and new.email_confirmed_at is not null then
    update public.profiles set is_admin = true where id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.grant_samalbakes_email_admin() from public, anon, authenticated;

-- AFTER INSERT triggers run alphabetically: profile creation runs first.
create or replace trigger zz_grant_samalbakes_email_admin
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.grant_samalbakes_email_admin();

-- Also covers an account registered and verified before this update is applied.
update public.profiles p set is_admin = true
from auth.users u
where p.id = u.id and lower(u.email) = 'samalbakes@gmail.com'
  and u.email_confirmed_at is not null;
commit;
