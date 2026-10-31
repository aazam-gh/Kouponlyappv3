begin;
alter table public.couponly_offers
  add column redemption_limit integer generated always as (nullif(payload->>'redemptionLimit','')::integer) stored check (redemption_limit>0),
  add column redemption_count bigint not null default 0 check (redemption_count>=0);
create index kouponly_offer_consumed_at_idx on public.redemptions(offer_id,consumed_at) where consumed_at is not null;

-- Count the current validity window; unlimited offers still accumulate usage for later limits.
update public.couponly_offers o set redemption_count=(select count(*) from public.redemptions r
 where r.offer_id=o.id and r.consumed_at is not null
 and (o.starts_at is null or r.consumed_at>=o.starts_at) and (o.ends_at is null or r.consumed_at<o.ends_at));
-- Usage is server-owned, including when vendor members can edit other offer fields.
create function public.kouponly_guard_offer_capacity() returns trigger
language plpgsql set search_path='' as $$
begin
 if pg_trigger_depth()=1 and ((tg_op='INSERT' and new.redemption_count<>0)
  or (tg_op='UPDATE' and new.redemption_count is distinct from old.redemption_count)) then
  raise exception 'Offer redemption usage is server-managed' using errcode='42501';
 end if;
 return new;
end $$;
create trigger aa_kouponly_guard_offer_capacity before insert or update on public.couponly_offers
 for each row execute function public.kouponly_guard_offer_capacity();

create function public.kouponly_recount_offer_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
  select count(*) into new.redemption_count from public.redemptions r where r.offer_id=new.id and r.consumed_at is not null
   and (new.starts_at is null or r.consumed_at>=new.starts_at) and (new.ends_at is null or r.consumed_at<new.ends_at);
 end if;
 return new;
end $$;
create trigger kouponly_recount_offer_capacity before update of starts_at,ends_at on public.couponly_offers
 for each row execute function public.kouponly_recount_offer_capacity();

-- The conditional row update is atomic across students, branches, rounds and older RPCs.
create function public.kouponly_consume_offer_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.offer_id is not distinct from old.offer_id and new.consumed_at is not distinct from old.consumed_at then return new; end if;
 if tg_op='UPDATE' then
  perform 1 from public.couponly_offers where id in (old.offer_id,new.offer_id) order by id for update;
 end if;
 if tg_op in ('DELETE','UPDATE') and old.consumed_at is not null then
  update public.couponly_offers set redemption_count=greatest(0,redemption_count-1)
   where id=old.offer_id and (starts_at is null or old.consumed_at>=starts_at) and (ends_at is null or old.consumed_at<ends_at);
 end if;
 if tg_op in ('INSERT','UPDATE') and new.consumed_at is not null then
  update public.couponly_offers set redemption_count=redemption_count+1
   where id=new.offer_id and (starts_at is null or new.consumed_at>=starts_at) and (ends_at is null or new.consumed_at<ends_at)
   and (redemption_limit is null or redemption_count<redemption_limit);
  if not found and exists(select 1 from public.couponly_offers where id=new.offer_id
   and (starts_at is null or new.consumed_at>=starts_at) and (ends_at is null or new.consumed_at<ends_at)) then
   raise exception 'OFFER_EXHAUSTED';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger kouponly_consume_offer_capacity after insert or update of offer_id,consumed_at or delete on public.redemptions
 for each row execute function public.kouponly_consume_offer_capacity();
revoke all on function public.kouponly_guard_offer_capacity(),public.kouponly_recount_offer_capacity(),public.kouponly_consume_offer_capacity() from public,anon,authenticated;
-- Refresh the compatibility view so existing catalogue readers receive the new fields.
create or replace view public.kouponly_offers as select * from public.couponly_offers;
do $$ begin
 if current_setting('server_version_num')::integer>=150000 then
  execute 'alter view public.kouponly_offers set (security_invoker=true)';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
