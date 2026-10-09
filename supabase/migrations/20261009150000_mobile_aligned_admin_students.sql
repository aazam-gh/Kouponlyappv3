-- Read the same Auth, profile, referral and saved records as the mobile MVP.
create function public.kouponly_admin_students(p_search text default '', p_offset integer default 0, p_limit integer default 25, p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or p_search is null or length(p_search)>200 then
    raise exception 'Invalid pagination or search' using errcode='22023';
  end if;
  with students as (
    select u.id,u.email,coalesce(nullif(p.full_name,''),nullif(concat_ws(' ',s.first_name,s.last_name),''),nullif(u.raw_user_meta_data->>'full_name',''),'Unnamed student') as name,
      p.city,coalesce(p.mobile,s.phone) as phone,u.created_at as "createdAt",u.email_confirmed_at as "emailVerifiedAt",
      public.kouponly_school_email(u.email) and u.email_confirmed_at is not null as eligible,
      (select code from public.kouponly_invite_codes where user_id=u.id) as "inviteCode",
      (select count(*) from public.kouponly_reward_grants where user_id=u.id and source_type='referral') as "referralRefreshes",
      (select max_rewards_per_period from public.kouponly_referral_policy where id) as "referralLimit",
      (select count(*) from public.referral_uses where inviter_user_id=u.id) as "invitedFriends",
      (select count(*) from public.redemptions where user_id=u.id and round_id is not null and consumed_at>=month_start) as "consumedThisMonth",
      (select jsonb_build_object('startsAt',sp.starts_at,'endsAt',sp.ends_at,'roundNumber',r.round_number,
         'usedVendors',(select count(distinct vendor_id) from public.redemptions where user_id=u.id and consumed_at is not null
           and (round_id=r.id or (r.round_number=0 and consumed_at>=sp.starts_at and consumed_at<sp.ends_at
             and period_id in (select periods.id from public.kouponly_subscription_periods periods join public.kouponly_subscriptions paid on paid.id=periods.subscription_id where paid.provider<>'free_mvp')))))
       from public.kouponly_subscription_periods sp join public.kouponly_subscriptions sub on sub.id=sp.subscription_id
       left join public.kouponly_coupon_rounds r on r.period_id=sp.id and r.closed_at is null
       where sp.user_id=u.id and sub.provider='free_mvp' and sp.revoked_at is null and sp.starts_at<=now() and sp.ends_at>now()
       order by sp.starts_at desc limit 1) as "couponMonth"
    from auth.users u left join public.profiles p on p.user_id=u.id left join public.couponly_students s on s.id=u.id
    where not coalesce(u.is_anonymous,false)
      and (p.user_id is not null or s.id is not null or public.kouponly_school_email(u.email))
      and not exists(select 1 from public.couponly_user_roles where user_id=u.id and role in ('admin','vendor'))
      and (p_user_id is null or u.id=p_user_id)
  ), filtered as (select * from students where p_search='' or position(lower(p_search) in lower(concat_ws(' ',name,email,"inviteCode")))>0)
  select jsonb_build_object('total',(select count(*) from filtered),'students',coalesce((select jsonb_agg(x order by "createdAt" desc,id)
    from (select * from filtered order by "createdAt" desc,id offset p_offset limit p_limit)x),'[]'::jsonb)) into result;
  if p_user_id is not null and (result->>'total')::integer>0 then
    result:=result || jsonb_build_object(
      'savedItems',coalesce((select jsonb_agg(x order by "savedAt" desc,id) from (
        select 'vendor:'||d.deal_id as id,'Vendor' as type,coalesce(v.name,'Unavailable vendor') as title,v.id as "vendorId",d.created_at as "savedAt"
        from public.saved_deals d left join public.couponly_vendors v on v.catalogue_deal_id=d.deal_id where d.user_id=p_user_id
        union all
        select 'offer:'||o.offer_id,'Offer',coalesce(f.title,'Unavailable offer'),f.vendor_id,o.created_at
        from public.saved_offers o left join public.couponly_offers f on f.id=o.offer_id where o.user_id=p_user_id
      )x),'[]'::jsonb),
      'referrals',coalesce((select jsonb_agg(x order by "createdAt" desc,id) from (
        select r.referred_user_id as id,u.email,r.status,r.reason,r.created_at as "createdAt"
        from public.referral_uses r left join auth.users u on u.id=r.referred_user_id where r.inviter_user_id=p_user_id
      )x),'[]'::jsonb));
  end if;
  return result;
end $$;
revoke all on function public.kouponly_admin_students(text,integer,integer,uuid) from public,anon;
grant execute on function public.kouponly_admin_students(text,integer,integer,uuid) to authenticated;
notify pgrst,'reload schema';
