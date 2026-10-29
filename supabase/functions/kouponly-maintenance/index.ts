import { createClient } from "npm:@supabase/supabase-js@2";
import { processNotificationReceipts } from "../_shared/push.ts";

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
  const objects = paths.map((path) => path.replace(/^(?:couponly|kouponly)-student-documents\//, "")).filter(Boolean);
  if (!objects.length) return true;
  const { error } = await service.storage.from("kouponly-student-documents").remove(objects);
  if (error) console.warn("Could not remove one or more student ID files", errorText(error));
  return !error;
}

async function cleanExpiredVerificationRequests(service: any) {
  const now = new Date().toISOString();
  const { data: expired, error } = await service.from("couponly_verification_requests")
    .select("id,id_image_path").eq("status", "pending").lte("expires_at", now).limit(200);
  if (error) throw error;
  let expiredCount = 0;
  for (const row of expired || []) {
    const { error: updateError } = await service.from("couponly_verification_requests")
      .update({ status: "expired", expired_at: now, updated_at: now }).eq("id", row.id);
    if (updateError) throw updateError;
    const deleted = await removeDocuments(service, row.id_image_path ? [row.id_image_path] : []);
    if (!deleted) continue;
    const { error: clearError } = await service.from("couponly_verification_requests")
      .update({ expires_at: null, id_image_path: null, updated_at: now }).eq("id", row.id);
    if (clearError) throw clearError;
    expiredCount++;
  }

  const retention = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: reviewed, error: reviewedError } = await service.from("couponly_verification_requests")
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
    const { error: deleteError } = await service.from("couponly_verification_requests").delete().in("id", removable);
    if (deleteError) throw deleteError;
    removedReviewed += removable.length;
  }
  return { expiredPending: expiredCount, removedReviewed };
}

async function cleanTransientRows(service: any) {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const results = await Promise.all([
    service.from("couponly_otp_challenges").delete().lte("expires_at", now),
    service.from("couponly_rate_limits").delete().lt("window_started_at", old),
    service.from("couponly_opportunity_action_requests").delete().not("expires_at", "is", null).lte("expires_at", now),
  ]);
  for (const result of results) if (result.error) throw result.error;
  return { otpChallenges: results[0].count || 0, rateLimits: results[1].count || 0, opportunityActions: results[2].count || 0 };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !serviceKey) return json({ error: "Supabase server configuration is incomplete" }, 500);
  if (!bearer || (bearer !== serviceKey && bearer !== Deno.env.get("KOUPONLY_RECEIPT_WORKER_KEY"))) return json({ error: "Service access required" }, 401);
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { action } = await request.json();
    if (action === "processNotificationReceipts") return json(await processNotificationReceipts(service));
    if (action !== "dailyMaintenance") return json({ error: "Unknown maintenance action" }, 400);
    const [verification, transient, receipts] = await Promise.all([
      cleanExpiredVerificationRequests(service), cleanTransientRows(service), processNotificationReceipts(service),
    ]);
    return json({ success: true, verification, transient, receipts });
  } catch (error) {
    console.error("kouponly-maintenance", errorText(error));
    return json({ error: errorText(error) }, 500);
  }
});
