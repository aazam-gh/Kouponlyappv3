begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('aaaaaaaa-0000-0000-0000-000000000021','profile-audit@rajagiri.edu.in',now(),'{"full_name":"Original Student"}');
insert into public.couponly_students(id,email,first_name,last_name) values('aaaaaaaa-0000-0000-0000-000000000021','profile-audit@rajagiri.edu.in','Original','Student');
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000021',true);
set local role authenticated;
do $$
declare result jsonb; rejected boolean:=false;
begin
  result:=public.update_own_profile_details('{"first_name":"Updated","date_of_birth":"2000-01-01","mobile":"1234567890"}');
  assert result->>'first_name_edit_used'='true','name slot consumed';
  assert result->>'date_of_birth_edit_used'='true','DOB slot consumed';
  assert result->>'mobile_edit_used'='true','phone slot consumed';
  assert (select first_name='Updated' from public.realx_students where id=auth.uid()),'student view synchronized';
  perform public.update_own_profile_details('{"first_name":"Updated"}');
  begin perform public.update_own_profile_details('{"first_name":"Again"}');exception when raise_exception then rejected:=sqlerrm like '%only%once%';end;
  assert rejected,'second name change rejected';rejected:=false;
  begin update public.profiles set full_name='Bypass' where user_id=auth.uid();exception when insufficient_privilege then rejected:=true;end;
  assert rejected,'direct protected-column writes rejected';rejected:=false;
  begin perform public.update_own_profile_details('{"avatar_path":"another-account/photo.jpg"}');exception when raise_exception then rejected:=sqlerrm='Invalid avatar path';end;
  assert rejected,'cross-account avatar path rejected';rejected:=false;
  begin perform public.update_own_profile_details('[]');exception when raise_exception then rejected:=sqlerrm='Profile details must be an object';end;
  assert rejected,'nonobject payload rejected';
end $$;
rollback;
