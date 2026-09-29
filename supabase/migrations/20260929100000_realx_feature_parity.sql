-- RealX feature parity schema, coexisting with Kouponly's existing tables.
create extension if not exists pgcrypto with schema extensions;

create table public.realx_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','holding_admin','vendor')),
  holding_group_id text,
  vendor_id text,
  created_at timestamptz not null default now()
);
create table public.realx_universities (
  id text primary key default gen_random_uuid()::text, name text not null,
  email_domains text[] not null default '{}', logo_path text, active boolean not null default true,
  sort_order integer not null default 0, payload jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_categories (
  id text primary key default gen_random_uuid()::text, name text not null, slug text,
  image_path text, active boolean not null default true, sort_order integer not null default 0,
  payload jsonb not null default '{}', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.realx_students (
  id uuid primary key references auth.users(id) on delete cascade, email text unique,
  first_name text not null default '', last_name text not null default '', phone text,
  university_id text references public.realx_universities(id) on delete set null,
  account_role text not null default 'student' check(account_role in ('student','creator')),
  verification_status text not null default 'unverified', creator_code text unique,
  cashback numeric(12,2) not null default 0, savings numeric(12,2) not null default 0,
  profile jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_vendors (
  id text primary key default gen_random_uuid()::text, user_id uuid references auth.users(id) on delete set null,
  category_id text references public.realx_categories(id) on delete set null, name text not null,
  status text not null default 'Pending', vendor_type text not null default 'in_store'
    check(vendor_type in ('in_store','online','hybrid')), website text, logo_path text,
  description text, locations jsonb not null default '[]', settings jsonb not null default '{}',
  payload jsonb not null default '{}', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index realx_vendors_status_idx on public.realx_vendors(status);
create table public.realx_vendor_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor_id text not null references public.realx_vendors(id) on delete cascade,
  role text not null default 'manager' check(role in ('owner','manager','staff')),
  created_at timestamptz not null default now(), primary key(user_id,vendor_id)
);
create table public.realx_offers (
  id text primary key default gen_random_uuid()::text,
  vendor_id text not null references public.realx_vendors(id) on delete cascade,
  category_id text references public.realx_categories(id) on delete set null,
  title text not null, description text, offer_type text not null default 'discount',
  discount numeric(8,2), starts_at timestamptz, ends_at timestamptz,
  active boolean not null default true, payload jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_student_saved_items (
  id text primary key default gen_random_uuid()::text,
  student_id uuid not null references public.realx_students(id) on delete cascade,
  item_type text not null check(item_type in ('vendor','offer','opportunity')), item_id text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(), unique(student_id,item_type,item_id)
);
create table public.realx_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.realx_students(id) on delete set null,
  vendor_id text references public.realx_vendors(id) on delete set null, vendor_id_snapshot text not null default '',
  offer_id text references public.realx_offers(id) on delete set null,
  transaction_type text not null default 'offer' check(transaction_type in ('offer','giftcard','online')),
  status text not null default 'pending' check(status in ('pending','completed','cancelled','rejected')),
  idempotency_key uuid not null, amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0, final_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0, vendor_name text, type text, code text,
  cashback_amount numeric(12,2) not null default 0, creator_cashback_amount numeric(12,2) not null default 0,
  creator_code text, creator_uid uuid references public.realx_students(id) on delete set null,
  discount_type text, discount_value numeric(12,2), discount_code text, purchase_url text,
  redemption_card_amount numeric(12,2), remaining_amount numeric(12,2),
  metadata jsonb not null default '{}', payload jsonb not null default '{}',
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique(student_id,idempotency_key)
);
create index realx_transactions_vendor_time_idx on public.realx_transactions(vendor_id,created_at desc);
create index realx_transactions_student_time_idx on public.realx_transactions(student_id,created_at desc);

create table public.realx_verification_requests (
  id uuid primary key default gen_random_uuid(), email text not null,
  student_id uuid references public.realx_students(id) on delete set null,
  requested_role text not null default 'student' check(requested_role in ('student','creator')),
  status text not null default 'pending' check(status in ('pending','approving','approved','rejected','cancelled','profile_completed','expired')),
  status_token_hash text, id_image_path text, details jsonb not null default '{}',
  rejection_reason text, reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz, expires_at timestamptz default now()+interval '30 days', expired_at timestamptz,
  submitted_at timestamptz not null default now(), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index realx_verification_queue_idx on public.realx_verification_requests(status,submitted_at desc);
create index realx_verification_email_idx on public.realx_verification_requests(lower(email),submitted_at desc);
create table public.realx_wakti_student_verification_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.realx_students(id) on delete cascade,
  university_id text references public.realx_universities(id) on delete set null,
  email text not null, status text not null default 'pending', payload jsonb not null default '{}',
  submitted_at timestamptz not null default now(), reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

-- Admin managed CMS collections.
create table public.realx_events (
  id text primary key default gen_random_uuid()::text, title text not null, starts_at timestamptz,
  ends_at timestamptz, image_path text, published boolean not null default false,
  payload jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_banners (
  id text primary key default gen_random_uuid()::text, title text, image_path text, destination_url text,
  active boolean not null default true, sort_order integer not null default 0, payload jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_featured_brands (
  id text primary key default gen_random_uuid()::text, vendor_id text references public.realx_vendors(id) on delete set null,
  active boolean not null default true, sort_order integer not null default 0, payload jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.realx_trending_offer_banners (
  id text primary key default gen_random_uuid()::text, offer_id text references public.realx_offers(id) on delete set null,
  active boolean not null default true, sort_order integer not null default 0, payload jsonb not null default '{}', updated_at timestamptz not null default now()
);
-- The source mobile app also reads several Firestore CMS singleton documents.
create table public.realx_cms_documents (
  id text primary key, payload jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table public.realx_holding_groups (
  id text primary key default gen_random_uuid()::text, name text not null, status text not null default 'active',
  settings jsonb not null default '{}', payload jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_holding_group_members (
  id uuid primary key default gen_random_uuid(), holding_group_id text not null references public.realx_holding_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'viewer', payload jsonb not null default '{}',
  disabled_at timestamptz, created_at timestamptz not null default now(), unique(holding_group_id,user_id)
);
create table public.realx_holding_group_vendors (
  holding_group_id text not null references public.realx_holding_groups(id) on delete cascade,
  vendor_id text not null references public.realx_vendors(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(holding_group_id,vendor_id)
);
create table public.realx_notifications (
  id uuid primary key default gen_random_uuid(), recipient_id uuid references public.realx_students(id) on delete cascade,
  title text not null, body text not null, data jsonb not null default '{}',
  sent_at timestamptz not null default now(), status text not null default 'sent',
  sent_by uuid references auth.users(id) on delete set null, date_key date,
  sent_count integer not null default 0, failed_count integer not null default 0,
  invalid_token_count integer not null default 0, total_registered integer not null default 0,
  receipt_success_count integer not null default 0, receipt_failure_count integer not null default 0,
  completed_at timestamptz
);
create table public.realx_notification_daily_limits (
  date_key date primary key, count integer not null default 0 check(count>=0), updated_at timestamptz not null default now()
);
create table public.realx_push_tokens (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique, platform text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.realx_notifications(id) on delete cascade,
  token_id uuid references public.realx_push_tokens(id) on delete set null,
  receipt_id text not null unique, status text not null default 'pending',
  details jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index realx_notification_delivery_campaign_idx on public.realx_notification_deliveries(campaign_id,status,created_at);
create table public.realx_vendor_online_configs (
  vendor_id text primary key references public.realx_vendors(id) on delete cascade, active boolean not null default true,
  destination_url text, offer jsonb not null default '{}', daily_limit integer, updated_at timestamptz not null default now()
);
create table public.realx_online_vendor_clicks (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.realx_students(id) on delete cascade,
  vendor_id text not null references public.realx_vendors(id) on delete cascade, request_id uuid not null,
  platform text not null default 'web', purchase_url text not null, tracked boolean not null default true,
  clicked_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
  unique(student_id,vendor_id,request_id)
);
create index realx_online_click_daily_idx on public.realx_online_vendor_clicks(student_id,vendor_id,clicked_at desc) where tracked;
create table public.realx_vendor_redemption_secrets (
  vendor_id text primary key references public.realx_vendors(id) on delete cascade,
  pin_hash text not null, pin_salt text not null, rotated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.realx_creator_codes (
  code text primary key, student_id uuid not null unique references public.realx_students(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.realx_opportunities (
  id text primary key default gen_random_uuid()::text, category_id text references public.realx_categories(id) on delete set null,
  title text not null, published boolean not null default false, starts_at timestamptz, ends_at timestamptz,
  payload jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_map_locations (
  id text primary key, vendor_id text not null references public.realx_vendors(id) on delete cascade,
  latitude double precision not null, longitude double precision not null, geohash text,
  payload jsonb not null default '{}', updated_at timestamptz not null default now(),
  check(latitude between -90 and 90), check(longitude between -180 and 180)
);
create index realx_map_coords_idx on public.realx_map_locations(latitude,longitude);
create index realx_map_vendor_idx on public.realx_map_locations(vendor_id);
create table public.realx_map_cache (
  id text primary key, payload jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.realx_opportunity_action_configs (
  id text primary key, payload jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.realx_opportunity_action_requests (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.realx_students(id) on delete cascade,
  opportunity_id text not null references public.realx_opportunities(id) on delete cascade, request_id uuid not null,
  expires_at timestamptz,
  status text not null default 'pending', payload jsonb not null default '{}', created_at timestamptz not null default now(),
  unique(student_id,request_id)
);
create table public.realx_opportunity_analytics (
  id bigint generated always as identity primary key, student_id uuid references public.realx_students(id) on delete set null,
  opportunity_id text references public.realx_opportunities(id) on delete set null, event text not null,
  payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.realx_online_vendor_analytics (
  id bigint generated always as identity primary key, student_id uuid references public.realx_students(id) on delete set null,
  vendor_id text references public.realx_vendors(id) on delete set null, event text not null,
  payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.realx_onboarding_analytics (
  id bigint generated always as identity primary key, student_id uuid references public.realx_students(id) on delete set null,
  event text not null, payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.realx_reward_accounts (
  student_id uuid primary key references public.realx_students(id) on delete cascade,
  balance numeric(12,2) not null default 0, status_points bigint not null default 0,
  redemption_count bigint not null default 0, last_earned_at timestamptz,
  payload jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.realx_pilot_campaigns (
  id text primary key, active boolean not null default false, payload jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.realx_pilot_campaign_identity_claims (
  id uuid primary key default gen_random_uuid(), program_id text not null,
  identity_hash text not null, week_key text not null, student_id uuid references public.realx_students(id) on delete set null,
  created_at timestamptz not null default now(), unique(program_id,identity_hash,week_key)
);
create table public.realx_pilot_campaign_codes (
  campaign_id text not null references public.realx_pilot_campaigns(id) on delete cascade,
  id text not null, sequence integer not null, pool text not null check(pool in ('public','reserved')),
  code text not null, status text not null default 'available' check(status in ('available','assigned')),
  assigned_to_uid uuid references public.realx_students(id) on delete set null,
  assigned_claim_id uuid, assigned_by uuid references auth.users(id) on delete set null,
  configured_at timestamptz not null default now(), assigned_at timestamptz,
  primary key(campaign_id,id), unique(campaign_id,sequence), unique(campaign_id,code)
);
create table public.realx_pilot_campaign_claims (
  id uuid primary key default gen_random_uuid(), campaign_id text not null references public.realx_pilot_campaigns(id) on delete cascade,
  student_id uuid not null references public.realx_students(id) on delete cascade,
  user_email text, code_id text not null, pool text not null check(pool in ('public','reserved')),
  status text not null default 'assigned', claimed_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null, payload jsonb not null default '{}',
  unique(campaign_id,student_id), foreign key(campaign_id,code_id) references public.realx_pilot_campaign_codes(campaign_id,id) on delete restrict
);
alter table public.realx_pilot_campaign_codes
  add constraint realx_pilot_code_claim_fk foreign key(assigned_claim_id)
  references public.realx_pilot_campaign_claims(id) on delete set null;
create index realx_pilot_codes_available_idx on public.realx_pilot_campaign_codes(campaign_id,pool,sequence) where status='available';
create table public.realx_inventory_batches (
  id text primary key default gen_random_uuid()::text, program_id text,
  imported_by uuid references auth.users(id) on delete set null, record_count integer not null default 0,
  payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.realx_otp_challenges (
  id uuid primary key default gen_random_uuid(), email text not null, purpose text not null,
  code_hash text not null, verified_at timestamptz, expires_at timestamptz not null,
  attempts integer not null default 0, created_at timestamptz not null default now()
);
create index realx_otp_email_idx on public.realx_otp_challenges(lower(email),purpose,created_at desc);
create table public.realx_rate_limits (
  key text primary key, window_started_at timestamptz not null default now(), hit_count integer not null default 0
);

-- Protected Badrgo voucher inventory uses a per-user and per-Qatar-week lock.
create table public.realx_badrgo_voucher_programs (
  id text primary key default 'badrgo-rides', name text not null default 'Badrgo rides',
  active boolean not null default false, timezone text not null default 'Asia/Qatar',
  weekly_limit integer not null default 1 check(weekly_limit>0), terms jsonb not null default '{}',
  payload jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.realx_badrgo_voucher_inventory (
  id uuid primary key default gen_random_uuid(), program_id text not null references public.realx_badrgo_voucher_programs(id) on delete cascade,
  code_hash text not null unique, code_value text not null, import_id text, batch_id text,
  status text not null default 'available' check(status in ('available','assigned','reserved','redeemed','expired','revoked','void')),
  imported_at timestamptz not null default now(), assigned_at timestamptz, redeemed_at timestamptz,
  assigned_claim_id uuid, assigned_to_uid uuid references public.realx_students(id) on delete set null,
  redeemed_by uuid references public.realx_students(id) on delete set null, redemption_import_id text
);
create index realx_badrgo_available_idx on public.realx_badrgo_voucher_inventory(program_id,imported_at) where status='available';
create table public.realx_badrgo_voucher_claims (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references public.realx_badrgo_voucher_programs(id) on delete cascade,
  student_id uuid references public.realx_students(id) on delete set null,
  user_email text, week_key text not null, voucher_id uuid unique references public.realx_badrgo_voucher_inventory(id) on delete set null,
  identity_hash text not null, status text not null default 'assigned' check(status in ('assigned','redeemed','expired','revoked')),
  claimed_at timestamptz not null default now(), redeemed_at timestamptz, redemption_import_id text,
  unique(program_id,student_id,week_key), unique(program_id,identity_hash,week_key)
);
create table public.realx_admin_audit_log (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
  action text not null, entity_type text not null, entity_id text, details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.realx_redemption_imports (
  id text primary key, program_id text not null references public.realx_badrgo_voucher_programs(id) on delete cascade,
  imported_by uuid references auth.users(id) on delete set null, status text not null default 'processing',
  requested_count integer not null default 0, matched_count integer not null default 0,
  already_redeemed_count integer not null default 0, unmatched_count integer not null default 0,
  payload jsonb not null default '{}', created_at timestamptz not null default now(), completed_at timestamptz
);
alter table public.realx_user_roles
  add constraint realx_user_roles_holding_group_fk foreign key(holding_group_id)
    references public.realx_holding_groups(id) on delete set null,
  add constraint realx_user_roles_vendor_fk foreign key(vendor_id)
    references public.realx_vendors(id) on delete set null;
alter table public.realx_badrgo_voucher_inventory
  add constraint realx_inventory_redemption_import_fk foreign key(redemption_import_id)
    references public.realx_redemption_imports(id) on delete set null;
alter table public.realx_badrgo_voucher_claims
  add constraint realx_claim_redemption_import_fk foreign key(redemption_import_id)
    references public.realx_redemption_imports(id) on delete set null;
alter table public.realx_pilot_campaign_identity_claims
  add constraint realx_pilot_claim_program_fk foreign key(program_id)
  references public.realx_pilot_campaigns(id) on delete cascade;
alter table public.realx_inventory_batches
  add constraint realx_inventory_batch_program_fk foreign key(program_id)
  references public.realx_badrgo_voucher_programs(id) on delete set null;
alter table public.realx_badrgo_voucher_inventory
  add constraint realx_inventory_assigned_claim_fk foreign key(assigned_claim_id)
  references public.realx_badrgo_voucher_claims(id) on delete set null;
create unique index realx_verification_pending_email_idx
  on public.realx_verification_requests(lower(email)) where status='pending';

create or replace function public.realx_is_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.realx_user_roles where user_id=(select auth.uid()) and role='admin');
$$;
create or replace function public.realx_allowed_student_email(p_email text)
returns boolean language sql immutable set search_path='' as $$
  select split_part(lower(trim(p_email)),'@',2) like '%.qa'
    or split_part(lower(trim(p_email)),'@',2)=any(array[
      'gemsed.com','dpsmisdoha.com','oliveschooldoha.com','rajagiridoha.com','education.qa',
      'americanacademy.sch.qa','student.ukm.qa','miesppu.edu.qa','abdn.ac.uk','ulster.ac.uk',
      'student.dbs.sch.qa','student.dbsrawdat.com','asd.equ.qa','qu.edu.qa','oryx.edu.qa',
      'lu.edu.qa','tamu.edu','smail.astate.edu','hbku.edu.qa','andrew.cmu.edu'
    ]);
$$;
create or replace function public.realx_is_vendor_member(p_vendor_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.realx_vendor_memberships where user_id=(select auth.uid()) and vendor_id=p_vendor_id and role in ('owner','manager'))
    or exists(select 1 from public.realx_vendors where id=p_vendor_id and user_id=(select auth.uid()));
$$;
create or replace function public.realx_touch_updated_at()
returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;

create or replace function public.realx_update_map_cache_entry(p_vendor_id text,p_entry jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.realx_map_cache(id,payload) values('locations','{}'::jsonb) on conflict(id) do nothing;
  update public.realx_map_cache
    set payload=case when p_entry is null then coalesce(payload,'{}'::jsonb)-p_vendor_id else jsonb_set(coalesce(payload,'{}'::jsonb),array[p_vendor_id],p_entry,true) end,
        updated_at=now()
    where id='locations';
end $$;

create or replace function public.realx_geohash(p_latitude double precision,p_longitude double precision,p_precision integer default 10)
returns text language plpgsql immutable set search_path='' as $$
declare
  alphabet constant text:='0123456789bcdefghjkmnpqrstuvwxyz';
  lat_min double precision:=-90;lat_max double precision:=90;lon_min double precision:=-180;lon_max double precision:=180;
  midpoint double precision;even_bit boolean:=true;bit_count integer:=0;value integer:=0;result text:='';i integer;
begin
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then return null; end if;
  if p_precision<1 or p_precision>12 then raise exception 'Geohash precision must be from 1 to 12'; end if;
  for i in 1..(p_precision*5) loop
    if even_bit then
      midpoint:=(lon_min+lon_max)/2;
      if p_longitude>=midpoint then value:=value*2+1;lon_min:=midpoint;else value:=value*2;lon_max:=midpoint;end if;
    else
      midpoint:=(lat_min+lat_max)/2;
      if p_latitude>=midpoint then value:=value*2+1;lat_min:=midpoint;else value:=value*2;lat_max:=midpoint;end if;
    end if;
    even_bit:=not even_bit;bit_count:=bit_count+1;
    if bit_count=5 then result:=result||substr(alphabet,value+1,1);bit_count:=0;value:=0;end if;
  end loop;
  return result;
end $$;

create or replace function public.realx_sync_vendor_map()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  vendor_id text;vendor public.realx_vendors%rowtype;payload jsonb;offers jsonb;offer jsonb;location jsonb;loc record;
  lat_text text;lon_text text;lat_value double precision;lon_value double precision;location_key text;full_hash text;
  location_json jsonb:='[]'::jsonb;primary_location jsonb;first_location jsonb;offer_types text[]:='{}';first_offer jsonb;
  offer_count integer:=0;is_primary boolean;entry jsonb;map_payload jsonb;location_index bigint;
begin
  if tg_op='DELETE' then
    vendor_id:=old.id;
    delete from public.realx_map_locations where realx_map_locations.vendor_id=vendor_id;
    delete from public.realx_offers where realx_offers.vendor_id=vendor_id;
    perform public.realx_update_map_cache_entry(vendor_id,null);
    return old;
  end if;
  vendor:=new;vendor_id:=new.id;payload:=coalesce(new.payload,'{}'::jsonb);
  offers:=case when jsonb_typeof(payload->'offers')='array' then payload->'offers' else '[]'::jsonb end;
  delete from public.realx_map_locations where realx_map_locations.vendor_id=vendor_id;
  delete from public.realx_offers where realx_offers.vendor_id=vendor_id;
  for offer,location_index in select value,ordinality from jsonb_array_elements(offers) with ordinality loop
    insert into public.realx_offers(id,vendor_id,title,description,offer_type,discount,active,payload)
    values(vendor_id||':embedded:'||location_index::text,vendor_id,coalesce(offer->>'titleEn',offer->>'title',offer->>'name',''),coalesce(offer->>'descriptionEn',offer->>'description'),coalesce(offer->>'discountType','discount'),
      case when coalesce(offer->>'discountValue','') ~ '^-?[0-9]+([.][0-9]+)?$' then (offer->>'discountValue')::numeric else null end,
      coalesce((offer->>'isActive')::boolean,true),offer)
    on conflict(id) do update set title=excluded.title,description=excluded.description,offer_type=excluded.offer_type,discount=excluded.discount,active=excluded.active,payload=excluded.payload,updated_at=now();
  end loop;
  if new.status='Active' and new.vendor_type<>'online' then
    select coalesce(array_agg(distinct value->>'discountType') filter(where nullif(value->>'discountType','') is not null),'{}'::text[])
      into offer_types from jsonb_array_elements(offers);
    offer_count:=jsonb_array_length(offers);
    if offer_count>0 then
      offer:=offers->0;
      first_offer:=jsonb_strip_nulls(jsonb_build_object('titleEn',offer->>'titleEn','titleAr',offer->>'titleAr','discountType',offer->>'discountType'));
    end if;
    if jsonb_typeof(new.locations)='array' and jsonb_array_length(new.locations)>0 then
      for loc in select value,ordinality from jsonb_array_elements(new.locations) with ordinality loop
        location:=loc.value;location_index:=loc.ordinality;
        lat_text:=coalesce(location->>'latitude',payload->>'latitude',payload->>'lat');lon_text:=coalesce(location->>'longitude',payload->>'longitude',payload->>'lng');
        if coalesce(lat_text,'') !~ '^-?[0-9]+([.][0-9]+)?$' or coalesce(lon_text,'') !~ '^-?[0-9]+([.][0-9]+)?$' then continue;end if;
        lat_value:=lat_text::double precision;lon_value:=lon_text::double precision;
        if lat_value not between -90 and 90 or lon_value not between -180 and 180 then continue;end if;
        full_hash:=public.realx_geohash(lat_value,lon_value,10);
        location_key:=coalesce(nullif(location->>'id',''),case when location->>'isPrimary'='true' then 'primary' else 'branch-'||location_index::text end);
        is_primary:=coalesce(location->>'isPrimary'='true',false) or location_index=1;
        location:=jsonb_build_object('id',location_key,'latitude',lat_value,'longitude',lon_value,'geohash',full_hash,'address',coalesce(location->'address',payload->'address'),'addressAr',coalesce(location->'addressAr',payload->'addressAr'),'isPrimary',is_primary)
          ||case when jsonb_typeof(loc.value)='object' then jsonb_strip_nulls(jsonb_build_object('name',loc.value->>'name','nameAr',loc.value->>'nameAr','phoneNumber',loc.value->>'phoneNumber')) else '{}'::jsonb end;
        location_json:=location_json||jsonb_build_array(location);
        if first_location is null then first_location:=location;end if;
        if is_primary then primary_location:=location;end if;
        map_payload:=jsonb_build_object('name',coalesce(new.name,payload->>'name'),'nameAr',payload->>'nameAr','vendorName',coalesce(new.name,payload->>'name'),'vendorNameAr',payload->>'nameAr',
          'branchName',loc.value->>'name','branchNameAr',loc.value->>'nameAr','phoneNumber',loc.value->>'phoneNumber','geohash',full_hash,'geohash4',left(full_hash,4),'geohash5',left(full_hash,5),'geohash6',left(full_hash,6),
          'address',coalesce(loc.value->'address',payload->'address'),'addressAr',coalesce(loc.value->'addressAr',payload->'addressAr'),'mainCategory',payload->'mainCategory','profilePicture',coalesce(payload->'profilePicture',payload->'logo',payload->'logoUrl'),
          'vendorType',new.vendor_type,'status',new.status,'isActive',true,'xcard',coalesce((payload->>'xcard')::boolean,false),'offerTypes',to_jsonb(offer_types),'hasBuyOneGetOne','buy1get1'=any(offer_types),'hasStudentDeal',offer_count>0,
          'openingHours',coalesce(payload->'openingHours',payload->'hours'),'searchTokens',coalesce(payload->'searchTokens','[]'::jsonb),'firstOffer',first_offer,'isPrimary',is_primary,'updatedAt',now());
        insert into public.realx_map_locations(id,vendor_id,latitude,longitude,geohash,payload)
        values(vendor_id||'_'||regexp_replace(location_key,'[/[:space:]]+','_','g'),vendor_id,lat_value,lon_value,full_hash,map_payload)
        on conflict(id) do update set vendor_id=excluded.vendor_id,latitude=excluded.latitude,longitude=excluded.longitude,geohash=excluded.geohash,payload=excluded.payload,updated_at=now();
      end loop;
    else
      lat_text:=coalesce(payload->>'latitude',payload->>'lat');lon_text:=coalesce(payload->>'longitude',payload->>'lng');
      if coalesce(lat_text,'') ~ '^-?[0-9]+([.][0-9]+)?$' and coalesce(lon_text,'') ~ '^-?[0-9]+([.][0-9]+)?$' then
        lat_value:=lat_text::double precision;lon_value:=lon_text::double precision;
        if lat_value between -90 and 90 and lon_value between -180 and 180 then
          full_hash:=public.realx_geohash(lat_value,lon_value,10);
          location:=jsonb_build_object('id','primary','latitude',lat_value,'longitude',lon_value,'geohash',full_hash,'address',payload->'address','addressAr',payload->'addressAr','isPrimary',true);
          location_json:=jsonb_build_array(location);primary_location:=location;first_location:=location;
          map_payload:=jsonb_build_object('name',coalesce(new.name,payload->>'name'),'nameAr',payload->>'nameAr','vendorName',coalesce(new.name,payload->>'name'),'vendorNameAr',payload->>'nameAr',
            'geohash',full_hash,'geohash4',left(full_hash,4),'geohash5',left(full_hash,5),'geohash6',left(full_hash,6),'address',payload->'address','addressAr',payload->'addressAr','mainCategory',payload->'mainCategory',
            'profilePicture',coalesce(payload->'profilePicture',payload->'logo',payload->'logoUrl'),'vendorType',new.vendor_type,'status',new.status,'isActive',true,'xcard',coalesce((payload->>'xcard')::boolean,false),
            'offerTypes',to_jsonb(offer_types),'hasBuyOneGetOne','buy1get1'=any(offer_types),'hasStudentDeal',offer_count>0,'openingHours',coalesce(payload->'openingHours',payload->'hours'),
            'searchTokens',coalesce(payload->'searchTokens','[]'::jsonb),'firstOffer',first_offer,'isPrimary',true,'updatedAt',now());
          insert into public.realx_map_locations(id,vendor_id,latitude,longitude,geohash,payload) values(vendor_id||'_primary',vendor_id,lat_value,lon_value,full_hash,map_payload)
          on conflict(id) do update set latitude=excluded.latitude,longitude=excluded.longitude,geohash=excluded.geohash,payload=excluded.payload,updated_at=now();
        end if;
      end if;
    end if;
  end if;
  if primary_location is null then primary_location:=first_location;end if;
  if primary_location is not null and new.status='Active' and new.vendor_type<>'online' then
    entry:=jsonb_build_object('name',coalesce(new.name,payload->>'name'),'nameAr',payload->>'nameAr','vendorName',coalesce(new.name,payload->>'name'),'vendorNameAr',payload->>'nameAr',
      'latitude',primary_location->'latitude','longitude',primary_location->'longitude','geohash',left(primary_location->>'geohash',5),'address',coalesce(payload->'address',primary_location->'address'),
      'addressAr',coalesce(payload->'addressAr',primary_location->'addressAr'),'mainCategory',payload->'mainCategory','profilePicture',coalesce(payload->'profilePicture',payload->'logo',payload->'logoUrl'),
      'xcard',coalesce((payload->>'xcard')::boolean,false),'offerTypes',to_jsonb(offer_types),'hasBuyOneGetOne','buy1get1'=any(offer_types),'hasStudentDeal',offer_count>0,
      'openingHours',coalesce(payload->'openingHours',payload->'hours'),'searchTokens',coalesce(payload->'searchTokens','[]'::jsonb),'firstOffer',first_offer,'locations',location_json);
  end if;
  perform public.realx_update_map_cache_entry(vendor_id,entry);
  return new;
end $$;

create trigger realx_vendor_map_sync after insert or update or delete on public.realx_vendors
for each row execute function public.realx_sync_vendor_map();

create or replace function public.realx_consume_notification_quota(p_date_key date,p_daily_limit integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare next_count integer;
begin
  if p_daily_limit<1 then return false; end if;
  insert into public.realx_notification_daily_limits(date_key,count) values(p_date_key,1)
    on conflict(date_key) do update set count=public.realx_notification_daily_limits.count+1,updated_at=now()
    where public.realx_notification_daily_limits.count<p_daily_limit
    returning count into next_count;
  return next_count is not null;
end $$;

do $$ declare t text; begin
  foreach t in array array['realx_universities','realx_categories','realx_students','realx_vendors','realx_offers','realx_events','realx_banners','realx_holding_groups','realx_badrgo_voucher_programs'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.realx_touch_updated_at()',t,t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array[
    'realx_user_roles','realx_universities','realx_categories','realx_students','realx_vendors','realx_vendor_memberships',
    'realx_offers','realx_student_saved_items','realx_transactions','realx_verification_requests',
    'realx_wakti_student_verification_requests','realx_events','realx_banners','realx_featured_brands',
    'realx_trending_offer_banners','realx_cms_documents','realx_holding_groups','realx_holding_group_members','realx_notifications',
    'realx_notification_deliveries','realx_notification_daily_limits',
    'realx_push_tokens','realx_vendor_online_configs','realx_online_vendor_clicks','realx_vendor_redemption_secrets',
    'realx_creator_codes','realx_otp_challenges','realx_rate_limits','realx_badrgo_voucher_programs',
    'realx_pilot_campaign_codes','realx_pilot_campaign_claims',
    'realx_badrgo_voucher_inventory','realx_badrgo_voucher_claims','realx_admin_audit_log','realx_redemption_imports'
  ] loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;
alter table public.realx_redemption_imports enable row level security;

create policy realx_roles_self on public.realx_user_roles for select to authenticated using(user_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_university_read on public.realx_universities for select to anon,authenticated using(active or public.realx_is_admin());
create policy realx_university_admin on public.realx_universities for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_category_read on public.realx_categories for select to anon,authenticated using(active or public.realx_is_admin());
create policy realx_category_admin on public.realx_categories for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_student_read on public.realx_students for select to authenticated using(id=(select auth.uid()) or public.realx_is_admin());
create policy realx_student_update on public.realx_students for update to authenticated using(id=(select auth.uid()) or public.realx_is_admin()) with check(id=(select auth.uid()) or public.realx_is_admin());
create policy realx_vendor_read on public.realx_vendors for select to anon,authenticated using(status='Active' or public.realx_is_admin() or user_id=(select auth.uid()) or public.realx_is_vendor_member(id));
create policy realx_vendor_admin on public.realx_vendors for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_vendor_members_self on public.realx_vendor_memberships for select to authenticated using(user_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_offer_read on public.realx_offers for select to anon,authenticated using(active or public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));
create policy realx_offer_write on public.realx_offers for all to authenticated using(public.realx_is_admin() or public.realx_is_vendor_member(vendor_id)) with check(public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));
create policy realx_saved_owner on public.realx_student_saved_items for all to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));
create policy realx_transactions_read on public.realx_transactions for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));
create policy realx_verification_owner on public.realx_verification_requests for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_verification_admin on public.realx_verification_requests for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_wakti_owner on public.realx_wakti_student_verification_requests for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_wakti_admin on public.realx_wakti_student_verification_requests for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_events_read on public.realx_events for select to anon,authenticated using(published or public.realx_is_admin());
create policy realx_events_admin on public.realx_events for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_banners_read on public.realx_banners for select to anon,authenticated using(active or public.realx_is_admin());
create policy realx_banners_admin on public.realx_banners for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_featured_read on public.realx_featured_brands for select to anon,authenticated using(active or public.realx_is_admin());
create policy realx_featured_admin on public.realx_featured_brands for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_trending_read on public.realx_trending_offer_banners for select to anon,authenticated using(active or public.realx_is_admin());
create policy realx_trending_admin on public.realx_trending_offer_banners for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_cms_read on public.realx_cms_documents for select to anon,authenticated using(true);
create policy realx_cms_admin on public.realx_cms_documents for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_holding_scope on public.realx_holding_groups for select to authenticated using(public.realx_is_admin() or exists(select 1 from public.realx_user_roles r where r.user_id=(select auth.uid()) and r.holding_group_id=id));
create policy realx_holding_admin on public.realx_holding_groups for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_holding_members_scope on public.realx_holding_group_members for select to authenticated using(user_id=(select auth.uid()) or public.realx_is_admin());
alter table public.realx_holding_group_vendors enable row level security;
create policy realx_holding_group_vendors_scope on public.realx_holding_group_vendors for select to authenticated using(public.realx_is_admin() or exists(select 1 from public.realx_user_roles r where r.user_id=(select auth.uid()) and r.holding_group_id=public.realx_holding_group_vendors.holding_group_id));
create policy realx_notifications_read on public.realx_notifications for select to authenticated using(recipient_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_notifications_admin on public.realx_notifications for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_notification_deliveries_admin on public.realx_notification_deliveries for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_notification_limits_admin on public.realx_notification_daily_limits for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_push_tokens_owner on public.realx_push_tokens for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy realx_online_config_read on public.realx_vendor_online_configs for select to anon,authenticated using(active or public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));
create policy realx_online_config_admin on public.realx_vendor_online_configs for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_clicks_owner on public.realx_online_vendor_clicks for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_vendor_secrets_deny on public.realx_vendor_redemption_secrets for all to authenticated using(false) with check(false);
create policy realx_creator_codes_owner on public.realx_creator_codes for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
alter table public.realx_opportunities enable row level security;
alter table public.realx_map_locations enable row level security;
alter table public.realx_map_cache enable row level security;
alter table public.realx_opportunity_action_configs enable row level security;
alter table public.realx_opportunity_action_requests enable row level security;
alter table public.realx_opportunity_analytics enable row level security;
alter table public.realx_online_vendor_analytics enable row level security;
alter table public.realx_onboarding_analytics enable row level security;
alter table public.realx_reward_accounts enable row level security;
alter table public.realx_pilot_campaigns enable row level security;
alter table public.realx_pilot_campaign_identity_claims enable row level security;
alter table public.realx_inventory_batches enable row level security;
create policy realx_opportunities_public_read on public.realx_opportunities for select to anon,authenticated using(published or public.realx_is_admin());
create policy realx_opportunities_admin_write on public.realx_opportunities for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_map_locations_public_read on public.realx_map_locations for select to anon,authenticated using(true);
create policy realx_map_admin_write on public.realx_map_locations for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_map_cache_admin on public.realx_map_cache for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_action_config_admin on public.realx_opportunity_action_configs for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_action_request_owner on public.realx_opportunity_action_requests for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_opportunity_analytics_admin on public.realx_opportunity_analytics for select to authenticated using(public.realx_is_admin());
create policy realx_online_analytics_admin on public.realx_online_vendor_analytics for select to authenticated using(public.realx_is_admin());
create policy realx_onboarding_analytics_admin on public.realx_onboarding_analytics for select to authenticated using(public.realx_is_admin());
create policy realx_reward_account_owner on public.realx_reward_accounts for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_pilot_campaign_read on public.realx_pilot_campaigns for select to anon,authenticated using(active or public.realx_is_admin());
create policy realx_pilot_campaign_admin on public.realx_pilot_campaigns for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_pilot_claims_owner on public.realx_pilot_campaign_identity_claims for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_pilot_codes_admin on public.realx_pilot_campaign_codes for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_pilot_campaign_claim_owner on public.realx_pilot_campaign_claims for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_inventory_batch_admin on public.realx_inventory_batches for select to authenticated using(public.realx_is_admin());
create policy realx_redemption_import_admin on public.realx_redemption_imports for select to authenticated using(public.realx_is_admin());
create policy realx_otp_deny on public.realx_otp_challenges for all to authenticated using(false) with check(false);
create policy realx_limits_deny on public.realx_rate_limits for all to authenticated using(false) with check(false);
create policy realx_badrgo_program_read on public.realx_badrgo_voucher_programs for select to anon,authenticated using(active or public.realx_is_admin());
create policy realx_badrgo_program_admin on public.realx_badrgo_voucher_programs for all to authenticated using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy realx_badrgo_inventory_deny on public.realx_badrgo_voucher_inventory for all to authenticated using(false) with check(false);
create policy realx_badrgo_claims_owner on public.realx_badrgo_voucher_claims for select to authenticated using(student_id=(select auth.uid()) or public.realx_is_admin());
create policy realx_audit_admin on public.realx_admin_audit_log for select to authenticated using(public.realx_is_admin());

insert into public.realx_badrgo_voucher_programs(id) values('badrgo-rides') on conflict(id) do nothing;

create or replace function public.realx_complete_signup(p_profile jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); code text; existing public.realx_students%rowtype; email_value text; approved_manual boolean;
begin
  if uid is null then raise exception 'Login required' using errcode='28000'; end if;
  email_value:=lower(trim(coalesce(p_profile->>'email','')));
  if email_value<>lower(coalesce((select email from auth.users where id=uid),'')) then raise exception 'Authenticated email mismatch' using errcode='42501'; end if;
  if coalesce(length(trim(p_profile->>'firstName')),0)=0 or length(trim(p_profile->>'firstName'))>80 or coalesce(length(trim(p_profile->>'lastName')),0)=0 or length(trim(p_profile->>'lastName'))>80 then raise exception 'First and last name are required' using errcode='22023'; end if;
  if coalesce(p_profile->>'accountRole','student') not in ('student','creator') then raise exception 'Valid role is required' using errcode='22023'; end if;
  select exists(select 1 from public.realx_verification_requests where email=email_value and status='approved' and student_id=uid) into approved_manual;
  if not public.realx_allowed_student_email(email_value) and not approved_manual then raise exception 'Only approved school emails can complete signup' using errcode='42501'; end if;
  select * into existing from public.realx_students where id=uid for update;
  if found then return jsonb_build_object('success',true,'alreadyExists',true,'creatorCode',existing.creator_code); end if;
  if p_profile->>'accountRole'='creator' then
    loop code:=upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,8)); exit when not exists(select 1 from public.realx_creator_codes where realx_creator_codes.code=code); end loop;
    insert into public.realx_creator_codes(code,student_id) values(code,uid);
  end if;
  insert into public.realx_students(id,email,first_name,last_name,account_role,creator_code,verification_status,profile)
  values(uid,email_value,trim(p_profile->>'firstName'),trim(p_profile->>'lastName'),coalesce(p_profile->>'accountRole','student'),code,'verified',p_profile);
  return jsonb_build_object('success',true,'creatorCode',code);
end $$;

create or replace function public.realx_assign_creator_code()
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); code text;
begin
  if uid is null then raise exception 'Login required' using errcode='28000'; end if;
  select creator_code into code from public.realx_students where id=uid for update;
  if not found then raise exception 'Student not found' using errcode='P0002'; end if;
  if code is null then
    loop code:=upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,8)); exit when not exists(select 1 from public.realx_creator_codes where realx_creator_codes.code=code); end loop;
    insert into public.realx_creator_codes(code,student_id) values(code,uid);
    update public.realx_students set creator_code=code where id=uid;
  end if;
  return code;
end $$;

create or replace function public.realx_submit_verification_request(p_email text,p_role text,p_status_token text,p_image_path text,p_details jsonb default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); req uuid;
begin
  if uid is not null and lower(trim(p_email))<>lower(coalesce((select email from auth.users where id=uid),'')) then raise exception 'Authenticated email mismatch' using errcode='42501'; end if;
  if p_role not in ('student','creator') or length(coalesce(p_status_token,''))<20 then raise exception 'Invalid verification request' using errcode='22023'; end if;
  if exists(select 1 from public.realx_verification_requests where lower(email)=lower(trim(p_email)) and status='pending') then raise exception 'Pending request already exists' using errcode='23505'; end if;
  insert into public.realx_verification_requests(email,student_id,requested_role,status_token_hash,id_image_path,details)
  values(lower(trim(p_email)),uid,p_role,encode(extensions.digest(p_status_token,'sha256'),'hex'),p_image_path,p_details) returning id into req;
  return req;
end $$;
create or replace function public.realx_get_verification_status(p_request_id uuid,p_status_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.realx_verification_requests%rowtype;
begin
  select * into r from public.realx_verification_requests where id=p_request_id;
  if not found or r.status_token_hash<>encode(extensions.digest(p_status_token,'sha256'),'hex') then raise exception 'Invalid status token' using errcode='42501'; end if;
  return jsonb_build_object('status',r.status,'requestId',r.id,'rejectionReason',r.rejection_reason,'role',r.requested_role);
end $$;
create or replace function public.realx_cancel_verification_request(p_request_id uuid,p_status_token text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.realx_verification_requests%rowtype;
begin
  select * into r from public.realx_verification_requests where id=p_request_id for update;
  if not found or r.status_token_hash<>encode(extensions.digest(p_status_token,'sha256'),'hex') then raise exception 'Invalid status token' using errcode='42501'; end if;
  if r.status<>'pending' then raise exception 'Only pending requests can be cancelled' using errcode='55000'; end if;
  update public.realx_verification_requests set status='cancelled',updated_at=now() where id=p_request_id;
end $$;
create or replace function public.realx_review_verification_request(p_request_id uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.realx_verification_requests%rowtype;
begin
  if not public.realx_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision' using errcode='22023'; end if;
  select * into r from public.realx_verification_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if r.status<>'pending' then raise exception 'Request already reviewed' using errcode='55000'; end if;
  update public.realx_verification_requests set status=p_decision,rejection_reason=case when p_decision='rejected' then left(trim(coalesce(p_reason,'')),500) end,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_request_id;
  insert into public.realx_admin_audit_log(actor_id,action,entity_type,entity_id,details) values(auth.uid(),p_decision,'verification_request',p_request_id::text,jsonb_build_object('email',r.email));
  return jsonb_build_object('success',true,'email',r.email,'studentId',r.student_id,'role',r.requested_role,'requestId',r.id);
end $$;

create or replace function public.realx_set_vendor_redemption_pin(p_vendor_id text,p_pin text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.realx_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_pin is null or p_pin !~ '^\d{4}$' then raise exception 'PIN must contain exactly 4 digits' using errcode='22023'; end if;
  insert into public.realx_vendor_redemption_secrets(vendor_id,pin_hash,pin_salt,rotated_by,updated_at)
  values(p_vendor_id,extensions.crypt(p_pin,extensions.gen_salt('bf')),'',auth.uid(),now())
  on conflict(vendor_id) do update set pin_hash=excluded.pin_hash,pin_salt=excluded.pin_salt,rotated_by=excluded.rotated_by,updated_at=now();
end $$;

create or replace function public.realx_redeem_offer(
  p_vendor_id text,p_offer_id text,p_total_amount numeric,p_pin text,p_type text,
  p_giftcard_amount numeric,p_offer_index integer,p_creator_code text,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); student public.realx_students%rowtype; vendor public.realx_vendors%rowtype;
  secret public.realx_vendor_redemption_secrets%rowtype; creator public.realx_students%rowtype;
  txn public.realx_transactions%rowtype; offer_data jsonb; creator_code_row public.realx_creator_codes%rowtype;
  total_cents bigint; discount_cents bigint:=0; gift_cents bigint:=0; final_cents bigint;
  user_cashback bigint:=0; creator_cashback bigint:=0; rate_key text; rate_row public.realx_rate_limits%rowtype;
  creator_name text; discount_type text; discount_value numeric; allowed_values jsonb; response jsonb;
begin
  if uid is null then raise exception 'Login required' using errcode='28000'; end if;
  if p_type is null or p_type not in ('offer','giftcard') then raise exception 'Invalid redemption type' using errcode='22023'; end if;
  if p_total_amount is null or p_total_amount<0.01 or p_total_amount>1000000 or round(p_total_amount*100)<>p_total_amount*100 then raise exception 'Total amount is invalid' using errcode='22023'; end if;
  select * into txn from public.realx_transactions where student_id=uid and idempotency_key=p_idempotency_key;
  if found and txn.payload ? 'finalAmount' then return txn.payload; end if;
  select * into student from public.realx_students where id=uid for update;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;
  if coalesce((student.profile->>'redemptionDisabled')::boolean,false) or student.profile->>'accountType'='browse_only' then raise exception 'This account cannot make redemptions' using errcode='42501'; end if;
  select * into vendor from public.realx_vendors where id=p_vendor_id for share;
  if not found then raise exception 'Vendor not found' using errcode='P0002'; end if;
  select * into secret from public.realx_vendor_redemption_secrets where vendor_id=p_vendor_id for share;
  if not found then raise exception 'Vendor redemption is not configured' using errcode='55000'; end if;
  if p_pin is null or p_pin !~ '^\d{4}$' or extensions.crypt(p_pin,secret.pin_hash) is distinct from secret.pin_hash then raise exception 'Invalid PIN' using errcode='42501'; end if;
  rate_key:=encode(extensions.digest(uid::text||':'||p_vendor_id,'sha256'),'hex');
  insert into public.realx_rate_limits(key,window_started_at,hit_count) values(rate_key,now(),1)
    on conflict(key) do update set hit_count=case when now()-realx_rate_limits.window_started_at<interval '5 minutes' then realx_rate_limits.hit_count+1 else 1 end,
      window_started_at=case when now()-realx_rate_limits.window_started_at<interval '5 minutes' then realx_rate_limits.window_started_at else now() end returning * into rate_row;
  if rate_row.hit_count>10 then raise exception 'Too many redemption attempts. Please try again later.' using errcode='42900'; end if;
  total_cents:=round(p_total_amount*100);final_cents:=total_cents;
  if p_type='offer' then
    if p_offer_index is not null then
      offer_data:=vendor.payload->'offers'->p_offer_index;
      if offer_data is null then raise exception 'Offer not found for this vendor' using errcode='P0002'; end if;
      if coalesce((offer_data->>'isActive')::boolean,true)=false then raise exception 'Offer is not available' using errcode='55000'; end if;
      discount_type:=offer_data->>'discountType';discount_value:=coalesce((offer_data->>'discountValue')::numeric,0);
      if discount_value<0 then raise exception 'Invalid discount value' using errcode='22023'; end if;
      if discount_type='percentage' then discount_cents:=round(total_cents*discount_value/100);
      elsif discount_type='amount' then discount_cents:=round(discount_value*100);
      elsif discount_type='buy1get1' then discount_cents:=0;
      else raise exception 'Invalid discount type' using errcode='22023'; end if;
      discount_cents:=least(discount_cents,total_cents);final_cents:=total_cents-discount_cents;
    end if;
    if nullif(trim(coalesce(p_creator_code,'')),'') is not null then
      select * into creator_code_row from public.realx_creator_codes where code=upper(trim(p_creator_code));
      if not found then raise exception 'Invalid creator code' using errcode='P0002'; end if;
      select * into creator from public.realx_students where id=creator_code_row.student_id;
      if not found then raise exception 'Creator not found' using errcode='P0002'; end if;
      creator_name:=coalesce(creator.profile->>'name',nullif(creator.first_name||' '||creator.last_name,' '));
    end if;
    if coalesce((vendor.payload->>'xcard')::boolean,false) then
      user_cashback:=round(final_cents*0.01);if creator_code_row.student_id is not null then creator_cashback:=round(final_cents*0.01);end if;
    end if;
  else
    allowed_values:=vendor.payload->'loyalty';if jsonb_typeof(allowed_values)<>'array' or jsonb_array_length(allowed_values)=0 then allowed_values:='[25,50,75]'::jsonb;end if;
    if p_giftcard_amount is null or p_giftcard_amount<=0 or not exists(select 1 from jsonb_array_elements_text(allowed_values) item where round(item::numeric*100)=round(p_giftcard_amount*100)) then raise exception 'Gift card value is not available for this vendor' using errcode='22023'; end if;
    gift_cents:=round(p_giftcard_amount*100);
    if round(student.cashback*100)<gift_cents then raise exception 'Insufficient balance' using errcode='55000'; end if;
    final_cents:=greatest(0,total_cents-gift_cents);
    update public.realx_students set cashback=cashback-(gift_cents::numeric/100),savings=savings+(gift_cents::numeric/100) where id=uid;
  end if;
  insert into public.realx_transactions(student_id,vendor_id,vendor_id_snapshot,offer_id,transaction_type,status,idempotency_key,amount,total_amount,final_amount,discount_amount,vendor_name,type,cashback_amount,creator_cashback_amount,creator_code,creator_uid,discount_type,discount_value,redemption_card_amount,remaining_amount,metadata,completed_at)
  values(uid,p_vendor_id,p_vendor_id,p_offer_id,p_type,'completed',p_idempotency_key,p_total_amount,p_total_amount,final_cents::numeric/100,discount_cents::numeric/100,vendor.name,p_type,user_cashback::numeric/100,creator_cashback::numeric/100,nullif(p_creator_code,''),creator_code_row.student_id,discount_type,discount_value,gift_cents::numeric/100,final_cents::numeric/100,
    jsonb_build_object('totalAmount',p_total_amount,'finalAmount',final_cents::numeric/100,'offer',offer_data,'creatorCode',nullif(p_creator_code,''),'cashbackAmount',user_cashback::numeric/100,'creatorCashbackAmount',creator_cashback::numeric/100),now()) returning * into txn;
  if p_type='offer' and (discount_cents+gift_cents)>0 then update public.realx_students set savings=savings+(discount_cents::numeric/100) where id=uid; end if;
  if user_cashback>0 then update public.realx_students set cashback=cashback+(user_cashback::numeric/100) where id=uid; end if;
  if creator_cashback>0 then update public.realx_students set cashback=cashback+(creator_cashback::numeric/100) where id=creator_code_row.student_id; end if;
  insert into public.realx_reward_accounts(student_id,status_points,redemption_count,last_earned_at,updated_at)
    values(uid,100,1,now(),now()) on conflict(student_id) do update set status_points=realx_reward_accounts.status_points+100,redemption_count=realx_reward_accounts.redemption_count+1,last_earned_at=now(),updated_at=now();
  response:=jsonb_build_object('transactionId',txn.id,'finalAmount',final_cents::numeric/100,'discountAmount',discount_cents::numeric/100,
    'savedAmount',(discount_cents+gift_cents)::numeric/100,'cashbackAmount',case when creator_code_row.student_id=uid then (user_cashback+creator_cashback)::numeric/100 else user_cashback::numeric/100 end,
    'creatorUid',creator_code_row.student_id,'creatorName',creator_name,'creatorCashback',creator_cashback::numeric/100,'vendorName',vendor.name);
  update public.realx_transactions set payload=response where id=txn.id;
  return response;
end $$;
create or replace function public.realx_redeem_gift_card(p_vendor_id text,p_amount numeric,p_idempotency_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'Use realx_redeem_offer with the transaction PIN' using errcode='42501'; end $$;
create or replace function public.realx_record_online_click(p_vendor_id text,p_request_id uuid,p_platform text default 'web')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); c public.realx_online_vendor_clicks%rowtype;
  student public.realx_students%rowtype; vendor public.realx_vendors%rowtype;
  config public.realx_vendor_online_configs%rowtype; destination text; tracked_value boolean:=false;
  qatar_day_start timestamptz; click_count integer;
begin
  if uid is null then raise exception 'Login required' using errcode='28000'; end if;
  if p_request_id is null then raise exception 'A request ID is required' using errcode='22023'; end if;
  select * into student from public.realx_students where id=uid;
  if not found then raise exception 'Student profile not found' using errcode='P0002'; end if;
  if coalesce((student.profile->>'redemptionDisabled')::boolean,false) or student.profile->>'accountType'='browse_only' then raise exception 'This account cannot access online vendor offers' using errcode='42501'; end if;
  select * into vendor from public.realx_vendors where id=p_vendor_id;
  if not found then raise exception 'Vendor not found' using errcode='P0002'; end if;
  if vendor.vendor_type<>'online' or vendor.status='Inactive' or coalesce((vendor.payload->>'isActive')::boolean,true)=false then raise exception 'This online vendor is disabled' using errcode='55000'; end if;
  select * into config from public.realx_vendor_online_configs where vendor_id=p_vendor_id and active;
  if not found or coalesce((config.offer->>'enabled')::boolean,false)=false then raise exception 'Online vendor access is not enabled' using errcode='55000'; end if;
  destination:=case when p_platform='ios' then coalesce(config.offer->>'iosUrl',config.offer->>'purchaseUrl',config.destination_url)
                    when p_platform='android' then coalesce(config.offer->>'androidUrl',config.offer->>'purchaseUrl',config.destination_url)
                    else coalesce(config.offer->>'purchaseUrl',config.destination_url) end;
  if coalesce(destination,'') !~ '^https://' or destination ~ '^https://[^/]*@' then raise exception 'Online vendor destination is invalid' using errcode='22023'; end if;
  select * into c from public.realx_online_vendor_clicks where student_id=uid and vendor_id=p_vendor_id and request_id=p_request_id;
  if found and c.expires_at>now() then
    return jsonb_build_object('clickId',c.id,'vendorId',c.vendor_id,'clickedAt',c.clicked_at,'purchaseUrl',c.purchase_url,'tracked',c.tracked);
  end if;
  qatar_day_start:=((now() at time zone 'Asia/Qatar')::date::timestamp at time zone 'Asia/Qatar');
  select count(*) into click_count from public.realx_online_vendor_clicks where student_id=uid and vendor_id=p_vendor_id and tracked and clicked_at>=qatar_day_start;
  tracked_value:=click_count<100;
  insert into public.realx_online_vendor_clicks(student_id,vendor_id,request_id,platform,purchase_url,tracked,clicked_at,expires_at)
  values(uid,p_vendor_id,p_request_id,case when p_platform in ('ios','android','web') then p_platform else 'web' end,destination,tracked_value,now(),now()+interval '7 days')
  on conflict(student_id,vendor_id,request_id) do update set platform=excluded.platform,purchase_url=excluded.purchase_url,tracked=excluded.tracked,clicked_at=excluded.clicked_at,expires_at=excluded.expires_at
  returning * into c;
  if c.tracked then
    insert into public.realx_online_vendor_analytics(student_id,vendor_id,event,payload)
      values(uid,p_vendor_id,'outbound_click',jsonb_build_object('dateKey',to_char(now() at time zone 'Asia/Qatar','YYYY-MM-DD'),'requestId',p_request_id));
  end if;
  return jsonb_build_object('clickId',c.id,'vendorId',c.vendor_id,'clickedAt',c.clicked_at,'purchaseUrl',c.purchase_url,'tracked',c.tracked);
end $$;
create or replace function public.realx_get_opportunity_action(p_opportunity_id text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); student public.realx_students%rowtype; opportunity public.realx_opportunities%rowtype;
  action_config public.realx_opportunity_action_configs%rowtype; existing public.realx_opportunity_action_requests%rowtype;
  action_url text; created boolean:=false; expires timestamptz:=now()+interval '7 days';
begin
  if uid is null then raise exception 'Sign in to access this opportunity' using errcode='28000'; end if;
  select * into student from public.realx_students where id=uid;
  if not found or student.verification_status<>'verified' then raise exception 'A verified student account is required' using errcode='42501'; end if;
  select * into opportunity from public.realx_opportunities where id=p_opportunity_id and published;
  if not found then raise exception 'Opportunity not found' using errcode='P0002'; end if;
  if opportunity.starts_at is not null and opportunity.starts_at>now() or opportunity.ends_at is not null and opportunity.ends_at<=now() then
    raise exception 'This opportunity is not currently available' using errcode='55000';
  end if;
  select * into action_config from public.realx_opportunity_action_configs where id=p_opportunity_id;
  action_url:=coalesce(action_config.payload->>'actionUrl','');
  if action_url='' or action_url !~ '^https://' then raise exception 'This opportunity does not have a valid action configured' using errcode='22023'; end if;
  select * into existing from public.realx_opportunity_action_requests where student_id=uid and request_id=p_request_id;
  if found then return jsonb_build_object('actionUrl',action_url,'tracked',false); end if;
  insert into public.realx_opportunity_action_requests(student_id,opportunity_id,request_id,expires_at,status,payload)
    values(uid,p_opportunity_id,p_request_id,expires,'opened',jsonb_build_object('userId',uid,'requestId',p_request_id));
  insert into public.realx_opportunity_analytics(student_id,opportunity_id,event,payload)
    values(uid,p_opportunity_id,'qualifiedAction',jsonb_build_object('requestId',p_request_id,'day',to_char(now() at time zone 'Asia/Qatar','YYYY-MM-DD')));
  return jsonb_build_object('actionUrl',action_url,'tracked',true);
end $$;
create or replace function public.realx_track_opportunity_event(p_opportunity_id text,p_event text,p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Login required' using errcode='28000'; end if;
  if p_event not in ('view','save','unsave','share') then raise exception 'Invalid opportunity event' using errcode='22023'; end if;
  if not exists(select 1 from public.realx_opportunities where id=p_opportunity_id and published) then raise exception 'Opportunity unavailable' using errcode='P0002'; end if;
  insert into public.realx_opportunity_analytics(student_id,opportunity_id,event,payload) values(uid,p_opportunity_id,p_event,coalesce(p_payload,'{}'));
end $$;
create or replace function public.realx_configure_badrgo_pilot(p_codes jsonb,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare code_item jsonb; seq integer:=0; normalized text; now_value timestamptz:=now();
  current_campaign public.realx_pilot_campaigns%rowtype; payload_value jsonb;
begin
  if jsonb_typeof(p_codes) is distinct from 'array' or jsonb_array_length(p_codes)<>100 then
    raise exception 'Exactly 100 codes are required' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_codes) as code_items(value) where jsonb_typeof(code_items.value) is distinct from 'string') then
    raise exception 'Every code must be text' using errcode='22023';
  end if;
  if (select count(*) from jsonb_array_elements_text(p_codes))<>
     (select count(distinct upper(trim(value))) from jsonb_array_elements_text(p_codes)) then
    raise exception 'Coupon codes must be unique' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements_text(p_codes) where upper(trim(value)) !~ '^[A-Z0-9]{6,32}$') then
    raise exception 'Every code must contain 6-32 letters or numbers' using errcode='22023';
  end if;
  if nullif(p_values->>'startsAt','') is not null and nullif(p_values->>'endsAt','') is not null
    and (p_values->>'startsAt')::timestamptz >= (p_values->>'endsAt')::timestamptz then
    raise exception 'End time must be after start time' using errcode='22023';
  end if;
  select * into current_campaign from public.realx_pilot_campaigns where id='badrgo-first-ride-2026' for update;
  if coalesce((current_campaign.payload->>'publicAssignedCount')::integer,0)>0
     or coalesce((current_campaign.payload->>'reservedAssignedCount')::integer,0)>0 then
    raise exception 'A campaign with assigned coupons cannot be reconfigured' using errcode='55000';
  end if;
  payload_value:=jsonb_build_object(
    'campaignId','badrgo-first-ride-2026','brandName','Badrgo','status','draft','uiApproved',false,
    'totalCodes',100,'publicLimit',80,'reservedLimit',20,'publicAssignedCount',0,'reservedAssignedCount',0,
    'nextPublicSequence',0,'nextReservedSequence',80,'startsAt',p_values->'startsAt','endsAt',p_values->'endsAt',
    'title',coalesce(nullif(trim(p_values->>'title'),''),'Your next ride is on us'),
    'titleAr',coalesce(nullif(trim(p_values->>'titleAr'),''),'مشوارك القادم علينا'),
    'description',coalesce(nullif(trim(p_values->>'description'),''),'The first 80 eligible realX users can claim one complimentary ride code.'),
    'descriptionAr',coalesce(nullif(trim(p_values->>'descriptionAr'),''),'أول ٨٠ مستخدمًا مؤهلًا في realX يمكنهم الحصول على رمز رحلة مجانية واحدة.'),
    'instructions',coalesce(nullif(trim(p_values->>'instructions'),''),''),
    'instructionsAr',coalesce(nullif(trim(p_values->>'instructionsAr'),''),''),
    'destinationUrl',coalesce(nullif(trim(p_values->>'destinationUrl'),''),''),
    'configuredBy',auth.uid(),'configuredAt',now_value,'updatedAt',now_value
  );
  if nullif(payload_value->>'destinationUrl','') is not null and payload_value->>'destinationUrl' !~ '^https://' then
    raise exception 'Destination URL must use HTTPS' using errcode='22023';
  end if;
  insert into public.realx_pilot_campaigns(id,active,payload,updated_at)
    values('badrgo-first-ride-2026',false,payload_value,now_value)
    on conflict(id) do update set active=false,payload=excluded.payload,updated_at=excluded.updated_at;
  delete from public.realx_pilot_campaign_codes where campaign_id='badrgo-first-ride-2026';
  for code_item in select value from jsonb_array_elements(p_codes) loop
    normalized:=upper(trim(code_item#>>'{}'));
    insert into public.realx_pilot_campaign_codes(campaign_id,id,sequence,pool,code,status,configured_at)
      values('badrgo-first-ride-2026',lpad(seq::text,3,'0'),seq,case when seq<80 then 'public' else 'reserved' end,normalized,'available',now_value);
    seq:=seq+1;
  end loop;
  return jsonb_build_object('success',true,'campaignId','badrgo-first-ride-2026','status','draft','totalCodes',seq);
end $$;

create or replace function public.realx_claim_badrgo_pilot_for(p_student_id uuid,p_pool text,p_assigned_by uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare campaign public.realx_pilot_campaigns%rowtype; student public.realx_students%rowtype;
  claim_row public.realx_pilot_campaign_claims%rowtype; code_row public.realx_pilot_campaign_codes%rowtype;
  canonical_email text; identity_value text; identity_digest text; campaign_status text; starts_at timestamptz; ends_at timestamptz;
  assigned_field text; sequence_field text; assigned_count integer; next_sequence integer; pool_limit integer; claim_id uuid;
begin
  if p_pool not in ('public','reserved') then raise exception 'Invalid coupon pool' using errcode='22023'; end if;
  select * into student from public.realx_students where id=p_student_id;
  if not found then raise exception 'Student profile not found' using errcode='P0002'; end if;
  if coalesce((student.profile->>'redemptionDisabled')::boolean,false) or student.profile->>'accountType'='browse_only' then
    raise exception 'This account cannot claim coupons' using errcode='42501';
  end if;
  select * into campaign from public.realx_pilot_campaigns where id='badrgo-first-ride-2026' for update;
  if not found then raise exception 'Campaign is not configured' using errcode='55000'; end if;
  select lower(trim(coalesce(student.email,auth_user.email))) into canonical_email from auth.users auth_user where auth_user.id=p_student_id;
  identity_value:=coalesce(nullif(canonical_email,''),'uid:'||p_student_id::text);
  identity_digest:=encode(extensions.digest('badrgo-first-ride-2026:'||identity_value,'sha256'),'hex');
  select * into claim_row from public.realx_pilot_campaign_claims where campaign_id='badrgo-first-ride-2026' and student_id=p_student_id;
  if found then
    select * into code_row from public.realx_pilot_campaign_codes where campaign_id=claim_row.campaign_id and id=claim_row.code_id;
    return jsonb_build_object('code',code_row.code,'pool',claim_row.pool,'claimedAt',claim_row.claimed_at,'existing',true);
  end if;
  if exists(select 1 from public.realx_pilot_campaign_identity_claims where program_id='badrgo-first-ride-2026' and identity_hash=identity_digest and week_key='pilot') then
    raise exception 'This verified identity already has a coupon' using errcode='23505';
  end if;
  starts_at:=nullif(campaign.payload->>'startsAt','')::timestamptz;
  ends_at:=nullif(campaign.payload->>'endsAt','')::timestamptz;
  campaign_status:=coalesce(campaign.payload->>'status','draft');
  if campaign_status='active' and starts_at is not null and starts_at>now() then campaign_status:='scheduled'; end if;
  if campaign_status='active' and ends_at is not null and ends_at<=now() then campaign_status:='ended'; end if;
  assigned_field:=case when p_pool='public' then 'publicAssignedCount' else 'reservedAssignedCount' end;
  sequence_field:=case when p_pool='public' then 'nextPublicSequence' else 'nextReservedSequence' end;
  assigned_count:=coalesce((campaign.payload->>assigned_field)::integer,0);
  next_sequence:=coalesce((campaign.payload->>sequence_field)::integer,case when p_pool='public' then 0 else 80 end);
  pool_limit:=case when p_pool='public' then 80 else 100 end;
  if p_pool='public' and campaign_status<>'active' then
    if campaign_status='sold_out' or assigned_count>=80 then raise exception 'All public coupons have been claimed' using errcode='55000'; end if;
    raise exception 'This campaign is not accepting claims' using errcode='55000';
  end if;
  if p_pool='reserved' and coalesce(campaign.payload->>'status','draft')='ended' then raise exception 'This campaign has ended' using errcode='55000'; end if;
  if assigned_count>=(case when p_pool='public' then 80 else 20 end) or next_sequence>=pool_limit then
    raise exception 'No % coupons remain',p_pool using errcode='P0001';
  end if;
  select * into code_row from public.realx_pilot_campaign_codes where campaign_id='badrgo-first-ride-2026'
    and sequence=next_sequence and pool=p_pool and status='available' for update;
  if not found then raise exception 'Coupon inventory is inconsistent' using errcode='P0001'; end if;
  claim_id:=gen_random_uuid();
  insert into public.realx_pilot_campaign_claims(id,campaign_id,student_id,user_email,code_id,pool,status,claimed_at,assigned_by)
    values(claim_id,'badrgo-first-ride-2026',p_student_id,canonical_email,code_row.id,p_pool,'assigned',now(),coalesce(p_assigned_by,p_student_id));
  insert into public.realx_pilot_campaign_identity_claims(program_id,identity_hash,week_key,student_id)
    values('badrgo-first-ride-2026',identity_digest,'pilot',p_student_id);
  update public.realx_pilot_campaign_codes set status='assigned',assigned_to_uid=p_student_id,assigned_claim_id=claim_id,
    assigned_by=coalesce(p_assigned_by,p_student_id),assigned_at=now() where campaign_id=code_row.campaign_id and id=code_row.id;
  update public.realx_pilot_campaigns set payload=campaign.payload||jsonb_build_object(assigned_field,assigned_count+1,sequence_field,next_sequence+1,'updatedAt',now()) where id=campaign.id;
  return jsonb_build_object('code',code_row.code,'pool',p_pool,'claimedAt',now(),'existing',false);
end $$;

create or replace function public.realx_claim_badrgo_pilot_coupon()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Login required' using errcode='28000'; end if;
  return public.realx_claim_badrgo_pilot_for(auth.uid(),'public',auth.uid());
end $$;

create or replace function public.realx_get_badrgo_pilot_campaign()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare campaign public.realx_pilot_campaigns%rowtype; claim_row public.realx_pilot_campaign_claims%rowtype;
  code_row public.realx_pilot_campaign_codes%rowtype; status_value text; assigned integer; starts_at timestamptz; ends_at timestamptz;
  claim_json jsonb; visible boolean;
begin
  select * into campaign from public.realx_pilot_campaigns where id='badrgo-first-ride-2026';
  if not found then return jsonb_build_object('exists',false,'status','unavailable'); end if;
  assigned:=coalesce((campaign.payload->>'publicAssignedCount')::integer,0); status_value:=coalesce(campaign.payload->>'status','draft');
  starts_at:=nullif(campaign.payload->>'startsAt','')::timestamptz; ends_at:=nullif(campaign.payload->>'endsAt','')::timestamptz;
  if status_value='active' and starts_at is not null and starts_at>now() then status_value:='scheduled'; end if;
  if status_value='active' and ends_at is not null and ends_at<=now() then status_value:='ended'; end if;
  if status_value='active' and assigned>=80 then status_value:='sold_out'; end if;
  if auth.uid() is not null then
    select * into claim_row from public.realx_pilot_campaign_claims where campaign_id=campaign.id and student_id=auth.uid();
    if found then
      select * into code_row from public.realx_pilot_campaign_codes where campaign_id=campaign.id and id=claim_row.code_id;
      claim_json:=jsonb_build_object('code',code_row.code,'pool',claim_row.pool,'claimedAt',claim_row.claimed_at);
    end if;
  end if;
  visible:=status_value in ('active','scheduled','sold_out') or claim_json is not null;
  if not visible then return jsonb_build_object('exists',true,'status','unavailable','claim',claim_json); end if;
  return campaign.payload||jsonb_build_object('exists',true,'campaignId',campaign.id,'brandName','Badrgo','status',status_value,
    'publicLimit',80,'publicAssignedCount',assigned,'remaining',greatest(0,80-assigned),'startsAt',starts_at,'endsAt',ends_at,'claim',claim_json);
end $$;

create or replace function public.realx_migrate_badrgo_pilot_to_vouchers(p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare campaign public.realx_pilot_campaigns%rowtype; program public.realx_badrgo_voucher_programs%rowtype;
  legacy_code public.realx_pilot_campaign_codes%rowtype; legacy_claim public.realx_pilot_campaign_claims%rowtype;
  target public.realx_badrgo_voucher_inventory%rowtype; new_claim_id uuid; hash_value text; email_value text;
  requested integer:=0; migrated integer:=0; available integer:=0; assigned integer:=0; migrated_claims integer:=0; duplicates integer:=0;
begin
  select * into program from public.realx_badrgo_voucher_programs where id='badrgo-rides' for update;
  if found and program.payload ? 'legacyPilotMigration' then
    return jsonb_build_object('success',true,'existing',true)||program.payload->'legacyPilotMigration';
  end if;
  select * into campaign from public.realx_pilot_campaigns where id='badrgo-first-ride-2026' for update;
  if not found then return jsonb_build_object('success',true,'migratedCodes',0,'migratedClaims',0); end if;
  insert into public.realx_badrgo_voucher_programs(id,name,active,timezone,weekly_limit,payload)
    values('badrgo-rides','Badrgo rides',false,'Asia/Qatar',1,'{"status":"paused"}'::jsonb)
    on conflict(id) do nothing;
  select * into program from public.realx_badrgo_voucher_programs where id='badrgo-rides' for update;
  if coalesce((select count(*) from public.realx_pilot_campaign_codes where campaign_id=campaign.id),0)>100 then
    raise exception 'Unexpected legacy campaign inventory size' using errcode='55000';
  end if;
  for legacy_code in select * from public.realx_pilot_campaign_codes where campaign_id=campaign.id order by sequence for update loop
    requested:=requested+1;
    hash_value:=encode(extensions.digest('badrgo-rides:'||upper(trim(legacy_code.code)),'sha256'),'hex');
    select * into target from public.realx_badrgo_voucher_inventory where code_hash=hash_value;
    if found then duplicates:=duplicates+1;continue;end if;
    select * into legacy_claim from public.realx_pilot_campaign_claims where campaign_id=campaign.id and code_id=legacy_code.id and pool=legacy_code.pool limit 1;
    if legacy_code.status='assigned' and found and legacy_claim.student_id is not null then
      select lower(trim(coalesce(legacy_claim.user_email,student.email,auth_user.email))) into email_value
        from public.realx_students student left join auth.users auth_user on auth_user.id=student.id where student.id=legacy_claim.student_id;
      insert into public.realx_badrgo_voucher_inventory(program_id,code_hash,code_value,batch_id,status,assigned_to_uid,assigned_at)
        values('badrgo-rides',hash_value,upper(trim(legacy_code.code)),'legacy-pilot-v1','available',legacy_claim.student_id,legacy_claim.claimed_at)
        returning * into target;
      new_claim_id:=gen_random_uuid();
      insert into public.realx_badrgo_voucher_claims(id,program_id,student_id,user_email,week_key,voucher_id,identity_hash,status,claimed_at)
        values(new_claim_id,'badrgo-rides',legacy_claim.student_id,email_value,'legacy-pilot',target.id,
          encode(extensions.digest(coalesce(nullif(email_value,''),'uid:'||legacy_claim.student_id::text),'sha256'),'hex'),'assigned',legacy_claim.claimed_at)
        on conflict do nothing;
      if found then
        update public.realx_badrgo_voucher_inventory set status='assigned',assigned_claim_id=new_claim_id where id=target.id;
        assigned:=assigned+1;migrated_claims:=migrated_claims+1;
      else
        update public.realx_badrgo_voucher_inventory set assigned_to_uid=null,assigned_at=null where id=target.id;
        available:=available+1;
      end if;
    else
      insert into public.realx_badrgo_voucher_inventory(program_id,code_hash,code_value,batch_id,status)
        values('badrgo-rides',hash_value,upper(trim(legacy_code.code)),'legacy-pilot-v1','available');
      available:=available+1;
    end if;
    migrated:=migrated+1;
  end loop;
  insert into public.realx_inventory_batches(id,program_id,imported_by,record_count,payload,created_at)
    values('legacy-pilot-v1','badrgo-rides',p_admin_id,migrated,jsonb_build_object('status','complete','requestedCount',requested,
      'acceptedCount',migrated,'duplicateCount',duplicates,'failedCount',0,'inventoryCounted',true),now())
    on conflict(id) do update set record_count=excluded.record_count,payload=excluded.payload;
  update public.realx_pilot_campaigns set active=false,payload=payload||jsonb_build_object('status','paused','migratedToVoucherProgramAt',now(),'updatedAt',now()),updated_at=now()
    where id=campaign.id;
  update public.realx_badrgo_voucher_programs set active=false,payload=payload||jsonb_build_object('status','paused',
    'legacyPilotMigration',jsonb_build_object('migratedCodes',migrated,'migratedClaims',migrated_claims,'availableCount',available,
      'assignedActiveCount',assigned,'duplicateCount',duplicates,'migratedBy',p_admin_id,'completedAt',now())),updated_at=now()
    where id='badrgo-rides';
  return jsonb_build_object('success',true,'migratedCodes',migrated,'migratedClaims',migrated_claims,'availableCount',available,
    'assignedActiveCount',assigned,'duplicateCount',duplicates);
end $$;

create or replace function public.realx_get_badrgo_voucher_program()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); p public.realx_badrgo_voucher_programs%rowtype;
  c public.realx_badrgo_voucher_claims%rowtype; v public.realx_badrgo_voucher_inventory%rowtype;
  wk text; ih text; email_value text; program_status text; available_count integer;
  assigned_count integer; redeemed_count integer; reason text; claim_json jsonb;
begin
  select * into p from public.realx_badrgo_voucher_programs where id='badrgo-rides';
  if not found then return jsonb_build_object('exists',false,'status','unavailable','claim',null); end if;
  program_status:=coalesce(p.payload->>'status',case when p.active then 'active' else 'paused' end);
  select count(*) into available_count from public.realx_badrgo_voucher_inventory where program_id=p.id and status='available';
  select count(*) into assigned_count from public.realx_badrgo_voucher_inventory where program_id=p.id and status='assigned';
  select count(*) into redeemed_count from public.realx_badrgo_voucher_inventory where program_id=p.id and status='redeemed';
  wk:=to_char(now() at time zone p.timezone,'IYYY-"W"IW');
  if uid is null then reason:='auth_required';
  else
    select lower(trim(coalesce(s.email,u.email))) into email_value
      from auth.users u left join public.realx_students s on s.id=u.id where u.id=uid;
    ih:=encode(extensions.digest(coalesce(nullif(email_value,''),'uid:'||uid::text),'sha256'),'hex');
    select * into c from public.realx_badrgo_voucher_claims where program_id=p.id and identity_hash=ih order by claimed_at desc limit 1;
    if found then
      if c.status='assigned' then reason:='previous_code_not_redeemed';
      elsif c.week_key=wk then reason:='already_claimed_this_week';
      elsif program_status='ended' then reason:='program_ended';
      elsif program_status<>'active' then reason:='program_paused';
      elsif available_count=0 then reason:='out_of_stock';
      else reason:='eligible'; end if;
      if c.week_key=wk or c.status='assigned' then
        select * into v from public.realx_badrgo_voucher_inventory where id=c.voucher_id;
        claim_json:=jsonb_build_object('id',c.id,'code',v.code_value,'status',c.status,'periodKey',c.week_key,'claimedAt',c.claimed_at,'redeemedAt',c.redeemed_at);
      end if;
    else
      if program_status='ended' then reason:='program_ended';
      elsif program_status<>'active' then reason:='program_paused';
      elsif available_count=0 then reason:='out_of_stock';
      else reason:='eligible'; end if;
    end if;
  end if;
  return jsonb_build_object(
    'exists',true,'programId',p.id,'brandName','Badrgo','status',case when program_status='active' and available_count=0 then 'out_of_stock' else program_status end,
    'timeZone',p.timezone,'availableCount',available_count,'totalCodes',available_count+assigned_count+redeemed_count,
    'assignedActiveCount',assigned_count,'redeemedCount',redeemed_count,
    'title',coalesce(p.payload->>'title','Your next ride is on us'),'titleAr',coalesce(p.payload->>'titleAr','مشوارك القادم علينا'),
    'description',coalesce(p.payload->>'description','Claim a Badrgo ride code when you are eligible.'),
    'descriptionAr',coalesce(p.payload->>'descriptionAr','احصل على رمز رحلة من بدر جو عند استحقاقك.'),
    'instructions',coalesce(p.payload->>'instructions','Use your current code before requesting another code in a future week.'),
    'instructionsAr',coalesce(p.payload->>'instructionsAr','استخدم رمزك الحالي قبل طلب رمز آخر في أسبوع لاحق.'),
    'destinationUrl',coalesce(p.payload->>'destinationUrl','https://go.badrgo.com/invite?code=R1AA52'),
    'claim',claim_json,'currentClaim',claim_json,
      'eligibility',jsonb_build_object('canClaim',reason='eligible','reason',reason,'periodKey',wk,'nextEligibleAt',case when reason='already_claimed_this_week' then to_char(((date_trunc('week',now() at time zone p.timezone)+interval '1 week') at time zone p.timezone) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') else null end)
  );
end $$;

create or replace function public.realx_claim_badrgo_voucher()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); s public.realx_students%rowtype; p public.realx_badrgo_voucher_programs%rowtype;
  v public.realx_badrgo_voucher_inventory%rowtype; c public.realx_badrgo_voucher_claims%rowtype;
  wk text; ih text; email_value text; program_status text; claim_id uuid;
begin
  if uid is null then raise exception 'Login required' using errcode='28000'; end if;
  select * into s from public.realx_students where id=uid;
  if not found then raise exception 'Student profile not found' using errcode='P0002'; end if;
  if coalesce((s.profile->>'redemptionDisabled')::boolean,false) or s.profile->>'accountType'='browse_only' then raise exception 'This account cannot claim vouchers' using errcode='42501'; end if;
  select * into p from public.realx_badrgo_voucher_programs where id='badrgo-rides' for share;
  if not found then raise exception 'Voucher program unavailable' using errcode='55000'; end if;
  program_status:=coalesce(p.payload->>'status',case when p.active then 'active' else 'paused' end);
  wk:=to_char(now() at time zone p.timezone,'IYYY-"W"IW');
  select lower(trim(coalesce(s.email,u.email))) into email_value from auth.users u left join public.realx_students s on s.id=u.id where u.id=uid;
  ih:=encode(extensions.digest(coalesce(nullif(email_value,''),'uid:'||uid::text),'sha256'),'hex');
  select * into c from public.realx_badrgo_voucher_claims where program_id=p.id and identity_hash=ih order by claimed_at desc limit 1 for update;
  if found then
    select * into v from public.realx_badrgo_voucher_inventory where id=c.voucher_id;
    if c.week_key=wk or c.status='assigned' then
      return jsonb_build_object('id',c.id,'code',v.code_value,'status',c.status,'periodKey',c.week_key,'claimedAt',c.claimed_at,'redeemedAt',c.redeemed_at,'existing',true,'alreadyClaimed',true,'success',true);
    end if;
  end if;
  if c.status='assigned' then raise exception 'Use your current ride code before claiming another' using errcode='55000'; end if;
  if program_status='ended' then raise exception 'The voucher program has ended' using errcode='55000'; end if;
  if program_status<>'active' then raise exception 'The voucher program is not accepting claims' using errcode='55000'; end if;
  select * into v from public.realx_badrgo_voucher_inventory where program_id=p.id and status='available' order by imported_at,id for update skip locked limit 1;
  if not found then raise exception 'No vouchers available' using errcode='P0001'; end if;
  insert into public.realx_badrgo_voucher_claims(program_id,student_id,user_email,week_key,voucher_id,identity_hash,status)
    values(p.id,uid,email_value,wk,v.id,ih,'assigned') returning id into claim_id;
  update public.realx_badrgo_voucher_inventory set status='assigned',assigned_claim_id=claim_id,assigned_to_uid=uid,assigned_at=now() where id=v.id;
  return jsonb_build_object('id',claim_id,'code',v.code_value,'status','assigned','periodKey',wk,'claimedAt',now(),'redeemedAt',null,'existing',false,'alreadyClaimed',false,'success',true);
end $$;

create or replace function public.realx_import_badrgo_redemptions(p_codes jsonb,p_import_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  item text; normalized text; v_code_hash text; inv public.realx_badrgo_voucher_inventory%rowtype;
  claim_row public.realx_badrgo_voucher_claims%rowtype; import_row public.realx_redemption_imports%rowtype;
  matched integer:=0; already integer:=0; unmatched integer:=0; requested integer:=0;
begin
  if not public.realx_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_codes is null or jsonb_typeof(p_codes) is distinct from 'array' then raise exception 'Voucher codes must be an array' using errcode='22023'; end if;
  if jsonb_array_length(p_codes)=0 or jsonb_array_length(p_codes)>5000 then raise exception 'Import between 1 and 5000 codes' using errcode='22023'; end if;
  if (select count(*) from jsonb_array_elements_text(p_codes))<>(select count(distinct upper(trim(value))) from jsonb_array_elements_text(p_codes)) then raise exception 'The import contains duplicate voucher codes' using errcode='22023'; end if;
  if coalesce(p_import_id,'') !~ '^[A-Za-z0-9_-]{8,80}$' then raise exception 'Invalid import ID' using errcode='22023'; end if;
  insert into public.realx_redemption_imports(id,program_id,imported_by,status)
    values(p_import_id,'badrgo-rides',auth.uid(),'processing') on conflict(id) do nothing;
  select * into import_row from public.realx_redemption_imports where id=p_import_id for update;
  if import_row.status='complete' then
    requested:=import_row.requested_count; matched:=import_row.matched_count;
    already:=import_row.already_redeemed_count; unmatched:=import_row.unmatched_count;
    return jsonb_build_object('success',true,'importId',p_import_id,'requestedCount',requested,'matchedCount',matched,'alreadyRedeemedCount',already,'unmatchedCount',unmatched,'existing',true);
  end if;
  update public.realx_redemption_imports set status='processing',imported_by=coalesce(imported_by,auth.uid()) where id=p_import_id;
  for item in select jsonb_array_elements_text(p_codes) loop
    requested:=requested+1; normalized:=upper(trim(item));
    if normalized !~ '^[A-Z0-9_-]{6,64}$' then unmatched:=unmatched+1; continue; end if;
    v_code_hash:=encode(extensions.digest('badrgo-rides:'||normalized,'sha256'),'hex');
    select * into inv from public.realx_badrgo_voucher_inventory where realx_badrgo_voucher_inventory.code_hash=v_code_hash for update;
    if not found then unmatched:=unmatched+1; continue; end if;
    if inv.status='redeemed' then already:=already+1; continue; end if;
    if inv.status<>'assigned' or inv.assigned_claim_id is null then unmatched:=unmatched+1; continue; end if;
    select * into claim_row from public.realx_badrgo_voucher_claims where id=inv.assigned_claim_id for update;
    if not found or claim_row.status='redeemed' then already:=already+1; continue; end if;
    update public.realx_badrgo_voucher_inventory set status='redeemed',redeemed_by=inv.assigned_to_uid,redeemed_at=now(),redemption_import_id=p_import_id where id=inv.id;
    update public.realx_badrgo_voucher_claims set status='redeemed',redeemed_at=now(),redemption_import_id=p_import_id where id=claim_row.id;
    matched:=matched+1;
  end loop;
  update public.realx_redemption_imports set status='complete',requested_count=requested,matched_count=matched,already_redeemed_count=already,unmatched_count=unmatched,completed_at=now() where id=p_import_id;
  return jsonb_build_object('success',true,'importId',p_import_id,'requestedCount',requested,'matchedCount',matched,'alreadyRedeemedCount',already,'unmatchedCount',unmatched);
end $$;
create or replace function public.realx_get_admin_dashboard()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.realx_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return jsonb_build_object('students',(select count(*) from public.realx_students),
    'activeVendors',(select count(*) from public.realx_vendors where status='Active'),
    'transactions',(select count(*) from public.realx_transactions),
    'pendingVerifications',(select count(*) from public.realx_verification_requests where status='pending'),
    'completedTransactions',(select count(*) from public.realx_transactions where status='completed'),
    'totalDiscount',(select coalesce(sum(discount_amount),0) from public.realx_transactions where status='completed'));
end $$;

create or replace function public.realx_increment_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare current_count integer;
begin
  insert into public.realx_rate_limits(key,window_started_at,hit_count) values(p_key,now(),1)
  on conflict(key) do update set
    hit_count=case when now()-realx_rate_limits.window_started_at < make_interval(secs=>p_window_seconds) then realx_rate_limits.hit_count+1 else 1 end,
    window_started_at=case when now()-realx_rate_limits.window_started_at < make_interval(secs=>p_window_seconds) then realx_rate_limits.window_started_at else now() end
  returning hit_count into current_count;
  return current_count<=p_limit;
end $$;

grant execute on function public.realx_is_admin() to authenticated;
grant execute on function public.realx_is_admin() to anon;
grant execute on function public.realx_allowed_student_email(text) to anon,authenticated,service_role;
grant execute on function public.realx_is_vendor_member(text) to authenticated;
grant execute on function public.realx_is_vendor_member(text) to anon;
revoke all on function public.realx_complete_signup(jsonb) from public,anon;
grant execute on function public.realx_complete_signup(jsonb) to authenticated;
revoke all on function public.realx_assign_creator_code() from public,anon;
grant execute on function public.realx_assign_creator_code() to authenticated;
revoke all on function public.realx_submit_verification_request(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.realx_submit_verification_request(text,text,text,text,jsonb) to service_role;
grant execute on function public.realx_get_verification_status(uuid,text) to anon,authenticated;
grant execute on function public.realx_cancel_verification_request(uuid,text) to anon,authenticated;
revoke all on function public.realx_review_verification_request(uuid,text,text) from public,anon;
grant execute on function public.realx_review_verification_request(uuid,text,text) to authenticated;
revoke all on function public.realx_set_vendor_redemption_pin(text,text) from public,anon;
grant execute on function public.realx_set_vendor_redemption_pin(text,text) to authenticated;
revoke all on function public.realx_redeem_gift_card(text,numeric,uuid) from public,anon,authenticated;
revoke all on function public.realx_redeem_offer(text,text,numeric,text,text,numeric,integer,text,uuid) from public,anon;
grant execute on function public.realx_redeem_offer(text,text,numeric,text,text,numeric,integer,text,uuid) to authenticated;
revoke all on function public.realx_record_online_click(text,uuid,text) from public,anon;
grant execute on function public.realx_record_online_click(text,uuid,text) to authenticated;
revoke all on function public.realx_get_opportunity_action(text,uuid) from public,anon;
grant execute on function public.realx_get_opportunity_action(text,uuid) to authenticated;
revoke all on function public.realx_track_opportunity_event(text,text,jsonb) from public,anon;
grant execute on function public.realx_track_opportunity_event(text,text,jsonb) to authenticated;
revoke all on function public.realx_get_badrgo_voucher_program() from public;
grant execute on function public.realx_get_badrgo_voucher_program() to anon,authenticated;
revoke all on function public.realx_configure_badrgo_pilot(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.realx_configure_badrgo_pilot(jsonb,jsonb) to service_role;
revoke all on function public.realx_claim_badrgo_pilot_for(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.realx_claim_badrgo_pilot_for(uuid,text,uuid) to service_role;
revoke all on function public.realx_claim_badrgo_pilot_coupon() from public,anon;
grant execute on function public.realx_claim_badrgo_pilot_coupon() to authenticated;
revoke all on function public.realx_get_badrgo_pilot_campaign() from public;
grant execute on function public.realx_get_badrgo_pilot_campaign() to anon,authenticated;
revoke all on function public.realx_claim_badrgo_voucher() from public,anon;
grant execute on function public.realx_claim_badrgo_voucher() to authenticated;
revoke all on function public.realx_import_badrgo_redemptions(jsonb,text) from public,anon;
grant execute on function public.realx_import_badrgo_redemptions(jsonb,text) to authenticated;
revoke all on function public.realx_get_admin_dashboard() from public,anon;
grant execute on function public.realx_get_admin_dashboard() to authenticated;
revoke all on function public.realx_increment_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.realx_increment_rate_limit(text,integer,integer) to service_role;
revoke all on function public.realx_update_map_cache_entry(text,jsonb) from public,anon,authenticated;
grant execute on function public.realx_update_map_cache_entry(text,jsonb) to service_role;
revoke all on function public.realx_consume_notification_quota(date,integer) from public,anon,authenticated;
grant execute on function public.realx_consume_notification_quota(date,integer) to service_role;
grant select on public.realx_universities,public.realx_categories,public.realx_vendors,public.realx_offers,
  public.realx_events,public.realx_banners,public.realx_featured_brands,public.realx_trending_offer_banners,public.realx_cms_documents,
  public.realx_opportunities,public.realx_map_locations,public.realx_opportunity_action_configs,
  public.realx_vendor_online_configs,public.realx_badrgo_voucher_programs to anon,authenticated;
grant select,insert,update,delete on table
  public.realx_user_roles,public.realx_universities,public.realx_categories,public.realx_students,
  public.realx_vendors,public.realx_vendor_memberships,public.realx_offers,public.realx_student_saved_items,
  public.realx_transactions,public.realx_verification_requests,public.realx_wakti_student_verification_requests,
  public.realx_events,public.realx_banners,public.realx_featured_brands,public.realx_trending_offer_banners,
  public.realx_cms_documents,public.realx_holding_groups,public.realx_holding_group_members,
  public.realx_holding_group_vendors,public.realx_notifications,public.realx_push_tokens,
  public.realx_notification_deliveries,public.realx_notification_daily_limits,
  public.realx_vendor_online_configs,public.realx_online_vendor_clicks,public.realx_vendor_redemption_secrets,
  public.realx_creator_codes,public.realx_opportunities,public.realx_map_locations,public.realx_map_cache,
  public.realx_opportunity_action_configs,public.realx_opportunity_action_requests,public.realx_opportunity_analytics,
  public.realx_online_vendor_analytics,public.realx_onboarding_analytics,public.realx_reward_accounts,
  public.realx_pilot_campaigns,public.realx_pilot_campaign_identity_claims,public.realx_inventory_batches,
  public.realx_pilot_campaign_codes,public.realx_pilot_campaign_claims,
  public.realx_otp_challenges,public.realx_rate_limits,public.realx_badrgo_voucher_programs,
  public.realx_badrgo_voucher_inventory,public.realx_badrgo_voucher_claims,public.realx_admin_audit_log,
  public.realx_redemption_imports to authenticated;

insert into storage.buckets(id,name,public) values
  ('realx-public-media','realx-public-media',true),
  ('realx-student-documents','realx-student-documents',false)
on conflict(id) do nothing;
create policy realx_media_public_read on storage.objects for select to anon,authenticated using(bucket_id='realx-public-media');
create policy realx_media_admin_write on storage.objects for all to authenticated using(bucket_id='realx-public-media' and public.realx_is_admin()) with check(bucket_id='realx-public-media' and public.realx_is_admin());
create policy realx_student_doc_owner_insert on storage.objects for insert to authenticated with check(bucket_id='realx-student-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy realx_student_doc_owner_read on storage.objects for select to authenticated using(bucket_id='realx-student-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.realx_is_admin()));
create policy realx_student_doc_admin_delete on storage.objects for delete to authenticated using(bucket_id='realx-student-documents' and public.realx_is_admin());

do $$
begin
  execute 'create extension if not exists pg_cron';
  execute 'create extension if not exists pg_net';
  if to_regclass('vault.decrypted_secrets') is not null then
    execute $schedule$
      select cron.schedule('realx-daily-maintenance','0 23 * * *',
        $job$
          select net.http_post(
            url := secrets.project_url || '/functions/v1/realx-maintenance',
            headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secrets.service_role_key),
            body := '{"action":"dailyMaintenance"}'::jsonb
          )
          from (
            select
              max(decrypted_secret) filter(where name='realx_project_url') as project_url,
              max(decrypted_secret) filter(where name='realx_service_role_key') as service_role_key
            from vault.decrypted_secrets
            where name in ('realx_project_url','realx_service_role_key')
          ) secrets
          where coalesce(secrets.project_url,'')<>'' and coalesce(secrets.service_role_key,'')<>'';
        $job$
      )
    $schedule$;
    execute $schedule$
      select cron.schedule('realx-notification-receipts','*/15 * * * *',
        $job$
          select net.http_post(
            url := secrets.project_url || '/functions/v1/realx-maintenance',
            headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secrets.service_role_key),
            body := '{"action":"processNotificationReceipts"}'::jsonb
          )
          from (
            select
              max(decrypted_secret) filter(where name='realx_project_url') as project_url,
              max(decrypted_secret) filter(where name='realx_service_role_key') as service_role_key
            from vault.decrypted_secrets
            where name in ('realx_project_url','realx_service_role_key')
          ) secrets
          where coalesce(secrets.project_url,'')<>'' and coalesce(secrets.service_role_key,'')<>'';
        $job$
      )
    $schedule$;
  end if;
exception when others then
  raise notice 'RealX scheduled maintenance setup was skipped: %',sqlerrm;
end $$;

comment on table public.realx_students is 'RealX student and creator profiles backed by Supabase Auth.';
comment on table public.realx_badrgo_voucher_inventory is 'Private one-time voucher inventory available only to security-definer claim/admin operations.';
comment on function public.realx_claim_badrgo_voucher() is 'Allocates a voucher transactionally using the Qatar-local ISO week and SKIP LOCKED inventory.';

do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array[
      'realx_transactions','realx_students','realx_vendors','realx_verification_requests',
      'realx_events','realx_banners','realx_categories','realx_universities','realx_cms_documents'
    ] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
