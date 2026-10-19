import { createClient } from 'npm:@supabase/supabase-js@2';
import { credentialLink, recoveryEmail, sha256, validatePassword, validateUsername, vendorAuthEmail } from '../_shared/vendor-credentials.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
const generic = { message: 'If this username has a verified recovery email, a reset link will be sent.' };
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return reply({});
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const isolatedAuth = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = <T extends { data: unknown; error: unknown }>(result: T): T['data'] => { if (result.error) throw result.error; return result.data; };
  const limit = async (key: string, max = 5, seconds = 900) => {
    if (!check(await service.rpc('kouponly_credential_limit', { p_key: await sha256(key), p_max: max, p_seconds: seconds }))) fail('Too many attempts. Please try again later.', 429);
  };
  const audit = async (actor: string | null, uid: string, action: string) => {
    check(await service.from('kouponly_credential_audit').insert({ actor_id: actor, user_id: uid, action }));
  };
  const send = async (email: string, kind: 'verify' | 'reset', token: string) => {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const base = Deno.env.get('VENDOR_PANEL_URL');
    if (!apiKey || !base) fail('Recovery email delivery is not configured.', 503);
    const link = credentialLink(base!, kind, token);
    const button = kind === 'verify' ? 'Verify recovery email' : 'Reset password';
    const safeLink = link.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('RESEND_FROM_EMAIL') || 'Kouponly <verification@kouponly.com>', to: [email],
        subject: kind === 'verify' ? 'Verify your Kouponly recovery email' : 'Reset your Kouponly vendor password',
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#17251b"><h2>Kouponly</h2><h1 style="font-size:24px">${button}</h1><p>Open the link below and complete the form to ${kind === 'verify' ? 'verify this inbox for your vendor account' : 'choose a new password for your vendor account'}.</p><p style="margin:28px 0"><a href="${safeLink}" style="background:#15803d;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">${button}</a></p><p>This link expires in 30 minutes and can be used once.</p><p>If you did not request this, ignore this email. Your password has not changed.</p></div>`,
        text: `${kind === 'verify' ? 'Verify your recovery email' : 'Choose a new password'} by opening this link and completing the form:\n\n${link}\n\nThis link can be used once and expires in 30 minutes.\nIf you did not request this, ignore this email. Your password has not changed.` })
    });
    if (!result.ok) fail('Email could not be sent. Please try again later.', 502);
  };
  const membership = async (uid: string) => {
    const rows = check(await service.from('couponly_vendor_memberships').select('vendor_id').eq('user_id', uid).in('role', ['owner', 'manager']).limit(2));
    if (rows?.length !== 1) fail('A single vendor owner or manager account is required.', 403);
  };
  const sendReset = async (uid: string, inbox: string) => {
    // A reset token grants only password replacement, never a general Auth session.
    const token = randomToken();
    check(await service.from('kouponly_vendor_recovery').update({ reset_hash: await sha256(token), reset_expires_at: new Date(Date.now() + 30 * 60_000).toISOString() }).eq('user_id', uid));
    await send(inbox, 'reset', token);
  };
  try {
    const { action, data = {} } = await request.json();
    // Supabase's gateway replaces forwarded headers; never accept an IP supplied in JSON.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await limit(`ip:${ip}`, 30);
    if (action === 'requestReset') {
      const started = Date.now();
      try {
        const username = validateUsername(data.username);
        let uid = check(await service.rpc('kouponly_vendor_login_id', { p_email: await vendorAuthEmail(username) }));
        // Preserve recovery for older vendor accounts that still sign in with a real Auth email.
        if (!uid && username.includes('@')) uid = check(await service.rpc('kouponly_vendor_login_id', { p_email: username.toLowerCase() }));
        if (uid) {
          await limit(`reset:${uid}`, 3);
          const record = check(await service.from('kouponly_vendor_recovery').select('email,verified_at').eq('user_id', uid).maybeSingle());
          if (record?.email && record.verified_at) {
            await sendReset(uid, record.email);
            await audit(null, uid, 'requestReset');
          }
        }
      } catch (error) {
        // Keep the public response generic, while leaving an operational signal without account/token data.
        console.error('Vendor recovery request failed', { status: error instanceof Error && 'status' in error ? error.status : 500 });
      }
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 1200 - (Date.now() - started))));
      return reply(generic);
    }
    if (action === 'verifyEmail') {
      if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)) fail('This verification link is invalid or expired.');
      const uid = check(await service.rpc('kouponly_verify_vendor_recovery', { p_hash: await sha256(data.token) }));
      if (!uid) fail('This verification link is invalid or expired.');
      await audit(null, uid, 'verifyEmail');
      return reply({ message: 'Recovery email verified. You can now request password reset emails.' });
    }
    if (action === 'completeReset') {
      const password = validatePassword(data.password);
      if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)) fail('This reset link is invalid or expired.');
      const uid = check(await service.rpc('kouponly_consume_vendor_reset', { p_hash: await sha256(data.token) }));
      if (!uid) fail('This reset link is invalid or expired. Request a new link.');
      await membership(uid);
      check(await service.auth.admin.updateUserById(uid, { password }));
      await audit(null, uid, 'completeReset');
      return reply({ message: 'Password updated. Sign in with your username and new password.' });
    }
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const identity = await service.auth.getUser(jwt);
    if (identity.error || !identity.data.user) fail('Authentication required.', 401);
    const actor = identity.data.user!;
    const role = check(await service.from('couponly_user_roles').select('role').eq('user_id', actor.id).maybeSingle());
    const admin = role?.role === 'admin';
    let uid = actor.id;
    if (data.vendorId !== undefined) {
      if (!admin) fail('Admin access required.', 403);
      const vendor = check(await service.from('couponly_vendors').select('user_id').eq('id', String(data.vendorId)).single());
      if (!vendor?.user_id) fail('This vendor has no login account.');
      uid = vendor.user_id;
    }
    await membership(uid);
    const target = check(await service.auth.admin.getUserById(uid)).user;
    if (!target?.email) fail('Vendor login account not found.');
    const record = check(await service.from('kouponly_vendor_recovery').select('email,verified_at,pending_email').eq('user_id', uid).maybeSingle());
    if (action === 'status') return reply({ username: target.user_metadata?.username || target.email, email: record?.email || '', pendingEmail: record?.pending_email || '' });
    await limit(`action:${uid}:${action}`, 5);
    if (action === 'enrollEmail') {
      const email = recoveryEmail(data.email);
      if (!admin) {
        const reauth = isolatedAuth();
        const result = await reauth.auth.signInWithPassword({ email: target.email, password: String(data.currentPassword || '') });
        if (result.error || result.data.user?.id !== uid) fail('Your current password is incorrect.', 403);
        await reauth.auth.signOut({ scope: 'local' });
      }
      const token = randomToken();
      check(await service.from('kouponly_vendor_recovery').upsert({ user_id: uid, pending_email: email, token_hash: await sha256(token), expires_at: new Date(Date.now() + 30 * 60_000).toISOString() }, { onConflict: 'user_id' }));
      await send(email, 'verify', token);
    } else if (action === 'sendReset') {
      if (!record?.email || !record.verified_at) fail('Verify a recovery email before sending a reset link.');
      await limit(`reset:${uid}`, 3);
      await sendReset(uid, record.email);
    } else if (action === 'changeUsername') {
      if (!admin) fail('Admin access required.', 403);
      const username = validateUsername(data.username);
      const result = await service.auth.admin.updateUserById(uid, { email: await vendorAuthEmail(username), email_confirm: true, user_metadata: { ...target.user_metadata, username } });
      if (result.error) fail('Username could not be changed. It may already be in use.');
    } else if (action === 'setPassword') {
      if (!admin) fail('Admin access required.', 403);
      check(await service.auth.admin.updateUserById(uid, { password: validatePassword(data.password) }));
    } else fail('Unknown credential action.');
    await audit(actor.id, uid, action);
    return reply({ message: action === 'enrollEmail' ? 'Verification email sent. The new address becomes active only after verification.' : action === 'sendReset' ? 'Password reset email sent.' : action === 'changeUsername' ? 'Username changed. Use the new username for future sign-ins.' : 'Password updated. The vendor must sign in with the new password.' });
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? Number(error.status) : 400;
    return reply({ error: error instanceof Error ? error.message : 'Credential action failed.' }, status >= 400 && status < 600 ? status : 400);
  }
});
