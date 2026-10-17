-- Friends must read the mobile store’s saved_offers as well as legacy saved items.
create or replace function public.kouponly_friends_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); friends jsonb; activity jsonb;
begin
  if uid is null then raise exception 'Sign in to see friends.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',coalesce(nullif(p.full_name,''),'Student'),'status',f.status,'incoming',f.recipient_id=uid) order by f.created_at desc),'[]'::jsonb) into friends
    from public.kouponly_friendships f left join public.profiles p on p.user_id=case when f.requester_id=uid then f.recipient_id else f.requester_id end where uid in (f.requester_id,f.recipient_id);
  with peers as (
    select case when requester_id=uid then recipient_id else requester_id end as user_id from public.kouponly_friendships where status='accepted' and uid in(requester_id,recipient_id)
  ), saved as (
    select s.student_id as user_id,s.item_id as offer_id,s.created_at
      from public.couponly_student_saved_items s join peers on peers.user_id=s.student_id where s.item_type='offer'
    union all
    select s.user_id,s.offer_id,s.created_at from public.saved_offers s join peers on peers.user_id=s.user_id
  ), saved_offers as (
    select user_id,offer_id,max(created_at) as created_at from saved group by user_id,offer_id
  ), events as (
    select s.user_id::text||':'||s.offer_id as id,s.user_id,s.created_at,'saved' as action,o.vendor_id,v.name as vendor_name,o.title
      from peers join public.kouponly_social_preferences pref on pref.user_id=peers.user_id and pref.share_activity
      join saved_offers s on s.user_id=peers.user_id
      join public.couponly_offers o on o.id=s.offer_id join public.couponly_vendors v on v.id=o.vendor_id
      where s.created_at>now()-interval '30 days' and o.active and v.status='Active'
    union all
    select r.redemption_id,r.user_id,r.consumed_at,'redeemed',r.vendor_id,v.name,r.offer_snapshot->>'title'
      from peers join public.kouponly_social_preferences pref on pref.user_id=peers.user_id and pref.share_activity
      join public.redemptions r on r.user_id=peers.user_id join public.couponly_vendors v on v.id=r.vendor_id
      where r.consumed_at>now()-interval '30 days' and r.status='success' and v.status='Active'
  ) select coalesce(jsonb_agg(row_to_json(a)),'[]'::jsonb) into activity from (
    select e.id,coalesce(nullif(p.full_name,''),'Student') as name,e.action,e.vendor_id as "vendorId",e.vendor_name as "vendorName",e.title,e.created_at as "createdAt"
      from events e left join public.profiles p on p.user_id=e.user_id order by e.created_at desc limit 50
  ) a;
  return jsonb_build_object('friends',friends,'activity',activity,'shareActivity',coalesce((select share_activity from public.kouponly_social_preferences where user_id=uid),false));
end $$;
revoke all on function public.kouponly_request_friend(text),public.kouponly_respond_friend(uuid,text),public.kouponly_friends_snapshot() from public,anon;
grant execute on function public.kouponly_request_friend(text),public.kouponly_respond_friend(uuid,text),public.kouponly_friends_snapshot() to authenticated;
notify pgrst,'reload schema';
