-- Hybrid vendors depended on online redemption, which has been retired.
ALTER TABLE public.kouponly_vendors
  DROP CONSTRAINT IF EXISTS kouponly_vendors_vendor_type_check;

ALTER TABLE public.kouponly_vendors
  ADD CONSTRAINT kouponly_vendors_vendor_type_check CHECK (vendor_type = 'in_store');
