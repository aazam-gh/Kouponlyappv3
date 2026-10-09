-- Only for an empty isolated local fixture database. Never run against Supabase.
do $$ begin if current_database()<>'benefits_v2' then raise exception 'Use benefits_v2 fixture database only'; end if; end $$;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
grant usage on schema public to anon,authenticated,service_role;
create schema auth; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}', is_anonymous boolean default false, email_confirmed_at timestamptz, phone_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.profiles(user_id uuid primary key references auth.users(id) on delete cascade, full_name text default '',email text default '',referral_code text unique);
create function public.handle_new_user() returns trigger language plpgsql as $$begin insert into profiles(user_id,email) values(new.id,new.email);return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
create table public.referral_uses(referred_user_id uuid primary key references auth.users(id) on delete cascade,inviter_user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz default now(),check(referred_user_id<>inviter_user_id));
create table public.mutation_receipts(user_id uuid references auth.users(id) on delete cascade,mutation_id uuid,operation text,result jsonb,created_at timestamptz default now(),primary key(user_id,mutation_id));
create table public.redemptions(user_id uuid references auth.users(id) on delete cascade,redemption_id text,mode text,status text,code text,expires_at timestamptz,completed_at timestamptz,consumed_at timestamptz,primary key(user_id,redemption_id));
create table public.offer_usage(user_id uuid references auth.users(id),offer_id text,use_count integer,period_start date);
create table realx_categories(id text primary key,active boolean); insert into realx_categories values('test-category',true);
create table realx_vendors(id text primary key,name text,status text,catalogue_deal_id integer,category_id text);
create table realx_offers(id text primary key,vendor_id text,title text,active boolean,starts_at timestamptz,ends_at timestamptz,redemption_mode text,sort_order integer);
create table realx_user_roles(user_id uuid,role text);
