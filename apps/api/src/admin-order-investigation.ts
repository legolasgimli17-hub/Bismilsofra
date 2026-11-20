/** Admin order troubleshooting: exact ID or displayed eight-character prefix.
 * Search returns operational metadata only, never addresses, phone numbers,
 * customer identity or free-text notes. Detail reads have a durable audit event.
 */
import type {Pool} from 'pg';
import {invalid,uuid} from './domain.ts';
import {transaction} from './order-service.ts';

export type OrderLookupKey={fullId:string|null;prefix:string|null};
export function parseOrderLookupKey(raw:unknown):OrderLookupKey{
 if(typeof raw!=='string')invalid('ORDER_SEARCH_INVALID','Sipariş numarası gerekli.');
 const key=(raw as string).trim().toLowerCase();
 if(uuid(key))return {fullId:key,prefix:null};
 if(/^[a-f0-9]{8}$/.test(key))return {fullId:null,prefix:key};
 return invalid('ORDER_SEARCH_INVALID','Tam sipariş numarası veya ekranda görünen 8 karakter gereklidir.');
}
export const ADMIN_ORDER_LOOKUP_SQL=`SELECT o.id,o.restaurant_id,r.name AS restaurant_name,
 o.status,o.created_at,o.updated_at,o.expires_at,o.accepted_at,o.delivered_at,
 o.total_kurus,o.payment_method
 FROM orders o JOIN restaurants r ON r.id=o.restaurant_id
 WHERE ($1::uuid IS NOT NULL AND o.id=$1::uuid)
 OR ($2::text IS NOT NULL AND left(o.id::text,8)=$2::text
      AND o.created_at>=now()-interval '180 days')
 ORDER BY o.created_at DESC LIMIT 6`;

export async function searchAdminOrders(pool:Pool,raw:unknown){
 const key=parseOrderLookupKey(raw);
 const result=await pool.query(ADMIN_ORDER_LOOKUP_SQL,[key.fullId,key.prefix]);
 const matches=result.rows.slice(0,5);
 return {orders:matches,more:result.rows.length>5,
  note:key.prefix?'Kısa numara araması son 180 günle sınırlıdır.':'Tam numarayla geçmiş kayıt da bulunabilir.'};
}
export async function readAdminOrderDetail(pool:Pool,actorId:string,orderId:string){
 if(!uuid(orderId))invalid('INVALID_ID','Sipariş numarası geçersiz.');
 return transaction(pool,async db=>{
  const order=await db.query(`SELECT o.id,o.restaurant_id,r.name AS restaurant_name,
   o.status,o.created_at,o.updated_at,o.expires_at,o.accepted_at,o.delivered_at,
   o.subtotal_kurus,o.delivery_fee_kurus,o.total_kurus,o.payment_method
   FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.id=$1`,[orderId]);
  if(!order.rowCount)invalid('NOT_FOUND','Sipariş bulunamadı.',404);
  const [lines,events]=await Promise.all([
   db.query(`SELECT product_name_snapshot,unit_kurus,quantity,line_total_kurus,options_snapshot
    FROM order_items WHERE order_id=$1 ORDER BY id LIMIT 60`,[orderId]),
   db.query(`SELECT previous_status,new_status,actor_type,reason,created_at
    FROM order_events WHERE order_id=$1 ORDER BY id LIMIT 100`,[orderId])
  ]);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'admin_order_investigation','order',$2,$3::jsonb)`,
   [actorId,orderId,JSON.stringify({view:'status_and_items'})]);
  return {order:order.rows[0],items:lines.rows,events:events.rows};
 });
}
