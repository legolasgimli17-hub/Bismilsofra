/** Two real Fastify processes, one real disposable PostgreSQL and a local
 * cryptographically signed JWKS. No production provider, customer or payment.
 *
 * This exercises cross-replica HTTP idempotency and PostgreSQL LISTEN fanout.
 * It does not prove shared distributed IP rate-limiting or public availability.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {exportJWK,generateKeyPair,SignJWT} from 'jose';

const connection=process.env.INTEGRATION_DATABASE_URL;
if(!connection)throw Error('INTEGRATION_DATABASE_URL is required.');
const address=new URL(connection);
if(!address.pathname.endsWith('_test')||!['127.0.0.1','localhost'].includes(address.hostname))
 throw Error('Refusing to test cross-replica writes on a non-local or non-_test database.');

const RID='11111111-1111-4111-8111-111111111111';
const ZID='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
const PID='33333333-3333-4333-8333-333333333333';
const EXTRA='55555555-5555-4555-8555-555555555555';

async function freePort(){
 const server=createServer();
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const a=server.address();
 if(!a||typeof a==='string')throw Error('No free port');
 await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 return a.port;
}
async function ready(base:string,child:ChildProcess,output:()=>string){
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error('Replica exited early: '+output().slice(-1300));
  try{
   const r=await fetch(base+'/readyz',{signal:AbortSignal.timeout(700)});
   if(r.ok)return;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,120));
 }
 throw Error('API replica did not become ready: '+output().slice(-1300));
}
async function request(base:string,path:string,token?:string,method='GET',body?:unknown,header?:string){
 const headers:Record<string,string>={};
 if(token)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']='application/json';
 if(header)headers['Idempotency-Key']=header;
 const r=await fetch(base+path,{method,headers,
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(9000)});
 return {status:r.status,body:await r.json() as Record<string,any>};
}
async function stopChild(child:ChildProcess){
 if(child.exitCode!==null)return;
 child.kill('SIGTERM');
 await Promise.race([
  new Promise<void>(resolve=>child.once('exit',()=>resolve())),
  new Promise<void>(resolve=>setTimeout(resolve,3000))
 ]);
 if(child.exitCode===null)child.kill('SIGKILL');
}
test('two HTTP API replicas preserve 10 real signed customer orders, cross-replica retries and SSE', {timeout:100000},async t=>{
 const pool=new Pool({connectionString:connection,max:10,connectionTimeoutMillis:6000});
 const {publicKey,privateKey}=await generateKeyPair('RS256',{extractable:true});
 const jwk={...(await exportJWK(publicKey)),kid:'replica-jwk',alg:'RS256',use:'sig'};
 const jwks=createServer((req,res)=>{
  if(req.url!=='/.well-known/jwks.json'){res.writeHead(404);res.end();return}
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({keys:[jwk]}));
 });
 await new Promise<void>(resolve=>jwks.listen(0,'127.0.0.1',resolve));
 const jwksAddress=jwks.address();
 if(!jwksAddress||typeof jwksAddress==='string')throw Error('Cannot bind local JWKS');
 const issuer='http://127.0.0.1:'+jwksAddress.port+'/';
 const audience='bismil-sofra-multireplica-fixture';
 const ports=await Promise.all([freePort(),freePort()]);
 if(ports[0]===ports[1])throw Error('Port collision');
 const origins=ports.map(port=>'http://127.0.0.1:'+port);
 const errors=['',''];
 const children=ports.map((port,index)=>{
  const child=spawn(process.execPath,['--experimental-strip-types','apps/api/src/server.ts'],{
   cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{
    ...process.env,DATABASE_URL:connection,ORDER_EVENTS_LISTEN_DATABASE_URL:connection,
    NODE_ENV:'test',API_BIND_HOST:'127.0.0.1',PORT:String(port),
    OIDC_ISSUER:issuer,OIDC_AUDIENCE:audience,OIDC_JWKS_URL:issuer+'.well-known/jwks.json',
    CORS_ORIGIN:'http://127.0.0.1:3000'
   }
  });
  child.stderr?.on('data',buffer=>{errors[index]=(errors[index]+String(buffer)).slice(-4000)});
  child.stdout?.on('data',buffer=>{errors[index]=(errors[index]+String(buffer)).slice(-4000)});
  return child;
 });
 t.after(async()=>{
  await Promise.all(children.map(stopChild));
  await pool.end();
  await new Promise<void>(resolve=>jwks.close(()=>resolve()));
 });
 await Promise.all(origins.map((url,i)=>ready(url,children[i],()=>errors[i])));
 const nonce=randomUUID();
 const now=Math.floor(Date.now()/1000);
 const tokens=await Promise.all(Array.from({length:10},(_,i)=>
  new SignJWT({email:'multi-replica-'+nonce+'-'+i+'@example.invalid',email_verified:true})
   .setProtectedHeader({alg:'RS256',kid:'replica-jwk'})
   .setIssuer(issuer).setAudience(audience)
   .setSubject('multi-replica-'+nonce+'-'+i)
   .setIssuedAt(now).setExpirationTime(now+240).sign(privateKey)
 ));
 // Real signed HTTP authentication on both servers auto-provisions each user.
 const provision=await Promise.all(tokens.map((jwt,i)=>
  request(origins[i%2],'/v1/me/addresses',jwt)));
 assert.ok(provision.every(x=>x.status===200),JSON.stringify(provision.filter(x=>x.status!==200)));
 const users=await Promise.all(tokens.map(async(_,i)=>{
  const subject='multi-replica-'+nonce+'-'+i;
  const user=await pool.query('SELECT id FROM users WHERE oidc_subject=$1',[subject]);
  assert.equal(user.rowCount,1,'signed user must provision exactly once');
  const address=await pool.query(
   'INSERT INTO addresses(user_id,zone_id,full_address,phone) VALUES($1,$2,$3,$4) RETURNING id',
   [user.rows[0].id,ZID,'CI-only multi-replica street '+i,'05000000000']);
  return {userId:user.rows[0].id as string,addressId:address.rows[0].id as string};
 }));
 const bodies=users.map(u=>({restaurantId:RID,addressId:u.addressId,paymentMethod:'cash',
  items:[{productId:PID,quantity:1,optionIds:[EXTRA]}],note:'CI replica test only'}));
 const quoted=await Promise.all(tokens.map((jwt,i)=>
  request(origins[i%2],'/v1/orders/quote',jwt,'POST',bodies[i])));
 for(const q of quoted)assert.equal(q.status,200,JSON.stringify(q.body));
 const confirmed=bodies.map((b,i)=>({...b,confirmedTotalKurus:quoted[i].body.totals.totalKurus}));
 const keys=tokens.map(()=>('replica-'+randomUUID()));
 const started=Date.now();
 const created=await Promise.all(tokens.map((jwt,i)=>
  request(origins[i%2],'/v1/orders',jwt,'POST',confirmed[i],keys[i])));
 for(const item of created)assert.equal(item.status,201,JSON.stringify(item.body));
 const ids=created.map(x=>String(x.body.id));
 assert.equal(new Set(ids).size,10,'independent customers must get distinct orders');
 const retry=await Promise.all(tokens.map((jwt,i)=>
  request(origins[(i+1)%2],'/v1/orders',jwt,'POST',confirmed[i],keys[i])));
 assert.ok(retry.every((x,i)=>x.status===200&&x.body.id===ids[i]&&x.body.replayed===true),
  'cross-replica POST replay must return the original order, never duplicate');
 const persisted=await pool.query('SELECT id FROM orders WHERE id=ANY($1::uuid[])',[ids]);
 assert.equal(persisted.rowCount,10);
 const outbox=await pool.query(
  "SELECT count(*)::int AS n FROM notification_outbox WHERE order_id=ANY($1::uuid[]) AND type='new_order'",[ids]);
 const fallback=await pool.query('SELECT count(*)::int AS n FROM restaurant_escalations WHERE order_id=ANY($1::uuid[])',[ids]);
 assert.equal(outbox.rows[0].n,10,'one durable first alert per checkout');
 assert.equal(fallback.rows[0].n,10,'one durable fallback per checkout');
 // Same customer may see their order on a different replica. Another
 // customer must never see its details, even through the other server.
 const owned=await request(origins[1],'/v1/me/orders/'+ids[0],tokens[0]);
 assert.equal(owned.status,200);
 const alien=await request(origins[0],'/v1/me/orders/'+ids[0],tokens[1]);
 assert.equal(alien.status,404,'database tenant check must survive replica crossover');
 // Both replicas hold separate LISTEN connections: a single committed DB
 // notification should invalidate two authenticated SSE streams.
 const controllers=[new AbortController(),new AbortController()];
 const streams:Response[]=[];
 const readers:ReadableStreamDefaultReader<Uint8Array>[]=[];
 try{
  for(let i=0;i<2;i++){
   const response=await fetch(origins[i]+'/v1/me/orders/'+ids[0]+'/events',{
    headers:{Authorization:'Bearer '+tokens[0],Accept:'text/event-stream'},signal:controllers[i].signal});
   assert.equal(response.status,200);
   streams.push(response);
   const reader=response.body!.getReader();
   readers.push(reader);
   assert.match(new TextDecoder().decode((await reader.read()).value),/event: ready/);
  }
  const signal=JSON.stringify({restaurantId:RID,customerId:users[0].userId});
  await pool.query('SELECT pg_notify($1,$2)',['bismil_order_events',signal]);
  async function changed(reader:ReadableStreamDefaultReader<Uint8Array>){
   let output='';
   for(let i=0;i<8;i++){
    const x=await reader.read();
    if(x.done)throw Error('SSE closed before change');
    output+=new TextDecoder().decode(x.value);
    if(output.includes('event: changed'))return output;
   }
   throw Error('No changed event from replica');
  }
  const timer=setTimeout(()=>controllers.forEach(c=>c.abort()),4000);
  try{
   const events=await Promise.all(readers.map(changed));
   for(const x of events){
    assert.match(x,/event: changed/);
    assert.doesNotMatch(x,/customerId|restaurantId|CI-only|token/i);
   }
  }finally{clearTimeout(timer)}
 }finally{
  controllers.forEach(c=>c.abort());
  await Promise.all(readers.map(reader=>reader.cancel().catch(()=>{})));
 }
 console.log(JSON.stringify({test:'two HTTP replicas, signed JWT, real PostgreSQL',
  parallelCheckouts:10,crossReplicaIdempotentRetries:10,errors:0,
  durableOutbox:10,durableFallback:10,sseOnTwoReplicas:true,
  elapsedMs:Date.now()-started}));
});
