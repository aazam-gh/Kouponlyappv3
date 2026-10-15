begin;
-- Rollback-only fixtures; safe to rehearse against deployed catalogue/role aliases.
do $$ declare roles regclass; vendors regclass; offers regclass; categories regclass; category text; begin
  roles:=coalesce(to_regclass('public.couponly_user_roles'),to_regclass('public.realx_user_roles'));
  vendors:=coalesce(to_regclass('public.couponly_vendors'),to_regclass('public.realx_vendors'));
  offers:=coalesce(to_regclass('public.couponly_offers'),to_regclass('public.realx_offers'));
  categories:=coalesce(to_regclass('public.couponly_categories'),to_regclass('public.realx_categories'));
  execute format('select id from %s where active order by id limit 1',categories) into category;
  insert into auth.users(id,email,email_confirmed_at,created_at,raw_user_meta_data) values
   ('aaaaaaaa-0000-0000-0000-000000000009','mvp-test-alice@outlook.com',now(),now(),'{}'),
   ('bbbbbbbb-0000-0000-0000-000000000009','mvp-test-bob@gmail.com',null,now(),'{}'),
   ('cccccccc-0000-0000-0000-000000000009','mvp-test-outsider@example.com',now(),now(),'{}'),
   ('dddddddd-0000-0000-0000-000000000009','mvp-test-admin@rajagiri.edu.in',now(),now(),'{}');
  execute format('insert into %s(user_id,role) values($1,''admin'')',roles) using 'dddddddd-0000-0000-0000-000000000009'::uuid;
  execute format('insert into %s(id,name,status,catalogue_deal_id,category_id) values(''mvp-test-vendor'',''MVP vendor'',''Active'',900099,$1)',vendors) using category;
  execute format('insert into %s(id,vendor_id,title,active,redemption_mode,sort_order) values(''mvp-test-offer1'',''mvp-test-vendor'',''Coupon 1'',true,''inStore'',0),(''mvp-test-offer2'',''mvp-test-vendor'',''Coupon 2'',true,''inStore'',1)',offers);
end $$;
do $$
declare
 alice uuid:='aaaaaaaa-0000-0000-0000-000000000009';
 admin uuid:='dddddddd-0000-0000-0000-000000000009';
 round uuid; mutation uuid:=gen_random_uuid(); legacy uuid:=gen_random_uuid();
 result jsonb; activity jsonb; invalid numeric;
begin
 perform set_config('request.jwt.claim.sub',alice::text,true);
 round:=(public.kouponly_account_benefits()->'subscription'->>'roundId')::uuid;
 begin
  perform public.kouponly_redeem_coupon('mvp-test-offer1',round,mutation);
  raise exception 'missing amount accepted';
 exception when invalid_parameter_value then assert sqlerrm='BILL_AMOUNT_REQUIRED'; end;
 foreach invalid in array array[0,-1,1.001,10000000000,'NaN'::numeric,'Infinity'::numeric] loop
  begin
   perform public.kouponly_redeem_coupon('mvp-test-offer1',round,mutation,invalid);
   raise exception 'invalid amount accepted';
  exception when invalid_parameter_value then assert sqlerrm='INVALID_BILL_AMOUNT'; end;
 end loop;
 assert not exists(select 1 from public.redemptions where user_id=alice),'invalid bills consume no coupons';
 result:=public.kouponly_redeem_coupon('mvp-test-offer1',round,mutation,250.55);
 assert (result->>'billAmount')::numeric=250.55,'receipt contains the entered pre-discount total';
 assert exists(select 1 from public.redemptions where redemption_id=result->>'id'
  and user_id=alice and vendor_id='mvp-test-vendor' and offer_id='mvp-test-offer1'
  and bill_amount=250.55 and (offer_snapshot->>'billAmount')::numeric=250.55),'bill linked to student/vendor/coupon';
 assert public.kouponly_redeem_coupon('mvp-test-offer1',round,mutation,250.550)=result,'normalized monetary retry';
 begin
  perform public.kouponly_redeem_coupon('mvp-test-offer1',round,mutation,250.56);
  raise exception 'changed amount accepted on retry';
 exception when raise_exception then assert sqlerrm='IDEMPOTENCY_MISMATCH'; end;
 begin
  perform public.kouponly_redeem_coupon('mvp-test-offer1',round,gen_random_uuid(),250.55);
  raise exception 'duplicate coupon accepted';
 exception when raise_exception then assert sqlerrm='OFFER_ALREADY_USED'; end;
 perform public.kouponly_redeem_coupon('mvp-test-offer2',round,gen_random_uuid(),0.01);
 assert (select count(*)=2 from public.redemptions where user_id=alice),'one receipt per offer, including minimum bill';
 insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint)
 values(alice,legacy,'kouponly-redeem-coupon','{"id":"historical-receipt"}',
 encode(extensions.digest('redeem:old-offer:'||round::text,'sha256'),'hex'));
 assert public.kouponly_redeem_coupon('old-offer',round,legacy)->>'id'='historical-receipt','older clients can recover historical receipts';
 perform set_config('request.jwt.claim.sub',admin::text,true);
 activity:=public.kouponly_admin_coupons('mvp-test-vendor',alice);
 assert (activity->>'total')::integer=2,'admin student/vendor tracking';
 assert exists(select 1 from jsonb_array_elements(activity->'receipts') x
  where x->>'id'=result->>'id' and (x->>'billAmount')::numeric=250.55),'admin coupon receipt includes bill';
 assert not has_function_privilege('anon','public.kouponly_redeem_coupon(text,uuid,uuid,numeric)','execute'),'anonymous redemption denied';
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.kouponly_redeem_coupon('mvp-test-offer1',round,gen_random_uuid(),10);
  raise exception 'anonymous request accepted';
 exception when invalid_authorization_specification then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000009',true);
do $$ begin
 assert exists(select 1 from public.redemptions where offer_id='mvp-test-offer1' and bill_amount=250.55),'student can read own recorded bill';
 assert not exists(select 1 from public.redemptions where user_id<>auth.uid()),'student cannot read other bills';
 begin perform public.kouponly_admin_coupons(); raise exception 'student accessed admin receipts'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
