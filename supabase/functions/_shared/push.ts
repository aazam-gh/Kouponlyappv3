export function summarizeTickets(entries: any[], payload: any) {
  const tickets = Array.isArray(payload?.data) ? payload.data : [];
  return entries.map((entry, index) => {
    const ticket = tickets[index];
    const accepted = ticket?.status === 'ok' && typeof ticket.id === 'string';
    return { entry, accepted, receiptId: accepted ? ticket.id : null,
      error: accepted ? null : ticket?.details?.error || ticket?.message || payload?.errors?.[0]?.message || 'No push ticket returned',
      invalid: ticket?.details?.error === 'DeviceNotRegistered' };
  });
}

export async function processNotificationReceipts(service: any) {
  const { data: rows, error } = await service.from('couponly_notification_deliveries')
    .select('id,campaign_id,token_id,receipt_id,created_at,couponly_notifications!inner(status)').eq('status', 'pending')
    .neq('couponly_notifications.status', 'queued')
    .order('created_at', { ascending: true }).limit(300);
  if (error) throw error;
  if (!rows?.length) return { checked: 0, pending: 0 };
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids: rows.map((row: any) => row.receipt_id) }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Expo receipt request failed (${response.status})`);
  const result = await response.json();
  const campaigns = new Set<string>();
  let checked = 0;
  for (const row of rows) {
    let receipt = result.data?.[row.receipt_id];
    if (!receipt && Date.now() - Date.parse(row.created_at) > 24 * 60 * 60 * 1000)
      receipt = { status: 'error', details: { error: 'ReceiptExpired' }, message: 'Delivery could not be confirmed before the receipt expired' };
    if (!receipt) continue;
    const { error: updateError } = await service.from('couponly_notification_deliveries')
      .update({ status: receipt.status === 'ok' ? 'ok' : 'error', details: receipt, updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('status', 'pending');
    if (updateError) throw updateError;
    if (receipt.details?.error === 'DeviceNotRegistered' && row.token_id) {
      const { error: deleteError } = await service.from('couponly_push_tokens').delete().eq('id', row.token_id);
      if (deleteError) throw deleteError;
    }
    campaigns.add(row.campaign_id);
    checked++;
  }
  for (const campaignId of campaigns) {
    const counts: Record<string, number> = {};
    for (const status of ['ok', 'error', 'pending']) {
      const { count, error: countError } = await service.from('couponly_notification_deliveries')
        .select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', status);
      if (countError) throw countError;
      counts[status] = count || 0;
    }
    const { data: campaign, error: campaignError } = await service.from('couponly_notifications')
      .select('failed_count,data').eq('id', campaignId).single();
    if (campaignError) throw campaignError;
    const status = counts.pending ? 'processing' : !counts.ok ? 'failed' : counts.error || campaign.failed_count ? 'partial' : 'sent';
    const { data: failures, error: failureError } = await service.from('couponly_notification_deliveries')
      .select('details').eq('campaign_id', campaignId).eq('status', 'error').limit(10);
    if (failureError) throw failureError;
    const errors = [...new Set([...(campaign.data?.errors || []), ...(failures || []).map((row: any) =>
      row.details?.details?.error || row.details?.message || 'Push provider rejected delivery')])].slice(0, 10);
    const { error: saveError } = await service.from('couponly_notifications').update({
      data: { ...campaign.data, errors }, receipt_success_count: counts.ok, receipt_failure_count: counts.error, status,
      completed_at: counts.pending ? null : new Date().toISOString(),
    }).eq('id', campaignId);
    if (saveError) throw saveError;
  }
  return { checked, pending: rows.length - checked };
}
