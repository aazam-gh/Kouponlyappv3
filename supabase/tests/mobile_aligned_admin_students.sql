begin;
insert into auth.users(id,email,email_confirmed_at,created_at,raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000015','admin-align-student@gmail.com',now(),now(),'{}'),
 ('bbbbbbbb-0000-0000-0000-000000000015','admin-align-pending@outlook.com',null,now(),'{}'),
 ('dddddddd-0000-0000-0000-000000000015','admin-align-admin@rajagiri.edu.in',now(),now(),'{}');
insert into public.couponly_user_roles(user_id,role) values('dddddddd-0000-0000-0000-000000000015','admin');
update public.profiles set full_name='Admin alignment mobile profile',city='Kochi',mobile='12345' where user_id='aaaaaaaa-0000-0000-0000-000000000015';
do $$
declare student uuid:='aaaaaaaa-0000-0000-0000-000000000015'; pending uuid:='bbbbbbbb-0000-0000-0000-000000000015';
 admin uuid:='dddddddd-0000-0000-0000-000000000015'; result jsonb; b jsonb; vendor public.couponly_vendors%rowtype; offer text;
begin
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.kouponly_admin_students(); raise exception 'anonymous read accepted'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',student::text,true);
  begin perform public.kouponly_admin_students(); raise exception 'student read accepted'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  result:=public.kouponly_admin_students(p_user_id:=student);
  assert result->>'total'='1','mobile Auth/profile user appears without a legacy student row';
  assert result->'students'->0->>'name'='Admin alignment mobile profile','mobile name';
  assert result->'students'->0->>'eligible'='true','confirmed school email eligible';
  assert result->'students'->0->'couponMonth'='null'::jsonb,'admin does not allocate coupons';
  assert result->'students'->0->>'city'='Kochi','mobile city';
  assert public.kouponly_admin_students(p_user_id:=pending)->'students'->0->>'eligible'='false','unverified school email ineligible';
  assert public.kouponly_admin_students(p_user_id:=admin)->>'total'='0','admin excluded from students';
  assert public.kouponly_admin_students(p_search:='admin-align-',p_limit:=1)->>'total'='2','search count excludes admin';
  assert jsonb_array_length(public.kouponly_admin_students(p_search:='admin-align-',p_offset:=1,p_limit:=1)->'students')=1,'second page';
  assert public.kouponly_admin_students(p_search:='%')->>'total'='0','search treats wildcard literally';
  begin perform public.kouponly_admin_students(p_limit:=101); raise exception 'oversized page accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.kouponly_admin_students(p_offset:=-1); raise exception 'negative offset accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.kouponly_admin_students(p_search:=null); raise exception 'null search accepted'; exception when invalid_parameter_value then null; end;
  select v.* into vendor from public.couponly_vendors v where v.status='Active' and v.catalogue_deal_id is not null order by v.id limit 1;
  select id into offer from public.couponly_offers where vendor_id=vendor.id order by id limit 1;
  assert vendor.id is not null and offer is not null,'catalogue fixture available';
  insert into public.saved_deals(user_id,deal_id) values(student,vendor.catalogue_deal_id);
  insert into public.saved_offers(user_id,offer_id) values(student,offer);
  result:=public.kouponly_admin_students(p_user_id:=student);
  assert jsonb_array_length(result->'savedItems')=2,'reads both mobile saved tables';
  assert result->'savedItems'->0->>'vendorId'=vendor.id,'saved item canonical vendor';
  perform set_config('request.jwt.claim.sub',student::text,true);
  b:=public.kouponly_account_benefits();
  perform set_config('request.jwt.claim.sub',pending::text,true);
  result:=public.kouponly_claim_code(b->>'inviteCode',gen_random_uuid());
  assert result->>'error'='Verified email required','unverified referral claim denied';
  -- Attach the attribution the signup trigger records before email verification.
  insert into public.referral_uses(referred_user_id,inviter_user_id,status) values(pending,student,'attached');
end $$;
-- Verify lazy coupon reads and successful referral qualification separately from denial subtransactions.
do $$ declare student uuid:='aaaaaaaa-0000-0000-0000-000000000015'; pending uuid:='bbbbbbbb-0000-0000-0000-000000000015'; b jsonb; begin
  perform set_config('request.jwt.claim.sub',student::text,true);
  b:=public.kouponly_account_benefits();
  insert into public.referral_uses(referred_user_id,inviter_user_id,status) values(pending,student,'attached') on conflict(referred_user_id) do nothing;
  update auth.users set email_confirmed_at=now() where id=pending;
  perform set_config('request.jwt.claim.sub',pending::text,true);
  b:=public.kouponly_account_benefits();
  perform set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000015',true);
  b:=public.kouponly_admin_students(p_user_id:=student);
  assert b->'students'->0->>'referralRefreshes'='1','reads successful refresh count';
  assert b->'students'->0->'couponMonth'->>'roundNumber'='1','reads latest open round';
  assert b->'referrals'->0->>'status'='rewarded','reads referral qualification';
  assert not has_function_privilege('anon','public.kouponly_admin_students(text,integer,integer,uuid)','execute'),'anonymous execute revoked';
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000015',true);
set local role authenticated;
do $$ begin
  begin perform public.kouponly_admin_students(); raise exception 'authenticated student reads all students'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
