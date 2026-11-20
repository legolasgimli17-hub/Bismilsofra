import {Pool} from 'pg';
import {createSignedWebhook,dispatchOutbox} from './notification-service.ts';
import {recordWorkerCycle} from './worker-health.ts';
if(!process.env.DATABASE_URL||!process.env.ALERT_WEBHOOK_URL||!process.env.ALERT_WEBHOOK_SECRET)
 throw new Error('DATABASE_URL, ALERT_WEBHOOK_URL, ALERT_WEBHOOK_SECRET gerekli. Bildirim düşürülmez; ayar yoksa worker başlamaz.');
const deliver=createSignedWebhook(process.env.ALERT_WEBHOOK_URL,process.env.ALERT_WEBHOOK_SECRET);
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:5000});
let running=true;
process.on('SIGINT',()=>{running=false});process.on('SIGTERM',()=>{running=false});
while(running){
 try{
  const result=await dispatchOutbox(pool,deliver,10);
  await recordWorkerCycle(pool,'outbox',{success:true,work:result.sent,failed:result.failed});
  if(result.processed)console.log(JSON.stringify({at:new Date().toISOString(),...result}));
 }catch{
  // Provider exception messages can include secrets or personal information.
  console.error('outbox-worker cycle failed');
  try{await recordWorkerCycle(pool,'outbox',{success:false})}
  catch{console.error('outbox-worker heartbeat unavailable')}
 }
 await new Promise(resolve=>setTimeout(resolve,2000));
}
await pool.end();
