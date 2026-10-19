-- GoTrue saves email and metadata in separate statements in one transaction.
-- Check their final committed values, rather than rejecting the intermediate state.
create or replace function public.kouponly_sync_vendor_username()
returns trigger language plpgsql security definer set search_path = '' as $$
declare username text; auth_email text;
begin
  select email, raw_user_meta_data->>'username' into auth_email, username from auth.users where id = new.id;
  if auth_email like '%@vendor.kouponly.invalid' then
    if username is null or auth_email <> encode(sha256(convert_to(username, 'UTF8')), 'hex') || '@vendor.kouponly.invalid' then
      raise exception 'Vendor username must match its login identity';
    end if;
    update public.couponly_vendors set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{username}', to_jsonb(username))
    where user_id = new.id;
  end if;
  return new;
end $$;
drop trigger kouponly_sync_vendor_username on auth.users;
create constraint trigger kouponly_sync_vendor_username after update on auth.users
deferrable initially deferred for each row
when (old.email is distinct from new.email or old.raw_user_meta_data->>'username' is distinct from new.raw_user_meta_data->>'username')
execute function public.kouponly_sync_vendor_username();
