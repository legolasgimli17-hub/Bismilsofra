/** Two isolated browser sessions against a disposable localhost API. */
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';

const fixture=JSON.parse(process.env.SOFRA_BROWSER_FIXTURE||'null');
assert(fixture,'An isolated browser fixture is required');
const base=new URL(fixture.base);
assert.equal(base.origin,'http://127.0.0.1:'+base.port);
assert.equal(base.href,base.origin+'/');
assert(base.port);
assert.notEqual(fixture.customer,fixture.owner);
const binary=process.env.CHROME_BINARY||['google-chrome','chromium','chromium-browser']
 .find(x=>spawnSync('which',[x]).status===0);
assert(binary,'Chromium not found');
const profile=await mkdtemp(join(tmpdir(),'sofra-two-browser-'));
const chrome=spawn(binary,['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
 '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let socket;
let messageId=0;
const pending=new Map();
async function command(method,params={},sessionId){
 const id=++messageId;
 return await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Chromium timeout: '+method))},12000);
  pending.set(id,result=>{clearTimeout(timer);if(result.error)reject(Error('Chromium rejected: '+method));else resolve(result.result)});
  socket.send(JSON.stringify({id,method,params,sessionId}));
 });
}
async function evaluate(sessionId,expression){
 const response=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);
 assert(!response.exceptionDetails,'Browser action failed');
 return response.result.value;
}
async function openBrowser(token,width,height){
 const {browserContextId}=await command('Target.createBrowserContext');
 const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
 const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true},sessionId);
 await command('Page.navigate',{url:base.origin+'/healthz'},sessionId);
 let navigated=false;
 for(let i=0;i<60;i++){
  try{navigated=await evaluate(sessionId,'location.origin')===base.origin}catch{}
  if(navigated)break;
  await delay(100);
 }
 assert(navigated,'Browser did not reach localhost API');
 const request=async(path,{method='GET',body,key}={})=>{
  const options={method,headers:{authorization:'Bearer '+token,
   ...(body?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},
   body:body?JSON.stringify(body):undefined};
  return await evaluate(sessionId,`(async()=>{
   const r=await fetch(${JSON.stringify(path)},{...${JSON.stringify(options)},signal:AbortSignal.timeout(5000)});
   return {status:r.status,body:await r.json()};
  })()`);
 };
 return {sessionId,request,browserContextId};
}
try{
 let endpoint;
 for(let i=0;i<100;i++){
  if(chrome.exitCode!==null)throw Error('Chromium did not start');
  try{
   const [port,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);
   if(port&&path){endpoint='ws://127.0.0.1:'+port+path;break}
  }catch{}
  await delay(100);
 }
 assert(endpoint,'Chromium DevTools endpoint missing');
 socket=new WebSocket(endpoint);
 await new Promise((resolve,reject)=>{
  socket.addEventListener('open',resolve,{once:true});
  socket.addEventListener('error',()=>reject(Error('Chromium connection failed')),{once:true});
 });
 socket.addEventListener('message',event=>{
  const payload=JSON.parse(event.data);
  const done=pending.get(payload.id);
  if(done){pending.delete(payload.id);done(payload)}
 });
 const [customer,merchant]=await Promise.all([
  openBrowser(fixture.customer,390,844),openBrowser(fixture.owner,360,800)
 ]);
 assert.notEqual(customer.browserContextId,merchant.browserContextId);
 await evaluate(customer.sessionId,"localStorage.setItem('sofra-rehearsal-session','customer')");
 assert.equal(await evaluate(merchant.sessionId,"localStorage.getItem('sofra-rehearsal-session')"),null);
 const rid=fixture.payload.restaurantId;
 const inbox='/v1/restaurant/'+rid+'/inbox';
 const address=await customer.request('/v1/me/addresses',{method:'POST',body:fixture.address});
 assert.equal(address.status,201);
 const payload={...fixture.payload,addressId:address.body.id};
 const quote=await customer.request('/v1/orders/quote',{method:'POST',body:payload});
 assert.equal(quote.status,200,'customer browser receives quote');
 const order=await customer.request('/v1/orders',{method:'POST',key:'ci-browser-'+randomUUID(),
  body:{...payload,confirmedTotalKurus:quote.body.totals.totalKurus}});
 assert.equal(order.status,201,'customer browser places test order');
 const id=order.body.id;
 const queue=await merchant.request(inbox);
 assert.equal(queue.status,200);
 assert(queue.body.pending.some(x=>x.id===id),'merchant browser sees pending order');
 for(const status of ['kabul_edildi','hazirlaniyor','hazir','yolda','teslim_edildi']){
  const next=await merchant.request('/v1/restaurant/'+rid+'/orders/'+id+'/status',{method:'POST',body:{to:status}});
  assert.equal(next.status,200,'merchant advances to '+status);
  const view=await customer.request('/v1/me/orders/'+id);
  assert.equal(view.status,200);
  assert.equal(view.body.order.status,status);
  assert.equal(view.body.order.total_kurus,quote.body.totals.totalKurus);
 }
 console.log('TWO_BROWSER_ORDER_PASS: quote, create, merchant inbox, 5 status transitions, customer tracking');
}finally{
 socket?.close();
 if(chrome.exitCode===null){
  const exited=once(chrome,'exit');
  chrome.kill('SIGTERM');
  await Promise.race([exited,delay(2000)]);
  if(chrome.exitCode===null){chrome.kill('SIGKILL');await exited}
 }
 await rm(profile,{recursive:true,force:true});
}
