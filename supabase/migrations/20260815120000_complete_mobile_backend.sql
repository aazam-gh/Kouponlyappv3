create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists mobile text not null default '',
  add column if not exists avatar_path text,
  add column if not exists revision bigint not null default 0;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  offer_alerts boolean not null default true,
  creator_updates boolean not null default true,
  location text not null default 'Kochi',
  language text not null default 'English',
  updated_at timestamptz not null default now(),
  revision bigint not null default 0
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id text not null,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  status text not null default 'pending' check (status in ('pending','submitted','deleted')),
  created_at timestamptz not null default now()
);

create table if not exists public.mutation_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  operation text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, mutation_id)
);

create table if not exists public.partner_redemption_pins (
  partner_id text primary key,
  pin_hash text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
revoke all on public.partner_redemption_pins from anon, authenticated;

do $$
declare entity text;
begin
  foreach entity in array array['deals','offers','partners','categories','hero_slides','campaigns','rewards'] loop
    execute format(
      'create table if not exists public.catalogue_%1$I (id text primary key, payload jsonb not null, published boolean not null default true, sort_order integer not null default 0, updated_at timestamptz not null default now())',
      entity
    );
    execute format('alter table public.catalogue_%I enable row level security', entity);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='catalogue_'||entity and policyname='Published catalogue is readable') then
      execute format('create policy "Published catalogue is readable" on public.catalogue_%I for select to anon, authenticated using (published)', entity);
    end if;
    execute format('grant select on public.catalogue_%I to anon, authenticated', entity);
  end loop;
end $$;

alter table public.user_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.campaign_attachments enable row level security;
alter table public.mutation_receipts enable row level security;

do $$
declare entity text;
begin
  foreach entity in array array['user_preferences','notifications','campaign_attachments','mutation_receipts'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=entity and policyname='Users manage their own rows') then
      execute format('create policy "Users manage their own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', entity);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', entity);
  end loop;
end $$;

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists campaign_attachments_application_idx on public.campaign_attachments(user_id, campaign_id, created_at);
create index if not exists mutation_receipts_created_idx on public.mutation_receipts(user_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic']),
  ('campaign-media', 'campaign-media', false, 26214400, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime'])
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Users own avatar objects') then
    create policy "Users own avatar objects" on storage.objects for all to authenticated
      using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
      with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Users own campaign media') then
    create policy "Users own campaign media" on storage.objects for all to authenticated
      using (bucket_id='campaign-media' and (storage.foldername(name))[1]=(select auth.uid())::text)
      with check (bucket_id='campaign-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
end $$;

create or replace function public.touch_owned_row() returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at = now();
  if to_jsonb(new) ? 'revision' then new.revision = coalesce(old.revision, 0) + 1; end if;
  return new;
end $$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_owned_row();
drop trigger if exists touch_preferences on public.user_preferences;
create trigger touch_preferences before update on public.user_preferences for each row execute function public.touch_owned_row();

create or replace function public.redeem_reward_atomic(p_reward_id text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid()); cost integer; current_points integer; prior jsonb; response jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select result into prior from public.mutation_receipts where user_id=uid and mutation_id=p_idempotency_key;
  if prior is not null then return prior; end if;
  select (payload->>'points')::integer into cost from public.catalogue_rewards where id=p_reward_id and published;
  if cost is null then raise exception 'Reward is unavailable' using errcode='P0001'; end if;
  select points into current_points from public.profiles where user_id=uid for update;
  if exists(select 1 from public.redeemed_rewards where user_id=uid and reward_id=p_reward_id) then raise exception 'Reward already redeemed' using errcode='P0001'; end if;
  if current_points < cost then raise exception 'Not enough points' using errcode='P0001'; end if;
  update public.profiles set points=points-cost where user_id=uid returning points into current_points;
  insert into public.redeemed_rewards(user_id,reward_id) values(uid,p_reward_id);
  response=jsonb_build_object('rewardId',p_reward_id,'points',current_points,'cost',cost);
  insert into public.mutation_receipts(user_id,mutation_id,operation,result) values(uid,p_idempotency_key,'redeem-reward',response);
  return response;
end $$;

create or replace function public.validate_redemption_atomic(p_redemption_id text, p_mode text, p_pin text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid()); prior jsonb; response jsonb; generated_code text; expiration timestamptz; deal_key text;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_mode not in ('online','inStore') then raise exception 'Invalid redemption mode' using errcode='22023'; end if;
  select result into prior from public.mutation_receipts where user_id=uid and mutation_id=p_idempotency_key;
  if prior is not null then return prior; end if;
  if exists(select 1 from public.redemptions where user_id=uid and redemption_id=p_redemption_id and consumed_at is not null) then raise exception 'Redemption already consumed' using errcode='P0001'; end if;
  deal_key=substring(p_redemption_id from 'deal-([0-9]+)');
  if deal_key is null or not exists(select 1 from public.catalogue_deals where id=deal_key and published) then raise exception 'Offer is unavailable' using errcode='P0001'; end if;
  if p_mode='inStore' and not exists(select 1 from public.partner_redemption_pins where enabled and pin_hash=extensions.crypt(p_pin,pin_hash)) then raise exception 'Invalid partner PIN' using errcode='P0001'; end if;
  if p_mode='online' then generated_code='KPN-'||lpad(deal_key,2,'0')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)); expiration=now()+interval '10 minutes'; end if;
  insert into public.redemptions(user_id,redemption_id,mode,status,code,expires_at,completed_at,consumed_at)
  values(uid,p_redemption_id,p_mode,case when p_mode='online' then 'code' else 'success' end,generated_code,expiration,case when p_mode='inStore' then now() end,now())
  on conflict(user_id,redemption_id) do update set status=excluded.status,code=excluded.code,expires_at=excluded.expires_at,completed_at=excluded.completed_at,consumed_at=excluded.consumed_at,updated_at=now();
  response=jsonb_build_object('code',generated_code,'expiresAt',case when expiration is null then null else extract(epoch from expiration)*1000 end,'status',case when p_mode='online' then 'code' else 'success' end);
  insert into public.mutation_receipts(user_id,mutation_id,operation,result) values(uid,p_idempotency_key,'validate-redemption',response);
  return response;
end $$;

grant execute on function public.redeem_reward_atomic(text,uuid) to authenticated;
grant execute on function public.validate_redemption_atomic(text,text,text,uuid) to authenticated;
revoke execute on function public.redeem_reward_atomic(text,uuid) from anon, public;
revoke execute on function public.validate_redemption_atomic(text,text,text,uuid) from anon, public;

insert into public.partner_redemption_pins(partner_id,pin_hash)
values('prototype',extensions.crypt('0000',extensions.gen_salt('bf')))
on conflict(partner_id) do nothing;

insert into public.catalogue_campaigns(id,payload,sort_order) values
('paragon-reel','{"id":"paragon-reel","brand":"Paragon","title":"A 20-second biryani reel","payment":"₹2,500","due":"5 days","method":"Visit + dine-in shoot","brief":"Show the full table, the first serving and your honest one-line reaction."}'::jsonb,0),
('marriott-day','{"id":"marriott-day","brand":"Kochi Marriott","title":"Pool-day story set","payment":"₹4,500","due":"8 days","method":"Hosted experience","brief":"Create four vertical stories covering arrival, pool, lunch and your favourite detail."}'::jsonb,1),
('starbucks-study','{"id":"starbucks-study","brand":"Starbucks","title":"Study-session photo carousel","payment":"₹1,800","due":"3 days","method":"Self-shot visit","brief":"Capture a real study session and highlight the member offer naturally."}'::jsonb,2)
on conflict(id) do update set payload=excluded.payload,sort_order=excluded.sort_order,updated_at=now();

insert into public.catalogue_rewards(id,payload,sort_order) values
('coffee','{"id":"coffee","name":"Free coffee","detail":"Any regular drink","points":200}'::jsonb,0),
('burger','{"id":"burger","name":"Free burger meal","detail":"Burger, fries and drink","points":450}'::jsonb,1),
('pottery','{"id":"pottery","name":"Pottery workshop","detail":"Mattancherry · 90 minutes","points":650}'::jsonb,2),
('kayak','{"id":"kayak","name":"Kayaking experience","detail":"Kadamakkudy morning","points":900}'::jsonb,3)
on conflict(id) do update set payload=excluded.payload,sort_order=excluded.sort_order,updated_at=now();

insert into public.catalogue_deals(id,payload,sort_order)
select value::text, jsonb_build_object('id',value), value from generate_series(1,16) value
on conflict(id) do nothing;

do $$
declare entity text;
begin
  foreach entity in array array['profiles','user_preferences','saved_deals','saved_offers','used_deals','offer_usage','campaign_applications','campaign_attachments','user_interests','redemptions','redeemed_rewards','accepted_gifts','sent_gifts','notifications','catalogue_deals','catalogue_offers','catalogue_partners','catalogue_categories','catalogue_hero_slides','catalogue_campaigns','catalogue_rewards'] loop
    execute format('alter table public.%I replica identity full',entity);
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=entity) then
      execute format('alter publication supabase_realtime add table public.%I',entity);
    end if;
  end loop;
end $$;
