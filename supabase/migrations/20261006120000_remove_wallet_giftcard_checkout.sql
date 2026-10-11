-- Disable wallet balance spending while keeping the legacy offer RPC's current response.
create or replace function public.realx_redeem_offer(
  p_vendor_id text,p_offer_id text,p_total_amount numeric,p_type text,
  p_giftcard_amount numeric,p_offer_index integer,p_creator_code text,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_type is distinct from 'offer' then
    raise exception 'Gift-card checkout is no longer available' using errcode='0A000';
  end if;
  raise exception 'Use the monthly coupon redemption flow' using errcode='42501';
end $$;

-- This migration may run after the couponly_* backend rename.
do $$
begin
  if to_regprocedure('public.couponly_redeem_offer(text,text,numeric,text,numeric,integer,text,uuid)') is not null then
    execute replace(pg_get_functiondef('public.realx_redeem_offer(text,text,numeric,text,numeric,integer,text,uuid)'::regprocedure),
      'public.realx_redeem_offer(', 'public.couponly_redeem_offer(');
  end if;
end $$;

-- The former implementation contains the balance debit and is no longer callable.
drop function if exists public.realx_redeem_offer_legacy(text,text,numeric,text,numeric,integer,text,uuid);
drop function if exists public.realx_redeem_gift_card(text,numeric,uuid);
drop function if exists public.couponly_redeem_offer_legacy(text,text,numeric,text,numeric,integer,text,uuid);
drop function if exists public.couponly_redeem_gift_card(text,numeric,uuid);
