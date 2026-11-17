create table public.kouponly_vendor_account_managers (
  vendor_id text primary key references public.couponly_vendors(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  phone text not null check (length(phone) <= 40 and phone ~ '^[+]?[0-9(). -]+$' and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 5 and 15)
);

alter table public.kouponly_vendor_account_managers enable row level security;
revoke all on public.kouponly_vendor_account_managers from public, anon, authenticated;
grant select, insert, update on public.kouponly_vendor_account_managers to authenticated;

create policy vendor_account_manager_read on public.kouponly_vendor_account_managers
  for select to authenticated
  using ((select public.kouponly_is_benefits_admin()) or public.couponly_is_vendor_member(vendor_id));

create policy vendor_account_manager_insert on public.kouponly_vendor_account_managers
  for insert to authenticated with check ((select public.kouponly_is_benefits_admin()));

create policy vendor_account_manager_update on public.kouponly_vendor_account_managers
  for update to authenticated
  using ((select public.kouponly_is_benefits_admin()))
  with check ((select public.kouponly_is_benefits_admin()));

notify pgrst, 'reload schema';
