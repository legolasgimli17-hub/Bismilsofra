/** PostgreSQL-atomic account quota across API replicas, independent of NAT IP.
 * This is a checkout-specific shared gate; edge WAF/general rate limiting are
 * still required for production traffic. Never accept a client-provided ID.
 */
import type {Pool} from 'pg';

export const CUSTOMER_ORDERS_PER_MINUTE=12;

export async function checkSharedOrderQuota(pool:Pool,verifiedUserId:string):
 Promise<{allowed:boolean;retryAfter:number}>{
 const result=await pool.query(`INSERT INTO customer_order_quotas(user_id,window_start,hits)
 VALUES($1,date_trunc('minute',clock_timestamp()),1)
 ON CONFLICT (user_id,window_start) DO UPDATE
 SET hits=customer_order_quotas.hits+1
 WHERE customer_order_quotas.hits<$2
 RETURNING hits`,[verifiedUserId,CUSTOMER_ORDERS_PER_MINUTE]);
 return {allowed:(result.rowCount??0)>0,retryAfter:(result.rowCount??0)>0?0:60};
}
