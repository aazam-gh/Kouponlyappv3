begin;
update public.kouponly_school_email_domains set active=false,updated_at=now() where domain<>'rajagiri.edu.in';
insert into public.kouponly_school_email_domains(domain,active) values('rajagiri.edu.in',true)
 on conflict(domain) do update set active=true,updated_at=now();
create or replace function public.kouponly_school_email(p_email text)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(lower(trim(p_email)) ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  and exists(select 1 from public.kouponly_school_email_domains where active and domain=split_part(lower(trim(p_email)),'@',2)),false);
$$;
revoke all on function public.kouponly_school_email(text) from public;
grant execute on function public.kouponly_school_email(text) to anon,authenticated,service_role;
create or replace function public.kouponly_has_verified_email(p_uid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=p_uid and not coalesce(is_anonymous,false)
  and email_confirmed_at is not null and public.kouponly_school_email(email));
$$;
create function public.kouponly_student_email_allowed()
returns boolean language sql stable security definer set search_path='' as $$
 select public.kouponly_is_benefits_admin() or exists(select 1 from auth.users where id=auth.uid() and public.kouponly_school_email(email));
$$;
revoke all on function public.kouponly_student_email_allowed() from public,anon;
grant execute on function public.kouponly_student_email_allowed() to authenticated;
-- Enforce student enrollment without interfering with vendor/admin Auth provisioning.
create function public.kouponly_guard_student_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not public.kouponly_school_email(new.email) or not exists(select 1 from auth.users where id=new.id and lower(trim(email))=lower(trim(new.email))) then
  raise exception 'EMAIL_DOMAIN_NOT_ALLOWED' using errcode='42501';
 end if;
 return new;
end $$;
create trigger kouponly_guard_student_email before insert or update of email,id on public.couponly_students
 for each row execute function public.kouponly_guard_student_email();
revoke all on function public.kouponly_guard_student_email() from public,anon,authenticated;
create or replace function public.kouponly_ensure_free_month(p_uid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare sub uuid; period uuid;
  month_start timestamptz := date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  month_end timestamptz := (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month') at time zone 'Asia/Kolkata';
begin
  if not exists(select 1 from auth.users where id=p_uid and public.kouponly_school_email(email)) then raise exception 'EMAIL_DOMAIN_NOT_ALLOWED' using errcode='42501'; end if;
  if not public.kouponly_has_verified_email(p_uid) then
    raise exception 'Verified email required' using errcode='42501';
  end if;
  perform public.kouponly_lock_account(p_uid);
  insert into public.kouponly_subscriptions(user_id,plan_id,provider,provider_subscription_id)
    values(p_uid,'free_mvp','free_mvp',p_uid::text) on conflict(provider,provider_subscription_id) do nothing;
  select id into sub from public.kouponly_subscriptions where user_id=p_uid and provider='free_mvp';
  insert into public.kouponly_subscription_periods(user_id,subscription_id,provider_period_key,starts_at,ends_at)
    values(p_uid,sub,to_char(month_start at time zone 'Asia/Kolkata','YYYY-MM'),month_start,month_end)
    on conflict(subscription_id,provider_period_key) do nothing;
  select id into period from public.kouponly_subscription_periods where subscription_id=sub and starts_at=month_start and revoked_at is null;
  if period is null then raise exception 'Account access unavailable'; end if;
  insert into public.kouponly_coupon_rounds(user_id,period_id,round_number) values(p_uid,period,0) on conflict(period_id,round_number) do nothing;
  return period;
end $$;

notify pgrst,'reload schema';
commit;
