begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,created_at)
values('eeeeeeee-1616-0000-0000-000000000099','cto-name-parts@kouponly.test',now(),'{}',now());
insert into public.couponly_students(id,email,first_name,last_name)
values('eeeeeeee-1616-0000-0000-000000000099','cto-name-parts@kouponly.test','Mary Jane','van Doe');
select set_config('request.jwt.claim.sub','eeeeeeee-1616-0000-0000-000000000099',true);
select public.update_own_profile_details('{"first_name":"Mary Jane","last_name":"van Doe"}');
do $$ begin
 assert exists(select 1 from public.couponly_students where id=auth.uid() and first_name='Mary Jane' and last_name='van Doe'),'name parts retained';
 assert exists(select 1 from public.profiles where user_id=auth.uid() and not first_name_edit_used and not last_name_edit_used),'unchanged names must not consume an edit';
end $$;
rollback;
