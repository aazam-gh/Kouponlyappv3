begin;

alter table public.couponly_vendors
  add column is_suggested boolean not null default false;

create or replace view public.realx_vendors with (security_invoker = true) as
select * from public.couponly_vendors;

notify pgrst, 'reload schema';

commit;
