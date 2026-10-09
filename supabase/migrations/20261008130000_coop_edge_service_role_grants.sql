grant select on table
  public.realx_students,
  public.realx_verification_requests,
  public.realx_notification_deliveries,
  public.realx_notifications,
  public.realx_push_tokens,
  public.realx_transactions,
  public.realx_vendors
to service_role;

grant insert on table
  public.notifications,
  public.realx_admin_audit_log,
  public.realx_creator_codes,
  public.realx_map_cache,
  public.realx_map_locations,
  public.realx_notification_deliveries,
  public.realx_notifications,
  public.realx_otp_challenges,
  public.realx_students,
  public.realx_user_roles,
  public.realx_vendor_memberships,
  public.realx_vendors
to service_role;

grant update on table
  public.realx_creator_codes,
  public.realx_map_cache,
  public.realx_map_locations,
  public.realx_notification_deliveries,
  public.realx_notifications,
  public.realx_otp_challenges,
  public.realx_push_tokens,
  public.realx_students,
  public.realx_vendors,
  public.realx_verification_requests
to service_role;

grant delete on table
  public.realx_map_locations,
  public.realx_opportunity_action_requests,
  public.realx_otp_challenges,
  public.realx_push_tokens,
  public.realx_rate_limits,
  public.realx_students,
  public.realx_transactions,
  public.realx_user_roles,
  public.realx_vendor_memberships,
  public.realx_vendors,
  public.realx_verification_requests
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
        'notifications', 'realx_admin_audit_log', 'realx_creator_codes',
        'realx_map_cache', 'realx_map_locations', 'realx_notification_deliveries',
        'realx_notifications', 'realx_otp_challenges', 'realx_students',
        'realx_user_roles', 'realx_vendor_memberships', 'realx_vendors'
      )
  loop
    execute format('grant usage, select on sequence %I.%I to service_role', seq.schema_name, seq.sequence_name);
  end loop;
end $$;
