/**
 * Real HTTP + PostgreSQL + cryptographic OIDC verifier integration.
 * Local JWKS is ONLY a test fixture. Does not prove live Auth0 configuration.
 * Requires a disposable localhost PostgreSQL database ending in _test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {exportJWK,generateKeyPair,SignJWT} from 'jose';
import {dispatchOutbox} from '../src/notification-service.ts';

const connection=process.env.INTEGRATION_DATABASE_URL;
if(!connection)throw Error('Only a disposable INTEGRATION_DATABASE_URL is allowed.');
const parsed=new URL(connection);
if(!parsed.pathname.endsWith('_test')||!['localhost','127.0.0.1'].includes(parsed.hostname))
 throw Error('Refusing non-local or non-test database.');

const rid='11111111-1111-4111-8111-111111111111';
const zid='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
const pid='33333333-3333-4333-8333-333333333333';
const extra='55555555-5555-4555-8555-555555555555';

async function freePort(){
 const listener=createServer();
 await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));
 const address=listener.address();if(!address||typeof address==='string')throw Error('No test port');
 const port=address.port;
 await new Promise<void>((resolve,reject)=>listener.close(err=>err?reject(err):resolve()));
 return port;
}
async function waitFor(base:string,child:ChildProcess){
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error('API exited before becoming ready, code='+child.exitCode);
  try{const r=await fetch(base+'/readyz',{signal:AbortSignal.timeout(1000)});if(r.ok)return}catch{}
  await new Promise(resolve=>setTimeout(resolve,130));
 }
 throw Error('Test API did not become ready.');
}

test('HTTP: verified JWT, owner MFA, real order, isolation, reconnect and durable notification retry', {timeout:60000},async t=>{
 const pool=new Pool({connectionString:connection,max:6});
 const {publicKey,privateKey}=await generateKeyPair('RS256',{extractable:true});
 const jwk={...(await exportJWK(publicKey)),kid:'ci-key',alg:'RS256',use:'sig'};
 const jwks=createServer((req,res)=>{
  if(req.url!=='/.well-known/jwks.json'){res.writeHead(404);res.end();return}
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({keys:[jwk]}));
 });
 await new Promise<void>(resolve=>jwks.listen(0,'127.0.0.1',resolve));
 const addr=jwks.address();if(!addr||typeof addr==='string')throw Error('No JWKS bind');
 const jwksPort=addr.port;
 const basePort=await freePort();
 const issuer='http://127.0.0.1:'+jwksPort+'/';
 const base='http://127.0.0.1:'+basePort;
 const audience='bismil-sofra-integration';
 let output='';
 const child=spawn(process.execPath,['--experimental-strip-types','apps/api/src/server.ts'],{
  cwd:process.cwd(),stdio:['ignore','pipe','pipe'],
  env:{...process.env,DATABASE_URL:connection,CORS_ORIGIN:'http://127.0.0.1:3000',
   OIDC_ISSUER:issuer,OIDC_AUDIENCE:audience,OIDC_JWKS_URL:issuer+'.well-known/jwks.json',
   PORT:String(basePort),NODE_ENV:'test'}
 });
 child.stdout?.on('data',x=>{output+=String(x).slice(-2000)});
 child.stderr?.on('data',x=>{output+=String(x).slice(-2000)});
 t.after(async()=>{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1000))]);
  if(child.exitCode===null)child.kill('SIGKILL');
  await pool.end();
  await new Promise<void>(resolve=>jwks.close(()=>resolve()));
 });
 try{await waitFor(base,child)}catch(e){throw Error(String(e)+' (server output: '+output.slice(-1000)+')')}
 const nonce=randomUUID();
 const subject=(who:string)=>'ci-http-'+nonce+'-'+who;
 const now=Math.floor(Date.now()/1000);
 const sign=async(who:string,claims:Record<string,unknown>={},secret=privateKey)=>
  new SignJWT({email:who+'@example.invalid',email_verified:true,...claims})
   .setProtectedHeader({alg:'RS256',kid:'ci-key'}).setSubject(subject(who))
   .setIssuer(issuer).setAudience(audience).setIssuedAt(now).setExpirationTime(now+120)
   .sign(secret);
 const customer=await sign('customer');
 const stranger=await sign('stranger');
 const owner=await sign('owner',{amr:['pwd','mfa'],auth_time:now});
 const noMfa=await sign('owner',{amr:['pwd'],auth_time:now});
 const unverified=await sign('unverified',{email_verified:false});
 const {privateKey:wrongKey}=await generateKeyPair('RS256');
 const forgery=await sign('forgery',{},wrongKey);
 type HttpResult={status:number;body:Record<string,any>};
 async function request(route:string,opts:{method?:string;token?:string;body?:unknown;headers?:Record<string,string>}={}):Promise<HttpResult>{
  const headers:Record<string,string>={...(opts.headers||{})};
  if(opts.token)headers.Authorization='Bearer '+opts.token;
  if(opts.body!==undefined)headers['Content-Type']='application/json';
  const res=await fetch(base+route,{method:opts.method||'GET',headers,
   body:opts.body===undefined?undefined:JSON.stringify(opts.body),signal:AbortSignal.timeout(4000)});
  return {status:res.status,body:await res.json() as Record<string,any>};
 }
 assert.equal((await request('/readyz')).status,200);
 assert.equal((await request('/v1/me/addresses')).status,401);
 assert.equal((await request('/v1/me/addresses',{token:forgery})).status,401);
 assert.equal((await request('/v1/me/addresses',{token:unverified})).status,403);
 assert.equal((await request('/v1/zones',{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await request('/v1/me/addresses',{token:customer})).status,200);
 assert.equal((await request('/v1/me/staff-restaurants',{token:noMfa})).status,403);
 assert.equal((await request('/v1/me/staff-restaurants',{token:owner})).status,200);
 const ownerRow=await pool.query('SELECT id FROM users WHERE oidc_subject=$1',[subject('owner')]);
 const ownerId=ownerRow.rows[0].id;
 await pool.query('INSERT INTO restaurant_staff(user_id,restaurant_id,role) VALUES($1,$2,$3)',[ownerId,rid,'owner']);
 const address=await request('/v1/me/addresses',{method:'POST',token:customer,
  body:{zoneId:zid,fullAddress:'CI Test Sokak 12 Daire 3',label:'Ev',phone:'05000000000',directions:'Kapının önünde'}});
 assert.equal(address.status,201,JSON.stringify(address.body));
 const addrId=address.body.id as string;
 const payload={restaurantId:rid,addressId:addrId,paymentMethod:'cash',items:[{productId:pid,quantity:1,optionIds:[extra]}],note:'Az acılı'};
 const quote=await request('/v1/orders/quote',{method:'POST',token:customer,body:payload});
 assert.equal(quote.status,200,JSON.stringify(quote.body));
 assert.equal(quote.body.totals.totalKurus,21500);
 const orderKey='ci-http-'+randomUUID();
 const stale=await request('/v1/orders',{method:'POST',token:customer,headers:{'Idempotency-Key':orderKey},
  body:{...payload,confirmedTotalKurus:21499}});
 assert.equal(stale.status,409);
 assert.equal(stale.body.code,'PRICE_CHANGED');
 const correct={...payload,confirmedTotalKurus:quote.body.totals.totalKurus};
 const placed=await request('/v1/orders',{method:'POST',token:customer,headers:{'Idempotency-Key':orderKey},body:correct});
 assert.equal(placed.status,201,JSON.stringify(placed.body));
 const orderId=placed.body.id as string;
 const retry=await request('/v1/orders',{method:'POST',token:customer,headers:{'Idempotency-Key':orderKey},body:correct});
 assert.equal(retry.status,200);
 assert.equal(retry.body.id,orderId);
 assert.equal((await request('/v1/me/orders/by-key/'+orderKey,{token:customer})).body.order.id,orderId);
 assert.equal((await request('/v1/me/orders/'+orderId,{token:customer})).status,200);
 assert.equal((await request('/v1/me/orders/'+orderId,{token:stranger})).status,404);
 assert.equal((await request('/v1/restaurant/'+rid+'/inbox',{token:noMfa})).status,403);
 assert.equal((await request('/v1/restaurant/'+rid+'/inbox',{token:customer})).status,403);
 const inbox=await request('/v1/restaurant/'+rid+'/inbox',{token:owner});
 assert.equal(inbox.status,200);
 assert.ok(inbox.body.pending.some((o:{id:string})=>o.id===orderId),'new order must appear in restaurant inbox');
 const detail=await request('/v1/restaurant/'+rid+'/orders/'+orderId,{token:owner});
 assert.equal(detail.status,200);
 assert.equal(detail.body.order.address_snapshot.address,'CI Test Sokak 12 Daire 3');
 const accepted=await request('/v1/restaurant/'+rid+'/orders/'+orderId+'/status',{
  method:'POST',token:owner,body:{to:'kabul_edildi'}});
 assert.equal(accepted.status,200,JSON.stringify(accepted.body));
 assert.equal((await request('/v1/me/orders/'+orderId,{token:customer})).body.order.status,'kabul_edildi');
 // Reconnect: a fresh authenticated HTTP request reconstructs the active inbox after network loss.
 const afterReconnect=await request('/v1/restaurant/'+rid+'/inbox',{token:owner});
 assert.equal(afterReconnect.status,200);
 assert.ok(afterReconnect.body.active.some((o:{id:string})=>o.id===orderId));
 const cancellation=await request('/v1/me/orders/'+orderId+'/cancel',{method:'POST',token:customer});
 assert.equal(cancellation.status,409);
 // Failed delivery stays durable and is delivered on the next attempt.
 const event=(await pool.query("SELECT id FROM notification_outbox WHERE order_id=$1 AND type='new_order'",[orderId])).rows[0];
 const eventId=String(event.id);
 let failOnce=true;
 const first=await dispatchOutbox(pool,async e=>{
  if(String(e.id)===eventId&&failOnce){failOnce=false;throw Error('CI simulated offline webhook')}
 },30);
 assert.ok(first.failed>=1);
 const failed=await pool.query('SELECT sent_at,attempts FROM notification_outbox WHERE id=$1',[eventId]);
 assert.equal(failed.rows[0].sent_at,null);
 assert.equal(failed.rows[0].attempts,1);
 await pool.query('UPDATE notification_outbox SET next_attempt_at=now() WHERE id=$1',[eventId]);
 const sent=await dispatchOutbox(pool,async()=>{},30);
 assert.ok(sent.sent>=1);
 const done=await pool.query('SELECT sent_at,attempts FROM notification_outbox WHERE id=$1',[eventId]);
 assert.ok(done.rows[0].sent_at);
 assert.equal(done.rows[0].attempts,2);
});
