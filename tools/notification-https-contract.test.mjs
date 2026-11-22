/** No-cost REAL HTTPS socket contract test for primary + fallback webhook senders.
 * Self-signed localhost certificates and fictional order IDs only.
 * This does NOT imply any third-party provider accepted an alert.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const SECRET='ci-only-webhook-contract-secret-please-change';
const validId='a0ff2026-1010-4010-8010-a0ff20261010';
const orderId='11111111-1111-4111-8111-111111111111';
const restaurantId='22222222-2222-4222-8222-222222222222';

if(process.env.SOFRA_LOCAL_WEBHOOK_CHILD==='yes'){
 // NODE_EXTRA_CA_CERTS is loaded at process startup; never disable TLS checking.
 const {createSignedWebhook}=await import('../apps/api/src/notification-service.ts');
 const e={id:validId,order_id:orderId,restaurant_id:restaurantId,type:'new_order',
  payload:{orderId,kind:'fictional_test'},attempts:0};
 const primary=createSignedWebhook(process.env.SOFRA_PRIMARY_TEST_URL,SECRET);
 const fallback=createSignedWebhook(process.env.SOFRA_FALLBACK_TEST_URL,SECRET);
 await primary(e);
 await primary(e); // at-least-once delivery -> receiver must dedupe
 let rejected=false;
 try{await primary({...e,id:'primary-fails'})}catch{rejected=true}
 if(!rejected)throw Error('Non-2xx provider response must reject delivery');
 await fallback({...e,id:'escalation:'+validId,type:'pending_order_escalation'});
 const bad=await fetch(process.env.SOFRA_PRIMARY_TEST_URL,{
  method:'POST',headers:{'content-type':'application/json','x-sofra-event-id':'bad','x-sofra-signature':'sha256='+'0'.repeat(64)},
  body:JSON.stringify({eventId:'bad',orderId}),signal:AbortSignal.timeout(3000),redirect:'error'});
 if(bad.status!==401)throw Error('Tampered signature was accepted');
 process.stdout.write('SIGNED_HTTPS_PROVIDER_CONTRACT_OK\n');
}else{
 test('real localhost HTTPS accepts signed payloads, rejects tampering, dedupes retry and fails over', {timeout:50000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'sofra-webhook-tls-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const cert=join(dir,'cert.pem'),key=join(dir,'key.pem');
  const gen=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes',
   '-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost',
   '-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{encoding:'utf8',timeout:18000});
  assert.equal(gen.status,0,'openssl must produce disposable HTTPS fixture');
  const tls={key:readFileSync(key),cert:readFileSync(cert)};
  function makeReceiver({failOnSpecial=false}={}){
   const state={requests:0,accepted:new Set(),bad:0,rejected:0};
   const server=createServer(tls,(req,res)=>{
    if(req.method!=='POST'){res.writeHead(405);res.end();return}
    const chunks=[];
    let size=0;
    req.on('data',chunk=>{size+=chunk.length;if(size>65536){req.destroy();return}chunks.push(chunk)});
    req.on('end',()=>{
     state.requests++;
     const body=Buffer.concat(chunks);
     const sig=req.headers['x-sofra-signature'];
     const expected='sha256='+createHmac('sha256',SECRET).update(body).digest('hex');
     const ok=typeof sig==='string'&&Buffer.byteLength(sig)===Buffer.byteLength(expected)&&
      timingSafeEqual(Buffer.from(sig),Buffer.from(expected));
     if(!ok){state.bad++;res.writeHead(401);res.end('invalid');return}
     let payload;
     try{payload=JSON.parse(body.toString('utf8'))}catch{res.writeHead(400);res.end();return}
     if(req.headers['x-sofra-event-id']!==payload.eventId){res.writeHead(400);res.end();return}
     if(failOnSpecial&&payload.eventId==='primary-fails'){
      state.rejected++;res.writeHead(503);res.end('receiver unavailable');return
     }
     state.accepted.add(payload.eventId);
     res.writeHead(200);res.end('accepted');
    });
   });
   return {server,state};
  }
  const primary=makeReceiver({failOnSpecial:true});
  const fallback=makeReceiver();
  t.after(async()=>{
   await Promise.all([primary.server,fallback.server].map(s=>new Promise(resolve=>s.close(resolve))));
  });
  async function listen(server){
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   const addr=server.address();
   assert.ok(addr&&typeof addr==='object');
   return 'https://127.0.0.1:'+addr.port+'/hook';
  }
  const primaryUrl=await listen(primary.server);
  const fallbackUrl=await listen(fallback.server);
  const child=spawn(process.execPath,['--experimental-strip-types',new URL(import.meta.url).pathname],{
   cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{...process.env,SOFRA_LOCAL_WEBHOOK_CHILD:'yes',
    NODE_EXTRA_CA_CERTS:cert,SOFRA_PRIMARY_TEST_URL:primaryUrl,SOFRA_FALLBACK_TEST_URL:fallbackUrl}});
  let stdout='',stderr='';
  child.stdout.on('data',chunk=>stdout=(stdout+String(chunk)).slice(-1500));
  child.stderr.on('data',chunk=>stderr=(stderr+String(chunk)).slice(-1500));
  const exit=await Promise.race([
   new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal}))),
   new Promise((_,reject)=>setTimeout(()=>{child.kill('SIGKILL');reject(Error('Fixture child timed out'))},25000))
  ]);
  assert.equal(exit.code,0,'HTTPS worker subprocess failed '+stderr);
  assert.match(stdout,/SIGNED_HTTPS_PROVIDER_CONTRACT_OK/);
  assert.equal(primary.state.requests,4,'duplicate + failed delivery + bad signature');
  assert.equal(primary.state.accepted.size,1,'recipient persists a deduped event ID');
  assert.equal(primary.state.rejected,1,'primary failure must not be accepted');
  assert.equal(primary.state.bad,1,'invalid HMAC rejected');
  assert.equal(fallback.state.requests,1);
  assert.equal(fallback.state.accepted.size,1);
  console.log(JSON.stringify({scenario:'real-loopback-HTTPS-signed-webhook-contract',primaryRequests:4,
   fallbackRequests:1,acceptedUniquePrimary:1,acceptedUniqueFallback:1,tamperingRejected:true,
   errors:0,provider:'LOCAL_FIXTURE_NOT_THIRD_PARTY'}));
 });
}
