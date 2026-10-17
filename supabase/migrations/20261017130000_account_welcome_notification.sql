create table public.kouponly_account_welcome_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  title text not null default 'Welcome to Kouponly' check (length(trim(title)) between 1 and 120),
  body text not null default 'You’re using Kouponly pre-launch access. Thank you for being here. Please share Kouponly with your friends.' check (length(trim(body)) between 1 and 500),
  button_label text not null default 'Visit Kouponly' check (length(trim(button_label)) between 1 and 60),
  button_url text not null default 'https://kouponly.in' check (button_url ~ '^https://[^[:space:]]+$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.kouponly_account_welcome_settings(id) values (true) on conflict(id) do nothing;
alter table public.kouponly_account_welcome_settings enable row level security;
grant select, insert, update on public.kouponly_account_welcome_settings to authenticated;
create policy kouponly_account_welcome_admin on public.kouponly_account_welcome_settings for all to authenticated
  using (public.kouponly_is_benefits_admin()) with check (public.kouponly_is_benefits_admin());

create function public.kouponly_notify_new_account() returns trigger
language plpgsql security definer set search_path = '' as $$
declare settings public.kouponly_account_welcome_settings%rowtype;
begin
  select * into settings from public.kouponly_account_welcome_settings where id;
  if not found or not settings.enabled then return new; end if;
  insert into public.notifications(user_id, kind, title, body, data)
  values(new.id, 'prelaunch_welcome', settings.title, settings.body,
    jsonb_build_object('buttonLabel',settings.button_label,'buttonUrl',settings.button_url));
  return new;
end $$;
revoke all on function public.kouponly_notify_new_account() from public, anon, authenticated;
create trigger kouponly_account_welcome_notification after insert on auth.users
  for each row execute function public.kouponly_notify_new_account();
notify pgrst, 'reload schema';
