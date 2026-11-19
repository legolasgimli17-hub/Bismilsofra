import {Pool} from 'pg';
import {createSignedWebhook,dispatchOutbox} from './notification-service.ts';
if(!process.env.DATABASE_URL||!process.env.ALERT_WEBHOOK_URL||!process.env.ALERT_WEBHOOK_SECRET)
 throw new Error('DATABASE_URL, ALERT_WEBHOOK_URL, ALERT_WEBHOOK_SECRET gerekli. Bildirim düşürülmez; ayar yoksa worker başlamaz.');
const deliver=createSignedWebhook(process.env.ALERT_WEBHOOK_URL,process.env.ALERT_WEBHOOK_SECRET);
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:5000});
let running=true;
process.on('SIGINT',()=>{running=false});process.on('SIGTERM',()=>{running=false});
while(running){
 try{const result=await dispatchOutbox(pool,deliver,10);if(result.processed)console.log(JSON.stringify({at:new Date().toISOString(),...result}))}
 catch(err){console.error('outbox-worker error',err)}
 await new Promise(resolve=>setTimeout(resolve,2000));
}
await pool.end();
