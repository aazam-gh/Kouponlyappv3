create or replace function public.kouponly_complete_signup(p_profile jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  existing public.kouponly_students%rowtype;
  email_value text;
  profile_value jsonb := coalesce(p_profile, '{}'::jsonb) || jsonb_build_object('accountRole', 'student');
begin
  if uid is null then raise exception 'Login required' using errcode='28000'; end if;
  email_value := lower(trim(coalesce(profile_value->>'email', '')));
  if email_value <> lower(coalesce((select email from auth.users where id=uid), '')) then raise exception 'Authenticated email mismatch' using errcode='42501'; end if;
  if coalesce(length(trim(profile_value->>'firstName')), 0)=0 or length(trim(profile_value->>'firstName'))>80 or coalesce(length(trim(profile_value->>'lastName')), 0)=0 or length(trim(profile_value->>'lastName'))>80 then raise exception 'First and last name are required' using errcode='22023'; end if;

  select * into existing from public.kouponly_students where id=uid for update;
  if found then return jsonb_build_object('success', true, 'alreadyExists', true, 'creatorCode', existing.creator_code); end if;

  insert into public.kouponly_students(id, email, first_name, last_name, account_role, creator_code, verification_status, profile)
  values(uid, email_value, trim(profile_value->>'firstName'), trim(profile_value->>'lastName'), 'student', null, 'verified', profile_value);
  return jsonb_build_object('success', true, 'creatorCode', null);
end $$;
