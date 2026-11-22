import {Pool} from 'pg';import {expirePending} from './order-service.ts';import {recordWorkerCycle} from './worker-health.ts';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL gerekli');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3});
let running=true;
let lastQuotaPrune=0;
process.on('SIGINT',()=>{running=false});process.on('SIGTERM',()=>{running=false});
while(running){
 try{
  const count=await expirePending(pool);
  if(Date.now()-lastQuotaPrune>=60_000){
   await pool.query("DELETE FROM customer_order_quotas WHERE window_start < now()-interval '2 hours'");
   lastQuotaPrune=Date.now();
  }
  await recordWorkerCycle(pool,'expiry',{success:true,work:count});
  if(count)console.log(JSON.stringify({at:new Date().toISOString(),expired:count}));
 }catch{
  console.error('expiry-worker cycle failed');
  try{await recordWorkerCycle(pool,'expiry',{success:false})}
  catch{console.error('expiry-worker heartbeat unavailable')}
 }
 await new Promise(resolve=>setTimeout(resolve,5000));
}
await pool.end();
