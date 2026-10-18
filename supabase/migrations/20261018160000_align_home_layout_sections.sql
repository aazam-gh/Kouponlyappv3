begin;

create or replace function public.kouponly_validate_home_layout()
returns trigger language plpgsql set search_path = public as $$
declare expected text[] := array['brand-logos','categories','featured-showcase','nearby-vendors','new-deals','partner-banners','trending-offers'];
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

update public.couponly_cms_documents
set payload = jsonb_set(
  payload,
  '{sectionOrder}',
  (select jsonb_agg(value order by ordinal)
   from jsonb_array_elements_text(payload->'sectionOrder') with ordinality as sections(value, ordinal)
   where value <> 'top-brands')
)
where id = 'homeLayout'
  and payload->'sectionOrder' @> '["top-brands"]'::jsonb;

commit;
