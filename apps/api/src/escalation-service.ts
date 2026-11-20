/**
 * Durable fallback restaurant alert. Each reminder is atomically leased then
 * delivered WITHOUT keeping a PostgreSQL transaction open during network IO.
 * The receiver MUST deduplicate by event ID (at-least-once delivery).
 */
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import type {Deliver} from './notification-service.ts';

type Claimed={order_id:string;restaurant_id:string;attempts:number;status:string;unexpired:boolean};
export type EscalationOutcome={processed:number;sent:number;failed:number;cancelled:number;dead:number};
export async function dispatchEscalations(pool:Pool,deliver:Deliver,batch=5):Promise<EscalationOutcome>{
 const result:EscalationOutcome={processed:0,sent:0,failed:0,cancelled:0,dead:0};
 const size=Number.isInteger(batch)?Math.max(1,Math.min(10,batch)):5;
 for(let i=0;i<size;i++){
  const token=randomUUID();
  const claim=await pool.query(`WITH candidate AS (
     SELECT e.order_id FROM restaurant_escalations e
     WHERE e.sent_at IS NULL AND e.cancelled_at IS NULL AND e.dead_at IS NULL
      AND e.next_attempt_at<=now()
      AND (e.lease_until IS NULL OR e.lease_until<=now())
     ORDER BY e.next_attempt_at,e.order_id
     FOR UPDATE OF e SKIP LOCKED LIMIT 1
   )
   UPDATE restaurant_escalations e
   SET lease_token=$1::uuid,lease_until=now()+interval '30 seconds'
   FROM candidate c, orders o
   WHERE e.order_id=c.order_id AND o.id=e.order_id
   RETURNING e.order_id,e.restaurant_id,e.attempts,o.status,
     (o.expires_at>now()) AS unexpired`,[token]);
  if(!claim.rowCount)break;
  result.processed++;
  const item=claim.rows[0] as Claimed;

  // Status may change between claim and provider request. Recheck immediately
  // to avoid an unnecessary fallback alert after merchant acceptance.
  const state=await pool.query(`SELECT status,expires_at>now() AS unexpired
    FROM orders WHERE id=$1`,[item.order_id]);
  const current=state.rows[0] as {status:string;unexpired:boolean}|undefined;
  if(!current||current.status!=='beklemede'||current.unexpired!==true){
   const cancel=await pool.query(`UPDATE restaurant_escalations
    SET cancelled_at=now(),last_error=NULL,lease_token=NULL,lease_until=NULL
    WHERE order_id=$1 AND lease_token=$2::uuid
     AND sent_at IS NULL AND cancelled_at IS NULL RETURNING order_id`,[item.order_id,token]);
   if(cancel.rowCount)result.cancelled++;
   continue;
  }

  const event={
   id:'escalation:'+item.order_id,
   order_id:item.order_id,
   restaurant_id:item.restaurant_id,
   type:'pending_order_escalation',
   payload:{orderId:item.order_id,reason:'still_unaccepted'},
   attempts:Number(item.attempts)
  };
  try{
   await deliver(event);
   const ack=await pool.query(`UPDATE restaurant_escalations
     SET sent_at=now(),attempts=attempts+1,last_error=NULL,
      lease_token=NULL,lease_until=NULL
     WHERE order_id=$1 AND lease_token=$2::uuid
      AND sent_at IS NULL AND cancelled_at IS NULL RETURNING order_id`,
    [item.order_id,token]);
   if(ack.rowCount)result.sent++;
  }catch{
   // Never persist provider exception text (could contain secrets or PII).
   const attempts=Number(item.attempts)+1,terminal=attempts>=6;
   const retrySec=Math.min(90,15*2**Math.min(3,Number(item.attempts)));
   const updated=await pool.query(`UPDATE restaurant_escalations
     SET attempts=attempts+1,last_error='DELIVERY_FAILED',
      dead_at=CASE WHEN $3::boolean THEN now() ELSE NULL END,
      next_attempt_at=now()+($4::int * interval '1 second'),
      lease_token=NULL,lease_until=NULL
     WHERE order_id=$1 AND lease_token=$2::uuid
      AND sent_at IS NULL AND cancelled_at IS NULL RETURNING order_id`,
    [item.order_id,token,terminal,retrySec]);
   if(updated.rowCount){result.failed++;if(terminal)result.dead++}
  }
 }
 return result;
}
