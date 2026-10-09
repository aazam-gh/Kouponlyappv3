-- Retire the Online Vendors admin/mobile feature and its dedicated tables.
-- realx_vendors is shared with in-store partners; its online-only subtype is no longer allowed.

DROP FUNCTION IF EXISTS public.realx_record_online_click(text, uuid, text);

DROP TABLE public.realx_vendor_online_configs,
  public.realx_online_vendor_clicks,
  public.realx_online_vendor_analytics;

ALTER TABLE public.realx_vendors
  DROP CONSTRAINT IF EXISTS realx_vendors_vendor_type_check;

ALTER TABLE public.realx_vendors
  ADD CONSTRAINT realx_vendors_vendor_type_check CHECK (vendor_type IN ('in_store', 'hybrid'));
