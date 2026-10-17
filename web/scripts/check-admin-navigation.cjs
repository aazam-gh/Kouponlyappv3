const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const source = path.resolve(__dirname, '../src/lib/admin-navigation.ts')
const compiled = new Module(source, module)
compiled._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, source)
const { matchesAdminPath, adminBreadcrumbs, homeContentLinks } = compiled.exports

assert.equal(matchesAdminPath('/admin/vendors/v/settings/offers', '/admin/vendors'), true)
assert.equal(matchesAdminPath('/admin/vendors/', '/admin/vendors'), true)
assert.equal(matchesAdminPath('/admin/vendors-old', '/admin/vendors'), false)
assert.equal(matchesAdminPath('/admin/transactions', '/admin/students'), false)
assert.deepEqual(adminBreadcrumbs('/admin/dashboard').map(c => c.title), ['Overview'])
assert.deepEqual(adminBreadcrumbs('/admin/transactions/receipt-id').map(c => c.title), ['Transactions', 'Transaction details'])
assert.deepEqual(adminBreadcrumbs('/admin/students/student-id/settings').map(c => c.title), ['Students', 'Student profile'])
assert.deepEqual(adminBreadcrumbs('/admin/vendors/vendor-id/settings/offers').map(c => c.title), ['Vendors & offers', 'Offers'])
assert.deepEqual(adminBreadcrumbs('/admin/cms/banners/add').map(c => c.title), ['Home content', 'Partner banners', 'Add new'])
assert.deepEqual(adminBreadcrumbs('/admin/cms/categories/food').map(c => c.title), ['Home content', 'Categories', 'Edit category'])
for (const link of homeContentLinks) {
  assert.deepEqual(adminBreadcrumbs(link.url + '/').map(c => c.title), ['Home content', link.title])
  assert.ok(fs.existsSync(path.resolve(__dirname, '../src/routes', link.url.slice(1), 'index.tsx')), `Missing route for ${link.url}`)
}
console.log('Admin navigation: nested links, path boundaries and breadcrumbs passed')
