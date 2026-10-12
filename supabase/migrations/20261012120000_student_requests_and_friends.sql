-- Public school suggestions do not grant account eligibility.
create table public.kouponly_student_requests (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('school','restaurant')),
  name text not null check (length(name) between 2 and 160),
  domain text,
  contact_email text not null,
  contact_name text,
  phone text,
  status text not null default 'pending' check (status in ('pending','reviewed','completed','declined')),
  created_at timestamptz not null default now()
);
alter table public.kouponly_student_requests enable row level security;
create policy request_read on public.kouponly_student_requests for select to authenticated
  using (user_id=(select auth.uid()) or public.kouponly_is_benefits_admin());
create policy request_admin_update on public.kouponly_student_requests for update to authenticated
  using (public.kouponly_is_benefits_admin()) with check (public.kouponly_is_benefits_admin());
revoke all on public.kouponly_student_requests from public,anon,authenticated;
grant select on public.kouponly_student_requests to authenticated;
grant update(status) on public.kouponly_student_requests to authenticated;
create index on public.kouponly_student_requests (contact_email,created_at);
create index on public.kouponly_student_requests (user_id);

-- Private quota history survives request cancellation and cannot be cleared by clients.
create table public.kouponly_community_request_log (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  origin_hash text,
  kind text not null check (kind in ('school','restaurant','friend')),
  created_at timestamptz not null default now()
);
alter table public.kouponly_community_request_log enable row level security;
revoke all on public.kouponly_community_request_log from public,anon,authenticated;
create index on public.kouponly_community_request_log(user_id,kind,created_at);
create index on public.kouponly_community_request_log(origin_hash,created_at);

create function public.kouponly_submit_student_request(p_id uuid,p_kind text,p_name text,p_domain text,p_email text,p_contact text,p_phone text,p_user_id uuid,p_origin_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=p_user_id; prior public.kouponly_student_requests%rowtype;
begin
  if p_origin_hash is null or p_origin_hash !~ '^[a-f0-9]{64}$' then raise exception 'Request origin required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('community-origin:'||p_origin_hash,0));
  if uid is not null then perform pg_advisory_xact_lock(hashtextextended('community-user:'||uid::text,0)); end if;
  p_name:=trim(p_name); p_domain:=lower(trim(coalesce(p_domain,''))); p_email:=lower(trim(p_email));
  p_contact:=trim(coalesce(p_contact,'')); p_phone:=trim(coalesce(p_phone,''));
  if p_kind='restaurant' then p_domain:=''; end if;
  if p_id is null or p_kind is null or p_kind not in ('school','restaurant') or p_name is null or length(p_name) not between 2 and 160
    or p_email is null or length(p_email)>254 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or length(p_contact)>160 or length(p_phone)>40 then raise exception 'Check the request details.'; end if;
  if p_kind='restaurant' and (uid is null or not exists(select 1 from public.couponly_students where id=uid)) then raise exception 'Sign in as a student to request a restaurant.' using errcode='42501'; end if;
  if p_kind='school' and (length(p_domain)>253 or p_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') then raise exception 'Enter a valid school email domain.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('school-request:'||p_email,0));
  select * into prior from public.kouponly_student_requests where id=p_id;
  if found then
    if prior.user_id is not distinct from uid and prior.contact_email=p_email and prior.kind=p_kind and prior.name=p_name
      and coalesce(prior.domain,'')=p_domain and coalesce(prior.contact_name,'')=p_contact and coalesce(prior.phone,'')=p_phone then return p_id; end if;
    raise exception 'This request changed. Submit a new request.';
  end if;
  if (select count(*) from public.kouponly_student_requests where contact_email=p_email and created_at>now()-interval '1 day')>=3 then raise exception 'You have submitted three requests today. Please try again tomorrow.'; end if;
  if (select count(*) from public.kouponly_community_request_log where kind in ('school','restaurant') and created_at>now()-interval '1 day' and (origin_hash=p_origin_hash or (uid is not null and user_id=uid)))>=3 then raise exception 'You have submitted three requests today. Please try again tomorrow.'; end if;
  insert into public.kouponly_community_request_log(id,user_id,origin_hash,kind) values(p_id,uid,p_origin_hash,p_kind);
  insert into public.kouponly_student_requests(id,user_id,kind,name,domain,contact_email,contact_name,phone)
    values(p_id,uid,p_kind,p_name,nullif(p_domain,''),p_email,nullif(p_contact,''),nullif(p_phone,''));
  return p_id;
end $$;
revoke all on function public.kouponly_submit_student_request(uuid,text,text,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.kouponly_submit_student_request(uuid,text,text,text,text,text,text,uuid,text) to service_role;

create table public.kouponly_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester_id<>recipient_id)
);
create unique index kouponly_friend_pair on public.kouponly_friendships (least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create index on public.kouponly_friendships(recipient_id,status);
create index on public.kouponly_friendships(requester_id,status);
alter table public.kouponly_friendships enable row level security;
-- All changes go through RPCs; clients cannot accept their own outgoing requests.
revoke all on public.kouponly_friendships from public,anon,authenticated;

create table public.kouponly_social_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_activity boolean not null default false
);
alter table public.kouponly_social_preferences enable row level security;
create policy social_preferences_self on public.kouponly_social_preferences for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.kouponly_social_preferences from public,anon,authenticated;
grant select,insert,update on public.kouponly_social_preferences to authenticated;

create function public.kouponly_request_friend(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); friend uuid; result uuid;
begin
  if uid is null or not exists(select 1 from public.couponly_students where id=uid) then raise exception 'Sign in as a student to add friends.' using errcode='42501'; end if;
  select c.user_id into friend from public.kouponly_invite_codes c join public.couponly_students s on s.id=c.user_id where c.code=upper(trim(p_code));
  if friend is null then raise exception 'No student found with this invite code.'; end if;
  if friend=uid then raise exception 'Use a friend’s code, not your own.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('friend:'||least(uid,friend)::text||greatest(uid,friend)::text,0));
  select id into result from public.kouponly_friendships where least(requester_id,recipient_id)=least(uid,friend) and greatest(requester_id,recipient_id)=greatest(uid,friend);
  if found then return result; end if;
  perform pg_advisory_xact_lock(hashtextextended('friend-requests:'||uid::text,0));
  if (select count(*) from public.kouponly_community_request_log where user_id=uid and kind='friend' and created_at>now()-interval '1 day')>=30 then raise exception 'Too many friend requests. Try again tomorrow.'; end if;
  insert into public.kouponly_friendships(requester_id,recipient_id) values(uid,friend) returning id into result;
  insert into public.kouponly_community_request_log(id,user_id,kind) values(result,uid,'friend');
  return result;
end $$;

create function public.kouponly_respond_friend(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); f public.kouponly_friendships%rowtype;
begin
  if uid is null then raise exception 'Sign in to manage friends.' using errcode='42501'; end if;
  select * into f from public.kouponly_friendships where id=p_id for update;
  if not found or uid not in (f.requester_id,f.recipient_id) then raise exception 'Friend request unavailable.' using errcode='42501'; end if;
  if p_action='accept' and uid=f.recipient_id and f.status='pending' then update public.kouponly_friendships set status='accepted' where id=p_id;
  elsif p_action='remove' then delete from public.kouponly_friendships where id=p_id;
  else raise exception 'This action is not available.' using errcode='42501'; end if;
end $$;

create function public.kouponly_friends_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); friends jsonb; activity jsonb;
begin
  if uid is null then raise exception 'Sign in to see friends.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',coalesce(nullif(p.full_name,''),'Student'),'status',f.status,'incoming',f.recipient_id=uid) order by f.created_at desc),'[]'::jsonb) into friends
    from public.kouponly_friendships f left join public.profiles p on p.user_id=case when f.requester_id=uid then f.recipient_id else f.requester_id end where uid in (f.requester_id,f.recipient_id);
  with peers as (
    select case when requester_id=uid then recipient_id else requester_id end as user_id from public.kouponly_friendships where status='accepted' and uid in(requester_id,recipient_id)
  ), events as (
    select s.id::text as id,s.student_id as user_id,s.created_at,'saved' as action,o.vendor_id,v.name as vendor_name,o.title
      from peers join public.kouponly_social_preferences pref on pref.user_id=peers.user_id and pref.share_activity
      join public.couponly_student_saved_items s on s.student_id=peers.user_id and s.item_type='offer'
      join public.couponly_offers o on o.id=s.item_id join public.couponly_vendors v on v.id=o.vendor_id
      where s.created_at>now()-interval '30 days' and o.active and v.status='Active'
    union all
    select r.redemption_id,r.user_id,r.consumed_at,'redeemed',r.vendor_id,v.name,r.offer_snapshot->>'title'
      from peers join public.kouponly_social_preferences pref on pref.user_id=peers.user_id and pref.share_activity
      join public.redemptions r on r.user_id=peers.user_id join public.couponly_vendors v on v.id=r.vendor_id
      where r.consumed_at>now()-interval '30 days' and r.status='success' and v.status='Active'
  ) select coalesce(jsonb_agg(row_to_json(a)),'[]'::jsonb) into activity from (
    select e.id,coalesce(nullif(p.full_name,''),'Student') as name,e.action,e.vendor_id as "vendorId",e.vendor_name as "vendorName",e.title,e.created_at as "createdAt"
      from events e left join public.profiles p on p.user_id=e.user_id order by e.created_at desc limit 50
  ) a;
  return jsonb_build_object('friends',friends,'activity',activity,'shareActivity',coalesce((select share_activity from public.kouponly_social_preferences where user_id=uid),false));
end $$;
revoke all on function public.kouponly_request_friend(text),public.kouponly_respond_friend(uuid,text),public.kouponly_friends_snapshot() from public,anon;
grant execute on function public.kouponly_request_friend(text),public.kouponly_respond_friend(uuid,text),public.kouponly_friends_snapshot() to authenticated;
notify pgrst,'reload schema';
