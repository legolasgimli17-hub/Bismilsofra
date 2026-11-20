import test from 'node:test';
import assert from 'node:assert/strict';
import {RequestLimiter,trustedProxyCidrs} from '../src/rate-limit.ts';
test('untrusted forwarded header is disabled unless narrow CIDRs configured',()=>{
 assert.equal(trustedProxyCidrs(undefined),false);
 assert.deepEqual(trustedProxyCidrs('127.0.0.1,10.0.0.0/24'),['127.0.0.1/32','10.0.0.0/24']);
 for(const cidr of ['0.0.0.0/0','::/0','192.0.2.0/8','bad','1.2.3.4,,5.6.7.8'])
  assert.throws(()=>trustedProxyCidrs(cidr));
});
test('order quota resets after minute; read quota is independent',()=>{
 const limiter=new RequestLimiter();
 for(let i=0;i<12;i++)assert.equal(limiter.check('127.0.0.1','POST','/v1/orders',1000).allowed,true);
 assert.deepEqual(limiter.check('127.0.0.1','POST','/v1/orders',1000),
  {allowed:false,retryAfter:60,bucket:'order'});
 assert.equal(limiter.check('127.0.0.1','GET','/healthz',1000).allowed,true);
 assert.equal(limiter.check('127.0.0.1','POST','/v1/orders',61000).allowed,true);
});
test('query parameters do not bypass quota; IPs independent',()=>{
 const limiter=new RequestLimiter();
 for(let i=0;i<12;i++)limiter.check('one','POST','/v1/orders?random='+i,10);
 assert.equal(limiter.check('one','POST','/v1/orders?random=13',10).allowed,false);
 assert.equal(limiter.check('two','POST','/v1/orders',10).allowed,true);
 assert.equal(limiter.check('one','POST','/v1/orders/quote',10).allowed,true);
});
test('photo upload budget is narrower than regular reads',()=>{
 const limiter=new RequestLimiter();
 for(let i=0;i<8;i++)assert.equal(limiter.check('ip','POST','/v1/restaurant/r/photos',10).allowed,true);
 assert.equal(limiter.check('ip','POST','/v1/restaurant/r/photos',10).allowed,false);
 assert.equal(limiter.check('ip','GET','/v1/restaurants',10).allowed,true);
 assert.equal(limiter.check('ip','OPTIONS','/v1/orders',10).allowed,true);
});
test('memory bound blocks new keys until previous entries expire',()=>{
 const limiter=new RequestLimiter(2);
 assert.equal(limiter.check('one','GET','/x',0).allowed,true);
 assert.equal(limiter.check('two','GET','/x',0).allowed,true);
 assert.equal(limiter.check('three','GET','/x',0).allowed,false);
 assert.equal(limiter.size,2);
 assert.equal(limiter.check('three','GET','/x',61000).allowed,true);
 assert.equal(limiter.size,1);
});

test('account and personnel mutations have independent bounded budget',()=>{
 const guard=new RequestLimiter();
 const path='/v1/restaurant/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/team';
 for(let i=0;i<40;i++)assert.equal(guard.check('127.0.0.1','POST',path,100).allowed,true);
 const blocked=guard.check('127.0.0.1','PATCH',path+'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',100);
 assert.equal(blocked.allowed,false);assert.equal(blocked.bucket,'management');
 assert.equal(guard.check('127.0.0.1','POST','/v1/admin/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/access',100).allowed,false);
 assert.equal(guard.check('127.0.0.1','POST','/v1/me/addresses',100).allowed,true);
});

test('draft menu imports have independent strict write rate limit',()=>{
 const limiter=new RequestLimiter();
 const route='/v1/admin/restaurants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/menu-import';
 for(let i=0;i<12;i++)assert.equal(limiter.check('127.0.0.1','POST',route,100).allowed,true);
 const denied=limiter.check('127.0.0.1','POST',route,100);
 assert.equal(denied.allowed,false);
 assert.equal(denied.bucket,'import');
 assert.equal(limiter.check('127.0.0.1','POST','/v1/me/addresses',100).allowed,true);
});

test('customer address mutations have bounded account quota independent of checkout',()=>{
 const limiter=new RequestLimiter();
 const uri='/v1/me/addresses/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 for(let i=0;i<30;i++)assert.equal(limiter.check('127.0.0.1','PATCH',uri,100).allowed,true);
 assert.equal(limiter.check('127.0.0.1','POST',uri+'/archive',100).allowed,false);
 assert.equal(limiter.check('127.0.0.1','POST','/v1/me/addresses',100).bucket,'account');
 assert.equal(limiter.check('127.0.0.1','POST','/v1/orders',100).allowed,true);
});
