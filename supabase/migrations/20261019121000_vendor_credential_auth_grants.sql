-- Edge credential checks read these tables; admin vendor creation also inserts/deletes rows.
-- BYPASSRLS does not substitute for table privileges. Browser grants remain unchanged.
grant select, insert, delete on public.couponly_user_roles, public.couponly_vendor_memberships to service_role;
