export function safeWebUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return
    return url.href
  } catch { return }
}
