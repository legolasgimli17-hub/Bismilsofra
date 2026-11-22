import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('offline fallback is navigational only and never caches personal screens',()=>{
 const sw=read('apps/web/public/sw.js');
 assert.match(sw,/request\.mode==='navigate'/);
 assert.match(sw,/caches\.match\(OFFLINE\)/);
 assert.doesNotMatch(sw,/caches\.put\(/);
 assert.doesNotMatch(sw,/caches\.open\(.*\).*\.put\(/);
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
