import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(relativePath, dependencies) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const context = { exports: {}, require: name => dependencies[name] }
  vm.runInNewContext(outputText, context)
  return context.exports
}

test('the vendor chart keeps earlier activity when only the end date is set', async () => {
  const points = [
    { date: '2026-11-03', redemptions: '1', revenue: '37' },
    { date: '2026-11-17', redemptions: '2', revenue: '64' },
  ]
  const { vendorChartDataQueryOptions } = load('../src/queries.ts', {
    '@tanstack/react-query': { queryOptions: options => options },
    '@/lib/supabase': { supabase: { rpc: async (name, args) => {
      assert.equal(name, 'couponly_vendor_dashboard_range')
      assert.equal(args.p_from, null)
      assert.equal(args.p_to, '2026-11-17')
      return { data: points }
    } } },
    '@/lib/constants': { STALE_TIME: {} },
    '@/lib/vendor-directory': {},
  })
  const rows = await vendorChartDataQueryOptions('vendor', '30d', '', '2026-11-17').queryFn()
  assert.equal(rows.length, 15)
  assert.equal(rows[0].date, '2026-11-03')
  assert.equal(rows[0].revenue, 37)
  assert.equal(rows[1].revenue, 0)
  assert.equal(rows.at(-1).date, '2026-11-17')
  assert.equal(rows.at(-1).revenue, 64)
})

test('banner writes reject stale edits and concurrent initial inserts', async () => {
  let document = null
  const table = {
    insert: async row => {
      if (document) return { error: { code: '23505' } }
      document = row.payload
      return { error: null }
    },
    update: ({ payload }) => {
      let revision
      const request = {
        eq(column, value) {
          if (column === 'id') assert.equal(value, 'banner')
          else {
            assert.equal(column, 'payload->>lastUpdated')
            revision = value
          }
          return request
        },
        is(column, value) { return request.eq(column, value) },
        select() { return request },
        async maybeSingle() {
          if (!document || (document.lastUpdated ?? null) !== revision) return { data: null, error: null }
          document = payload
          return { data: { id: 'banner' }, error: null }
        },
      }
      return request
    },
  }
  const { saveBannerDocument } = load('../src/lib/admin-cms.ts', {
    '@/lib/supabase': { supabase: { from: () => table } },
  })
  const first = await saveBannerDocument(null, [])
  await assert.rejects(saveBannerDocument(null, []), /changed in another session/)
  const newer = await saveBannerDocument(first, [{ bannerId: 'new' }])
  assert.ok(newer.lastUpdated > first.lastUpdated)
  await assert.rejects(saveBannerDocument(first, []), /changed in another session/)
  assert.equal(document.banners[0].bannerId, 'new')
  document = { banners: [], legacySetting: true }
  await saveBannerDocument(document, [{ bannerId: 'from-legacy' }])
  assert.equal(document.legacySetting, true)
  assert.equal(document.banners[0].bannerId, 'from-legacy')
})
