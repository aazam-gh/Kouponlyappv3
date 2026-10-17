alter table public.couponly_vendors
  add column new_deals_priority integer check (new_deals_priority between 1 and 99999),
  add column trending_priority integer check (trending_priority between 1 and 99999);

with ranked as (
  select v.id, row_number() over (order by v.newest desc, v.sort_order, v.name, v.id)::integer as priority
  from public.couponly_vendors v
  where v.status = 'Active'
    and exists (
      select 1 from public.couponly_offers o
      where o.vendor_id = v.id and o.active
        and (o.starts_at is null or o.starts_at <= now())
        and (o.ends_at is null or o.ends_at > now())
    )
)
update public.couponly_vendors v
set new_deals_priority = ranked.priority
from ranked
where ranked.id = v.id and ranked.priority <= 10;

with ranked as (
  select v.id, row_number() over (order by v.trend desc, v.sort_order, v.name, v.id)::integer as priority
  from public.couponly_vendors v
  where v.status = 'Active' and v.trend > 0
    and exists (
      select 1 from public.couponly_offers o
      where o.vendor_id = v.id and o.active
        and (o.starts_at is null or o.starts_at <= now())
        and (o.ends_at is null or o.ends_at > now())
    )
)
update public.couponly_vendors v
set trending_priority = ranked.priority
from ranked
where ranked.id = v.id;

create or replace view public.realx_vendors with (security_invoker = true) as
select * from public.couponly_vendors;
