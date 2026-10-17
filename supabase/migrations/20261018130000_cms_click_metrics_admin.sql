create or replace function public.couponly_cms_click_metrics(p_document_id text,p_item_id text,p_from date default null,p_to date default null)
returns table(total_clicks bigint,unique_students bigint) language plpgsql security definer set search_path=public as $$
begin
  if not public.couponly_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_document_id not in ('appLaunchPoster','featuredBrandShowcase','banner') or length(p_item_id) not between 1 and 160 then
    raise exception 'Invalid CMS click target' using errcode='22023';
  end if;
  return query select count(*)::bigint,count(distinct c.student_id)::bigint
  from public.couponly_cms_clicks c
  where c.document_id=p_document_id and c.item_id=p_item_id
    and (p_from is null or c.clicked_at >= (p_from::timestamp at time zone 'Asia/Qatar'))
    and (p_to is null or c.clicked_at < ((p_to+1)::timestamp at time zone 'Asia/Qatar'));
end $$;
grant execute on function public.couponly_cms_click_metrics(text,text,date,date) to authenticated;
