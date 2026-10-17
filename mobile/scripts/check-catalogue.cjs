// Read-only parity check against the same public Supabase API used by mobile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const env = {...process.env};
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !env[match[1]]) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert(url && key, 'Mobile Supabase configuration is required');
const source = path.join(root, 'lib/vendor-catalogue.ts');
const compiled = new Module(source, module);
compiled._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, source);
const {projectVendorCatalogue} = compiled.exports;
async function request(endpoint, body) {
  const response = await fetch(`${url}/rest/v1/${endpoint}`, {method:body ? 'POST' : 'GET', headers:{apikey:key,'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {})});
  const result = await response.json();
  assert(response.ok, `${endpoint.split('?')[0]}: ${response.status} ${result.message || ''}`);
  return result;
}
(async () => {
  const [vendors, offers, locations, categories, subcategories, assignments] = await Promise.all([
    request('realx_vendors?select=*&status=eq.Active&order=sort_order'),
    request('realx_offers?select=*&order=sort_order'),
    request('realx_vendor_locations?select=*&order=sort_order'),
    request('realx_categories?select=*&active=eq.true&order=sort_order'),
    request('realx_subcategories?select=*&order=sort_order'),
    request('realx_vendor_subcategories?select=*'),
  ]);
  const embedded = await request('realx_vendors?select=*,realx_categories(name),realx_vendor_subcategories(subcategory_id,realx_subcategories(name))&status=eq.Active');
  assert.equal(embedded.length, vendors.length, 'Admin/mobile vendor count mismatch');
  const catalogue = projectVendorCatalogue(vendors, offers, locations, {categories,subcategories,assignments});
  const now = Date.now();
  const available = offers.filter(o => o.active && (!o.starts_at || Date.parse(o.starts_at) <= now) && (!o.ends_at || Date.parse(o.ends_at) > now));
  assert.equal(catalogue.deals.length, vendors.filter(v => categories.some(c => c.id === v.category_id) && available.some(o => o.vendor_id === v.id)).length);
  for (const deal of catalogue.deals) {
    const vendor = vendors.find(v => v.id === deal.vendorId);
    assert.equal(deal.name, vendor.name);
    assert.equal(deal.cardLabel, vendor.card_label?.trim() || undefined);
    assert.equal(deal.category, categories.find(c => c.id === vendor.category_id).name);
    assert.equal(deal.image, vendor.cover_image_url || vendor.image_url || vendor.logo_path || vendor.payload?.profilePicture || '');
    assert.equal(deal.description, vendor.description || vendor.payload?.shortDescription || available.find(o => o.vendor_id === vendor.id)?.description || '');
    const admin = embedded.find(v => v.id === vendor.id);
    assert.equal(admin.realx_categories.name, deal.category);
    assert.deepEqual([...deal.subcategoryIds].sort(), admin.realx_vendor_subcategories.map(s => s.subcategory_id).sort());
    assert.deepEqual(deal.galleryImages, vendor.gallery_images || []);
    assert.equal(deal.locations.length, locations.filter(l => l.vendor_id === vendor.id).length);
    for (const offer of deal.offers) {
      const row = offers.find(o => o.id === offer.id);
      assert.equal(offer.title, row.title);
      assert.equal(offer.description, row.description || '');
      assert.equal(offer.saving, row.saving_label || '');
      assert.equal(offer.logo, deal.logo);
      assert.equal(offer.terms, row.terms || undefined);
      assert.equal(offer.redemptionInstructions, row.redemption_instructions || undefined);
      assert(available.some(o => o.id === offer.id));
    }
  }
  const branch = locations.find(l => l.latitude != null && l.longitude != null);
  let nearby = [];
  if (branch) {
    nearby = await request('rpc/get_nearby_food_offers', {p_latitude:branch.latitude,p_longitude:branch.longitude});
    for (const row of nearby) {
      const deal = catalogue.deals.find(d => d.vendorId === row.vendor_id);
      assert(deal, 'Nearby offer has no matching mobile vendor');
      assert.equal(row.image_url, deal.image || null, 'Nearby image differs from catalogue cover');
      assert(deal.offers.some(o => o.id === row.offer_id && o.title === row.offer_title));
      assert(Number.isFinite(row.distance_km) && row.distance_km >= 0);
    }
  }
  const media = [...new Set([...vendors.flatMap(v => [v.cover_image_url,v.logo_path,...(v.gallery_images || [])]),...offers.map(o => o.image_url),...categories.map(c => c.image_path)].filter(u => typeof u === 'string' && u.startsWith(`${url}/storage/`)))];
  await Promise.all(media.map(async asset => {const response = await fetch(asset,{method:'HEAD'});assert(response.ok, `Uploaded image unavailable: ${response.status}`);assert(response.headers.get('content-type')?.startsWith('image/'), 'Uploaded media is not an image');}));
  console.log(JSON.stringify({project:new URL(url).host,vendors:vendors.length,mobileVendors:catalogue.deals.length,currentOffers:catalogue.offers.length,branches:locations.length,mainCategories:categories.length,subcategories:subcategories.length,assignments:assignments.length,categoryImages:categories.filter(c=>c.image_path).length,galleryImages:vendors.reduce((n,v)=>n+(v.gallery_images?.length||0),0),nearbyFoodOffers:nearby.length,uploadedImagesChecked:media.length,adminEmbedding:'passed',fieldParity:'passed'},null,2));
})().catch(error => {console.error(error.message);process.exitCode=1;});
