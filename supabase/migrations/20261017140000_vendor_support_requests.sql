create table public.kouponly_vendor_support_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id text not null references public.couponly_vendors(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('staff_visit','offer','support')),
  details text not null check (length(trim(details)) between 5 and 2000),
  status text not null default 'pending' check (status in ('pending','contacted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kouponly_vendor_support_requests_recent_idx on public.kouponly_vendor_support_requests(created_at desc);
alter table public.kouponly_vendor_support_requests enable row level security;
grant select, insert, update on public.kouponly_vendor_support_requests to authenticated;
create policy kouponly_vendor_support_own_read on public.kouponly_vendor_support_requests for select to authenticated
  using (requester_id = auth.uid() or public.kouponly_is_benefits_admin());
create policy kouponly_vendor_support_vendor_insert on public.kouponly_vendor_support_requests for insert to authenticated
  with check (requester_id = auth.uid() and public.couponly_is_vendor_member(vendor_id));
create policy kouponly_vendor_support_admin_update on public.kouponly_vendor_support_requests for update to authenticated
  using (public.kouponly_is_benefits_admin()) with check (public.kouponly_is_benefits_admin());
notify pgrst, 'reload schema';
