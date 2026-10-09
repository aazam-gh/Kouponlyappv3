import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type RequestBody = { id?: string; idempotencyKey?: string };
const failure = (code: string, message: string, status = 400) => Response.json({ error: { code, message } }, { status });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const body = await req.json() as RequestBody;
    if (!body.id?.trim()) return failure("invalid_redemption", "A redemption id is required.");
    if (!body.idempotencyKey || !/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)) {
      return failure("invalid_idempotency_key", "A valid idempotency key is required.");
    }
    const { data, error } = await ctx.supabase.rpc("complete_redemption_atomic", {
      p_redemption_id: body.id,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) return failure("redemption_rejected", error.message, 409);
    return Response.json({ data });
  }),
};
