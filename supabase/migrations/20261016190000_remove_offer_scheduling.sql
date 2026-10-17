begin;

create function public.kouponly_offer_no_schedule()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.starts_at := null;
  new.ends_at := null;
  return new;
end $$;

create trigger kouponly_offer_no_schedule
before insert or update on public.couponly_offers
for each row execute function public.kouponly_offer_no_schedule();

update public.couponly_offers set starts_at = null, ends_at = null
where starts_at is not null or ends_at is not null;

commit;
