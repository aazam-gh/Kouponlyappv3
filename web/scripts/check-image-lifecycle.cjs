const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/upload.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
async function check(mode) {
  const revoked=[]; let image;
  const context={exports:{},require:()=>({}),Promise,Error,File:class File{},Image:class Image{constructor(){image=this;}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:value=>revoked.push(value)},document:{createElement:()=>({getContext:()=>mode==='canvas-error'?null:{drawImage(){}},toBlob:done=>done(mode==='blob-error'?null:{})})}};
  vm.runInNewContext(source,context);
  const promise=context.exports.compressImage({},100,0.8);
  if(mode==='decode-error')image.onerror();else image.onload();
  if(mode==='success')await promise;else await assert.rejects(promise);
  assert.deepEqual(revoked,['blob:test']);
}
(async()=>{for(const mode of ['success','decode-error','canvas-error','blob-error'])await check(mode);console.log('PASS: image URL released on success and every failure path');})().catch(error=>{console.error(error);process.exitCode=1;});
