import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default { fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
  const body = await req.json() as { rewardId?: string; idempotencyKey?: string };
  if (!body.rewardId || !body.idempotencyKey) return Response.json({ error:{code:"invalid_request",message:"Reward and idempotency key are required."} },{status:400});
  const { data, error } = await ctx.supabase.rpc("redeem_reward_atomic", { p_reward_id:body.rewardId, p_idempotency_key:body.idempotencyKey });
  if (error) return Response.json({ error:{code:"reward_rejected",message:error.message} },{status:409});
  return Response.json({data});
}) };
