/** A durable, best-effort webhook dispatcher. Delivery is at-least-once: receiver MUST dedupe X-Sofra-Event-ID. */
import type {Pool} from 'pg';
import {createHmac,randomUUID} from 'node:crypto';
import {httpsEndpoint,validWebhookSecret} from './runtime-guard.ts';

type OutboxEvent={id:string|number;order_id:string;restaurant_id:string;type:string;payload:unknown;attempts:number};
export type Deliver=(event:OutboxEvent)=>Promise<void>;
export function createSignedWebhook(url:string,secret:string):Deliver{
 const target=httpsEndpoint(url);
 if(!target)throw new Error('ALERT_WEBHOOK_URL must be an HTTPS URL without credentials or fragment.');
 if(!validWebhookSecret(secret))throw new Error('ALERT_WEBHOOK_SECRET must be 32+ characters.');
 return async(event)=>{
  const body=JSON.stringify({eventId:String(event.id),type:event.type,orderId:event.order_id,restaurantId:event.restaurant_id,payload:event.payload});
  const signature=createHmac('sha256',secret).update(body).digest('hex');
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-sofra-event-id':String(event.id),'x-sofra-signature':'sha256='+signature},body,signal:AbortSignal.timeout(3000),redirect:'error'});
  if(!response.ok)throw new Error('Webhook failed HTTP '+response.status);
 };
}
/**
 * Claim ONE event atomically, commit it, then send the HTTP request WITHOUT a
 * database transaction or row lock held over the network. The lease is a
 * fencing token: a slow/crashed worker cannot acknowledge another worker's job.
 *
 * This is at-least-once, not exactly-once; receivers MUST persist deduplication
 * by x-sofra-event-id, including after a server restart.
 */
export async function dispatchOutbox(pool:Pool,deliver:Deliver,batch=10){
 const limit=Number.isInteger(batch)?Math.max(1,Math.min(batch,30)):10;
 let processed=0,sent=0,failed=0,dead=0;
 for(let index=0;index<limit;index++){
  const leaseToken=randomUUID();
  const claim=await pool.query(`WITH candidate AS (
    SELECT id FROM notification_outbox
    WHERE sent_at IS NULL AND dead_at IS NULL
     AND next_attempt_at<=now()
     AND (lease_until IS NULL OR lease_until<=now())
    ORDER BY next_attempt_at,id
    FOR UPDATE SKIP LOCKED LIMIT 1
   )
   UPDATE notification_outbox n
    SET lease_token=$1::uuid,lease_until=now()+interval '30 seconds'
    FROM candidate c WHERE n.id=c.id
    RETURNING n.id,n.order_id,n.restaurant_id,n.type,n.payload,n.attempts`,
   [leaseToken]);
  if(!claim.rowCount)break;
  processed++;
  const event=claim.rows[0] as OutboxEvent;
  try{
   await deliver(event);
   const ack=await pool.query(`UPDATE notification_outbox SET sent_at=now(),
      last_error=NULL,attempts=attempts+1,lease_token=NULL,lease_until=NULL
     WHERE id=$1 AND lease_token=$2::uuid AND sent_at IS NULL
     RETURNING id`,[event.id,leaseToken]);
   if(ack.rowCount)sent++;
  }catch{
   const attempt=Number(event.attempts)+1;
   const terminal=attempt>=12;
   const retrySec=Math.min(3600,5*2**Math.min(10,Number(event.attempts)));
   // Never persist raw provider errors: they can contain credentials or PII.
   const updated=await pool.query(`UPDATE notification_outbox SET
      attempts=attempts+1,last_error='DELIVERY_FAILED',
      dead_at=CASE WHEN $3::boolean THEN now() ELSE NULL END,
      next_attempt_at=now()+($4::int * interval '1 second'),
      lease_token=NULL,lease_until=NULL
     WHERE id=$1 AND lease_token=$2::uuid AND sent_at IS NULL
     RETURNING id`,
    [event.id,leaseToken,terminal,retrySec]);
   if(updated.rowCount){failed++;if(terminal)dead++}
  }
 }
 return {processed,sent,failed,dead};
}
