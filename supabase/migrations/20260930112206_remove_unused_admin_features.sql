-- Retire unused Holding Groups, Wakti verification, and Badrgo campaign/voucher features.
-- The admin/vendor role records and transaction history are intentionally preserved.

DROP FUNCTION IF EXISTS public.kouponly_claim_badrgo_pilot_coupon();
DROP FUNCTION IF EXISTS public.kouponly_claim_badrgo_pilot_for(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.kouponly_claim_badrgo_voucher();
DROP FUNCTION IF EXISTS public.kouponly_configure_badrgo_pilot(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.kouponly_get_badrgo_pilot_campaign();
DROP FUNCTION IF EXISTS public.kouponly_get_badrgo_voucher_program();
DROP FUNCTION IF EXISTS public.kouponly_import_badrgo_redemptions(jsonb, text);
DROP FUNCTION IF EXISTS public.kouponly_migrate_badrgo_pilot_to_vouchers(uuid);

ALTER TABLE public.kouponly_user_roles
  DROP CONSTRAINT IF EXISTS kouponly_user_roles_role_check;

ALTER TABLE public.kouponly_user_roles
  ADD CONSTRAINT kouponly_user_roles_role_check CHECK (role IN ('admin', 'vendor'));

DROP POLICY IF EXISTS kouponly_holding_scope ON public.kouponly_holding_groups;
DROP POLICY IF EXISTS kouponly_holding_group_vendors_scope ON public.kouponly_holding_group_vendors;

ALTER TABLE public.kouponly_user_roles
  DROP COLUMN IF EXISTS holding_group_id;

DROP TABLE public.kouponly_wakti_student_verification_requests,
  public.kouponly_pilot_campaign_claims,
  public.kouponly_pilot_campaign_identity_claims,
  public.kouponly_pilot_campaign_codes,
  public.kouponly_pilot_campaigns,
  public.kouponly_badrgo_voucher_inventory,
  public.kouponly_badrgo_voucher_claims,
  public.kouponly_redemption_imports,
  public.kouponly_inventory_batches,
  public.kouponly_badrgo_voucher_programs,
  public.kouponly_holding_group_members,
  public.kouponly_holding_group_vendors,
  public.kouponly_holding_groups;
