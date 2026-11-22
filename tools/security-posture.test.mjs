/** Security invariants that must not quietly regress in a refactor.
 * Source assertions supplement (not replace) real HTTP/PG tests and a
 * professional independent security assessment.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('authentication verifies issuer, audience and a strict JWT signature algorithm list',()=>{
 const src=read('apps/api/src/auth.ts');
 assert.match(src,/jwtVerify\(token,jwks,\{issuer,audience,algorithms:/);
 assert.doesNotMatch(src,/algorithms:\s*\[[^\]]*['"]none['"]/i);
 assert.match(src,/requireVerifiedEmail\(ident\)/);
 assert.match(src,/!identity\.amr\.includes\('mfa'\)/);
});
test('customer-identifiable PostgreSQL error details never enter raw exception logging',()=>{
 const src=read('apps/api/src/server.ts');
 assert.doesNotMatch(src,/req\.log\.error\(\{err:error\}/);
 assert.match(src,/requestId:req\.id,errorType:/);
 assert.match(src,/reply\.code\(500\)\.send\(\{code:'INTERNAL_ERROR'/);
});
test('shared authenticated quota is database atomic and not keyed by a public IP',()=>{
 const src=read('apps/api/src/shared-order-limiter.ts');
 const migration=read('apps/api/sql/014_customer_order_quotas.sql');
 const server=read('apps/api/src/server.ts');
 assert.match(src,/ON CONFLICT \(user_id,window_start\) DO UPDATE/);
 assert.match(src,/WHERE customer_order_quotas\.hits<\$2/);
 assert.match(migration,/PRIMARY KEY \(user_id,window_start\)/);
 assert.doesNotMatch(migration,/email|phone|ip_address|access_token/i);
 assert.match(server,/await checkSharedOrderQuota\(pool,userId\)/);
});
test('production intake and container staging remain closed until external launch checks',()=>{
 const guard=read('apps/api/src/runtime-guard.ts');
 const compose=read('deploy/staging.compose.yml');
 assert.match(guard,/PILOT_ACCEPT_ORDERS!=='true'/);
 assert.match(compose,/PILOT_ACCEPT_ORDERS: "false"/);
 assert.match(compose,/127\.0\.0\.1:4188:4000/);
 assert.match(compose,/127\.0\.0\.1:8443:8443/);
});
