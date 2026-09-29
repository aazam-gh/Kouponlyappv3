-- Make user activity writable only through the app's row-level mutations and trusted redemption RPCs.
alter table public.offer_usage
  add column if not exists period_start date not null default (date_trunc('month', now())::date);

-- New Supabase projects may have Data API default privileges disabled; expose only the
-- operations required by authenticated clients, with RLS still controlling every row.
grant usage on schema public to anon, authenticated;
grant select on public.catalogue_deals, public.catalogue_offers, public.catalogue_partners,
  public.catalogue_categories, public.catalogue_hero_slides, public.catalogue_campaigns,
  public.catalogue_rewards to anon, authenticated;
grant select, insert, update, delete on public.saved_deals, public.saved_offers, public.user_interests to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select on public.profiles, public.used_deals, public.offer_usage, public.redemptions,
  public.redeemed_rewards, public.accepted_gifts, public.campaign_applications,
  public.campaign_attachments, public.sent_gifts, public.notifications to authenticated;
grant insert on public.feedback to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, email, city, mobile, avatar_path) on public.profiles to authenticated;
drop policy if exists "Users manage their own profiles" on public.profiles;
drop policy if exists "Read own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;
create policy "Read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Points, reward claims and redemption counters are changed only by atomic database functions.
do $secure_activity$
declare
  entity text;
  policy_row record;
begin
  foreach entity in array array['used_deals','offer_usage','redemptions','redeemed_rewards'] loop
    for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = entity loop
      execute format('drop policy %I on public.%I', policy_row.policyname, entity);
    end loop;
    execute format('revoke insert, update, delete on public.%I from authenticated', entity);
    execute format('grant select on public.%I to authenticated', entity);
    execute format('create policy "Users read own rows" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', entity);
  end loop;
end
$secure_activity$;

-- A user may apply or withdraw an application, but cannot approve their own submission.
do $campaign_policies$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'campaign_applications' loop
    execute format('drop policy %I on public.campaign_applications', policy_row.policyname);
  end loop;
end
$campaign_policies$;
revoke all on public.campaign_applications from authenticated;
grant select, insert, update on public.campaign_applications to authenticated;
create policy "Users read own campaign applications" on public.campaign_applications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users submit own campaign applications" on public.campaign_applications
  for insert to authenticated with check ((select auth.uid()) = user_id and status in ('submitted','withdrawn'));
create policy "Users withdraw own campaign applications" on public.campaign_applications
  for update to authenticated using ((select auth.uid()) = user_id and status in ('submitted','withdrawn'))
  with check ((select auth.uid()) = user_id and status in ('submitted','withdrawn'));

-- Feedback is append-only; users can only submit feedback for their own authenticated account.
do $feedback_policies$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'feedback' loop
    execute format('drop policy %I on public.feedback', policy_row.policyname);
  end loop;
end
$feedback_policies$;
revoke all on public.feedback from authenticated;
grant insert on public.feedback to authenticated;
create policy "Users submit own feedback" on public.feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- User clients can read notifications, but only trusted backend code creates or updates them.
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;

-- Sent gift receipts are append-only from the sender's perspective.
revoke update, delete on public.sent_gifts from authenticated;
grant select, insert on public.sent_gifts to authenticated;

drop policy if exists "Users manage their own rows" on public.mutation_receipts;
revoke all on public.mutation_receipts from anon, authenticated;

-- Keep the public profile email synchronized with Supabase Auth after email changes are confirmed.
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_profile_email() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated after update of email on auth.users
  for each row execute function public.sync_profile_email();

create or replace function public.record_redemption_usage(p_user_id uuid, p_redemption_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  deal_key text := substring(p_redemption_id from '^deal-([0-9]+)');
  offer_key text := substring(p_redemption_id from '^deal-[0-9]+-([0-9]+)');
  month_start date := date_trunc('month', now())::date;
begin
  if deal_key is null then return; end if;
  insert into public.used_deals(user_id, deal_id) values (p_user_id, deal_key::integer)
    on conflict (user_id, deal_id) do nothing;
  if offer_key is not null then
    insert into public.offer_usage(user_id, offer_id, use_count, period_start)
    values (p_user_id, deal_key || '-' || offer_key, 1, month_start)
    on conflict (user_id, offer_id) do update set
      use_count = case when public.offer_usage.period_start < month_start then 1 else least(3, public.offer_usage.use_count + 1) end,
      period_start = month_start,
      updated_at = now();
  end if;
end;
$$;
revoke all on function public.record_redemption_usage(uuid,text) from public, anon, authenticated;

create or replace function public.validate_redemption_atomic(p_redemption_id text, p_mode text, p_pin text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  prior jsonb;
  response jsonb;
  generated_code text;
  expiration timestamptz;
  deal_key text;
  listing_key text;
  offer_key text;
  used_count integer := 0;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_mode not in ('online','inStore') then raise exception 'Invalid redemption mode' using errcode = '22023'; end if;
  if p_redemption_id is null or length(p_redemption_id) > 240 then raise exception 'Invalid redemption id' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':receipt:' || p_idempotency_key::text, 0));
  select result into prior from public.mutation_receipts where user_id = uid and mutation_id = p_idempotency_key;
  if prior is not null then return prior; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':redemption:' || p_redemption_id, 1));

  deal_key := substring(p_redemption_id from '^deal-([0-9]+)');
  listing_key := substring(p_redemption_id from '^listing-(.+)$');
  offer_key := substring(p_redemption_id from '^deal-[0-9]+-([0-9]+)');
  if deal_key is not null then
    if not exists (select 1 from public.catalogue_deals where id = deal_key and published) then
      raise exception 'Offer is unavailable' using errcode = 'P0001';
    end if;
    select case when period_start < date_trunc('month', now())::date then 0 else use_count end
      into used_count from public.offer_usage where user_id = uid and offer_id = deal_key || '-' || coalesce(offer_key, '0');
    if coalesce(used_count, 0) >= 3 then raise exception 'Offer usage limit reached' using errcode = 'P0001'; end if;
  elsif listing_key is not null then
    if not exists (select 1 from public.catalogue_partners where id = listing_key and published) then
      raise exception 'Offer is unavailable' using errcode = 'P0001';
    end if;
  else
    raise exception 'Offer is unavailable' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.redemptions where user_id = uid and redemption_id = p_redemption_id and consumed_at is not null) then
    raise exception 'Redemption already completed' using errcode = 'P0001';
  end if;
  if p_mode = 'inStore' and not exists (
    select 1 from public.partner_redemption_pins
    where enabled and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid partner PIN' using errcode = 'P0001';
  end if;

  if p_mode = 'online' then
    select code, expires_at into generated_code, expiration from public.redemptions
      where user_id = uid and redemption_id = p_redemption_id and status = 'code' and expires_at > now();
    if generated_code is null then
      generated_code := 'KPN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      expiration := now() + interval '10 minutes';
    end if;
  end if;

  insert into public.redemptions(user_id, redemption_id, mode, status, code, expires_at, completed_at, consumed_at)
  values (uid, p_redemption_id, p_mode, case when p_mode = 'online' then 'code' else 'success' end,
          generated_code, expiration, case when p_mode = 'inStore' then now() end,
          case when p_mode = 'inStore' then now() end)
  on conflict (user_id, redemption_id) do update set
    mode = excluded.mode, status = excluded.status, code = excluded.code, expires_at = excluded.expires_at,
    completed_at = excluded.completed_at, consumed_at = excluded.consumed_at, updated_at = now();

  if p_mode = 'inStore' then perform public.record_redemption_usage(uid, p_redemption_id); end if;
  response := jsonb_build_object(
    'code', generated_code,
    'expiresAt', case when expiration is null then null else extract(epoch from expiration) * 1000 end,
    'status', case when p_mode = 'online' then 'code' else 'success' end
  );
  insert into public.mutation_receipts(user_id, mutation_id, operation, result)
    values (uid, p_idempotency_key, 'validate-redemption', response);
  return response;
end;
$$;

create or replace function public.complete_redemption_atomic(p_redemption_id text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  prior jsonb;
  current_redemption public.redemptions%rowtype;
  response jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_redemption_id is null or length(p_redemption_id) > 240 then raise exception 'Invalid redemption id' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':receipt:' || p_idempotency_key::text, 0));
  select result into prior from public.mutation_receipts where user_id = uid and mutation_id = p_idempotency_key;
  if prior is not null then return prior; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':redemption:' || p_redemption_id, 1));
  select * into current_redemption from public.redemptions
    where user_id = uid and redemption_id = p_redemption_id for update;
  if not found or current_redemption.mode <> 'online' or current_redemption.status <> 'code' then
    raise exception 'No active online redemption exists' using errcode = 'P0001';
  end if;
  if current_redemption.consumed_at is not null then raise exception 'Redemption already completed' using errcode = 'P0001'; end if;
  if current_redemption.expires_at is null or current_redemption.expires_at <= now() then
    update public.redemptions set status = 'expired', updated_at = now()
      where user_id = uid and redemption_id = p_redemption_id;
    raise exception 'Redemption code expired' using errcode = 'P0001';
  end if;
  update public.redemptions set status = 'success', completed_at = now(), consumed_at = now(), updated_at = now()
    where user_id = uid and redemption_id = p_redemption_id;
  perform public.record_redemption_usage(uid, p_redemption_id);
  response := jsonb_build_object('id', p_redemption_id, 'status', 'success', 'completedAt', extract(epoch from now()) * 1000);
  insert into public.mutation_receipts(user_id, mutation_id, operation, result)
    values (uid, p_idempotency_key, 'complete-redemption', response);
  return response;
end;
$$;

revoke all on function public.validate_redemption_atomic(text,text,text,uuid) from public, anon;
revoke all on function public.complete_redemption_atomic(text,uuid) from public, anon;
grant execute on function public.validate_redemption_atomic(text,text,text,uuid) to authenticated;
grant execute on function public.complete_redemption_atomic(text,uuid) to authenticated;
