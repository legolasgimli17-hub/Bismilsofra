import {validateStagingTarget} from './staging-target.mjs';
import {SseSignalDecoder} from '../apps/web/lib/order-stream-client.ts';

const roles=['customer','merchant','admin'];
const tokens=Object.fromEntries(roles.map(role=>[role,process.env['STAGING_'+role.toUpperCase()+'_ACCESS_TOKEN']?.trim()]));
const rid=process.env.STAGING_RESTAURANT_ID;
const results=[];

async function run(){
 const base=validateStagingTarget(process.env.STAGING_API_URL||'');
 if(!roles.every(role=>tokens[role])||new Set(Object.values(tokens)).size!==roles.length)
  throw Error('Supply three distinct staging access tokens.');
 if(!rid||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(rid))
  throw Error('STAGING_RESTAURANT_ID must identify the test restaurant.');

 async function probe(label,path,{role,status=200,stream=false}={}){
  try{
   const headers={Accept:stream?'text/event-stream':'application/json'};
   if(role)headers.Authorization='Bearer '+tokens[role];
   const response=await fetch(base+path,{headers,redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store'});
   if(response.status!==status){
    await response.body?.cancel();
    throw Error('expected '+status+', got '+response.status);
   }
   let body;
   if(stream){
    if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream')){
     await response.body?.cancel();
     throw Error('missing event stream');
    }
    const reader=response.body.getReader();
    const decoder=new SseSignalDecoder();
    const text=new TextDecoder();
    try{
     while(true){
      const chunk=await reader.read();
      if(chunk.done)throw Error('stream closed before ready');
      if(decoder.feed(text.decode(chunk.value,{stream:true})).includes('ready'))break;
     }
    }finally{await reader.cancel().catch(()=>{})}
   }else if(status===200){
    body=await response.json();
   }else await response.body?.cancel();
   results.push({check:label,status});
   return body;
  }catch(e){
   const message=e instanceof Error?e.message:'request failed';
   throw Error(label+': '+message);
  }
 }

 const ready=await probe('database ready','/readyz');
 if(ready?.status!=='ready')throw Error('Database readiness response was unexpected.');
 await probe('anonymous denied','/v1/me/orders',{status:401});
 const orders=await probe('customer can read own orders','/v1/me/orders',{role:'customer'});
 if(!Array.isArray(orders?.orders))throw Error('Customer order list missing.');
 const inbox='/v1/restaurant/'+rid+'/inbox';
 await probe('customer denied merchant inbox',inbox,{role:'customer',status:403});
 await probe('customer denied admin alerts','/v1/admin/alerts',{role:'customer',status:403});
 const staff=await probe('merchant assignments','/v1/me/staff-restaurants',{role:'merchant'});
 if(!Array.isArray(staff?.restaurants)||!staff.restaurants.some(r=>r.id===rid&&r.role==='owner'))
  throw Error('The merchant test account must own the test restaurant.');
 const queue=await probe('merchant can read inbox',inbox,{role:'merchant'});
 if(!Array.isArray(queue?.pending)||!Array.isArray(queue?.active))throw Error('Merchant inbox lists missing.');
 await probe('merchant stream ready','/v1/restaurant/'+rid+'/events',{role:'merchant',stream:true});
 await probe('merchant denied admin alerts','/v1/admin/alerts',{role:'merchant',status:403});
 const alerts=await probe('admin can read alerts','/v1/admin/alerts',{role:'admin'});
 if(!Array.isArray(alerts?.latePending))throw Error('Admin alerts response missing.');
 console.log(JSON.stringify({checks:results}));
}
try{await run()}catch(e){
 // Report only controlled messages. Fetch/JSON errors can contain response data.
 const msg=e instanceof Error?e.message:'preflight failed';
 const safe=/^(?:[a-z ]+: expected [0-9]+, got [0-9]+|Supply three distinct staging access tokens\.|STAGING_RESTAURANT_ID must identify the test restaurant\.|Refusing target: use localhost fixture or a dedicated HTTPS staging host\.|Invalid URL|Database readiness response was unexpected\.|Customer order list missing\.|The merchant test account must own the test restaurant\.|Merchant inbox lists missing\.|Admin alerts response missing\.)$/.test(msg);
 console.error(JSON.stringify({checks:results,error:safe?msg:'Request or event stream failed; check staging connectivity and configuration.'}));
 process.exitCode=1;
}
