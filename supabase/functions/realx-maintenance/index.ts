import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});
const errorText = (error: any) => String(error?.message || error || "Maintenance failed");

async function removeDocuments(service: any, paths: string[]) {
  const objects = paths.map((path) => path.replace(/^realx-student-documents\//, "")).filter(Boolean);
  if (!objects.length) return true;
  const { error } = await service.storage.from("realx-student-documents").remove(objects);
  if (error) console.warn("Could not remove one or more student ID files", errorText(error));
  return !error;
}

async function cleanExpiredVerificationRequests(service: any) {
  const now = new Date().toISOString();
  const { data: expired, error } = await service.from("realx_verification_requests")
    .select("id,id_image_path").eq("status", "pending").lte("expires_at", now).limit(200);
  if (error) throw error;
  let expiredCount = 0;
  for (const row of expired || []) {
    const { error: updateError } = await service.from("realx_verification_requests")
      .update({ status: "expired", expired_at: now, updated_at: now }).eq("id", row.id);
    if (updateError) throw updateError;
    const deleted = await removeDocuments(service, row.id_image_path ? [row.id_image_path] : []);
    if (!deleted) continue;
    const { error: clearError } = await service.from("realx_verification_requests")
      .update({ expires_at: null, id_image_path: null, updated_at: now }).eq("id", row.id);
    if (clearError) throw clearError;
    expiredCount++;
  }

  const retention = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: reviewed, error: reviewedError } = await service.from("realx_verification_requests")
    .select("id,id_image_path").in("status", ["approved", "verified"]).lte("reviewed_at", retention).limit(500);
  if (reviewedError) throw reviewedError;
  let removedReviewed = 0;
  for (let offset = 0; offset < (reviewed || []).length; offset += 20) {
    const page = reviewed!.slice(offset, offset + 20);
    const removable: string[] = [];
    for (const row of page) {
      if (await removeDocuments(service, row.id_image_path ? [row.id_image_path] : [])) removable.push(row.id);
    }
    if (!removable.length) continue;
    const { error: deleteError } = await service.from("realx_verification_requests").delete().in("id", removable);
    if (deleteError) throw deleteError;
    removedReviewed += removable.length;
  }
  return { expiredPending: expiredCount, removedReviewed };
}

async function cleanTransientRows(service: any) {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const results = await Promise.all([
    service.from("realx_otp_challenges").delete().lte("expires_at", now),
    service.from("realx_rate_limits").delete().lt("window_started_at", old),
    service.from("realx_online_vendor_clicks").delete().lte("expires_at", now),
    service.from("realx_opportunity_action_requests").delete().not("expires_at", "is", null).lte("expires_at", now),
  ]);
  for (const result of results) if (result.error) throw result.error;
  return { otpChallenges: results[0].count || 0, rateLimits: results[1].count || 0, onlineClicks: results[2].count || 0, opportunityActions: results[3].count || 0 };
}

async function processReceipts(service: any) {
  const { data: rows, error } = await service.from("realx_notification_deliveries")
    .select("id,campaign_id,token_id,receipt_id").eq("status", "pending")
    .order("created_at", { ascending: true }).limit(300);
  if (error) throw error;
  if (!rows?.length) return { checked: 0, pending: 0, errors: 0, invalidTokens: 0 };
  const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ids: rows.map((row: any) => row.receipt_id) }),
  });
  if (!response.ok) throw new Error(`Expo receipt request failed (${response.status})`);
  const result = await response.json();
  const campaignCounts = new Map<string, { success: number; failure: number; invalid: number }>();
  const invalidTokenIds: string[] = [];
  let checked = 0, pending = 0, errors = 0;
  for (const row of rows) {
    const receipt = result.data?.[row.receipt_id];
    if (!receipt) { pending++; continue; }
    checked++;
    const failed = receipt.status === "error";
    if (failed) errors++;
    const invalid = failed && ["DeviceNotRegistered", "InvalidCredentials"].includes(receipt.details?.error || "");
    if (invalid && row.token_id) invalidTokenIds.push(row.token_id);
    const counts = campaignCounts.get(row.campaign_id) || { success: 0, failure: 0, invalid: 0 };
    if (failed) counts.failure++; else counts.success++;
    if (invalid) counts.invalid++;
    campaignCounts.set(row.campaign_id, counts);
    const { error: updateError } = await service.from("realx_notification_deliveries")
      .update({ status: failed ? "error" : "ok", details: receipt, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (updateError) throw updateError;
  }
  if (invalidTokenIds.length) {
    const { error: tokenError } = await service.from("realx_push_tokens").delete().in("id", invalidTokenIds);
    if (tokenError) throw tokenError;
  }
  for (const [campaignId, counts] of campaignCounts) {
    const { data: campaign, error: campaignError } = await service.from("realx_notifications")
      .select("receipt_success_count,receipt_failure_count,invalid_token_count").eq("id", campaignId).maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) continue;
    const { error: countError } = await service.from("realx_notifications").update({
      receipt_success_count: Number(campaign.receipt_success_count || 0) + counts.success,
      receipt_failure_count: Number(campaign.receipt_failure_count || 0) + counts.failure,
      invalid_token_count: Number(campaign.invalid_token_count || 0) + counts.invalid,
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);
    if (countError) throw countError;
  }
  return { checked, pending, errors, invalidTokens: invalidTokenIds.length };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !serviceKey) return json({ error: "Supabase server configuration is incomplete" }, 500);
  if (!bearer || bearer !== serviceKey) return json({ error: "Service access required" }, 401);
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { action } = await request.json();
    if (action === "processNotificationReceipts") return json(await processReceipts(service));
    if (action !== "dailyMaintenance") return json({ error: "Unknown maintenance action" }, 400);
    const [verification, transient, receipts] = await Promise.all([
      cleanExpiredVerificationRequests(service), cleanTransientRows(service), processReceipts(service),
    ]);
    return json({ success: true, verification, transient, receipts });
  } catch (error) {
    console.error("realx-maintenance", errorText(error));
    return json({ error: errorText(error) }, 500);
  }
});
