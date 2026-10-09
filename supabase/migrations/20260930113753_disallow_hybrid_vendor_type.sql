-- Hybrid vendors depended on online redemption, which has been retired.
ALTER TABLE public.realx_vendors
  DROP CONSTRAINT IF EXISTS realx_vendors_vendor_type_check;

ALTER TABLE public.realx_vendors
  ADD CONSTRAINT realx_vendors_vendor_type_check CHECK (vendor_type = 'in_store');
