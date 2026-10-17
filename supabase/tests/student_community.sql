-- Run against a test database after the V2 migration; all fixtures roll back.
begin;
-- Test-only wrapper supplies the origin and owner normally verified by the Edge Function.
create function pg_temp.submit_request(p_id uuid,p_kind text,p_name text,p_domain text,p_email text)
returns uuid language sql as $$select public.kouponly_submit_student_request(p_id,p_kind,p_name,p_domain,p_email,'Student Name','+919876543210',auth.uid(),repeat('a',64),'Kochi')$$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,created_at) values
 ('cccccccc-1212-0000-0000-000000000001','community-alice@rajagiri.edu.in',now(),'{}',now()),
 ('cccccccc-1212-0000-0000-000000000002','community-bob@rajagiri.edu.in',now(),'{}',now()),
 ('cccccccc-1212-0000-0000-000000000003','community-carol@rajagiri.edu.in',now(),'{}',now());
insert into public.couponly_students(id,email) values
 ('cccccccc-1212-0000-0000-000000000001','community-alice@rajagiri.edu.in'),
 ('cccccccc-1212-0000-0000-000000000002','community-bob@rajagiri.edu.in'),
 ('cccccccc-1212-0000-0000-000000000003','community-carol@rajagiri.edu.in') on conflict(id) do nothing;
insert into public.profiles(user_id,full_name) values
 ('cccccccc-1212-0000-0000-000000000001','Alice'),('cccccccc-1212-0000-0000-000000000002','Bob'),('cccccccc-1212-0000-0000-000000000003','Carol')
 on conflict(user_id) do update set full_name=excluded.full_name;
insert into public.couponly_vendors(id,name,status,category_id)
select 'community-vendor','Community Cafe','Active',id from public.couponly_categories where active order by sort_order limit 1;
insert into public.couponly_offers(id,vendor_id,title,active) values('community-offer','community-vendor','Lunch discount',true);
insert into public.couponly_student_saved_items(student_id,item_type,item_id) values('cccccccc-1212-0000-0000-000000000002','offer','community-offer');
do $$
declare alice uuid:='cccccccc-1212-0000-0000-000000000001'; bob uuid:='cccccccc-1212-0000-0000-000000000002'; carol uuid:='cccccccc-1212-0000-0000-000000000003'; code text; friend uuid; snap jsonb; request uuid:=gen_random_uuid();
begin
  perform set_config('request.jwt.claim.sub','',true);
  assert pg_temp.submit_request(request,'school','Marina University','marina.edu','applicant@marina.edu')=request;
  assert pg_temp.submit_request(request,'school','Marina University','marina.edu','applicant@marina.edu')=request,'retry is idempotent';
  begin perform pg_temp.submit_request(gen_random_uuid(),'school','University','not a domain','applicant@marina.edu'); raise exception 'invalid domain accepted'; exception when raise_exception then assert sqlerrm='Enter a valid school email domain.'; end;
  begin perform pg_temp.submit_request(gen_random_uuid(),'restaurant','Cafe','','applicant@marina.edu'); raise exception 'anonymous restaurant request accepted'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',alice::text,true);
  perform pg_temp.submit_request(gen_random_uuid(),'restaurant','Marina Cafe','','community-alice@rajagiri.edu.in');
  select c.code into code from public.kouponly_invite_codes c where c.user_id=bob;
  friend:=public.kouponly_request_friend(code);
  assert public.kouponly_request_friend(code)=friend,'repeat friend request is idempotent';
  begin perform public.kouponly_respond_friend(friend,'accept'); raise exception 'sender accepted own request'; exception when insufficient_privilege then null; end;
  snap:=public.kouponly_friends_snapshot(); assert snap->'activity'='[]'::jsonb,'pending friend cannot see activity';
  perform set_config('request.jwt.claim.sub',carol::text,true);
  begin perform public.kouponly_respond_friend(friend,'remove'); raise exception 'stranger removed friendship'; exception when insufficient_privilege then null; end;
  assert public.kouponly_friends_snapshot()->'friends'='[]'::jsonb,'stranger cannot read friendship';
  perform set_config('request.jwt.claim.sub',bob::text,true);
  perform public.kouponly_respond_friend(friend,'accept');
  perform set_config('request.jwt.claim.sub',alice::text,true);
  assert public.kouponly_friends_snapshot()->'activity'='[]'::jsonb,'sharing is off by default';
  insert into public.kouponly_social_preferences(user_id,share_activity) values(bob,true);
  snap:=public.kouponly_friends_snapshot(); assert jsonb_array_length(snap->'activity')=1,'accepted friends can see opted in saved offers';
  assert snap->'activity'->0->>'vendorName'='Community Cafe';
  insert into public.saved_offers(user_id,offer_id) values(bob,'community-offer');
  assert jsonb_array_length(public.kouponly_friends_snapshot()->'activity')=1,'dual saved stores do not duplicate activity';
  delete from public.couponly_student_saved_items where student_id=bob;
  assert jsonb_array_length(public.kouponly_friends_snapshot()->'activity')=1,'mobile saved_offers appear without legacy saved items';
  insert into public.redemptions(user_id,redemption_id,mode,vendor_id,status,consumed_at,offer_snapshot) values(bob,'community-receipt','inStore','community-vendor','success',now(),'{"title":"Lunch discount"}');
  assert jsonb_array_length(public.kouponly_friends_snapshot()->'activity')=2,'shared redemptions and saved offers both load';
  update public.kouponly_social_preferences set share_activity=false where user_id=bob;
  assert public.kouponly_friends_snapshot()->'activity'='[]'::jsonb,'turning sharing off hides existing activity';
  perform public.kouponly_respond_friend(friend,'remove');
  assert public.kouponly_friends_snapshot()->'friends'='[]'::jsonb,'remove revokes friendship';
  for i in 1..29 loop
    friend:=public.kouponly_request_friend(code);
    perform public.kouponly_respond_friend(friend,'remove');
  end loop;
  begin perform public.kouponly_request_friend(code); raise exception 'cancellation bypassed quota'; exception when raise_exception then assert sqlerrm='Too many friend requests. Try again tomorrow.'; end;
  perform set_config('request.jwt.claim.sub','',true);
  perform pg_temp.submit_request(gen_random_uuid(),'school','University','marina.edu','rotated1@marina.edu');
  begin perform pg_temp.submit_request(gen_random_uuid(),'school','University','marina.edu','rotated2@marina.edu'); raise exception 'rotating email bypassed quota'; exception when raise_exception then assert sqlerrm='You have submitted three requests today. Please try again tomorrow.'; end;
  assert not has_table_privilege('anon','public.kouponly_student_requests','TRUNCATE');
  assert not has_table_privilege('authenticated','public.kouponly_social_preferences','TRUNCATE');
  assert not has_table_privilege('authenticated','public.kouponly_community_request_log','TRUNCATE');
  assert not has_function_privilege('anon','public.kouponly_submit_student_request(uuid,text,text,text,text,text,text,uuid,text,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.kouponly_submit_student_request(uuid,text,text,text,text,text,text,uuid,text,text)','EXECUTE');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-1212-0000-0000-000000000001',true);
do $$ begin
  assert (select count(*)=1 from public.kouponly_student_requests),'only owner requests are visible';
  begin insert into public.kouponly_social_preferences(user_id,share_activity) values('cccccccc-1212-0000-0000-000000000003',true); raise exception 'preference impersonation accepted'; exception when insufficient_privilege then null; end;
  begin select * from public.kouponly_friendships; raise exception 'direct friendship reads allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
