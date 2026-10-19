// Exercise the real Edge handler against fake Auth/database/email transports; no external writes.
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { sha256, vendorAuthEmail } from '../../supabase/functions/_shared/vendor-credentials.ts'

const owner = '00000000-0000-0000-0000-000000000001'
const admin = '00000000-0000-0000-0000-000000000002'
const users = {
  [owner]: { id: owner, email: await vendorAuthEmail('owner'), user_metadata: { username: 'owner' } },
  [admin]: { id: admin, email: 'admin@example.com', user_metadata: {} },
}
const tables = {
  couponly_user_roles: [{ user_id: owner, role: 'vendor' }, { user_id: admin, role: 'admin' }],
  couponly_vendor_memberships: [{ user_id: owner, vendor_id: 'vendor-a', role: 'owner' }],
  couponly_vendors: [{ id: 'vendor-a', user_id: owner }],
  kouponly_vendor_recovery: [],
  kouponly_credential_audit: [],
}
let handler
let passwordUpdates = []
let emails = []
let throttled = false
class Query {
  constructor(table) { this.table = table; this.filters = []; this.operation = 'select' }
  select() { return this }
  eq(key, value) { this.filters.push(row => row[key] === value); return this }
  in(key, values) { this.filters.push(row => values.includes(row[key])); return this }
  limit() { return this }
  maybeSingle() { this.singleRow = true; return this }
  single() { this.singleRow = true; return this }
  insert(value) { this.operation = 'insert'; this.value = value; return this }
  upsert(value) { this.operation = 'upsert'; this.value = value; return this }
  update(value) { this.operation = 'update'; this.value = value; return this }
  then(resolve, reject) {
    try {
      const table = tables[this.table]
      let rows = table.filter(row => this.filters.every(filter => filter(row)))
      if (this.operation === 'insert') table.push(this.value)
      if (this.operation === 'upsert') {
        const existing = table.find(row => row.user_id === this.value.user_id)
        if (existing) Object.assign(existing, this.value)
        else table.push(this.value)
      }
      if (this.operation === 'update') rows.forEach(row => Object.assign(row, this.value))
      resolve({ data: this.singleRow ? rows[0] ?? null : rows, error: null })
    } catch (error) { reject(error) }
  }
}
const client = {
  from: table => new Query(table),
  rpc: async (name, args) => {
    if (name === 'kouponly_credential_limit') return { data: !throttled, error: null }
    if (name === 'kouponly_vendor_login_id') return { data: Object.values(users).find(user => user.email === args.p_email)?.id ?? null, error: null }
    if (name === 'kouponly_consume_vendor_reset') {
      const row = tables.kouponly_vendor_recovery.find(row => row.reset_hash === args.p_hash && Date.parse(row.reset_expires_at) > Date.now())
      if (!row) return { data: null, error: null }
      row.reset_hash = null
      return { data: row.user_id, error: null }
    }
    throw new Error(`Unexpected RPC: ${name}`)
  },
  auth: {
    getUser: async token => ({ data: { user: users[token] ?? null }, error: users[token] ? null : new Error('Unauthorized') }),
    signInWithPassword: async () => ({ data: { user: null }, error: new Error('Incorrect password') }),
    signOut: async () => ({ error: null }),
    admin: {
      getUserById: async uid => ({ data: { user: users[uid] }, error: null }),
      updateUserById: async (uid, values) => {
        if (values.password) passwordUpdates.push({ uid, password: values.password })
        if (values.email) {
          users[uid].email = values.email
          users[uid].user_metadata = values.user_metadata
        }
        return { data: { user: users[uid] }, error: null }
      },
    },
  },
}
globalThis.__credentialTestClient = () => client
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'npm:@supabase/supabase-js@2') return { url: 'data:text/javascript,export const createClient = globalThis.__credentialTestClient;', shortCircuit: true }
  return next(specifier, context)
} })
globalThis.Deno = {
  env: { get: key => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test', RESEND_API_KEY: 'test', VENDOR_PANEL_URL: 'https://vendor.example.com' })[key] },
  serve: callback => { handler = callback },
}
globalThis.fetch = async (_url, options) => { emails.push(JSON.parse(options.body)); return new Response('{}', { status: 200 }) }
await import('../../supabase/functions/kouponly-vendor-credentials/index.ts')
async function call(action, data = {}, actor = '') {
  const response = await handler(new Request('https://test.supabase.co/credentials', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actor}` }, body: JSON.stringify({ action, data }),
  }))
  return { status: response.status, body: await response.json() }
}
assert.equal((await call('status')).status, 401)
assert.equal((await call('status', { vendorId: 'vendor-a' }, owner)).status, 403)
assert.equal((await call('changeUsername', { username: 'stolen' }, owner)).status, 403)
assert.equal((await call('setPassword', { password: 'a strong replacement' }, owner)).status, 403)
assert.equal((await call('enrollEmail', { email: 'new@example.com', currentPassword: 'wrong' }, owner)).status, 403)
assert.equal(emails.length, 0)
assert.equal((await call('sendReset', {}, owner)).status, 400)
assert.equal((await call('completeReset', { token: '0'.repeat(64), password: 'weak' })).status, 400)
assert.equal((await call('completeReset', { token: '0'.repeat(64), password: 'a strong replacement' })).status, 400)
assert.equal(passwordUpdates.length, 0)
assert.equal((await call('changeUsername', { vendorId: 'vendor-a', username: 'new owner' }, admin)).status, 200)
assert.equal(users[owner].email, await vendorAuthEmail('new owner'))
assert.equal((await call('setPassword', { vendorId: 'vendor-a', password: 'a strong replacement' }, admin)).status, 200)
assert.equal(passwordUpdates[0].uid, owner)
tables.kouponly_vendor_recovery.push({ user_id: owner, email: 'verified@example.com', verified_at: new Date().toISOString() })
assert.equal((await call('sendReset', { email: 'attacker@example.com' }, owner)).status, 200)
assert.deepEqual(emails[0].to, ['verified@example.com'])
const link = emails[0].text.match(/https:\/\/\S+/)[0]
const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token')
assert.equal(tables.kouponly_vendor_recovery[0].reset_hash, await sha256(token))
assert.ok(!JSON.stringify(tables).includes(token))
const attempts = await Promise.all([call('completeReset', { token, password: 'replacement password', userId: admin }), call('completeReset', { token, password: 'replacement password' })])
assert.deepEqual(attempts.map(result => result.status).sort(), [200, 400])
assert.equal(passwordUpdates.at(-1).uid, owner)
assert.equal(passwordUpdates.length, 2)
assert.deepEqual((await call('requestReset', { username: 'missing' })).body, (await call('requestReset', { username: 'new owner' })).body)
users[owner].email = 'legacy@example.com'
users[owner].user_metadata = {}
const beforeLegacy = emails.length
assert.equal((await call('requestReset', { username: 'LEGACY@example.com' })).status, 200)
assert.equal(emails.length, beforeLegacy + 1)
assert.equal((await call('status', {}, owner)).body.username, 'legacy@example.com')
throttled = true
assert.equal((await call('status', {}, owner)).status, 429)
assert.ok(tables.kouponly_credential_audit.every(row => !('password' in row) && !('token' in row)))
console.log('Edge handler authorization, verified recipient, reset replay, account isolation, enumeration, and rate-limit checks passed.')
