begin;
-- Fixtures use isolated UUIDs and roll back, including all receipts and grants.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,created_at) values
 ('aaaaaaaa-0000-0000-0000-000000000001','benefits-alice@example.test',now(),'{}',now()),
 ('bbbbbbbb-0000-0000-0000-000000000001','benefits-bob@example.test',null,'{}',now()),
 ('cccccccc-0000-0000-0000-000000000001','benefits-carol@example.test',now(),'{}',now()),
 ('dddddddd-0000-0000-0000-000000000001','benefits-admin@example.test',now(),'{}',now());
insert into public.kouponly_user_roles(user_id,role) values('dddddddd-0000-0000-0000-000000000001','admin');
insert into public.kouponly_vendors(id,name,status,catalogue_deal_id,category_id) values('benefits-test-a','Test A','Active',900001,(select id from public.kouponly_categories where active order by id limit 1)),('benefits-test-b','Test B','Active',900002,(select id from public.kouponly_categories where active order by id limit 1));
insert into public.kouponly_offers(id,vendor_id,title,active,redemption_mode,sort_order) values
 ('benefits-offer-a1','benefits-test-a','A1',true,'inStore',0),('benefits-offer-a2','benefits-test-a','A2',true,'inStore',1),('benefits-offer-b','benefits-test-b','B',true,'inStore',0);
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000001',true);
select public.kouponly_admin_grant_month('aaaaaaaa-0000-0000-0000-000000000001','benefits-test-paid');
do $$
declare alice uuid:='aaaaaaaa-0000-0000-0000-000000000001'; bob uuid:='bbbbbbbb-0000-0000-0000-000000000001'; carol uuid:='cccccccc-0000-0000-0000-000000000001';
  code text; round uuid; fresh uuid; response jsonb; claim jsonb; voucher text; mutation uuid:=gen_random_uuid(); receipts integer; event jsonb; extra_user uuid; n integer;
begin
  perform set_config('request.jwt.claim.sub',alice::text,true);
  response:=public.kouponly_account_benefits(); code:=response->>'inviteCode'; round:=(response->'subscription'->>'roundId')::uuid;
  assert length(code)=5,'five-character invite'; assert round is not null,'paid base round';
  assert (select count(*)=count(distinct kouponly_invite_codes.code) from public.kouponly_invite_codes),'unique invites';
  assert public.kouponly_claim_code(code,gen_random_uuid())->>'error'='SELF_REFERRAL','self referral denied';
  assert public.kouponly_claim_code('INVALID',gen_random_uuid())->>'error'='INVALID_CODE','invalid code denied';
  response:=public.kouponly_redeem_coupon('benefits-offer-a1',round,mutation,250.00);
  assert public.kouponly_redeem_coupon('benefits-offer-a1',round,mutation,250.00)=response,'redemption retry';
  perform public.kouponly_redeem_coupon('benefits-offer-a2',round,gen_random_uuid(),250.00);
  begin perform public.kouponly_redeem_coupon('benefits-offer-a2',round,gen_random_uuid(),250.00); raise exception 'same offer accepted twice'; exception when raise_exception then assert sqlerrm='OFFER_ALREADY_USED','offer quota in a round'; end;
  begin perform public.kouponly_redeem_coupon('benefits-offer-b',round,mutation,250.00); raise exception 'changed retry accepted'; exception when raise_exception then assert sqlerrm='IDEMPOTENCY_MISMATCH','retry payload binding'; end;
  perform set_config('request.jwt.claim.sub',bob::text,true);
  claim:=public.kouponly_claim_code(lower(code),gen_random_uuid()); assert claim->>'status'='attached','unverified referral pending: '||claim::text;
  assert (select count(*)=0 from public.kouponly_reward_grants where user_id=alice),'no unverified reward';
  update auth.users set email_confirmed_at=now() where id=bob;
  assert (select status='rewarded' from public.referral_uses where referred_user_id=bob),'verified referral rewarded';
  perform public.kouponly_qualify_referral(bob);
  assert (select count(*)=1 from public.kouponly_reward_grants where user_id=alice),'qualification once';
  perform set_config('request.jwt.claim.sub',alice::text,true);
  response:=public.kouponly_account_benefits(); fresh:=(response->'subscription'->>'roundId')::uuid;
  assert fresh<>round,'refresh opens new round'; assert response->'usedVendorIds'='[]'::jsonb,'coupons restored';
  assert (select count(*)=2 from public.redemptions where user_id=alice),'past receipts preserved';
  begin perform public.kouponly_redeem_coupon('benefits-offer-b',round,gen_random_uuid(),250.00); raise exception 'stale round accepted'; exception when raise_exception then assert sqlerrm='ROUND_CHANGED','stale round rejected'; end;
  perform public.kouponly_redeem_coupon('benefits-offer-a2',fresh,gen_random_uuid(),250.00);
  assert (select count(*)=3 from public.redemptions where user_id=alice),'new receipt after refresh';
  perform set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000001',true);
  perform set_config('request.jwt.claim.sub',alice::text,true);
  begin perform public.kouponly_admin_refresh_coupons(alice); raise exception 'nonadmin refreshed coupons'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000001',true);
  response:=public.kouponly_admin_refresh_coupons(alice);
  assert response->>'previousRoundId'=fresh::text,'refresh closes the current round';
  assert (response->>'roundId')::uuid<>fresh,'refresh opens a new round';
  assert (select count(*)=3 from public.redemptions where user_id=alice),'refresh keeps redemption history';
  assert exists(select 1 from public.couponly_admin_audit_log where actor_id='dddddddd-0000-0000-0000-000000000001' and action='refreshStudentCoupons' and entity_id=alice::text),'refresh records the admin action';
  response:=public.kouponly_admin_students(p_user_id:=alice);
  assert (response->'students'->0->'couponMonth'->>'roundNumber')=(select round_number::text from public.kouponly_coupon_rounds where user_id=alice and closed_at is null),'paid active period appears on admin profile';
  perform set_config('request.jwt.claim.sub',alice::text,true);
  response:=public.kouponly_account_benefits();
  assert response->'usedVendorIds'='[]'::jsonb,'refresh restores every coupon in the current round';
  assert response->'subscription'->>'roundId'=(select id::text from public.kouponly_coupon_rounds where user_id=alice and closed_at is null),'benefits follows the current round';
  perform set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000001',true);
  mutation:=gen_random_uuid(); response:=public.kouponly_admin_create_voucher('Test voucher',1,now()+interval '1 day',mutation); voucher:=response->>'code';
  assert public.kouponly_admin_create_voucher('Test voucher',1,now()+interval '1 day',mutation)=response,'voucher creation retry';
  begin perform public.kouponly_admin_create_voucher('Changed voucher',1,now()+interval '1 day',mutation); raise exception 'changed voucher accepted'; exception when raise_exception then assert sqlerrm='IDEMPOTENCY_MISMATCH','voucher issuance payload binding'; end;
  perform set_config('request.jwt.claim.sub',alice::text,true);
  mutation:=gen_random_uuid(); claim:=public.kouponly_claim_code(voucher,mutation);
  assert claim->>'status'='rewarded','voucher refresh'; assert public.kouponly_claim_code(voucher,mutation)=claim,'voucher retry';
  assert public.kouponly_claim_code(voucher,gen_random_uuid())->>'error'='VOUCHER_ALREADY_USED','per-user voucher limit';
  assert (select claimed_count=1 from public.kouponly_vouchers where label='Test voucher'),'retry consumes one allowance';
  perform set_config('request.jwt.claim.sub',carol::text,true);
  assert public.kouponly_claim_code(voucher,gen_random_uuid())->>'error'='SUBSCRIPTION_REQUIRED','unpaid claim rejected';
  begin perform public.kouponly_admin_grant_month(carol,'unauthorized'); raise exception 'nonadmin granted'; exception when insufficient_privilege then null; end;
  -- Repeated referrals restore one round each, cap rewards, and preserve exact expiry.
  for n in 1..5 loop
    extra_user:=gen_random_uuid();
    insert into auth.users(id,email,created_at,raw_user_meta_data,email_confirmed_at) values(extra_user,'referral-'||extra_user::text||'@example.test',now(),'{}',now());
    perform set_config('request.jwt.claim.sub',extra_user::text,true);
    claim:=public.kouponly_claim_code(code,gen_random_uuid());
    assert claim->>'status'=case when n<5 then 'rewarded' else 'ineligible' end,'referral period cap';
  end loop;
  assert (select count(*)=5 from public.kouponly_reward_grants where user_id=alice and source_type='referral'),'cap grants exactly';
  perform set_config('request.jwt.claim.sub',carol::text,true);
  update auth.users set created_at=now()-interval '8 days' where id=carol;
  assert public.kouponly_claim_code(code,gen_random_uuid())->>'error'='INVITE_WINDOW_CLOSED','signup window enforced';
  update auth.users set created_at=now() where id=carol;
  perform set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000001',true);
  perform public.kouponly_admin_grant_month(carol,'benefits-carol-paid');
  perform public.kouponly_admin_grant_month(carol,'benefits-carol-paid');
  assert (select count(*)=1 from public.kouponly_subscription_periods where user_id=carol),'admin grant idempotent';
  perform set_config('request.jwt.claim.sub',carol::text,true);
  assert public.kouponly_claim_code(voucher,gen_random_uuid())->>'error'='VOUCHER_EXHAUSTED','global voucher allowance';
  fresh:=(public.kouponly_account_benefits()->'subscription'->>'roundId')::uuid;
  update public.kouponly_subscription_periods set starts_at=now()-interval '1 month',ends_at=now() where user_id=carol;
  begin perform public.kouponly_redeem_coupon('benefits-offer-b',fresh,gen_random_uuid(),250.00); raise exception 'expired redemption accepted'; exception when raise_exception then assert sqlerrm='SUBSCRIPTION_REQUIRED','expiry enforced'; end;
  delete from public.kouponly_code_attempts where user_id=carol;
  for n in 1..11 loop
    claim:=public.kouponly_claim_code('INVALID',gen_random_uuid());
    assert claim->>'error'=case when n<=10 then 'INVALID_CODE' else 'RATE_LIMITED' end,'invalid attempts counted';
  end loop;
  -- Revoke and then replay a different paid event: never revive a revoked period.
  event:=(select request from public.kouponly_billing_events where event_id='benefits-test-paid');
  perform public.kouponly_apply_billing_event(event||jsonb_build_object('eventId','benefits-refund','type','revoke'));
  perform public.kouponly_apply_billing_event(event||jsonb_build_object('eventId','benefits-late-paid'));
  perform set_config('request.jwt.claim.sub',alice::text,true);
  assert public.kouponly_account_benefits()->'subscription'='null'::jsonb,'refund stops access';
  assert (select count(*)=2 from public.redemptions where user_id=alice),'refund retains history';
  assert not has_function_privilege('authenticated','public.kouponly_apply_billing_event(jsonb)','execute'),'billing service only';
  assert not has_function_privilege('anon','public.kouponly_admin_refresh_coupons(uuid)','execute'),'anonymous coupon refresh denied';
  assert not has_function_privilege('authenticated','public.kouponly_open_reward_round(uuid,uuid,text,text)','execute'),'no direct grants';
  assert not has_table_privilege('authenticated','public.kouponly_subscription_periods','insert'),'no direct paid periods';
  assert not has_table_privilege('authenticated','public.redemptions','insert'),'no direct receipt inserts';
  raise notice 'PASS: invite allocation, signup verification, referrals, vendor quotas, retries, history, stale rounds, voucher limits, refund ordering, admin and grant permissions';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',true);
do $$begin assert (select count(*)=1 from public.kouponly_invite_codes),'RLS own code only'; assert (select count(*)=1 from public.kouponly_subscriptions),'RLS own subscription only'; end$$;
reset role;
rollback;
