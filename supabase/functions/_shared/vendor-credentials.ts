export function validateUsername(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128 || value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error('Use a username of 1–128 characters without surrounding spaces or control characters.');
  }
  return value;
}

export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new Error('Use a password of 12–128 characters.');
  return value;
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function vendorAuthEmail(username: string): Promise<string> {
  return `${await sha256(username)}@vendor.kouponly.invalid`;
}

export function recoveryEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('.invalid')) throw new Error('Enter a reachable recovery email address.');
  return email;
}

export function credentialLink(base: string, kind: 'verify' | 'reset', token: string): string {
  const url = new URL(base);
  if (url.username || url.password) throw new Error('Vendor panel URL cannot contain credentials.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Vendor panel URL must use HTTPS.');
  url.pathname = '/credentials';
  url.search = '';
  url.hash = new URLSearchParams({ kind, token }).toString();
  return url.toString();
}
