begin;
-- Rollback-only accounts: exercise real verification triggers, claims, and permission checks.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000014','any-email-inviter@gmail.com',now(),'{}'),
 ('bbbbbbbb-0000-0000-0000-000000000014','any-email-friend@outlook.com',null,'{}'),
 ('cccccccc-0000-0000-0000-000000000014','any-email-other@rajagiri.edu.in',now(),'{}'),
 ('dddddddd-0000-0000-0000-000000000014','any-email-admin@example.com',now(),'{}');
insert into public.couponly_user_roles(user_id,role) values('dddddddd-0000-0000-0000-000000000014','admin');
do $$
declare inviter uuid:='aaaaaaaa-0000-0000-0000-000000000014'; friend uuid:='bbbbbbbb-0000-0000-0000-000000000014';
 other uuid:='cccccccc-0000-0000-0000-000000000014'; admin uuid:='dddddddd-0000-0000-0000-000000000014';
 code text; other_code text; b jsonb; before_round uuid; expiry timestamptz; old_mutation uuid:=gen_random_uuid(); result jsonb; anonymous_user uuid:=gen_random_uuid();
begin
 assert public.kouponly_has_verified_email(inviter),'Gmail inviter eligible';
 assert not public.kouponly_has_verified_email(friend),'unverified Outlook blocked';
 assert public.kouponly_has_verified_email(other),'Rajagiri still eligible';
 assert not public.kouponly_has_verified_email(gen_random_uuid()),'nonexistent account blocked';
 insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values(anonymous_user,'any-email-anonymous@example.com',now(),true,'{}');
 assert not public.kouponly_has_verified_email(anonymous_user),'anonymous account never eligible';
 update auth.users set email=null,phone_confirmed_at=now() where id=anonymous_user;
 assert not public.kouponly_has_verified_email(anonymous_user),'phone-only account never eligible';
 perform set_config('request.jwt.claim.sub',inviter::text,true);
 b:=public.kouponly_account_benefits(); code:=b->>'inviteCode'; before_round:=(b->'subscription'->>'roundId')::uuid; expiry:=(b->'subscription'->>'endsAt')::timestamptz;
 perform set_config('request.jwt.claim.sub',friend::text,true);
 assert public.kouponly_claim_code(code,gen_random_uuid())->>'error'='Verified email required','unverified invite claim blocked';
 update auth.users set phone_confirmed_at=now() where id=friend;
 assert public.kouponly_claim_code(code,gen_random_uuid())->>'error'='Verified email required','phone verification insufficient';
 -- Signup metadata records attribution; email verification must reward exactly once.
 insert into public.referral_uses(referred_user_id,inviter_user_id,status) values(friend,inviter,'attached');
 update auth.users set email_confirmed_at=now() where id=friend;
 assert (select status='rewarded' from public.referral_uses where referred_user_id=friend),'verification trigger rewards non-school referral';
 assert (select count(*)=1 from public.kouponly_reward_grants where user_id=inviter),'trigger grants one refresh';
 result:=public.kouponly_claim_code(lower(code),old_mutation);
 assert result->>'status'='rewarded' and result->>'rewardRecipient'='inviter','reward belongs to inviter';
 assert result->'benefits'->'subscription'->>'roundNumber'='0','invitee receives base monthly coupons';
 assert public.kouponly_claim_code(lower(code),old_mutation)=result,'claim retry is exact';
 perform set_config('request.jwt.claim.sub',other::text,true);
 other_code:=public.kouponly_account_benefits()->>'inviteCode';
 perform set_config('request.jwt.claim.sub',friend::text,true);
 assert public.kouponly_claim_code(other_code,old_mutation)->>'error'='IDEMPOTENCY_MISMATCH','changed claim payload rejected';
 assert public.kouponly_claim_code(other_code,gen_random_uuid())->>'error'='INVITE_ALREADY_ATTACHED','second inviter rejected';
 assert (select count(*)=1 from public.kouponly_reward_grants where user_id=inviter),'retries never duplicate refresh';
 perform set_config('request.jwt.claim.sub',inviter::text,true);
 b:=public.kouponly_account_benefits();
 assert (b->'subscription'->>'roundId')::uuid<>before_round,'inviter round reset';
 assert (b->'subscription'->>'endsAt')::timestamptz=expiry,'reset retains expiry';
 assert b->'usedOfferIds'='[]'::jsonb and b->'usedVendorIds'='[]'::jsonb,'coupon counters reset';
 assert b->>'rewardedReferrals'='1','referral counter increments';
 -- Existing accounts remain eligible if their verified address moves to another domain.
 update auth.users set email='any-email-inviter@company.example' where id=inviter;
 assert public.kouponly_account_benefits()->'subscription'->>'roundId'=b->'subscription'->>'roundId','email domain change retains current round';
 perform set_config('request.jwt.claim.sub',admin::text,true);
 b:=public.kouponly_admin_students(p_user_id:=inviter);
 assert b->'students'->0->>'eligible'='true','admin sees general-email eligibility';
 assert b->'students'->0->>'referralRefreshes'='1','admin sees refresh';
 assert public.kouponly_admin_mvp_overview()->>'eligibleUsers' is not null,'general-email admin overview available';
 -- Invalid attempts must remain counted after their validation subtransactions roll back.
 perform set_config('request.jwt.claim.sub',inviter::text,true);
 delete from public.kouponly_code_attempts where user_id=inviter;
 for n in 1..10 loop
   assert public.kouponly_claim_code('!!!!!',gen_random_uuid())->>'error'='INVALID_CODE','invalid code rejected';
 end loop;
 assert public.kouponly_claim_code(code,gen_random_uuid())->>'error'='RATE_LIMITED','attempt cap enforced';
 assert not has_function_privilege('anon','public.kouponly_account_benefits()','execute'),'anonymous benefits RPC denied';
 assert not has_function_privilege('authenticated','public.kouponly_qualify_referral(uuid)','execute'),'cannot reward arbitrary accounts';
 assert not has_function_privilege('authenticated','public.kouponly_claim_code_inner(text,uuid)','execute'),'cannot bypass rate limiter';
end $$;
set local role authenticated;
do $$ begin
 begin perform public.kouponly_has_verified_email('aaaaaaaa-0000-0000-0000-000000000014'); raise exception 'private helper exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
