/** Chromium CDP viewport and accessibility smoke with screenshots. Local-only.
 * Browser emulation != physical phone validation. No external target accepted.
 */
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const target=new URL(process.env.MOBILE_TEST_BASE_URL||'http://127.0.0.1:3180');
if(target.protocol!=='http:'||!['localhost','127.0.0.1'].includes(target.hostname)||
 !target.port||target.pathname!=='/'||target.username||target.password||target.hash||target.search)
 throw Error('Mobile QA refuses non-local HTTP targets.');
const output=process.env.MOBILE_SCREENSHOT_DIR||'/tmp/sofra-mobile-shots';
mkdirSync(output,{recursive:true});
const binary=process.env.CHROME_BINARY||['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(name=>spawnSync('which',[name]).status===0);
if(!binary)throw Error('Chromium not installed; cannot assert browser QA passed.');
const profile=mkdtempSync(join(tmpdir(),'sofra-browser-'));
const chrome=spawn(binary,['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
 '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let errors='';
chrome.stderr?.on('data',chunk=>errors=(errors+String(chunk)).slice(-1000));
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
let socket;
let seq=0;
const callbacks=new Map();
function send(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++seq;
  const timer=setTimeout(()=>{callbacks.delete(id);reject(Error('Chrome CDP timeout: '+method))},20000);
  callbacks.set(id,{ok:value=>{clearTimeout(timer);resolve(value)},fail:e=>{clearTimeout(timer);reject(e)}});
  socket.send(JSON.stringify({id,method,params}));
 });
}
// Exercise the shipped worker in a disposable same-origin fixture. Closing
// individual HTTP connections lets the worker see a real network failure.
async function checkOfflineRecovery() {
 const worker = readFileSync(new URL('../apps/web/public/sw.js', import.meta.url));
 const offline = readFileSync(new URL('../apps/web/public/offline.html', import.meta.url));
 let connected = true;
 const server = createServer((request, response) => {
  if (!connected) { request.socket.destroy(); return; }
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/sw.js') {
   response.setHeader('Content-Type', 'text/javascript');
   response.end(worker);
  } else if (request.url === '/offline.html') {
   response.setHeader('Content-Type', 'text/html; charset=utf-8');
   response.end(offline);
  } else {
   response.setHeader('Content-Type', 'text/html');
   response.end('<h1>Online</h1>');
  }
 });
 await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
 });
 const origin = 'http://127.0.0.1:' + server.address().port;
 async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
 }
 async function waitForPage(path, heading) {
  for (let attempt = 0; attempt < 80; attempt++) {
   if (await evaluate('location.href') === origin + path &&
       await evaluate("document.querySelector('h1')?.textContent") === heading) return;
   await delay(100);
  }
  throw Error('Offline recovery did not reach ' + path + ' with heading ' + heading);
 }
 try {
  await send('Page.navigate', {url:origin + '/'});
  await waitForPage('/', 'Online');
  await evaluate(`(async () => {
   const other = await caches.open('unrelated-app');
   await other.put('/offline.html', new Response('Other application'));
   await caches.open('bismil-sofra-static-v09');
   const claimed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
   await navigator.serviceWorker.register('/sw.js');
   await claimed;
   return true;
  })()`);
  const names = await evaluate('caches.keys()');
  assert.ok(names.includes('unrelated-app') && !names.includes('bismil-sofra-static-v09'));
  connected = false;
  await send('Page.navigate', {url:origin + '/checkout'});
  await waitForPage('/checkout', 'İnternet bağlantısı kurulamadı');
  connected = true;
  await evaluate("setTimeout(() => document.querySelector('button').click(), 0); true");
  await waitForPage('/checkout', 'Online');
  console.log('PWA_OFFLINE_RECOVERY_PASS');
 } finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
 }
}
async function run(){
 let wsUrl;
 // GitHub's shared runner can spend >10s starting Chromium while Docker
 // integration jobs compete for CPU. Keep failing closed, but avoid a flaky
 // false negative before Chrome has had reasonable startup opportunity.
 for(let i=0;i<400;i++){
  if(chrome.exitCode!==null)throw Error('Chrome exited: '+errors);
  const filename=join(profile,'DevToolsActivePort');
  if(existsSync(filename)){
   const port=readFileSync(filename,'utf8').split('\n')[0];
   try{
    const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    wsUrl=targets.find(x=>x.type==='page')?.webSocketDebuggerUrl;
    if(wsUrl)break;
   }catch{}
  }
  await delay(150);
 }
 if(!wsUrl)throw Error('Chromium remote debugging unavailable after bounded startup checks: '+errors);
 socket=new WebSocket(wsUrl);
 socket.addEventListener('message',event=>{
  const m=JSON.parse(String(event.data));
  const item=callbacks.get(m.id);
  if(!item)return;callbacks.delete(m.id);
  if(m.error)item.fail(Error(JSON.stringify(m.error)));else item.ok(m.result);
 });
 await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',fail,{once:true})});
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const devices=[['phone-360',360,800],['phone-390',390,844],['tablet-768',768,1024],['desktop-1280',1280,800]];
 for(const [device,width,height] of devices){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=768});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<=768,maxTouchPoints:5});
  for(const path of ['/','/checkout','/panel','/this-route-is-not-real']){
   await send('Page.navigate',{url:target.origin+path});
   let state;
   for(let tries=0;tries<100;tries++){
    const result=await send('Runtime.evaluate',{expression:"(()=>({ready:document.readyState,path:location.pathname,origin:location.origin,text:(document.querySelector('main')||document.body).innerText.slice(0,1000),scroll:document.documentElement.scrollWidth,inner:innerWidth,images:[...document.images].filter(x=>!x.hasAttribute('alt')).length,buttons:[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length>0&&!x.innerText.trim()&&!x.getAttribute('aria-label')&&!x.getAttribute('aria-labelledby')&&!x.getAttribute('title')).length,headings:document.querySelectorAll('h1').length,lang:document.documentElement.lang}))()",returnByValue:true});
    state=result.result?.value;
    if(state?.path===path&&state?.origin===target.origin&&state?.ready==='complete'&&state?.text?.length>10)break;
    await delay(100);
   }
   assert.equal(state?.origin,target.origin,'Chrome must render the actual local app, not an error or policy page');
   assert.equal(state?.path,path,'Navigation did not finish');
   assert.ok(state?.text?.length>10,'Empty page: '+device+path);
   // Leave time for client hydration and responsive layout/font settling.
   await delay(450);
   const current=await send('Runtime.evaluate',{expression:"(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,images:[...document.images].filter(x=>!x.hasAttribute('alt')).length,buttons:[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length>0&&!x.innerText.trim()&&!x.getAttribute('aria-label')&&!x.getAttribute('aria-labelledby')&&!x.getAttribute('title')).length,headings:document.querySelectorAll('h1').length,lang:document.documentElement.lang,text:(document.querySelector('main')||document.body).innerText.slice(0,1000)}))()",returnByValue:true});
   state=current.result.value;
   assert.ok(state.scroll<=state.inner+2,device+path+' horizontal overflow: '+JSON.stringify(state));
   assert.equal(state.images,0,device+path+' images missing alt text');
   assert.equal(state.buttons,0,device+path+' unnamed icon-only buttons');
   assert.ok(state.headings>0,device+path+' must have an h1');
   assert.equal(state.lang,'tr',device+path+' must declare Turkish document language');
   if(path==='/')assert.match(state.text,/Mahallene|BİSMİL|restoran/i);
   if(path==='/checkout')assert.match(state.text,/sepet/i);
   if(path==='/panel')assert.match(state.text,/İşletme paneli|Yönetim merkezi|çalışma alanı/i);
   if(path==='/this-route-is-not-real')assert.match(state.text,/bulunamadı|404/i);
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   const file=join(output,device+(path==='/'?'-home':path==='/checkout'?'-checkout':path==='/panel'?'-panel':'-not-found')+'.png');
   writeFileSync(file,Buffer.from(shot.data,'base64'));
   // Critical touch targets are tested at 360 px and 390 px, not just CSS overflow.
   // WCAG's technical minimum may be smaller; 44 CSS px is our pilot's usability bar.
   if(width<=390&&(path==='/'||path==='/panel')){
    const result=await send('Runtime.evaluate',{expression:
     "(()=>{const selectors=location.pathname==='/'?['.new-search input','.select-wrap select','.filter-chip','.sort-select select']:['.portal-gateway-card .btn','.portal-gateway-back'];return selectors.flatMap(sel=>[...document.querySelectorAll(sel)].filter(el=>el.getClientRects().length>0).map(el=>{const r=el.getBoundingClientRect();return {selector:sel,width:Math.round(r.width),height:Math.round(r.height)}}))})()",
     returnByValue:true});
    const targets=result.result.value;
    assert.ok(targets.length>=(path==='/panel'?3:4),device+path+' missing essential touch controls');
    assert.ok(targets.every(x=>x.width>=44&&x.height>=44),
     device+path+' touch target smaller than 44px: '+JSON.stringify(targets.filter(x=>x.width<44||x.height<44)));
   }
   if(width===360&&path==='/panel'){
    // Exercise one ACTUAL CDP touch event; not merely an element.click() call.
    await send('Runtime.evaluate',{expression:
     "document.querySelector('.portal-gateway-card .btn')?.scrollIntoView({block:'center'})"});
    await delay(250);
    const hit=await send('Runtime.evaluate',{expression:
     "(()=>{const e=document.querySelector('.portal-gateway-card .btn');const r=e?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null})()",
     returnByValue:true});
    assert.ok(hit.result.value,device+path+' merchant portal touch target missing');
    const {x,y}=hit.result.value;
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    let tapped=false;
    for(let i=0;i<50;i++){
     const navigation=await send('Runtime.evaluate',{expression:'location.pathname',returnByValue:true});
     if(navigation.result?.value==='/restaurant/overview'){tapped=true;break}
     await delay(100);
    }
    assert.ok(tapped,'A physical touch emulation did not open the merchant login portal');
   }
   console.log(JSON.stringify({device,path,viewport:state.inner,scroll:state.scroll,errors:0,file}));
  }
 }
 await checkOfflineRecovery();
}
try{await run();console.log('MOBILE_BROWSER_SMOKE_PASS')}
finally{socket?.close();chrome.kill('SIGTERM');await delay(200);
 if(chrome.exitCode===null)chrome.kill('SIGKILL');
 rmSync(profile,{recursive:true,force:true});}
