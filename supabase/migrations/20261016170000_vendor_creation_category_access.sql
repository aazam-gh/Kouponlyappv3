-- Vendor creation validates taxonomy through security-invoker compatibility views.
grant select on public.couponly_categories, public.couponly_subcategories to service_role;
