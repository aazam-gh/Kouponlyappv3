// Opt-in production integration check. Creates and removes only its own temporary fixtures.
// Email recipient is Resend's simulated delivery address, never a real vendor inbox.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { sha256, vendorAuthEmail } from '../../supabase/functions/_shared/vendor-credentials.ts'

if (!process.argv.includes('--run-live')) throw new Error('Explicit --run-live is required.')
const require = createRequire(new URL('../package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')
const project = 'incgawktquflywvypxiq'
const keys = JSON.parse(execFileSync('supabase', ['projects', 'api-keys', '--project-ref', project, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const url = `https://${project}.supabase.co`
const anon = keys.find(key => key.name === 'anon').api_key
const serviceKey = keys.find(key => key.name === 'service_role').api_key
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const auth = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
const check = result => { if (result.error) throw new Error(result.error.message); return result.data }
const suffix = randomBytes(8).toString('hex')
const username = `credential-qa-${suffix}`
const password = () => `Qa-${randomBytes(24).toString('hex')}`
const initial = password(), replacement = password(), recovered = password()
let adminId, vendorId, adminJwt, vendorJwt
const ownedUsers = []
async function action(action, data = {}, jwt = '', expected = 200, endpoint = 'kouponly-vendor-credentials') {
  const response = await fetch(`${url}/functions/v1/${endpoint}`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify({ action, data }), signal: AbortSignal.timeout(30000),
  })
  const body = await response.json()
  assert.equal(response.status, expected, `${action}: ${JSON.stringify(body)}`)
  return body
}
async function login(name, pass, succeeds = true) {
  const result = await auth().auth.signInWithPassword({ email: await vendorAuthEmail(name), password: pass })
  if (!succeeds) { assert.ok(result.error, 'Previous credentials still accepted'); return }
  assert.equal(result.error, null, result.error?.message)
  return result.data.session
}
try {
  const adminPass = password()
  const admin = check(await service.auth.admin.createUser({ email: `${username}@vendor.kouponly.invalid`, password: adminPass, email_confirm: true })).user
  adminId = admin.id; ownedUsers.push(adminId)
  check(await service.from('couponly_user_roles').insert({ user_id: adminId, role: 'admin' }))
  adminJwt = check(await auth().auth.signInWithPassword({ email: admin.email, password: adminPass })).session.access_token
  const category = check(await service.from('couponly_categories').select('id').eq('active', true).limit(1))[0]
  assert.ok(category, 'No active category for the temporary vendor')
  const created = await action('createVendorUser', { name: `Temporary credential QA ${suffix}`, username, password: initial, categoryIds: [category.id], categoryId: category.id }, adminJwt, 200, 'kouponly-admin-action')
  vendorId = created.uid; ownedUsers.push(vendorId)
  vendorJwt = (await login(username, initial)).access_token
  console.log('PASS: admin creates username/password vendor; vendor signs in')
  await action('setPassword', { vendorId, password: replacement }, vendorJwt, 403)
  await action('changeUsername', { username: 'unauthorized' }, vendorJwt, 403)
  await action('enrollEmail', { email: 'delivered@resend.dev', currentPassword: 'incorrect' }, vendorJwt, 403)
  console.log('PASS: vendor cannot run admin actions or enroll inbox with incorrect password')
  await action('setPassword', { vendorId, password: replacement }, adminJwt)
  await login(username, initial, false)
  vendorJwt = (await login(username, replacement)).access_token
  console.log('PASS: admin password replacement; old password rejected; new password accepted')
  const renamed = `${username}-renamed`
  await action('changeUsername', { vendorId, username: renamed }, adminJwt)
  await login(username, replacement, false)
  vendorJwt = (await login(renamed, replacement)).access_token
  assert.equal(check(await service.from('couponly_vendors').select('payload').eq('id', vendorId).single()).payload.username, renamed)
  console.log('PASS: admin username change; old username rejected; vendor display synchronized')
  await action('enrollEmail', { email: 'delivered@resend.dev', currentPassword: replacement }, vendorJwt)
  const pending = check(await service.from('kouponly_vendor_recovery').select('*').eq('user_id', vendorId).single())
  assert.equal(pending.pending_email, 'delivered@resend.dev'); assert.ok(pending.token_hash); assert.equal(pending.email, null)
  console.log('PASS: vendor inbox enrollment sends through Resend; address stays unverified')
  // We cannot read Resend's simulated inbox. Seed a known secret to exercise the real verification endpoint.
  const verifyToken = randomBytes(32).toString('hex')
  check(await service.from('kouponly_vendor_recovery').update({ token_hash: await sha256(verifyToken), expires_at: new Date(Date.now() + 1800000).toISOString() }).eq('user_id', vendorId))
  await action('verifyEmail', { token: verifyToken })
  await action('verifyEmail', { token: verifyToken }, '', 400)
  console.log('PASS: verification endpoint and replay protection (test-seeded token; email receipt not proved)')
  await action('sendReset', { vendorId }, adminJwt)
  assert.ok(check(await service.from('kouponly_vendor_recovery').select('reset_hash').eq('user_id', vendorId).single()).reset_hash)
  await action('sendReset', {}, vendorJwt)
  await action('requestReset', { username: renamed })
  console.log('PASS: admin, signed-in vendor, and forgot-password requests send through Resend')
  const resetToken = randomBytes(32).toString('hex')
  check(await service.from('kouponly_vendor_recovery').update({ reset_hash: await sha256(resetToken), reset_expires_at: new Date(Date.now() + 1800000).toISOString() }).eq('user_id', vendorId))
  await action('completeReset', { token: resetToken, password: recovered })
  await action('completeReset', { token: resetToken, password: recovered }, '', 400)
  await login(renamed, replacement, false)
  await login(renamed, recovered)
  console.log('PASS: vendor recovery changes real Auth password; old password rejected; new login accepted; reset token cannot replay (test-seeded token)')
} finally {
  const errors = []
  if (vendorId) {
    const result = await service.from('couponly_vendors').delete().eq('id', vendorId)
    if (result.error) errors.push(result.error.message)
  }
  for (const uid of ownedUsers.reverse()) {
    const roles = await service.from('couponly_user_roles').delete().eq('user_id', uid)
    if (roles.error) errors.push(roles.error.message)
    const result = await service.auth.admin.deleteUser(uid)
    if (result.error) errors.push(result.error.message)
  }
  if (errors.length) throw new Error(`Temporary fixture cleanup failed: ${errors.join('; ')}`)
  console.log('Temporary vendor/admin fixtures removed. No existing vendor credentials were changed.')
}
