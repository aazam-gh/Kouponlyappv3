import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function render() {
  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  workerUrl.searchParams.set('test', `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request('http://localhost/', { headers: { accept: 'text/html' } }), { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test('renders the Save-first Kouponly showcase', async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Save on what you love/);
  assert.match(html, /Go out/);
  assert.match(html, /Grow/);
  assert.match(html, /Coming soon/);
  assert.match(html, /Open account menu/);
  assert.match(html, /Browse by category/);
  assert.doesNotMatch(html, /Creator dashboard|Apply for this campaign|Creator earnings/i);
});

test('keeps web navigation, search, and saving wired without creator UI', async () => {
  const [page, css] = await Promise.all([readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'), readFile(new URL('../app/globals.css', import.meta.url), 'utf8')]);
  assert.match(page, /localStorage\.setItem\('kouponly-saved'/);
  assert.match(page, /function DealDetails/);
  assert.match(page, /function DealList/);
  assert.match(page, /aria-label="Search offers"/);
  assert.match(css, /\.sidebar-open/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(page, /campaign|earnings|creator/i);
});
