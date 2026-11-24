import {runInNewContext} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('offline lookup is scoped and customer screens are never cached', async () => {
 const handlers = new Map();
 const reads = [];
 const caches = {
  async match(key, options) {
   reads.push({key, cacheName: options?.cacheName});
   return 'offline page';
  }
 };
 let connected = false;
 runInNewContext(read('apps/web/public/sw.js'), {
  self: {location: {origin: 'https://sofra.test'}, addEventListener: (name, handler) => handlers.set(name, handler)},
  URL, caches, Response,
  fetch: async () => {
   if (!connected) throw Error('offline');
   return 'online page';
  }
 });
 function request(path, mode, method = 'GET') {
  let response;
  handlers.get('fetch')({
   request: {url: 'https://sofra.test' + path, method, mode},
   respondWith: promise => { response = promise; }
  });
  return response;
 }
 assert.equal(await request('/orders', 'navigate'), 'offline page');
 assert.equal(reads[0].key, '/offline.html');
 assert.match(reads[0].cacheName, /^bismil-sofra-static-/);
 assert.equal(request('/v1/orders', 'cors', 'POST'), undefined);
 assert.equal(request('/v1/me/addresses', 'cors'), undefined);
 connected = true;
 assert.equal(await request('/orders', 'navigate'), 'online page');
 assert.equal(reads.length, 1);
});
test('offline page warns against duplicate order submission',()=>{
 const html=read('apps/web/public/offline.html');
 assert.match(html,/Siparişlerim/);
 assert.match(html,/siparişi tekrar tekrar gönderme/);
 assert.doesNotMatch(html,/token|auth0|access_token/i);
});
test('accessible recovery pages and skip-to-content are present',()=>{
 const err=read('apps/web/app/error.tsx');
 const fatal=read('apps/web/app/global-error.tsx');
 const missing=read('apps/web/app/not-found.tsx');
 const shell=read('apps/web/components/shell.tsx');
 assert.match(err,/role="alert"/);
 assert.match(err,/onClick=\{reset\}/);
 assert.match(fatal,/role="alert"/);
 assert.match(missing,/404/);
 assert.match(shell,/href="#main-content"/);
 assert.match(shell,/id="main-content"/);
});
