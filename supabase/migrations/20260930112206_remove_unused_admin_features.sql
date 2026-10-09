-- Retire unused Holding Groups, Wakti verification, and Badrgo campaign/voucher features.
-- The admin/vendor role records and transaction history are intentionally preserved.

DROP FUNCTION IF EXISTS public.realx_claim_badrgo_pilot_coupon();
DROP FUNCTION IF EXISTS public.realx_claim_badrgo_pilot_for(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.realx_claim_badrgo_voucher();
DROP FUNCTION IF EXISTS public.realx_configure_badrgo_pilot(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.realx_get_badrgo_pilot_campaign();
DROP FUNCTION IF EXISTS public.realx_get_badrgo_voucher_program();
DROP FUNCTION IF EXISTS public.realx_import_badrgo_redemptions(jsonb, text);
DROP FUNCTION IF EXISTS public.realx_migrate_badrgo_pilot_to_vouchers(uuid);

ALTER TABLE public.realx_user_roles
  DROP CONSTRAINT IF EXISTS realx_user_roles_role_check;

ALTER TABLE public.realx_user_roles
  ADD CONSTRAINT realx_user_roles_role_check CHECK (role IN ('admin', 'vendor'));

DROP POLICY IF EXISTS realx_holding_scope ON public.realx_holding_groups;
DROP POLICY IF EXISTS realx_holding_group_vendors_scope ON public.realx_holding_group_vendors;

ALTER TABLE public.realx_user_roles
  DROP COLUMN IF EXISTS holding_group_id;

DROP TABLE public.realx_wakti_student_verification_requests,
  public.realx_pilot_campaign_claims,
  public.realx_pilot_campaign_identity_claims,
  public.realx_pilot_campaign_codes,
  public.realx_pilot_campaigns,
  public.realx_badrgo_voucher_inventory,
  public.realx_badrgo_voucher_claims,
  public.realx_redemption_imports,
  public.realx_inventory_batches,
  public.realx_badrgo_voucher_programs,
  public.realx_holding_group_members,
  public.realx_holding_group_vendors,
  public.realx_holding_groups;
