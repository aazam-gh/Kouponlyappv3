import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type RedemptionRequest = { id?: string; mode?: "online" | "inStore"; idempotencyKey?: string };

const errorResponse = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const body = (await req.json()) as RedemptionRequest;
    if (!body.id || !["online", "inStore"].includes(body.mode ?? "")) {
      return errorResponse("invalid_request", "A valid redemption id and mode are required.", 400);
    }
    if (!body.idempotencyKey || !/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)) {
      return errorResponse("invalid_idempotency_key", "A valid idempotency key is required.", 400);
    }
    const { data, error } = await ctx.supabase.rpc("validate_redemption_atomic", {
      p_redemption_id: body.id,
      p_mode: body.mode,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) {
      return errorResponse("redemption_rejected", error.message, 409);
    }
    return Response.json({ data });
  }),
};
