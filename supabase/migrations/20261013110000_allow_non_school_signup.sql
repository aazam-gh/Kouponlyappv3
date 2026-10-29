drop trigger if exists kouponly_guard_signup_email on auth.users;
drop function if exists public.kouponly_guard_signup_email();

do $$
declare f record;
begin
  for f in
    select proname
    from pg_proc
    where pronamespace='public'::regnamespace
      and proname in ('kouponly_complete_signup','couponly_complete_signup','kouponly_complete_signup')
      and to_regprocedure(format('public.%I(jsonb)',proname||'_pre_mvp')) is not null
  loop
    execute format(
      'create or replace function public.%I(p_profile jsonb) returns jsonb language plpgsql security definer set search_path='''' as $body$ begin if public.kouponly_school_email((select email from auth.users where id=auth.uid())) then perform public.kouponly_ensure_free_month(auth.uid()); end if; return public.%I(p_profile); end $body$',
      f.proname, f.proname||'_pre_mvp'
    );
  end loop;
end $$;
