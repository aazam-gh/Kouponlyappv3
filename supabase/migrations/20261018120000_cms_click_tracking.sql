begin;

create table if not exists public.couponly_cms_clicks (
  id bigint generated always as identity primary key,
  document_id text not null check (document_id in ('appLaunchPoster','featuredBrandShowcase','banner')),
  item_id text not null check (length(item_id) between 1 and 160),
  student_id uuid not null references auth.users(id) on delete cascade,
  clicked_at timestamptz not null default now()
);
create index if not exists couponly_cms_clicks_item_date_idx on public.couponly_cms_clicks(document_id,item_id,clicked_at desc);
alter table public.couponly_cms_clicks enable row level security;
revoke all on public.couponly_cms_clicks from anon, authenticated;

create or replace function public.couponly_record_cms_click(p_document_id text,p_item_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_document_id not in ('appLaunchPoster','featuredBrandShowcase','banner') or length(p_item_id) not between 1 and 160 then
    raise exception 'Invalid CMS click target' using errcode='22023';
  end if;
  insert into public.couponly_cms_clicks(document_id,item_id,student_id) values(p_document_id,p_item_id,auth.uid());
end $$;

create or replace function public.couponly_cms_click_metrics(p_document_id text,p_item_id text,p_from date default null,p_to date default null)
returns table(total_clicks bigint,unique_students bigint) language plpgsql security definer set search_path=public as $$
begin
  if not public.realx_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_document_id not in ('appLaunchPoster','featuredBrandShowcase','banner') or length(p_item_id) not between 1 and 160 then
    raise exception 'Invalid CMS click target' using errcode='22023';
  end if;
  return query select count(*)::bigint,count(distinct c.student_id)::bigint
  from public.couponly_cms_clicks c
  where c.document_id=p_document_id and c.item_id=p_item_id
    and (p_from is null or c.clicked_at >= (p_from::timestamp at time zone 'Asia/Qatar'))
    and (p_to is null or c.clicked_at < ((p_to+1)::timestamp at time zone 'Asia/Qatar'));
end $$;
grant execute on function public.couponly_record_cms_click(text,text) to authenticated;
grant execute on function public.couponly_cms_click_metrics(text,text,date,date) to authenticated;

commit;
