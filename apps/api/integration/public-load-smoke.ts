/** Safe, repeatable local-only concurrent HTTP read smoke.
 * Never sends orders or auth tokens and refuses remote/production hosts.
 * This does NOT establish capacity for 1,000 real concurrent users.
 */
import {performance} from 'node:perf_hooks';
const base=new URL(process.env.LOCAL_LOAD_BASE_URL||'http://127.0.0.1:4189');
if(base.protocol!=='http:'||!['127.0.0.1','localhost'].includes(base.hostname)||
 base.username||base.password||base.pathname!=='/'||base.search||base.hash||!base.port)
 throw Error('Refusing non-local HTTP load target. Use http://127.0.0.1:<port>.');
function bounded(name:string,fallback:number,min:number,max:number):number{
 const raw=process.env[name];
 if(raw===undefined)return fallback;
 if(!/^[0-9]+$/.test(raw))throw Error('Invalid '+name);
 const value=Number(raw);
 if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(name+' out of safe range');
 return value;
}
const total=bounded('LOCAL_LOAD_REQUESTS',160,1,250);
const concurrency=bounded('LOCAL_LOAD_CONCURRENCY',40,1,200);
const p95BudgetMs=bounded('LOCAL_LOAD_P95_BUDGET_MS',6000,200,20000);
const paths=['/v1/restaurants','/v1/zones','/v1/categories','/healthz'] as const;
const origin=base.origin;
async function ready(){
 for(let i=0;i<100;i++){
  try{
   const response=await fetch(origin+'/readyz',{signal:AbortSignal.timeout(1200)});
   if(response.ok)return;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,120));
 }
 throw Error('Local API never became ready. Refusing to benchmark unavailable service.');
}
await ready();
const timings:number[]=[],errors:string[]=[];
let next=0;
const start=performance.now();
await Promise.all(Array.from({length:Math.min(total,concurrency)},async()=>{
 while(next<total){
  const id=next++;
  const path=paths[id%paths.length];
  const begin=performance.now();
  try{
   const response=await fetch(origin+path,{signal:AbortSignal.timeout(8000),cache:'no-store'});
   await response.arrayBuffer();
   if(response.status!==200)errors.push(path+':HTTP_'+response.status);
  }catch(e){errors.push(path+':'+(e instanceof Error?e.name:'fetch-error'))}
  timings.push(performance.now()-begin);
 }
}));
timings.sort((a,b)=>a-b);
const percentile=(p:number)=>timings[Math.min(timings.length-1,Math.max(0,Math.ceil(timings.length*p)-1))];
const elapsed=performance.now()-start;
const summary={target:origin,requests:total,concurrency,completed:timings.length,errors:errors.length,
 durationMs:Math.round(elapsed),requestsPerSecond:Math.round(total/(elapsed/1000)*10)/10,
 p50Ms:Math.round(percentile(.5)),p95Ms:Math.round(percentile(.95)),p99Ms:Math.round(percentile(.99)),
 sampleErrors:errors.slice(0,5)};
console.log(JSON.stringify(summary));
if(errors.length||percentile(.95)>p95BudgetMs){
 console.error('Local-only load smoke FAILED (p95 budget '+p95BudgetMs+' ms).');
 process.exitCode=1;
}
