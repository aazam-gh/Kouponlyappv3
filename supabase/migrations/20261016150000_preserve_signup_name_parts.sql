-- Preserve multi-word first and last names without spending a one-time edit on an unchanged name.
create or replace function public.update_own_profile_details(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_profile public.profiles%rowtype;
  current_first text;
  current_last text;
  first_value text;
  last_value text;
  dob_value date;
  mobile_value text;
  avatar_value text;
  profile_name text;
  first_changed boolean := false;
  last_changed boolean := false;
  mobile_changed boolean := false;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Profile details must be an object'; end if;
  select * into current_profile from public.profiles where user_id = uid for update;
  if not found then raise exception 'Profile not found'; end if;
  select first_name,last_name into current_first,current_last from public.couponly_students where id=uid;
  current_first:=coalesce(current_first,split_part(btrim(current_profile.full_name), ' ', 1));
  current_last:=coalesce(current_last,btrim(regexp_replace(btrim(current_profile.full_name), '^\S+\s*', '')));

  if p_values ? 'first_name' then
    first_value := nullif(btrim(p_values->>'first_name'), '');
    if first_value is null or char_length(first_value) > 80 then raise exception 'Enter a valid first name'; end if;
    if first_value is distinct from current_first then
      if current_profile.first_name_edit_used then raise exception 'First name can only be changed once'; end if;
      current_profile.first_name_edit_used := true;
      first_changed := true;
    end if;
  else
    first_value := current_first;
  end if;

  if p_values ? 'last_name' then
    last_value := nullif(btrim(p_values->>'last_name'), '');
    if last_value is null or char_length(last_value) > 120 then raise exception 'Enter a valid last name'; end if;
    if last_value is distinct from current_last then
      if current_profile.last_name_edit_used then raise exception 'Last name can only be changed once'; end if;
      current_profile.last_name_edit_used := true;
      last_changed := true;
    end if;
  else
    last_value := nullif(current_last,'');
  end if;

  profile_name := concat_ws(' ', first_value, last_value);
  if p_values ? 'date_of_birth' and nullif(p_values->>'date_of_birth', '') is not null then
    dob_value := (p_values->>'date_of_birth')::date;
    if dob_value > current_date then raise exception 'Date of birth cannot be in the future'; end if;
    if dob_value is distinct from current_profile.date_of_birth then
      if current_profile.date_of_birth_edit_used then raise exception 'Date of birth can only be changed once'; end if;
      current_profile.date_of_birth_edit_used := true;
      current_profile.date_of_birth := dob_value;
    end if;
  end if;

  if p_values ? 'mobile' and nullif(btrim(p_values->>'mobile'), '') is not null then
    mobile_value := btrim(p_values->>'mobile');
    if char_length(mobile_value) > 32 then raise exception 'Enter a valid phone number'; end if;
    if mobile_value is distinct from nullif(btrim(current_profile.mobile), '') then
      if current_profile.mobile_edit_used then raise exception 'Phone number can only be changed once'; end if;
      current_profile.mobile_edit_used := true;
      current_profile.mobile := mobile_value;
      mobile_changed := true;
    end if;
  end if;

  if p_values ? 'avatar_path' and nullif(p_values->>'avatar_path', '') is not null then
    avatar_value := p_values->>'avatar_path';
    if avatar_value not like (uid::text || '/%') then raise exception 'Invalid avatar path'; end if;
    if avatar_value is distinct from current_profile.avatar_path then
      if current_profile.avatar_edit_used then raise exception 'Profile photo can only be changed once'; end if;
      current_profile.avatar_edit_used := true;
      current_profile.avatar_path := avatar_value;
    end if;
  end if;

  current_profile.full_name := btrim(profile_name);
  update public.realx_students set
    first_name = case when first_changed then first_value else first_name end,
    last_name = case when last_changed then last_value else last_name end,
    phone = case when mobile_changed then nullif(current_profile.mobile, '') else phone end,
    profile = profile || jsonb_build_object('name', current_profile.full_name)
  where id = uid;

  update public.profiles set
    full_name = current_profile.full_name,
    mobile = current_profile.mobile,
    avatar_path = current_profile.avatar_path,
    date_of_birth = current_profile.date_of_birth,
    first_name_edit_used = current_profile.first_name_edit_used,
    last_name_edit_used = current_profile.last_name_edit_used,
    date_of_birth_edit_used = current_profile.date_of_birth_edit_used,
    mobile_edit_used = current_profile.mobile_edit_used,
    avatar_edit_used = current_profile.avatar_edit_used,
    updated_at = now()
  where user_id = uid;

  update public.realx_students set
    profile = profile || jsonb_build_object('dob', current_profile.date_of_birth)
  where id = uid;

  return jsonb_build_object(
    'full_name', current_profile.full_name,
    'mobile', current_profile.mobile,
    'avatar_path', current_profile.avatar_path,
    'date_of_birth', current_profile.date_of_birth,
    'first_name_edit_used', current_profile.first_name_edit_used,
    'last_name_edit_used', current_profile.last_name_edit_used,
    'date_of_birth_edit_used', current_profile.date_of_birth_edit_used,
    'mobile_edit_used', current_profile.mobile_edit_used,
    'avatar_edit_used', current_profile.avatar_edit_used
  );
end;
$$;

revoke all on function public.update_own_profile_details(jsonb) from public, anon;
grant execute on function public.update_own_profile_details(jsonb) to authenticated;
