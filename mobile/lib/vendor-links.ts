export function safeWebUrl(value?: string, instagram = false): string | undefined {
  if (!value?.trim()) return;
  let text = value.trim();
  if (instagram && /^@?[a-z\d_.]+$/i.test(text)) text = `https://www.instagram.com/${text.replace(/^@/, '')}/`;
  if (!/^[a-z][a-z\d+.-]*:/i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return;
    if (instagram && url.hostname !== 'instagram.com' && !url.hostname.endsWith('.instagram.com')) return;
    return url.href;
  } catch { return; }
}
