import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onRequestGet } from '../functions/home.json.js'

test('publishes only public active cards, caches by path, and does not cache errors', async t => {
  const store = new Map()
  const originalCaches = globalThis.caches
  globalThis.caches = { default: {
    match: async request => store.get(request.url)?.clone(),
    put: async (request, response) => store.set(request.url, response),
  } }
  t.after(() => { globalThis.caches = originalCaches })
  const upstream = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.headers.apikey, 'sb_publishable_fixture')
    return Response.json(url.pathname.endsWith('categories')
      ? [{ id: 'food', name: 'Food', image_path: 'https://img.example/tile.webp', privateField: 'hidden' }]
      : [{ id: 'homeLayout', payload: { enabledSections: ['categories', 'partner-banners'] } },
         { id: 'banner', payload: { banners: [
           { bannerId: 'a', isActive: true, images: { mobile: 'https://img.example/banner.webp' }, mobileDimensions: { width: 900, height: 600, privateField: 'hidden' } },
           { bannerId: 'b', isActive: false, images: { mobile: 'https://img.example/hidden.webp' } },
         ] } }])
  })
  const env = { SUPABASE_URL: 'https://db.example', SUPABASE_PUBLIC_KEY: 'sb_publishable_fixture' }
  const get = path => onRequestGet({ request: new Request('https://dashboard.example' + path), env, waitUntil() {} })
  const response = await get('/home.json')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Cache-Control'), /s-maxage=60/)
  const feed = await response.json()
  assert.deepEqual(feed.order, ['categories', 'partner-banners'])
  assert.deepEqual(feed.banners.map(row => row.bannerId), ['a'])
  assert.deepEqual(feed.banners[0].mobileDimensions, { width: 900, height: 600 })
  assert.equal(feed.categories[0].privateField, undefined)
  assert.deepEqual(await (await get('/home.json?arbitrary=1')).json(), feed)
  assert.equal(upstream.mock.callCount(), 2)
  store.clear()
  upstream.mock.mockImplementation(async () => new Response(null, { status: 500 }))
  const failed = await get('/home.json')
  assert.equal(failed.status, 503)
  assert.equal(failed.headers.get('Cache-Control'), 'no-store')
  assert.equal(store.size, 0)
})
