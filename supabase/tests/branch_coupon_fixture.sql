-- Isolated benefits_v2 fixture only; see docs/branch-offers.md for setup.
do $$ begin if current_database()<>'benefits_v2' then raise exception 'Use benefits_v2 fixture database only'; end if; end $$;
alter table public.kouponly_vendors add column locations jsonb default '[]';
alter table public.kouponly_offers add column payload jsonb default '{}', add column discount_type text default 'percentage', add column discount_value numeric default 25, add column offer_value numeric default 25, add column currency text default 'INR';
create view public.couponly_vendors as select * from public.kouponly_vendors;
create view public.couponly_offers as select * from public.kouponly_offers;
create or replace view public.kouponly_entitlement_offers as
select id,vendor_id,title,active,starts_at,ends_at,redemption_mode,sort_order,offer_value,currency,discount_type,discount_value from public.kouponly_offers;
