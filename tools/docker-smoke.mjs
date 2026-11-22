/** CI-only container verification: local loopback + disposable PostgreSQL.
 * Check fail-closed production order intake through actual Docker networking.
 */
const origin='http://127.0.0.1:4188';
async function untilReady(){
 for(let i=0;i<100;i++){
  try{
   const ready=await fetch(origin+'/readyz',{signal:AbortSignal.timeout(1200)});
   if(ready.ok)return;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 throw Error('Production-mode API container never became ready');
}
await untilReady();
const zones=await fetch(origin+'/v1/zones',{signal:AbortSignal.timeout(3000)});
if(zones.status!==200)throw Error('Container public discovery unavailable: '+zones.status);
const blocked=await fetch(origin+'/v1/orders',{method:'POST',signal:AbortSignal.timeout(3000)});
const body=await blocked.json();
if(blocked.status!==503||body.code!=='ORDER_INTAKE_CLOSED')
 throw Error('CRITICAL: container accepted an order without operator authorization');
console.log(JSON.stringify({container:'ready',discovery:'ok',productionOrders:'CLOSED',status:503}));
