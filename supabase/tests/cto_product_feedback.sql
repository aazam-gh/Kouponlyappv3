-- Isolated database only; fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values('eeeeeeee-1616-0000-0000-000000000001','cto-fixture@example.com',now());
insert into public.couponly_students(id,email,first_name,last_name,profile)
 values('eeeeeeee-1616-0000-0000-000000000001','cto-fixture@example.com','New','Student','{"dob":"2001-02-03","phone":"+919876543210"}');
do $$ begin
 assert exists(select 1 from public.profiles where user_id='eeeeeeee-1616-0000-0000-000000000001' and full_name='New Student' and mobile='+919876543210' and date_of_birth='2001-02-03'),'signup data persisted';
 assert (select count(*)=1 from public.notifications where user_id='eeeeeeee-1616-0000-0000-000000000001' and kind='prelaunch_welcome'),'one saved welcome per new student';
end $$;
do $$
declare r uuid; result jsonb; mutation uuid; item record;
begin
 perform set_config('request.jwt.claim.sub','eeeeeeee-1616-0000-0000-000000000001',true);
 r:=(public.kouponly_account_benefits()->'subscription'->>'roundId')::uuid;
 for item in select * from (values
  ('percentage',25::numeric,100::numeric,null::numeric,25::numeric,75::numeric),
  ('amount',30,100,null,30,70),('buy1get1',0,150,60,60,90),
  ('free',0,100,null,100,0),('combo',70,100,null,30,70),('fixed_price',80,100,null,20,80)
 ) as t(kind,value,bill,free_item,saved,payable) loop
  insert into public.couponly_vendors(id,name,status) values('cto-'||item.kind,'CTO vendor','Active');
  insert into public.couponly_offers(id,vendor_id,title,active,redemption_mode,discount_type,discount_value,currency)
   values('cto-'||item.kind,'cto-'||item.kind,'CTO offer',true,'inStore',item.kind,item.value,'INR');
  mutation:=gen_random_uuid();
  if item.kind='buy1get1' then
   begin perform public.kouponly_redeem_coupon('cto-buy1get1',r,mutation,100,60); raise exception 'invalid BOGO accepted';
   exception when raise_exception then assert sqlerrm='Enter the cheaper item price for Buy 1 Get 1'; end;
   assert not exists(select 1 from public.redemptions where offer_id='cto-buy1get1');
  end if;
  result:=public.kouponly_redeem_coupon('cto-'||item.kind,r,mutation,item.bill,item.free_item);
  assert (result->>'estimatedSavings')::numeric=item.saved,'correct saved for '||item.kind;
  assert (result->>'payableAmount')::numeric=item.payable,'correct payable for '||item.kind;
  assert public.kouponly_redeem_coupon('cto-'||item.kind,r,mutation,item.bill,item.free_item)=result,'retry preserves receipt';
  assert exists(select 1 from public.redemptions where redemption_id=result->>'id' and (offer_snapshot->>'estimatedSavings')::numeric=item.saved),'stored savings match receipt';
 end loop;
 assert public.kouponly_my_savings()=265,'profile savings aggregate uses actual discounts';

 assert not has_function_privilege('anon','public.kouponly_redeem_coupon(text,uuid,uuid,numeric,numeric)','execute');
end $$;
rollback;
