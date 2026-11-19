/**
 * Durable second-channel reminder for orders that still await merchant acceptance.
 * No customer contact details are transmitted; receiver must dedupe the stable event ID.
 * Uses row locks to serialize reminder decisions against order state transitions.
 */
import type {Pool} from 'pg';
import {transaction} from './order-service.ts';
import type {Deliver} from './notification-service.ts';

export type EscalationOutcome={processed:number;sent:number;failed:number;cancelled:number;dead:number};
export async function dispatchEscalations(pool:Pool,deliver:Deliver,batch=5):Promise<EscalationOutcome>{
 const result:EscalationOutcome={processed:0,sent:0,failed:0,cancelled:0,dead:0};
 const size=Math.max(1,Math.min(10,Number.isInteger(batch)?batch:5));
 for(let i=0;i<size;i++){
  const action=await transaction(pool,async db=>{
   const due=await db.query(`SELECT e.order_id,e.restaurant_id,e.attempts,o.status,
      (o.expires_at>now()) AS unexpired
      FROM restaurant_escalations e
      JOIN orders o ON o.id=e.order_id
      WHERE e.sent_at IS NULL AND e.cancelled_at IS NULL AND e.dead_at IS NULL
       AND e.next_attempt_at<=now()
      ORDER BY e.next_attempt_at ASC
      FOR UPDATE OF e,o SKIP LOCKED LIMIT 1`);
   if(!due.rowCount)return null;
   const item=due.rows[0] as {order_id:string;restaurant_id:string;attempts:number;status:string;unexpired:boolean};
   if(item.status!=='beklemede'||item.unexpired!==true){
    await db.query('UPDATE restaurant_escalations SET cancelled_at=now(),last_error=NULL WHERE order_id=$1',[item.order_id]);
    return 'cancelled' as const;
   }
   const event={id:'escalation:'+item.order_id,order_id:item.order_id,restaurant_id:item.restaurant_id,
    type:'pending_order_escalation',payload:{orderId:item.order_id,reason:'still_unaccepted'},attempts:Number(item.attempts)};
   try{
    await deliver(event);
    await db.query('UPDATE restaurant_escalations SET sent_at=now(),attempts=attempts+1,last_error=NULL WHERE order_id=$1',[item.order_id]);
    return 'sent' as const;
   }catch{
    // The provider might include tokens or customer details in its error; never persist these.
    const attempt=Number(item.attempts)+1,terminal=attempt>=6;
    const delaySec=Math.min(90,15*2**Math.min(3,Number(item.attempts)));
    await db.query(`UPDATE restaurant_escalations
      SET attempts=attempts+1,last_error='DELIVERY_FAILED',
       dead_at=CASE WHEN $2::boolean THEN now() ELSE NULL END,
       next_attempt_at=now()+($3::int * interval '1 second')
      WHERE order_id=$1`,[item.order_id,terminal,delaySec]);
    return terminal?'dead' as const:'failed' as const;
   }
  });
  if(!action)break;
  result.processed++;
  result[action]++;
 }
 return result;
}
