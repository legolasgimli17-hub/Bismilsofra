/** Two genuine local Fastify processes + signed JWT + disposable PostgreSQL.
 * 50/100/200 simultaneous authenticated checkout calls, retries, tenant checks,
 * SSE fanout and disconnected-client recovery. NEVER targets a remote host.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {Pool} from 'pg';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';

const url=process.env.INTEGRATION_DATABASE_URL;
if(!url)throw Error('INTEGRATION_DATABASE_URL missing');
const target=new URL(url);
if(!['localhost','127.0.0.1'].includes(target.hostname)||!target.pathname.endsWith('_test'))
 throw Error('Authenticated capacity suite refuses non-local / non-_test databases.');
const RID='11111111-1111-4111-8111-111111111111';
const ZID='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
const PID='33333333-3333-4333-8333-333333333333';
const EXTRA='55555555-5555-4555-8555-555555555555';
const SUBJECT_PREFIX='ci-http-capacity-';
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function port(){
 const s=createServer();
 await new Promise<void>(ok=>s.listen(0,'127.0.0.1',ok));
 const address=s.address();
 if(!address||typeof address==='string')throw Error('port unavailable');
 await new Promise<void>(ok=>s.close(()=>ok()));
 return address.port;
}
async function req(base:string,path:string,token?:string,body?:unknown,key?:string){
 const h:Record<string,string>={};
 if(token)h.Authorization='Bearer '+token;
 if(body!==undefined)h['Content-Type']='application/json';
 if(key)h['Idempotency-Key']=key;
 const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:h,
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 return {status:r.status,body:await r.json() as Record<string,any>,retryAfter:r.headers.get('retry-after')};
}
async function stop(child:ChildProcess){
 if(child.exitCode!==null)return;
 child.kill('SIGTERM');
 await Promise.race([new Promise<void>(resolve=>child.once('exit',()=>resolve())),sleep(4000)]);
 if(child.exitCode===null)child.kill('SIGKILL');
}
function latency(values:number[]){const sorted=[...values].sort((a,b)=>a-b);
 return {p50Ms:Math.round(sorted[Math.ceil(sorted.length*.5)-1]??0),
  p95Ms:Math.round(sorted[Math.ceil(sorted.length*.95)-1]??0),
  p99Ms:Math.round(sorted[Math.ceil(sorted.length*.99)-1]??0)};
}

test('50/100/200 independent authenticated HTTP checkouts on two API replicas with NAT sharing', {timeout:240000},async t=>{
 const db=new Pool({connectionString:url,max:12,connectionTimeoutMillis:8000});
 const {publicKey,privateKey}=await generateKeyPair('RS256',{extractable:true});
 const jwk={...(await exportJWK(publicKey)),kid:'load-jwk',alg:'RS256',use:'sig'};
 const jwks=createServer((request,response)=>{
  if(request.url!=='/.well-known/jwks.json'){response.writeHead(404);response.end();return}
  response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  response.end(JSON.stringify({keys:[jwk]}));
 });
 await new Promise<void>(ok=>jwks.listen(0,'127.0.0.1',ok));
 const keyAddress=jwks.address();
 if(!keyAddress||typeof keyAddress==='string')throw Error('JWKS listener missing');
 const issuer='http://127.0.0.1:'+keyAddress.port+'/';
 const audience='ci-capacity-fixture';
 const ports=[await port(),await port()];
 assert.notEqual(ports[0],ports[1]);
 const bases=ports.map(p=>'http://127.0.0.1:'+p);
 const logs=['',''];
 const servers=ports.map((p,i)=>{
  const child=spawn(process.execPath,['--experimental-strip-types','apps/api/src/server.ts'],{
   cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{
    ...process.env,DATABASE_URL:url,ORDER_EVENTS_LISTEN_DATABASE_URL:url,
    NODE_ENV:'test',PORT:String(p),API_BIND_HOST:'127.0.0.1',
    OIDC_ISSUER:issuer,OIDC_AUDIENCE:audience,OIDC_JWKS_URL:issuer+'.well-known/jwks.json',
    CORS_ORIGIN:'http://127.0.0.1:3000'
   }});
  child.stderr?.on('data',chunk=>logs[i]=(logs[i]+String(chunk)).slice(-2500));
  return child;
 });
 t.after(async()=>{
  await Promise.all(servers.map(stop));
  await db.end();
  await new Promise<void>(ok=>jwks.close(()=>ok()));
 });
 for(const [i,base] of bases.entries()){
  let up=false;
  for(let tries=0;tries<100;tries++){
   if(servers[i].exitCode!==null)throw Error('Fastify replica crashed: '+logs[i]);
   try{if((await fetch(base+'/readyz',{signal:AbortSignal.timeout(800)})).ok){up=true;break}}catch{}
   await sleep(150);
  }
  assert.ok(up,'local API replica '+i+' did not become ready: '+logs[i]);
 }
 const run=randomUUID();
 const count=200;
 const now=Math.floor(Date.now()/1000);
 const tokens=await Promise.all(Array.from({length:count},(_,i)=>new SignJWT({
  email:SUBJECT_PREFIX+i+'-'+run+'@example.invalid',email_verified:true})
  .setProtectedHeader({alg:'RS256',kid:'load-jwk'})
  .setIssuer(issuer).setAudience(audience).setSubject(SUBJECT_PREFIX+i+'-'+run)
  .setIssuedAt(now).setExpirationTime(now+600).sign(privateKey)));
 const registered=await Promise.all(tokens.map((jwt,i)=>req(bases[i%2],'/v1/me/addresses',jwt)));
 assert.equal(registered.filter(x=>x.status!==200).length,0,'signed onboarding cannot fail');
 const users=await Promise.all(Array.from({length:count},async(_,i)=>{
  const row=await db.query('SELECT id FROM users WHERE oidc_subject=$1',[SUBJECT_PREFIX+i+'-'+run]);
  assert.equal(row.rowCount,1);
  const address=await db.query(
   'INSERT INTO addresses(user_id,zone_id,full_address,phone) VALUES($1,$2,$3,$4) RETURNING id',
   [row.rows[0].id,ZID,'CI only HTTP capacity '+i,'05000000000']);
  return {id:row.rows[0].id as string,address:address.rows[0].id as string};
 }));
 const bodies=users.map(u=>({restaurantId:RID,addressId:u.address,paymentMethod:'cash',
  items:[{productId:PID,quantity:1,optionIds:[EXTRA]}],note:'CI local capacity test'}));
 const quotes=await Promise.all(tokens.map((jwt,i)=>req(bases[i%2],'/v1/orders/quote',jwt,bodies[i])));
 assert.ok(quotes.every(x=>x.status===200),'all 200 authenticated quotes must succeed: '+
  JSON.stringify(quotes.filter(x=>x.status!==200).slice(0,3)));
 const confirmed=bodies.map((b,i)=>({...b,confirmedTotalKurus:quotes[i].body.totals.totalKurus}));
 const all:{id:string;index:number;key:string}[]=[];
 for(const batch of [50,100,200]){
  const samples:number[]=[];
  const begin=performance.now();
  const writes=await Promise.all(Array.from({length:batch},async(_,i)=>{
   // For shared-NAT fairness, 200 distinct verified customers use one loopback IP.
   const n=i;
   const key='ci-capacity-'+randomUUID();
   const start=performance.now();
   const response=await req(bases[n%2],'/v1/orders',tokens[n],confirmed[n],key);
   samples.push(performance.now()-start);
   return {response,n,key};
  }));
  const rejected=writes.filter(x=>x.response.status!==201);
  assert.equal(rejected.length,0,'real signed checkouts: '+JSON.stringify(rejected.slice(0,3)));
  const records=writes.map(({response,n,key})=>({id:String(response.body.id),index:n,key}));
  assert.equal(new Set(records.map(x=>x.id)).size,batch,'one order per independent key');
  // A timeout or replica crash must never cause duplicate checkout.
  const again=await Promise.all(records.map(({index,key},j)=>
   req(bases[(index+1)%2],'/v1/orders',tokens[index],confirmed[index],key)));
  assert.ok(again.every((x,j)=>x.status===200&&x.body.replayed===true&&x.body.id===records[j].id),
   'cross-replica retries MUST return the original order ID');
  all.push(...records);
  const stats={scenario:'authenticated-checkout',concurrentCustomers:batch,apiReplicas:2,
   created:batch,replayed:batch,errors:0,durationMs:Math.round(performance.now()-begin),...latency(samples)};
  console.log(JSON.stringify(stats));
  assert.ok(stats.p95Ms<=25000,'local checkout p95 exceeds conservative CI 25s guard');
 }
 const orderIds=all.map(x=>x.id);
 const report=await db.query(`SELECT
  (SELECT count(*)::int FROM orders WHERE id=ANY($1::uuid[])) AS orders,
  (SELECT count(*)::int FROM order_events WHERE order_id=ANY($1::uuid[]) AND new_status='beklemede') AS events,
  (SELECT count(*)::int FROM notification_outbox WHERE order_id=ANY($1::uuid[]) AND type='new_order') AS outbox,
  (SELECT count(*)::int FROM restaurant_escalations WHERE order_id=ANY($1::uuid[])) AS fallback`,[orderIds]);
 for(const column of ['orders','events','outbox','fallback'])
  assert.equal(report.rows[0][column],350,'durable '+column+' must equal all 350 unique orders');
 const own=await req(bases[0],'/v1/me/orders/'+orderIds[0],tokens[all[0].index]);
 const denied=await req(bases[1],'/v1/me/orders/'+orderIds[0],tokens[199]);
 assert.equal(own.status,200);
 assert.equal(denied.status,404,'a distinct customer must never see the order');
 // Cross-replica shared account quota: repeatedly replay one valid request
 // until the 12/min cap is exhausted; no extra orders may be inserted.
 const first=all[0];
 let blocked=false,allowed=0;
 for(let i=0;i<15;i++){
  const r=await req(bases[i%2],'/v1/orders',tokens[first.index],confirmed[first.index],first.key);
  if(r.status===429){assert.equal(r.body.code,'RATE_LIMIT');assert.ok(r.retryAfter);blocked=true;break}
  assert.equal(r.status,200);
  assert.equal(r.body.id,first.id);
  allowed++;
 }
 assert.ok(blocked,'one identity must be throttled even when switching API replicas');
 // A different customer on the same NAT continues to work.
 const independent=await req(bases[1],'/v1/orders',tokens[199],confirmed[199],'ci-independent-'+randomUUID());
 assert.equal(independent.status,201,'shared NAT cannot block a separate verified customer');

 // Open real SSE streams, trigger targeted NOTIFY, then simulate mobile offline.
 const controllers=Array.from({length:200},()=>new AbortController());
 const readers:ReadableStreamDefaultReader<Uint8Array>[]=[];
 let sseOpen=0;
 try{
  const opened=await Promise.all(Array.from({length:200},async(_,i)=>{
   const r=await fetch(bases[i%2]+'/v1/me/orders/'+all.find(o=>o.index===i)!.id+'/events',{
    headers:{Authorization:'Bearer '+tokens[i],Accept:'text/event-stream'},
    signal:controllers[i].signal});
   if(r.status!==200)return {index:i,status:r.status};
   const reader=r.body!.getReader();
   readers[i]=reader;
   const ready=await reader.read();
   assert.match(new TextDecoder().decode(ready.value),/event: ready/);
   sseOpen++;
   return {index:i,status:r.status};
  }));
  assert.ok(opened.every(x=>x.status===200),'200 unique SSE subscriptions must connect on 2 replicas: '+
   JSON.stringify(opened.filter(x=>x.status!==200).slice(0,5)));
  const subscriber=0;
  await db.query('SELECT pg_notify($1,$2)',['bismil_order_events',
   JSON.stringify({restaurantId:RID,customerId:users[subscriber].id})]);
  let changed='';
  const timer=setTimeout(()=>controllers[subscriber].abort(),5000);
  try{
   for(let i=0;i<8;i++){
    const chunk=await readers[subscriber].read();
    if(chunk.done)break;
    changed+=new TextDecoder().decode(chunk.value);
    if(changed.includes('event: changed'))break;
   }
  }finally{clearTimeout(timer)}
  assert.match(changed,/event: changed/,'LISTEN fanout must reach its authenticated SSE subscriber');
  for(let i=0;i<20;i++)controllers[i].abort();
  await sleep(200);
  const snapshots=await Promise.all(Array.from({length:20},(_,i)=>
   req(bases[(i+1)%2],'/v1/me/orders/'+all.find(x=>x.index===i)!.id,tokens[i])));
  assert.ok(snapshots.every(x=>x.status===200),'offline reconnection must recover authoritative snapshots');
  console.log(JSON.stringify({scenario:'SSE-connect-disconnect-snapshot-recovery',
   openStreams:sseOpen,abortedStreams:20,recoveredSnapshots:20,errors:0}));
 }finally{
  controllers.forEach(c=>c.abort());
  await Promise.all(readers.filter(Boolean).map(reader=>reader.cancel().catch(()=>{})));
 }
});
