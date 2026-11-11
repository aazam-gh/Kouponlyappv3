const FEED_HEADERS = {
  'Cache-Control': 'public, max-age=0, s-maxage=60',
  'Access-Control-Allow-Origin': '*',
}

function imageUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href
  } catch {}
}

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url)
  url.search = ''
  const key = new Request(url)
  const cached = await caches.default.match(key)
  if (cached) {
    const response = new Response(cached.body, cached)
    response.headers.set('X-Home-Cache', 'HIT')
    return response
  }

  try {
    const origin = new URL(env.SUPABASE_URL)
    const apiKey = env.SUPABASE_PUBLIC_KEY
    const legacy = typeof apiKey === 'string' && apiKey.startsWith('ey')
    const role = legacy ? JSON.parse(atob(apiKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role : undefined
    if (origin.protocol !== 'https:' || !(apiKey?.startsWith('sb_publishable_') || role === 'anon')) {
      throw new Error('Home feed needs a public Supabase key')
    }
    const signal = AbortSignal.timeout(4000)
    async function read(table, params) {
      const endpoint = new URL('/rest/v1/' + table, origin)
      endpoint.search = new URLSearchParams(params)
      const response = await fetch(endpoint, { headers: { apikey: apiKey, ...(legacy ? { Authorization: `Bearer ${apiKey}` } : {}) }, signal, redirect: 'manual' })
      if (!response.ok) throw new Error('Home feed upstream status ' + response.status)
      return response.json()
    }
    const [categories, documents] = await Promise.all([
      read('kouponly_categories', {
        select: 'id,name,image_path,english_name:payload->>nameEnglish,icon:payload->>icon',
        active: 'eq.true', order: 'sort_order,id',
      }),
      read('kouponly_cms_documents', { select: 'id,payload', id: 'in.(banner,homeLayout)' }),
    ])
    const layout = documents.find(row => row.id === 'homeLayout')?.payload
    const items = documents.find(row => row.id === 'banner')?.payload?.banners
    const banners = Array.isArray(items) ? items.flatMap(row => {
      if (row?.isActive !== true) return []
      const mobile = imageUrl(row.images?.mobile) ?? imageUrl(row.images?.desktop)
      if (!mobile) return []
      const dimensions = row.mobileDimensions
      return [{
        bannerId: typeof row.bannerId === 'string' ? row.bannerId : '',
        altText: typeof row.altText === 'string' ? row.altText : '',
        vendorId: typeof row.vendorId === 'string' ? row.vendorId : undefined,
        id: typeof row.id === 'string' ? row.id : undefined,
        vendorIds: Array.isArray(row.vendorIds) ? row.vendorIds.filter(id => typeof id === 'string') : undefined,
        images: { mobile }, isActive: true,
        mobileDimensions: Number.isInteger(dimensions?.width) && dimensions.width > 0
          && Number.isInteger(dimensions?.height) && dimensions.height > 0 ? { width: dimensions.width, height: dimensions.height } : undefined,
      }]
    }) : []
    const response = Response.json({
      version: 1,
      categories: categories.map(row => ({
        id: String(row.id), name: row.english_name || row.name,
        image: imageUrl(row.image_path), icon: row.icon || 'ShoppingBag',
      })),
      order: layout?.enabledSections ?? layout?.sectionOrder ?? null,
      banners,
    }, { headers: { ...FEED_HEADERS, 'X-Home-Cache': 'MISS' } })
    waitUntil(caches.default.put(key, response.clone()).catch(error => console.error('Home feed cache write failed', error)))
    return response
  } catch (error) {
    console.error('Home feed unavailable', error)
    return Response.json({ error: 'Home feed unavailable' }, {
      status: 503, headers: { ...FEED_HEADERS, 'Cache-Control': 'no-store' },
    })
  }
}
