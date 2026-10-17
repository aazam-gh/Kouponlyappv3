// Exercise the direct Supabase vendor update path without changing live records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
let written;
const row = {payload:{offers:[{id:'existing-offer',titleEn:'Existing offer'}]}};
const client = {from:()=>({select:()=>({eq:()=>({single:async()=>({data:row,error:null})})}),update:value=>({eq:async()=>{written=value;return {error:null};}})})};
const source = path.resolve(__dirname,'../src/lib/vendor-directory.ts');
const compiled = new Module(source,module);
compiled.require = name => {
  if (name === '@/lib/supabase') return {supabase:client};
  if (name === 'zod') {
    const chain = { int(){return this}, min(){return this}, max(){return this}, catch(){return this} };
    return {z:{object:()=>({}),coerce:{number:()=>({...chain}),string:()=>({...chain})},string:()=>({...chain}),enum:()=>({...chain})}};
  }
  if (name === '@/lib/admin-read-logging') return {logAdminRead(){}};
  throw new Error(`Unexpected dependency: ${name}`);
};
compiled._compile(ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,source);
(async()=>{
  const {updateVendor} = compiled.exports;
  await updateVendor('vendor-check',{profilePicture:'new-logo',cardLabel:' Student favourite ',shortDescription:'new-description',isTrending:false,coverImage:'new-cover',galleryImages:['gallery-photo']});
  assert.equal(written.card_label,'Student favourite');
  assert.equal(written.logo_path,'new-logo');
  assert.equal(written.description,'new-description');
  assert.equal(written.featured,false);
  assert.equal(written.trend,0);
  assert.equal(written.cover_image_url,'new-cover');
  assert.deepEqual(written.gallery_images,['gallery-photo']);
  assert.equal(written.payload.offers[0].id,'existing-offer');
  row.trend=0;
  await updateVendor('vendor-check',{shortDescription:'',profilePicture:'',cardLabel:'',isTrending:true});
  assert.equal(written.card_label,null);
  assert.equal(written.description,'');
  assert.equal(written.logo_path,'');
  assert.equal(written.featured,true);
  assert.equal(written.trend,1);
  await updateVendor('vendor-check',{isTrending:true,trend:8,newest:7,sortOrder:3});
  assert.equal(written.trend,1);
  assert.equal(written.newest,7);
  assert.equal(written.sort_order,3);
  await assert.rejects(updateVendor('vendor-check',{newest:-1}),/non-negative whole numbers/);
  await assert.rejects(updateVendor('vendor-check',{sortOrder:0.5}),/non-negative whole numbers/);
  await assert.rejects(updateVendor('vendor-check',{cardLabel:'x'.repeat(33)}),/32 characters/);
  console.log('Admin Supabase vendor writes, empty-field clearing, and field validation: passed');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
