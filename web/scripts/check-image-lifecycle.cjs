const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/upload.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText

async function check(mode, versioned = true) {
  const revoked = []
  const uploads = []
  let image
  const bucket = {
    upload: async (...args) => { uploads.push(args); return { error: mode === 'upload-error' ? new Error('Storage unavailable') : null } },
    getPublicUrl: path => ({ data: { publicUrl: `https://images.example.test/${path}` } }),
  }
  const WebURL = class extends URL {
    static createObjectURL() { return 'blob:test' }
    static revokeObjectURL(value) { revoked.push(value) }
  }
  const context = {
    exports: {},
    require: () => ({ supabase: { storage: { from: () => bucket } } }),
    crypto: { randomUUID: () => 'test-id' },
    URL: WebURL,
    Image: class {
      width = 100
      height = 200
      constructor() { image = this }
    },
    document: {
      createElement: () => ({
        getContext: () => mode === 'canvas-error' ? null : { drawImage() {} },
        toBlob: done => done(mode === 'blob-error' ? null : { type: 'image/webp' }),
      }),
    },
  }
  vm.runInNewContext(source, context)
  const pending = context.exports.uploadImageWithDimensions('banners/photo.png', {}, { maxWidth: 100, versioned })
  if (mode === 'decode-error') image.onerror()
  else image.onload()
  if (mode === 'success') {
    const result = await pending
    assert.equal(result.width, versioned ? 50 : 100)
    assert.equal(result.height, versioned ? 100 : 200)
    assert.equal(uploads[0][0], versioned ? 'banners/photo-test-id.webp' : 'banners/photo.webp')
    assert.equal(uploads[0][2].contentType, 'image/webp')
    assert.equal(uploads[0][2].upsert, !versioned)
    assert.equal(new URL(result.url).searchParams.has('v'), !versioned)
  } else {
    await assert.rejects(pending)
    assert.equal(uploads.length, mode === 'upload-error' ? 1 : 0)
  }
  assert.deepEqual(revoked, ['blob:test'])
}

;(async () => {
  await check('success', false)
  for (const mode of ['success', 'decode-error', 'canvas-error', 'blob-error', 'upload-error']) await check(mode)
  console.log('Image upload dimensions, storage and object URL cleanup passed')
})().catch(error => { console.error(error); process.exitCode = 1 })
