import test from 'node:test';
import assert from 'node:assert/strict';
import {safeAuthReturnTo} from './auth-redirect.ts';
test('after signing in, return only to same-site panels and safe query strings',()=>{
 assert.equal(safeAuthReturnTo('/checkout'),'/checkout');
 assert.equal(safeAuthReturnTo('/restaurant/overview'),'/restaurant/overview');
 assert.equal(safeAuthReturnTo('/admin?tab=alerts'),'/admin?tab=alerts');
 assert.equal(safeAuthReturnTo('/restaurant/manage#merchant-hours'),'/restaurant/manage#merchant-hours');
});
test('OIDC callback rejects protocol-relative, backslash and malformed redirects',()=>{
 for(const raw of [undefined,null,'','https://evil.example/','//evil.example','/..//evil.example','/%2e%2e//evil.example','/\\evil.example','\\evil.example','javascript:alert(1)','/\u000ahttps://evil.example',42,'/'.repeat(3000)])
  assert.equal(safeAuthReturnTo(raw),'/',String(raw));
});
