create or replace function public.couponly_record_cms_click(p_document_id text,p_item_id text)
returns void language plpgsql security definer set search_path=public as $$
declare target_active boolean:=false;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_document_id not in ('appLaunchPoster','featuredBrandShowcase','banner') or length(p_item_id) not between 1 and 160 then
    raise exception 'Invalid CMS click target' using errcode='22023';
  end if;
  if p_document_id='appLaunchPoster' then
    select coalesce((payload->>'active')::boolean,false) into target_active from public.couponly_cms_documents where id=p_document_id;
  elsif p_document_id='featuredBrandShowcase' then
    select exists(select 1 from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) item where item->>'id'=p_item_id and coalesce((item->>'isActive')::boolean,false)) into target_active from public.couponly_cms_documents where id=p_document_id;
  else
    select exists(select 1 from jsonb_array_elements(coalesce(payload->'banners','[]'::jsonb)) item where item->>'bannerId'=p_item_id and coalesce((item->>'isActive')::boolean,false)) into target_active from public.couponly_cms_documents where id=p_document_id;
  end if;
  if not coalesce(target_active,false) then raise exception 'CMS item is not active' using errcode='22023'; end if;
  insert into public.couponly_cms_clicks(document_id,item_id,student_id) values(p_document_id,p_item_id,auth.uid());
end $$;
grant execute on function public.couponly_record_cms_click(text,text) to authenticated;
