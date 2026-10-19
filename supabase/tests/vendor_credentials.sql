-- Run inside a transaction after migrations. Every fixture rolls back.
begin;
set constraints all immediate;
insert into public.couponly_categories(id,name,slug,active) values ('credentials-test-category','Credential test','credentials-test-category',true);
insert into auth.users(id, email, raw_user_meta_data, encrypted_password)
values ('00000000-0000-0000-0000-00000000c101', encode(sha256(convert_to('credentials-test-owner', 'UTF8')), 'hex') || '@vendor.kouponly.invalid', '{"username":"credentials-test-owner"}', 'original');
insert into auth.users(id, email, raw_user_meta_data, encrypted_password)
values ('00000000-0000-0000-0000-00000000c102', encode(sha256(convert_to('credentials-reserved', 'UTF8')), 'hex') || '@vendor.kouponly.invalid', '{"username":"credentials-reserved"}', 'original');
set local role service_role;
insert into public.couponly_vendors(id,user_id,name,status,category_id,payload)
values ('credentials-test-vendor', '00000000-0000-0000-0000-00000000c101', 'Credential test', 'Active', 'credentials-test-category', '{"username":"credentials-test-owner","unrelated":"keep","categoryIds":["credentials-test-category"]}');
insert into public.couponly_vendor_memberships(user_id,vendor_id,role)
values ('00000000-0000-0000-0000-00000000c101','credentials-test-vendor','owner');
insert into public.couponly_user_roles(user_id,role,vendor_id)
values ('00000000-0000-0000-0000-00000000c101','vendor','credentials-test-vendor');
reset role;
insert into public.kouponly_vendor_recovery(user_id,pending_email,token_hash,expires_at)
values ('00000000-0000-0000-0000-00000000c101','test@example.com','verify-test',now()+interval '1 minute');

do $$
declare uid uuid := '00000000-0000-0000-0000-00000000c101'; result uuid;
begin
  if not has_table_privilege('service_role','public.couponly_user_roles','SELECT') then raise exception 'Edge role checks cannot read roles'; end if;
  if not has_table_privilege('service_role','public.couponly_vendor_memberships','SELECT') then raise exception 'Edge membership checks cannot read memberships'; end if;
  if not has_table_privilege('service_role','public.couponly_vendor_memberships','INSERT') then raise exception 'Admin creation cannot insert membership'; end if;
  if not has_table_privilege('service_role','public.couponly_user_roles','INSERT') then raise exception 'Admin creation cannot insert role'; end if;
  if has_table_privilege('authenticated','public.kouponly_vendor_recovery','SELECT') then raise exception 'Recovery inboxes exposed'; end if;
  if has_function_privilege('anon','public.kouponly_verify_vendor_recovery(text)','EXECUTE') then raise exception 'Public verification RPC exposed'; end if;
  if has_function_privilege('authenticated','public.kouponly_consume_vendor_reset(text)','EXECUTE') then raise exception 'Reset RPC exposed'; end if;
  if public.kouponly_vendor_login_id(encode(sha256(convert_to('credentials-test-owner','UTF8')),'hex')||'@vendor.kouponly.invalid') is distinct from uid then raise exception 'Username lookup failed'; end if;
  result := public.kouponly_verify_vendor_recovery('verify-test');
  if result is distinct from uid then raise exception 'Verification failed'; end if;
  if public.kouponly_verify_vendor_recovery('verify-test') is not null then raise exception 'Verification token replay'; end if;
  update public.kouponly_vendor_recovery set token_hash='expired',pending_email='other@example.com',expires_at=now()-interval '1 minute' where user_id=uid;
  if public.kouponly_verify_vendor_recovery('expired') is not null then raise exception 'Expired verification accepted'; end if;
  if (select email from public.kouponly_vendor_recovery where user_id=uid) <> 'test@example.com' then raise exception 'Pending address replaced verified inbox'; end if;
  update public.kouponly_vendor_recovery set reset_hash='reset-test',reset_expires_at=now()+interval '1 minute' where user_id=uid;
  if public.kouponly_consume_vendor_reset('reset-test') is distinct from uid then raise exception 'Reset failed'; end if;
  if public.kouponly_consume_vendor_reset('reset-test') is not null then raise exception 'Reset replay'; end if;
  update public.kouponly_vendor_recovery set reset_hash='expired-reset',reset_expires_at=now()-interval '1 minute' where user_id=uid;
  if public.kouponly_consume_vendor_reset('expired-reset') is not null then raise exception 'Expired reset accepted'; end if;
  update public.kouponly_vendor_recovery set reset_hash='old-password-link',reset_expires_at=now()+interval '1 minute' where user_id=uid;
  update auth.users set encrypted_password='replacement' where id=uid;
  if public.kouponly_consume_vendor_reset('old-password-link') is not null then raise exception 'Password change retained reset'; end if;
  if (select token_hash from public.kouponly_vendor_recovery where user_id=uid) is not null then raise exception 'Password change retained pending enrollment'; end if;
  update auth.users set email=encode(sha256(convert_to('credentials-renamed','UTF8')),'hex')||'@vendor.kouponly.invalid',raw_user_meta_data='{"username":"credentials-renamed"}' where id=uid;
  if (select payload->>'username' from public.couponly_vendors where user_id=uid) <> 'credentials-renamed' then raise exception 'Username display not synchronized'; end if;
  if (select payload->>'unrelated' from public.couponly_vendors where user_id=uid) <> 'keep' then raise exception 'Unrelated payload overwritten'; end if;
  begin
    update auth.users set email=encode(sha256(convert_to('credentials-reserved','UTF8')),'hex')||'@vendor.kouponly.invalid',raw_user_meta_data='{"username":"credentials-reserved"}' where id=uid;
    raise exception 'Duplicate username accepted';
  exception when unique_violation then null;
  end;
  if (select payload->>'username' from public.couponly_vendors where user_id=uid) <> 'credentials-renamed' then raise exception 'Failed rename changed vendor payload'; end if;
  begin
    update auth.users set raw_user_meta_data='{"username":"impersonated"}' where id=uid;
    raise exception 'Metadata impersonation accepted';
  exception when raise_exception then
    if sqlerrm <> 'Vendor username must match its login identity' then raise; end if;
  end;
  if not public.kouponly_credential_limit('test-limit',1,60) then raise exception 'First request rejected'; end if;
  if public.kouponly_credential_limit('test-limit',1,60) then raise exception 'Rate limit bypass'; end if;
end $$;
-- Reproduce GoTrue's multi-statement transaction: metadata and email may be saved separately.
set constraints auth.kouponly_sync_vendor_username deferred;
update auth.users set raw_user_meta_data = '{"username":"credentials-final-name"}'
where id = '00000000-0000-0000-0000-00000000c101';
update auth.users set email = encode(sha256(convert_to('credentials-final-name','UTF8')),'hex') || '@vendor.kouponly.invalid'
where id = '00000000-0000-0000-0000-00000000c101';
set constraints auth.kouponly_sync_vendor_username immediate;
do $$ begin
  if (select payload->>'username' from public.couponly_vendors where id='credentials-test-vendor') <> 'credentials-final-name' then
    raise exception 'Multi-statement Auth username change was not synchronized';
  end if;
end $$;
rollback;
