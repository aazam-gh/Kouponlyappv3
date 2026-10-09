begin;
-- Rollback-only fixtures; safe to rehearse against deployed catalogue/role aliases.
do $$ declare roles regclass; vendors regclass; offers regclass; categories regclass; category text; begin
  roles:=coalesce(to_regclass('public.couponly_user_roles'),to_regclass('public.realx_user_roles'));
  vendors:=coalesce(to_regclass('public.couponly_vendors'),to_regclass('public.realx_vendors'));
  offers:=coalesce(to_regclass('public.couponly_offers'),to_regclass('public.realx_offers'));
  categories:=coalesce(to_regclass('public.couponly_categories'),to_regclass('public.realx_categories'));
  execute format('select id from %s where active order by id limit 1',categories) into category;
  insert into auth.users(id,email,email_confirmed_at,created_at,raw_user_meta_data) values
   ('aaaaaaaa-0000-0000-0000-000000000009','mvp-test-alice@rajagiri.edu.in',now(),now(),'{}'),
   ('bbbbbbbb-0000-0000-0000-000000000009','mvp-test-bob@rajagiri.edu.in',null,now(),'{}'),
   ('dddddddd-0000-0000-0000-000000000009','mvp-test-admin@rajagiri.edu.in',now(),now(),'{}');
  execute format('insert into %s(user_id,role) values($1,''admin'')',roles) using 'dddddddd-0000-0000-0000-000000000009'::uuid;
  execute format('insert into %s(id,name,status,catalogue_deal_id,category_id) values(''mvp-test-vendor'',''MVP vendor'',''Active'',900099,$1)',vendors) using category;
  execute format('insert into %s(id,vendor_id,title,active,redemption_mode,sort_order) values(''mvp-test-offer1'',''mvp-test-vendor'',''Coupon 1'',true,''inStore'',0),(''mvp-test-offer2'',''mvp-test-vendor'',''Coupon 2'',true,''inStore'',1)',offers);
end $$;
do $$
declare alice uuid:='aaaaaaaa-0000-0000-0000-000000000009'; bob uuid:='bbbbbbbb-0000-0000-0000-000000000009'; admin uuid:='dddddddd-0000-0000-0000-000000000009';
 b jsonb; result jsonb; replay jsonb; claim jsonb; code text; round uuid; original_period uuid; original_ends timestamptz; mutation uuid:=gen_random_uuid(); friend uuid; n int;
begin
  -- Exact domain matching, not suffix lookalikes, phone verification, or metadata.
  assert public.kouponly_school_email(' STUDENT@RAJAGIRI.EDU.IN '),'case-insensitive exact domain';
  assert not public.kouponly_school_email('a@rajagiri.edu.in.attacker.com'),'suffix spoof denied';
  begin insert into auth.users(email) values('mvp-test@example.com'); raise exception 'outside signup accepted'; exception when insufficient_privilege then null; end;
  begin insert into auth.users(email) values('a@sub.rajagiri.edu.in'); raise exception 'subdomain accepted'; exception when insufficient_privilege then null; end;
  begin update auth.users set email='mvp-test@example.com' where id=alice; raise exception 'email change bypass'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',bob::text,true);
  begin perform public.kouponly_account_benefits(); raise exception 'unverified access'; exception when insufficient_privilege then null; end;
  if to_regprocedure('public.couponly_complete_signup(jsonb)') is not null then
    begin execute 'select public.couponly_complete_signup($1)' using jsonb_build_object('email','mvp-test-bob@rajagiri.edu.in','firstName','MVP','lastName','Test'); raise exception 'unverified profile completion'; exception when insufficient_privilege then null; end;
  end if;
  update auth.users set phone_confirmed_at=now() where id=bob;
  begin perform public.kouponly_account_benefits(); raise exception 'phone verification bypass'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',alice::text,true);
  b:=public.kouponly_account_benefits(); code:=b->>'inviteCode'; round:=(b->'subscription'->>'roundId')::uuid; original_period:=(b->'subscription'->>'periodId')::uuid; original_ends:=(b->'subscription'->>'endsAt')::timestamptz;
  assert b->'subscription'->>'planName'='Free Rajagiri membership','automatic free access';
  assert b->>'referralLimit'='3','three total limit';
  assert (b->'subscription'->>'startsAt')::timestamptz=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata','calendar start IST';
  assert original_ends=(date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month') at time zone 'Asia/Kolkata','calendar end IST';
  assert public.kouponly_claim_code(code,gen_random_uuid())->>'error'='SELF_REFERRAL','self invite denied';
  result:=public.kouponly_redeem_coupon('mvp-test-offer1',round,mutation);
  assert length(result->>'code')=5 and result->>'code'=(select r.code from public.redemptions r where r.redemption_id=result->>'id'),'server receipt code persisted';
  assert public.kouponly_redeem_coupon('mvp-test-offer1',round,mutation)=result,'retry returns same receipt';
  begin perform public.kouponly_redeem_coupon('mvp-test-offer2',round,gen_random_uuid()); raise exception 'same vendor accepted'; exception when raise_exception then assert sqlerrm='VENDOR_ALREADY_USED','vendor quota across offers'; end;
  begin perform public.kouponly_redeem_coupon('mvp-test-offer2',round,mutation); raise exception 'changed retry accepted'; exception when raise_exception then assert sqlerrm='IDEMPOTENCY_MISMATCH','payload-bound retries'; end;
  perform set_config('request.jwt.claim.sub',bob::text,true);
  assert public.kouponly_claim_code(code,gen_random_uuid())->>'error'='Verified @rajagiri.edu.in email required','unverified referral rejected';
  update auth.users set email_confirmed_at=now() where id=bob;
  if to_regprocedure('public.couponly_complete_signup(jsonb)') is not null then
    execute 'select public.couponly_complete_signup($1)' into replay using jsonb_build_object('email','mvp-test-bob@rajagiri.edu.in','firstName','MVP','lastName','Test');
    assert replay->>'success'='true','verified school profile completes with free access';
  end if;
  claim:=public.kouponly_claim_code(lower(code),mutation);
  assert claim->>'status'='rewarded','inviter rewarded without prepaid access';
  assert public.kouponly_claim_code(lower(code),mutation)=claim,'referral retry exact';
  assert public.kouponly_claim_code(code,gen_random_uuid())->>'status'='rewarded','repeat attachment accepted without reward duplication';
  perform set_config('request.jwt.claim.sub',alice::text,true);
  b:=public.kouponly_account_benefits();
  assert b->>'rewardedReferrals'='1','one reward';
  assert b->'usedVendorIds'='[]'::jsonb,'all coupons restored';
  assert (b->'subscription'->>'endsAt')::timestamptz=original_ends,'expiry unchanged';
  begin perform public.kouponly_redeem_coupon('mvp-test-offer1',round,gen_random_uuid()); raise exception 'stale round accepted'; exception when raise_exception then assert sqlerrm='ROUND_CHANGED','stale confirmation denied'; end;
  round:=(b->'subscription'->>'roundId')::uuid;
  perform public.kouponly_redeem_coupon('mvp-test-offer2',round,gen_random_uuid());
  assert (select count(*)=2 from public.redemptions where user_id=alice),'history preserved after refresh';
  for n in 1..3 loop
    friend:=gen_random_uuid();
    insert into auth.users(id,email,email_confirmed_at,created_at,raw_user_meta_data) values(friend,'mvp-test-'||friend||'@rajagiri.edu.in',now(),now()-interval '10 days','{}');
    perform set_config('request.jwt.claim.sub',friend::text,true);
    claim:=public.kouponly_claim_code(code,gen_random_uuid());
    assert claim->>'status'=case when n<3 then 'rewarded' else 'ineligible' end,'exact three cap';
  end loop;
  assert (select count(*)=3 from public.kouponly_reward_grants where user_id=alice and source_type='referral'),'only three rewarded friends';
  -- Simulate previous month history: next active calendar month gets fresh coupons,
  -- while lifetime referral rewards remain spent.
  update public.kouponly_subscription_periods set starts_at=starts_at-interval '1 month',ends_at=starts_at,provider_period_key='mvp-test-previous' where id=original_period;
  perform set_config('request.jwt.claim.sub',alice::text,true);
  b:=public.kouponly_account_benefits();
  assert (b->'subscription'->>'periodId')::uuid<>original_period,'automatic next monthly period';
  assert b->'usedVendorIds'='[]'::jsonb,'monthly coupons reset';
  assert b->>'rewardedReferrals'='3','referral cap does not reset monthly';
  perform public.kouponly_redeem_coupon('mvp-test-offer1',(b->'subscription'->>'roundId')::uuid,gen_random_uuid());
  assert (select count(*)=3 from public.redemptions where user_id=alice),'monthly history retained';
  assert public.kouponly_claim_code('KPN-TEST',gen_random_uuid())->>'error'='Only personal invite codes are available in the free MVP','manual vouchers disabled';
  begin perform public.kouponly_apply_billing_event('{}'); raise exception 'payments accepted'; exception when raise_exception then assert sqlerrm='Payments are disabled for the free MVP'; end;
  begin perform public.kouponly_admin_mvp_overview(); raise exception 'nonadmin sees activity'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  b:=public.kouponly_admin_mvp_overview();
  assert (b->>'eligibleUsers')::int>=2,'admin eligible count';
  assert jsonb_array_length(b->'recentRedemptions')>=3,'admin sees unique receipts';
end $$;
-- Authenticated clients cannot manufacture free periods or call internal helpers.
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000009',true);
set local role authenticated;
do $$ begin
 begin perform public.kouponly_ensure_free_month(auth.uid()); raise exception 'helper exposed'; exception when insufficient_privilege then null; end;
 begin insert into public.kouponly_subscription_periods(user_id) values(auth.uid()); raise exception 'direct write'; exception when insufficient_privilege then null; end;
 assert (select count(*)=1 from public.kouponly_invite_codes),'owner-only invite access';
end $$;
reset role;
do $$ declare b jsonb; collision_constraint text; begin
 perform set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000009',true);
 begin perform public.kouponly_admin_coupons(); raise exception 'nonadmin exposed receipts'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000009',true);
 b:=public.kouponly_admin_coupons('mvp-test-vendor');
 assert (b->>'allTime')::int>=2,'canonical receipts counted';
 assert jsonb_array_length(b->'receipts')>=2,'receipts visible';
 assert length(b->'receipts'->0->>'code')=5,'confirmation code visible';
 assert (b->'receipts'->0->>'code') ~ '^[A-HJ-NP-Z2-9]{5}$','readable five-character alphabet';
 begin
   insert into public.redemptions(user_id,redemption_id,mode,status,code,completed_at,consumed_at,period_id,round_id,vendor_id,offer_id,offer_snapshot)
   select 'bbbbbbbb-0000-0000-0000-000000000009'::uuid,'short-code-collision-test',mode,status,code,completed_at,consumed_at,period_id,round_id,vendor_id,offer_id,offer_snapshot from public.redemptions where user_id='aaaaaaaa-0000-0000-0000-000000000009' and round_id is not null limit 1;
   raise exception 'duplicate short code accepted';
 exception when unique_violation then
   get stacked diagnostics collision_constraint=constraint_name;
   assert collision_constraint='kouponly_short_receipt_code_unique','duplicate code blocked by receipt index';
 end;

 assert (public.kouponly_admin_coupons('mvp-test-vendor',null,'missing-unique-search')->>'total')::int=0,'search filters receipts';
 assert jsonb_array_length(public.kouponly_admin_coupons('mvp-test-vendor',null,'',0,1)->'receipts')=1,'pagination';
 begin perform public.kouponly_admin_coupons(null,null,'',-1,25); raise exception 'negative offset'; exception when invalid_parameter_value then null; end;
 assert not exists(select 1 from public.couponly_offers where redemption_mode<>'inStore'),'existing online offers migrated';
 update public.couponly_vendors set payload=coalesce(payload,'{}')||jsonb_build_object('offers',jsonb_build_array(jsonb_build_object('id','mvp-test-offer1','titleEn','Coupon 1','redemptionMode','online'),jsonb_build_object('id','mvp-test-offer2','titleEn','Coupon 2','redemptionMode','online'))) where id='mvp-test-vendor';
 assert (select payload->'offers'->0->>'redemptionMode'='inStore' from public.couponly_vendors where id='mvp-test-vendor'),'older admin payload normalized';
 assert (select redemption_mode='inStore' from public.couponly_offers where id='mvp-test-offer1'),'payload sync remains in store';
 begin update public.couponly_offers set redemption_mode='online' where id='mvp-test-offer1'; exception when check_violation then null; end;
 assert (select redemption_mode='inStore' from public.couponly_offers where id='mvp-test-offer1'),'online writes cannot persist';
end $$;
rollback;
