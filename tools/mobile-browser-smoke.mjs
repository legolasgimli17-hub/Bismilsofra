/** Browser engine smoke: real Chromium mobile viewport, zero real-user data.
 * No new npm dependencies. Localhost only; no screenshots of private sessions.
 */
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';

async function freePort(){
 const socket=createServer();
 await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
 const info=socket.address();
 if(!info||typeof info==='string')throw Error('No port');
 await new Promise(resolve=>socket.close(resolve));
 return info.port;
}
const raw=process.env.MOBILE_SMOKE_BASE_URL||'http://127.0.0.1:3180';
const target=new URL(raw);
if(target.protocol!=='http:'||!['127.0.0.1','localhost'].includes(target.hostname)||
 !target.port||target.pathname!=='/'||target.search||target.hash||target.username||target.password)
 throw Error('Refusing non-local browser target; this QA may only test an isolated preview.');
const executable=process.env.CHROME_PATH;
if(!executable)throw Error('Set CHROME_PATH to the installed Chromium/Chrome executable.');
const temp=await mkdtemp(join(tmpdir(),'sofra-cdp-mobile-'));
const debugPort=await freePort();
const browser=spawn(executable,[
 '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
 '--no-proxy-server','--no-first-run','--no-default-browser-check',
 '--remote-debugging-address=127.0.0.1',
 '--remote-debugging-port='+debugPort,'--user-data-dir='+temp,'about:blank'
],{stdio:'ignore'});
let socket;
try{
 let wsUrl='';
 for(let attempt=0;attempt<90;attempt++){
  if(browser.exitCode!==null)throw Error('Chromium exited before debugging was ready');
  try{
   const pages=await fetch('http://127.0.0.1:'+debugPort+'/json/list',{
    signal:AbortSignal.timeout(500)}).then(r=>r.json());
   wsUrl=pages.find(page=>page.type==='page')?.webSocketDebuggerUrl||'';
   if(wsUrl)break;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!wsUrl)throw Error('Chromium CDP failed to start on localhost.');
 socket=new WebSocket(wsUrl);
 await new Promise((resolve,reject)=>{
  socket.addEventListener('open',resolve,{once:true});
  socket.addEventListener('error',reject,{once:true});
 });
 let next=0;
 const pending=new Map();
 socket.addEventListener('message',e=>{
  const value=JSON.parse(e.data);
  const entry=pending.get(value.id);
  if(!entry)return;
  pending.delete(value.id);
  if(value.error)entry.reject(Error(value.error.message));else entry.resolve(value.result);
 });
 const command=(method,params={})=>{
  const id=++next;
  return new Promise((resolve,reject)=>{
   pending.set(id,{resolve,reject});
   socket.send(JSON.stringify({id,method,params}));
   const watchdog=setTimeout(()=>{
    if(pending.has(id)){pending.delete(id);reject(Error('Chrome DevTools timed out: '+method))}
   },12000);
   watchdog.unref();
  });
 };
 await command('Page.enable');
 await command('Runtime.enable');
 const widths=[320,360,390,430,768,1280];
 const routes=['/','/restaurants/demo-ocak?demo=1','/checkout','/not-a-real-route'];
 const results=[];
 for(const width of widths){
  await command('Emulation.setDeviceMetricsOverride',{
   width,height:850,deviceScaleFactor:1,mobile:width<768
  });
  for(const route of routes){
   await command('Page.navigate',{url:target.origin+route});
   let state=null;
   for(let attempt=0;attempt<50;attempt++){
    try{
     const result=await command('Runtime.evaluate',{expression:String.raw`JSON.stringify({
      width:window.innerWidth,
      scrollWidth:Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0),
      ready:document.readyState,
      main:!!document.querySelector('main'),
      skip:!!document.querySelector('a[href="#main-content"]'),
      nav:!!document.querySelector('nav[aria-label="Alt gezinme"]'),
      heading:document.querySelector('h1')?.textContent?.trim()||'',
      oversized:[...document.querySelectorAll('body *')].filter(e=>{
       const r=e.getBoundingClientRect();
       return r.width>0&&r.right>window.innerWidth+3&&!e.closest('.category-gallery,.menu-category-tabs');
      }).slice(0,4).map(e=>e.tagName.toLowerCase()+'.'+String(e.className).slice(0,35))
     })`,returnByValue:true});
     if(result.result?.value){
      state=JSON.parse(result.result.value);
      if(state.ready==='complete'&&state.main&&state.heading)break;
     }
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,130));
   }
   if(!state?.main||!state.skip||!state.nav||!state.heading)
    throw Error('Missing accessible layout at '+width+'px '+route+': '+JSON.stringify(state));
   if(state.scrollWidth>state.width+2)
    throw Error('Horizontal page overflow at '+width+'px '+route+': '+JSON.stringify(state));
   results.push({width,route,scrollWidth:state.scrollWidth});
  }
 }
 console.log(JSON.stringify({
  engine:'Chromium',checks:results.length,widths,routes,maxAllowedOverflow:2,
  scope:'demo only; physical iOS/Android still unverified'
 }));
}finally{
 socket?.close();
 browser.kill('SIGTERM');
 await new Promise(resolve=>setTimeout(resolve,200));
 if(browser.exitCode===null)browser.kill('SIGKILL');
 await rm(temp,{recursive:true,force:true});
}
