grant select on table
  public.kouponly_students,
  public.kouponly_verification_requests,
  public.kouponly_notification_deliveries,
  public.kouponly_notifications,
  public.kouponly_push_tokens,
  public.kouponly_transactions,
  public.kouponly_vendors
to service_role;

grant insert on table
  public.notifications,
  public.kouponly_admin_audit_log,
  public.kouponly_creator_codes,
  public.kouponly_map_cache,
  public.kouponly_map_locations,
  public.kouponly_notification_deliveries,
  public.kouponly_notifications,
  public.kouponly_otp_challenges,
  public.kouponly_students,
  public.kouponly_user_roles,
  public.kouponly_vendor_memberships,
  public.kouponly_vendors
to service_role;

grant update on table
  public.kouponly_creator_codes,
  public.kouponly_map_cache,
  public.kouponly_map_locations,
  public.kouponly_notification_deliveries,
  public.kouponly_notifications,
  public.kouponly_otp_challenges,
  public.kouponly_push_tokens,
  public.kouponly_students,
  public.kouponly_vendors,
  public.kouponly_verification_requests
to service_role;

grant delete on table
  public.kouponly_map_locations,
  public.kouponly_opportunity_action_requests,
  public.kouponly_otp_challenges,
  public.kouponly_push_tokens,
  public.kouponly_rate_limits,
  public.kouponly_students,
  public.kouponly_transactions,
  public.kouponly_user_roles,
  public.kouponly_vendor_memberships,
  public.kouponly_vendors,
  public.kouponly_verification_requests
to service_role;

do $$
declare
  seq record;
begin
  for seq in
    select sn.nspname as schema_name, s.relname as sequence_name
    from pg_class s
    join pg_namespace sn on sn.oid = s.relnamespace
    join pg_depend d on d.objid = s.oid and d.deptype in ('a', 'i')
    join pg_class t on t.oid = d.refobjid
    join pg_namespace tn on tn.oid = t.relnamespace
    where s.relkind = 'S'
      and sn.nspname = 'public'
      and tn.nspname = 'public'
      and t.relname in (
        'notifications', 'kouponly_admin_audit_log', 'kouponly_creator_codes',
        'kouponly_map_cache', 'kouponly_map_locations', 'kouponly_notification_deliveries',
        'kouponly_notifications', 'kouponly_otp_challenges', 'kouponly_students',
        'kouponly_user_roles', 'kouponly_vendor_memberships', 'kouponly_vendors'
      )
  loop
    execute format('grant usage, select on sequence %I.%I to service_role', seq.schema_name, seq.sequence_name);
  end loop;
end $$;
