// Run with node web/scripts/check-vendor-credentials.mjs.
import assert from 'node:assert/strict'
import { credentialLink, recoveryEmail, sha256, validatePassword, validateUsername, vendorAuthEmail } from '../../supabase/functions/_shared/vendor-credentials.ts'

assert.equal(validateUsername('Café.Owner+1'), 'Café.Owner+1')
for (const value of ['', ' padded', 'padded ', 'user\nname', 'x'.repeat(129), null]) assert.throws(() => validateUsername(value))
assert.equal(validatePassword('spaces are allowed'), 'spaces are allowed')
for (const value of ['', '12345678901', 'x'.repeat(129), null]) assert.throws(() => validatePassword(value))
assert.equal(recoveryEmail(' Owner@Example.com '), 'owner@example.com')
for (const value of ['not-email', 'a@vendor.kouponly.invalid', 'a\nb@example.com', null]) assert.throws(() => recoveryEmail(value))
assert.equal(await vendorAuthEmail('vendor'), `${await sha256('vendor')}@vendor.kouponly.invalid`)
assert.notEqual(await vendorAuthEmail('Vendor'), await vendorAuthEmail('vendor'))
const link = new URL(credentialLink('https://vendors.example.com/old?secret=1#old', 'reset', 'abc123'))
assert.equal(link.pathname, '/credentials')
assert.equal(link.search, '')
assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), 'abc123')
assert.throws(() => credentialLink('http://evil.example', 'reset', 'token'))
assert.equal(new URL(credentialLink('http://localhost:3002', 'verify', 'token')).port, '3002')
console.log('Vendor credential input and secret-link checks passed.')
