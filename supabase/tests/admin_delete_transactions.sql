-- Run against an initialized database with an admin account. All writes roll back.
begin;
set local plpgsql.check_asserts = on;
do $$
declare
  admin_id uuid;
  fixture_user uuid := gen_random_uuid();
  fixture_transaction uuid := gen_random_uuid();
  pending_transaction uuid := gen_random_uuid();
  fixture_subscription uuid := gen_random_uuid();
  fixture_period uuid := gen_random_uuid();
  fixture_round uuid := gen_random_uuid();
  fixture_receipt text := 'delete-qa-' || fixture_user;
  selected_receipts jsonb := jsonb_build_array(jsonb_build_object('user_id', fixture_user, 'redemption_id', fixture_receipt));
begin
  select user_id into strict admin_id from public.couponly_user_roles where role = 'admin' limit 1;
  insert into auth.users(id,email) values (fixture_user, fixture_receipt || '@example.com');
  insert into public.kouponly_subscriptions(id,user_id,plan_id,provider,provider_subscription_id)
  values (fixture_subscription,fixture_user,'free_mvp','free_mvp',fixture_receipt);
  insert into public.kouponly_subscription_periods(id,user_id,subscription_id,provider_period_key,starts_at,ends_at)
  values (fixture_period,fixture_user,fixture_subscription,fixture_receipt,now(),now()+interval '1 day');
  insert into public.kouponly_coupon_rounds(id,user_id,period_id,round_number)
  values (fixture_round,fixture_user,fixture_period,0);
  insert into public.redemptions(user_id,redemption_id,mode,status,consumed_at,period_id,round_id,vendor_id,offer_id)
  values (fixture_user,fixture_receipt,'inStore','success',now(),fixture_period,fixture_round,fixture_receipt,fixture_receipt);
  insert into public.couponly_transactions(id,status,idempotency_key)
  values (fixture_transaction,'completed',gen_random_uuid()),(pending_transaction,'pending',gen_random_uuid());

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',fixture_user::text,true);
  begin
    perform public.kouponly_admin_delete_transactions(array[fixture_transaction],selected_receipts);
    raise exception 'Non-admin deletion succeeded';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  assert public.kouponly_admin_delete_transactions(array[fixture_transaction,pending_transaction],selected_receipts) = 2,
    'Delete only the completed transaction and consumed redemption';
  assert public.kouponly_admin_delete_transactions(array[fixture_transaction],selected_receipts) = 0,
    'Repeating the same request should delete zero records';
  reset role;

  assert not exists (select 1 from public.couponly_transactions where id = fixture_transaction);
  assert exists (select 1 from public.couponly_transactions where id = pending_transaction);
  assert not exists (select 1 from public.redemptions where user_id = fixture_user and redemption_id = fixture_receipt);
end $$;
rollback;
