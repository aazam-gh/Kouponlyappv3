-- Recovery inboxes are account credentials, never public vendor contact data.
create table public.kouponly_vendor_recovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  verified_at timestamptz,
  pending_email text,
  token_hash text unique,
  expires_at timestamptz,
  reset_hash text unique,
  reset_expires_at timestamptz,
  check ((email is null) = (verified_at is null))
);
create table public.kouponly_credential_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 1
);
create table public.kouponly_credential_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);
create index kouponly_credential_limits_window_idx on public.kouponly_credential_limits(window_start);
alter table public.kouponly_vendor_recovery enable row level security;
alter table public.kouponly_credential_limits enable row level security;
alter table public.kouponly_credential_audit enable row level security;
revoke all on public.kouponly_vendor_recovery, public.kouponly_credential_limits, public.kouponly_credential_audit from anon, authenticated;
grant all on public.kouponly_vendor_recovery, public.kouponly_credential_limits, public.kouponly_credential_audit to service_role;
grant usage, select on sequence public.kouponly_credential_audit_id_seq to service_role;

-- Atomic rate limits also cover simultaneous requests across Edge instances.
create function public.kouponly_credential_limit(p_key text, p_max integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.kouponly_credential_limits where key in (
    select key from public.kouponly_credential_limits where window_start < now() - interval '1 day' limit 100
  );
  insert into public.kouponly_credential_limits as limits(key) values(p_key)
  on conflict(key) do update set
    attempts = case when limits.window_start < now() - make_interval(secs => p_seconds) then 1 else limits.attempts + 1 end,
    window_start = case when limits.window_start < now() - make_interval(secs => p_seconds) then now() else limits.window_start end
  returning attempts into n;
  return n <= p_max;
end $$;

create function public.kouponly_verify_vendor_recovery(p_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  update public.kouponly_vendor_recovery set email = pending_email, verified_at = now(),
    pending_email = null, token_hash = null, expires_at = null, reset_hash = null, reset_expires_at = null
  where token_hash = p_hash and expires_at > now() and pending_email is not null
  returning user_id into uid;
  return uid;
end $$;

-- Resolve the immutable Auth email, not client-editable user metadata or business data.
create function public.kouponly_vendor_login_id(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where u.email = p_email and exists (
    select 1 from public.couponly_vendor_memberships m where m.user_id = u.id and m.role in ('owner','manager')
  )
$$;

create function public.kouponly_consume_vendor_reset(p_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  update public.kouponly_vendor_recovery set reset_hash = null, reset_expires_at = null
  where reset_hash = p_hash and reset_expires_at > now() returning user_id into uid;
  return uid;
end $$;

create function public.kouponly_invalidate_vendor_recovery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.kouponly_vendor_recovery set reset_hash = null, reset_expires_at = null,
    pending_email = null, token_hash = null, expires_at = null where user_id = new.id;
  return new;
end $$;
create trigger kouponly_invalidate_vendor_recovery after update of encrypted_password, email on auth.users
for each row when (old.encrypted_password is distinct from new.encrypted_password or old.email is distinct from new.email)
execute function public.kouponly_invalidate_vendor_recovery();

-- An Auth username change and its vendor display value must commit together.
-- Also reject client metadata edits that claim a different username without changing Auth email.
create function public.kouponly_sync_vendor_username()
returns trigger language plpgsql security definer set search_path = '' as $$
declare username text;
begin
  if new.email like '%@vendor.kouponly.invalid' then
    username := new.raw_user_meta_data->>'username';
    if username is null or new.email <> encode(sha256(convert_to(username, 'UTF8')), 'hex') || '@vendor.kouponly.invalid' then
      raise exception 'Vendor username must match its login identity';
    end if;
    update public.couponly_vendors set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{username}', to_jsonb(username))
    where user_id = new.id;
  end if;
  return new;
end $$;
create trigger kouponly_sync_vendor_username after update of email, raw_user_meta_data on auth.users
for each row when (old.email is distinct from new.email or old.raw_user_meta_data->>'username' is distinct from new.raw_user_meta_data->>'username')
execute function public.kouponly_sync_vendor_username();

revoke all on function public.kouponly_credential_limit(text, integer, integer), public.kouponly_verify_vendor_recovery(text), public.kouponly_vendor_login_id(text), public.kouponly_sync_vendor_username(), public.kouponly_consume_vendor_reset(text), public.kouponly_invalidate_vendor_recovery() from public, anon, authenticated;
grant execute on function public.kouponly_credential_limit(text, integer, integer), public.kouponly_verify_vendor_recovery(text), public.kouponly_vendor_login_id(text), public.kouponly_consume_vendor_reset(text) to service_role;
notify pgrst, 'reload schema';
