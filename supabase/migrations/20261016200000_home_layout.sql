begin;
create or replace function public.kouponly_validate_home_layout()
returns trigger language plpgsql set search_path = public as $$
declare expected text[] := array['brand-logos','categories','featured-showcase','nearby-vendors','new-deals','partner-banners','top-brands','trending-offers'];
        actual text[];
begin
  if new.id <> 'homeLayout' then return new; end if;
  if jsonb_typeof(new.payload->'sectionOrder') is distinct from 'array' then
    raise exception 'Home layout requires a section order array' using errcode = '23514';
  end if;
  select array_agg(value order by value) into actual from jsonb_array_elements_text(new.payload->'sectionOrder');
  if actual is distinct from expected then
    raise exception 'Home layout must contain each Home section exactly once' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger kouponly_validate_home_layout before insert or update on public.couponly_cms_documents
for each row execute function public.kouponly_validate_home_layout();
insert into public.couponly_cms_documents(id, payload) values ('homeLayout', '{"sectionOrder":["partner-banners","categories","nearby-vendors","new-deals","featured-showcase","trending-offers","brand-logos","top-brands"]}') on conflict(id) do nothing;
commit;
