-- Sandbox phone users sign up via synthetic email (p{phone}@geram.vercel.app).
-- Without service-role, GoTrue leaves email_confirmed_at null and password
-- sign-in fails with "Email not confirmed". Auto-confirm these sandbox emails.

create extension if not exists pgcrypto;

create or replace function public.auto_confirm_sandbox_phone_users()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if new.email like 'p%@geram.vercel.app' then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_confirm_sandbox_phone_users on auth.users;
create trigger trg_auto_confirm_sandbox_phone_users
before insert on auth.users
for each row
execute function public.auto_confirm_sandbox_phone_users();

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where email like 'p%@geram.vercel.app'
  and email_confirmed_at is null;
