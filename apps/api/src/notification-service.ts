/** A durable, best-effort webhook dispatcher. Delivery is at-least-once: receiver MUST dedupe X-Sofra-Event-ID. */
import type {Pool} from 'pg';
import {createHmac} from 'node:crypto';
import {transaction} from './order-service.ts';

type OutboxEvent={id:string|number;order_id:string;restaurant_id:string;type:string;payload:unknown;attempts:number};
export type Deliver=(event:OutboxEvent)=>Promise<void>;
export function createSignedWebhook(url:string,secret:string):Deliver{
 const target=new URL(url);
 if(target.protocol!=='https:'||!target.hostname||target.username||target.password||target.hash)throw new Error('ALERT_WEBHOOK_URL must be an HTTPS URL without credentials or fragment.');
 if(secret.length<32||secret.includes('REPLACE')||secret.includes('PUT_A_RANDOM'))throw new Error('ALERT_WEBHOOK_SECRET must be 32+ characters.');
 return async(event)=>{
  const body=JSON.stringify({eventId:String(event.id),type:event.type,orderId:event.order_id,restaurantId:event.restaurant_id,payload:event.payload});
  const signature=createHmac('sha256',secret).update(body).digest('hex');
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-sofra-event-id':String(event.id),'x-sofra-signature':'sha256='+signature},body,signal:AbortSignal.timeout(3000),redirect:'error'});
  if(!response.ok)throw new Error('Webhook failed HTTP '+response.status);
 };
}
export async function dispatchOutbox(pool:Pool,deliver:Deliver,batch=10){
 return transaction(pool,async db=>{
  const res=await db.query(`SELECT id,order_id,restaurant_id,type,payload,attempts FROM notification_outbox
   WHERE sent_at IS NULL AND dead_at IS NULL AND next_attempt_at<=now()
   ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $1`,[Math.max(1,Math.min(batch,30))]);
  let sent=0,failed=0,dead=0;
  for(const event of res.rows as OutboxEvent[]){
   try{
    await deliver(event);
    await db.query('UPDATE notification_outbox SET sent_at=now(),last_error=NULL,attempts=attempts+1 WHERE id=$1',[event.id]);
    sent++;
   }catch(error){
    const nextAttempts=Number(event.attempts)+1;
    const terminal=nextAttempts>=12;
    const retrySec=Math.min(3600,5*2**Math.min(10,Number(event.attempts)));
    const message=error instanceof Error?error.message:'delivery error';
    await db.query(`UPDATE notification_outbox SET attempts=attempts+1,last_error=$2,
     dead_at=CASE WHEN $3::boolean THEN now() ELSE NULL END,
     next_attempt_at=now()+($4::int*interval '1 second') WHERE id=$1`,
     [event.id,message.slice(0,180),terminal,retrySec]);
    failed++;if(terminal)dead++;
   }
  }
  return {processed:res.rows.length,sent,failed,dead};
 });
}
