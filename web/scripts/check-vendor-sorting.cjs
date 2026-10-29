const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
let orders = [], range;
const query = {
  select: () => query, eq: () => query,
  order: (column, options) => { orders.push([column, options]); return query; },
  range: async (from, to) => { range = [from, to]; return { data: [], count: 0, error: null }; },
};
const source = path.resolve(__dirname, '../src/lib/vendor-directory.ts');
const compiled = new Module(source, module);
compiled.require = name => {
  if (name === '@/lib/supabase') return { supabase: { from: () => query } };
  if (name === 'zod') return require('zod');
  if (name === '@/lib/admin-read-logging') return { logAdminRead() {} };
  throw new Error(`Unexpected dependency: ${name}`);
};
compiled._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, source);
(async () => {
  const { vendorsSearchSchema, fetchVendorsPage } = compiled.exports;
  assert.equal(vendorsSearchSchema.parse({}).sort, 'latest');
  for (const [sort, column, ascending] of [['latest','created_at',false],['oldest','created_at',true],['name-asc','name',true],['name-desc','name',false]]) {
    orders = [];
    await fetchVendorsPage(vendorsSearchSchema.parse({ sort, page: 2 }), 'in_store');
    assert.deepEqual(orders, [[column, { ascending, nullsFirst: false }], ['id', undefined]]);
    assert.deepEqual(range, [10,19]);
  }
  console.log('Vendor default, all four sort orders and pagination: passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
