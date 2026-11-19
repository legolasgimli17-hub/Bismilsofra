/** Independent fallback alert channel. Must run as its own process/container. */
import {Pool} from 'pg';
import {createSignedWebhook} from './notification-service.ts';
import {dispatchEscalations} from './escalation-service.ts';

const database=process.env.DATABASE_URL;
const url=process.env.ESCALATION_WEBHOOK_URL;
const secret=process.env.ESCALATION_WEBHOOK_SECRET;
if(!database||!url||!secret)
 throw new Error('DATABASE_URL, ESCALATION_WEBHOOK_URL and ESCALATION_WEBHOOK_SECRET are required.');
if(url===process.env.ALERT_WEBHOOK_URL)
 throw new Error('The fallback alert must use a DIFFERENT endpoint/provider from the primary alert.');
const deliver=createSignedWebhook(url,secret);
const pool=new Pool({connectionString:database,max:2,connectionTimeoutMillis:5000});
let running=true;
process.on('SIGINT',()=>{running=false});process.on('SIGTERM',()=>{running=false});
while(running){
 try{
  const report=await dispatchEscalations(pool,deliver,3);
  if(report.processed)console.log(JSON.stringify({time:new Date().toISOString(),...report}));
 }catch(error){console.error('escalation-worker failed',error)}
 await new Promise(resolve=>setTimeout(resolve,3000));
}
await pool.end();
