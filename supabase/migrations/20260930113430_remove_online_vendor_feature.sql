-- Retire the Online Vendors admin/mobile feature and its dedicated tables.
-- kouponly_vendors is shared with in-store partners; its online-only subtype is no longer allowed.

DROP FUNCTION IF EXISTS public.kouponly_record_online_click(text, uuid, text);

DROP TABLE public.kouponly_vendor_online_configs,
  public.kouponly_online_vendor_clicks,
  public.kouponly_online_vendor_analytics;

ALTER TABLE public.kouponly_vendors
  DROP CONSTRAINT IF EXISTS kouponly_vendors_vendor_type_check;

ALTER TABLE public.kouponly_vendors
  ADD CONSTRAINT kouponly_vendors_vendor_type_check CHECK (vendor_type IN ('in_store', 'hybrid'));
