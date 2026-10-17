create table public.kouponly_school_email_domains (
  domain text primary key check (domain = lower(trim(domain)) and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.kouponly_school_email_domains(domain)
select distinct lower(trim(domain)) from public.realx_universities u cross join lateral unnest(u.email_domains) as domains(domain)
where lower(trim(domain)) ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
on conflict(domain) do nothing;
insert into public.kouponly_school_email_domains(domain) values ('rajagiri.edu.in') on conflict(domain) do nothing;
alter table public.kouponly_school_email_domains enable row level security;
grant select, insert, update, delete on public.kouponly_school_email_domains to authenticated;
create policy kouponly_school_domains_admin on public.kouponly_school_email_domains for all to authenticated
  using (public.kouponly_is_benefits_admin()) with check (public.kouponly_is_benefits_admin());

create or replace function public.kouponly_school_email(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (lower(trim(p_email)) ~ '^[^@[:space:]]+@[^@[:space:]]+$' and
      split_part(lower(trim(p_email)), '@', 2) in (select d.domain from public.kouponly_school_email_domains d where d.active))
    or lower(trim(p_email)) = any(array['info@kouponly.in','pauljasonthykatt@gmail.com','sabinjsshaji2002@gmail.com']), false
  );
$$;
revoke all on function public.kouponly_school_email(text) from public, anon;
grant execute on function public.kouponly_school_email(text) to authenticated, service_role;
notify pgrst, 'reload schema';
