create table public.couponly_vendor_categories (
  vendor_id text not null references public.couponly_vendors(id) on delete cascade,
  category_id text not null references public.couponly_categories(id) on delete restrict,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (vendor_id, category_id)
);

create unique index couponly_vendor_categories_one_primary
  on public.couponly_vendor_categories(vendor_id) where is_primary;
create index couponly_vendor_categories_category_idx
  on public.couponly_vendor_categories(category_id, vendor_id);

insert into public.couponly_vendor_categories(vendor_id, category_id, is_primary, sort_order)
select id, category_id, true, 0 from public.couponly_vendors where category_id is not null;

update public.couponly_vendors v set payload = v.payload || jsonb_build_object(
  'categoryIds', coalesce((
    select jsonb_agg(vc.category_id order by vc.is_primary desc, vc.sort_order, vc.category_id)
    from public.couponly_vendor_categories vc where vc.vendor_id = v.id
  ), '[]'::jsonb)
);

create or replace function public.kouponly_apply_vendor_taxonomy()
returns trigger language plpgsql set search_path = '' as $$
declare
  category_name text;
  requested_name text;
  category_ids text[];
  category_count integer;
begin
  requested_name := coalesce(new.payload->>'mainCategory', new.payload->>'category');
  if new.category_id is null then
    select id into new.category_id from public.couponly_categories
    where active and lower(name) = lower(requested_name) limit 1;
  end if;

  if jsonb_typeof(new.payload->'categoryIds') = 'array' then
    select coalesce(array_agg(id order by ordinality), '{}') into category_ids
    from jsonb_array_elements_text(new.payload->'categoryIds') with ordinality as requested(id, ordinality);
  elsif tg_op = 'UPDATE' and new.category_id is not distinct from old.category_id then
    select coalesce(array_agg(id order by ordinality), array[new.category_id]) into category_ids
    from jsonb_array_elements_text(coalesce(old.payload->'categoryIds', jsonb_build_array(old.category_id))) with ordinality as existing(id, ordinality);
  else
    category_ids := array[new.category_id];
  end if;

  if coalesce(cardinality(category_ids), 0) = 0 or category_ids[1] is distinct from new.category_id then
    raise exception 'The first selected category must be the primary category' using errcode = '22023';
  end if;
  select count(*) into category_count from (select distinct unnest(category_ids)) selected;
  if category_count <> cardinality(category_ids) then
    raise exception 'A category can only be selected once' using errcode = '22023';
  end if;
  if (select count(*) from public.couponly_categories c where c.id = any(category_ids) and c.active) <> cardinality(category_ids) then
    raise exception 'Every selected category must be active' using errcode = '22023';
  end if;

  select name into category_name from public.couponly_categories where id = new.category_id and active;
  if category_name is null then
    raise exception 'Select an active primary category' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(new.payload->'subcategory', '[]'::jsonb)) <> 'array' then
    raise exception 'Vendor subcategories must be an array' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(new.payload->'subcategory', '[]'::jsonb)) label
    where not exists(select 1 from public.couponly_subcategories s where s.category_id = new.category_id and s.name = label)
  ) then
    raise exception 'Every subcategory must belong to the primary category' using errcode = '22023';
  end if;

  new.payload := new.payload || jsonb_build_object('mainCategory', category_name, 'categoryIds', to_jsonb(category_ids));
  return new;
end $$;

create or replace function public.kouponly_sync_vendor_categories()
returns trigger language plpgsql security definer set search_path = '' as $$
declare category_ids text[];
begin
  if tg_op = 'DELETE' then
    delete from public.couponly_vendor_categories where vendor_id = old.id;
    return old;
  end if;

  select coalesce(array_agg(id order by ordinality), '{}') into category_ids
  from jsonb_array_elements_text(new.payload->'categoryIds') with ordinality as selected(id, ordinality);

  delete from public.couponly_vendor_categories
  where vendor_id = new.id and not (category_id = any(category_ids));
  insert into public.couponly_vendor_categories(vendor_id, category_id, is_primary, sort_order)
  select new.id, id, id = new.category_id, ordinality - 1
  from unnest(category_ids) with ordinality as selected(id, ordinality)
  on conflict (vendor_id, category_id) do update
    set is_primary = excluded.is_primary, sort_order = excluded.sort_order;
  return new;
end $$;

create trigger kouponly_vendor_categories_sync
after insert or update of category_id, payload or delete on public.couponly_vendors
for each row execute function public.kouponly_sync_vendor_categories();

alter table public.couponly_vendor_categories enable row level security;
create policy couponly_vendor_categories_read on public.couponly_vendor_categories
  for select to anon, authenticated using (
    exists(select 1 from public.couponly_vendors v where v.id = vendor_id and v.status = 'Active')
    or public.couponly_is_admin() or public.couponly_is_vendor_member(vendor_id)
  );
create policy couponly_vendor_categories_admin on public.couponly_vendor_categories
  for all to authenticated using (public.couponly_is_admin()) with check (public.couponly_is_admin());
grant select on public.couponly_vendor_categories to anon, authenticated;
grant insert, update, delete on public.couponly_vendor_categories to authenticated;
revoke all on function public.kouponly_sync_vendor_categories() from public, anon, authenticated;

create view public.kouponly_vendor_categories with (security_invoker = true)
as select * from public.couponly_vendor_categories;
grant select on public.kouponly_vendor_categories to anon, authenticated;

do $body$
declare
  definition text;
  old_filter text := $old$and lower(btrim(coalesce(nullif(c.name, ''), nullif(v.payload->>'mainCategory', ''), v.payload->>'category'))) in ('food', 'dining', 'cafe', 'cafes')$old$;
  new_filter text := $new$and (
        lower(btrim(coalesce(nullif(c.name, ''), nullif(v.payload->>'mainCategory', ''), v.payload->>'category'))) in ('food', 'dining', 'cafe', 'cafes')
        or exists (
          select 1 from public.kouponly_vendor_categories vc
          join public.kouponly_categories assigned_category on assigned_category.id = vc.category_id
          where vc.vendor_id = v.id and lower(btrim(assigned_category.name)) in ('food', 'dining', 'cafe', 'cafes')
        )
      )$new$;
begin
  definition := pg_get_functiondef('public.get_nearby_food_offers(double precision,double precision)'::regprocedure);
  if position(old_filter in definition) = 0 then
    raise exception 'Unexpected get_nearby_food_offers definition';
  end if;
  execute replace(definition, old_filter, new_filter);
end $body$;

do $$
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'couponly_vendor_categories'
  ) then
    alter publication supabase_realtime add table public.couponly_vendor_categories;
  end if;
end $$;

notify pgrst, 'reload schema';
