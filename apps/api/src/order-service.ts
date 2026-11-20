import type {Pool, PoolClient} from 'pg';
import {assertTransition,calculateOrder,canStaff,cleanNote,invalid,parseOrder,payloadHash,uuid, type Actor,type CatalogProduct,type OrderInput,type Status} from './domain.ts';

export async function transaction<T>(pool:Pool,fn:(client:PoolClient)=>Promise<T>):Promise<T>{
 const client=await pool.connect();
 try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result}
 catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
 finally{client.release()}
}

export async function placeOrder(pool:Pool,subjectUserId:string,body:unknown,key:unknown){
 const request=parseOrder(body,key);const hash=payloadHash(request);
 return transaction(pool,async db=>{
  // The advisory lock serializes retries before checking the durable unique constraint.
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`order:${subjectUserId}:${request.idempotencyKey}`]);
  const existing=await db.query('SELECT id,payload_hash FROM orders WHERE customer_id=$1 AND idempotency_key=$2',[subjectUserId,request.idempotencyKey]);
  if(existing.rowCount){
   if(existing.rows[0].payload_hash!==hash)invalid('IDEMPOTENCY_CONFLICT','Bu işlem anahtarı farklı bir sepetle zaten kullanılmış.',409);
   return {id:existing.rows[0].id,replayed:true};
  }
  const addr=await db.query('SELECT a.id,a.zone_id,a.full_address,a.directions,a.phone,a.label,z.enabled AS zone_enabled,z.name AS zone_name FROM addresses a JOIN delivery_zones z ON z.id=a.zone_id WHERE a.id=$1 AND a.user_id=$2 AND a.archived_at IS NULL FOR SHARE OF a,z',[request.addressId,subjectUserId]);
  if(!addr.rowCount||!addr.rows[0].zone_enabled)invalid('ADDRESS_UNAVAILABLE','Bu adrese sipariş verilemiyor.',404);
  const address=addr.rows[0];
  const rr=await db.query('SELECT id,active,is_open,is_busy,accepts_orders FROM restaurants WHERE id=$1 FOR SHARE',[request.restaurantId]);
  if(!rr.rowCount||!rr.rows[0].active||!rr.rows[0].is_open||rr.rows[0].is_busy||!rr.rows[0].accepts_orders)invalid('RESTAURANT_CLOSED','Restoran şu anda sipariş kabul etmiyor.',409);
  const dz=await db.query('SELECT min_basket_kurus,delivery_fee_kurus FROM restaurant_delivery_zones WHERE restaurant_id=$1 AND zone_id=$2 AND enabled=true FOR SHARE',[request.restaurantId,address.zone_id]);
  if(!dz.rowCount)invalid('ZONE_UNAVAILABLE','Restoran bu mahalleye teslimat yapmıyor.',409);
  // Strict schedule matching in the restaurant-local Europe/Istanbul timezone.
  // A restaurant with no saved schedule is NOT considered open for live ordering.
  const hours=await db.query(`SELECT EXISTS(SELECT 1 FROM restaurant_hours h WHERE h.restaurant_id=$1 AND
    ((h.open_time<h.close_time AND h.day_of_week=EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul')) AND (now() AT TIME ZONE 'Europe/Istanbul')::time >= h.open_time AND (now() AT TIME ZONE 'Europe/Istanbul')::time < h.close_time)
    OR (h.open_time>h.close_time AND ((h.day_of_week=EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul')) AND (now() AT TIME ZONE 'Europe/Istanbul')::time >= h.open_time)
    OR (h.day_of_week=(EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul'))::int+6)%7 AND (now() AT TIME ZONE 'Europe/Istanbul')::time < h.close_time))))) AS allowed`,[request.restaurantId]);
  if(!hours.rows[0].allowed)invalid('OUTSIDE_HOURS','Restoranın çalışma saatleri dışında sipariş alınmıyor.',409);
  const closure=await db.query('SELECT 1 FROM restaurant_closures WHERE restaurant_id=$1 AND starts_at<=now() AND ends_at>now() LIMIT 1',[request.restaurantId]);
  if(closure.rowCount)invalid('RESTAURANT_CLOSED','Restoran geçici olarak kapalı.',409);
  const settings=await db.query('SELECT accept_minutes FROM restaurant_settings WHERE restaurant_id=$1',[request.restaurantId]);
  const acceptMinutes=settings.rowCount?Number(settings.rows[0].accept_minutes):4;
  if(!Number.isInteger(acceptMinutes)||acceptMinutes<1||acceptMinutes>15)invalid('ACCEPT_WINDOW_INVALID','Restoran kabul süresi hatalı.',500);
  const productIds=[...new Set(request.items.map(i=>i.productId))];
  const pr=await db.query('SELECT id,name,price_kurus,available FROM products WHERE restaurant_id=$1 AND id=ANY($2::uuid[]) FOR SHARE',[request.restaurantId,productIds]);
  if(pr.rows.length!==productIds.length)invalid('PRODUCT_UNAVAILABLE','Sepetteki ürün restorana ait değil veya bulunamadı.',409);
  const groups=await db.query('SELECT id,product_id,name,min_select,max_select FROM option_groups WHERE product_id=ANY($1::uuid[]) AND archived=false FOR SHARE',[productIds]);
  const groupIds=groups.rows.map(g=>g.id);
  const options=groupIds.length?(await db.query('SELECT id,group_id,name,price_kurus,available FROM options WHERE group_id=ANY($1::uuid[]) FOR SHARE',[groupIds])).rows:[];
  const products:CatalogProduct[]=pr.rows.map(p=>({id:p.id,name:p.name,priceKurus:p.price_kurus,available:p.available,optionGroups:groups.rows.filter(g=>g.product_id===p.id).map(g=>({id:g.id,name:g.name,minSelect:g.min_select,maxSelect:g.max_select,options:options.filter(o=>o.group_id===g.id).map(o=>({id:o.id,name:o.name,priceKurus:o.price_kurus,available:o.available}))}))}));
  const totals=calculateOrder(request.items,products,dz.rows[0].min_basket_kurus,dz.rows[0].delivery_fee_kurus);
  // Confirmation is compared to authoritative values INSIDE the order transaction.
  // Never use the client-confirmed amounts to compute the charge or order snapshots.
  const confirmation=(body && typeof body==='object' ? body as Record<string,unknown> : {});
  const expected=confirmation.confirmedTotalKurus;
  if(!Number.isSafeInteger(expected)||Number(expected)<0)invalid('CONFIRMATION_REQUIRED','Sipariş özeti ve güncel toplam onaylanmalıdır.',400);
  if(expected!==totals.totalKurus)invalid('PRICE_CHANGED','Sepetin güncel tutarı değişti. Yeni toplamı kontrol edip tekrar onaylayın.',409);
  const addressSnapshot={zoneId:address.zone_id,zone:address.zone_name,address:address.full_address,directions:address.directions,phone:address.phone,label:address.label};
  const inserted=await db.query(`INSERT INTO orders(customer_id,restaurant_id,address_id,address_snapshot,payment_method,status,subtotal_kurus,delivery_fee_kurus,total_kurus,note,idempotency_key,payload_hash,expires_at)
    VALUES($1,$2,$3,$4::jsonb,$5,'beklemede',$6,$7,$8,$9,$10,$11,now()+($12::int * interval '1 minute')) RETURNING id`,[subjectUserId,request.restaurantId,request.addressId,JSON.stringify(addressSnapshot),request.paymentMethod,totals.subtotalKurus,totals.deliveryFeeKurus,totals.totalKurus,request.note,request.idempotencyKey,hash,acceptMinutes]);
  const orderId=inserted.rows[0].id;
  for(const line of totals.items){await db.query('INSERT INTO order_items(order_id,product_id,product_name_snapshot,unit_kurus,quantity,line_total_kurus,options_snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',[orderId,line.productId,line.name,line.unitKurus,line.qty,line.lineKurus,JSON.stringify(line.optionSnapshots)]);}
  await db.query(`INSERT INTO order_events(order_id,previous_status,new_status,actor_type,actor_user_id) VALUES ($1,NULL,'beklemede','system',NULL)`,[orderId]);
  await db.query(`INSERT INTO notification_outbox(order_id,restaurant_id,type,payload) VALUES($1,$2,'new_order',$3::jsonb)`,[orderId,request.restaurantId,JSON.stringify({orderId})]);
  return {id:orderId,replayed:false,totals};
 });
}

export async function changeStatus(pool:Pool,actor:Actor,actorUserId:string|null,orderId:string,to:Status,reason=''){
 if(!uuid(orderId))invalid('INVALID_ID','Sipariş numarası hatalı.');
 return transaction(pool,async db=>{
  const res=await db.query('SELECT id,restaurant_id,customer_id,status,created_at,expires_at FROM orders WHERE id=$1 FOR UPDATE',[orderId]);
  if(!res.rowCount)invalid('NOT_FOUND','Sipariş bulunamadı.',404);
  const o=res.rows[0];
  if(actor==='customer'&&o.customer_id!==actorUserId)invalid('NOT_FOUND','Sipariş bulunamadı.',404);
  if(actor==='restaurant'){
   const membership=await db.query('SELECT role,can_view_orders,can_manage_orders,can_manage_menu FROM restaurant_staff WHERE restaurant_id=$1 AND user_id=$2',[o.restaurant_id,actorUserId]);
   if(!membership.rowCount)invalid('NOT_FOUND','Sipariş bulunamadı.',404);
   if(!canStaff(membership.rows[0],'order'))invalid('ROLE_FORBIDDEN','Sipariş yönetme yetkiniz yok.',403);
  }
  if(actor==='system'&&actorUserId!==null)invalid('ROLE_FORBIDDEN','Sistem işlemi yetkisiz.',403);
  const clock=await db.query('SELECT now() AS current_time');const when=new Date(clock.rows[0].current_time);
  assertTransition(o.status,to,actor,cleanNote(reason,400),new Date(o.created_at),when,new Date(o.expires_at));
  await db.query(`UPDATE orders SET status=$1,updated_at=now(),accepted_at=CASE WHEN $1='kabul_edildi' THEN now() ELSE accepted_at END,delivered_at=CASE WHEN $1='teslim_edildi' THEN now() ELSE delivered_at END WHERE id=$2`,[to,orderId]);
  await db.query('INSERT INTO order_events(order_id,previous_status,new_status,actor_type,actor_user_id,reason) VALUES($1,$2,$3,$4,$5,$6)',[orderId,o.status,to,actor,actorUserId,cleanNote(reason,400)]);
  await db.query('INSERT INTO notification_outbox(order_id,restaurant_id,type,payload) VALUES($1,$2,$3,$4::jsonb)',[orderId,o.restaurant_id,'order_status',JSON.stringify({orderId,status:to})]);
  return {id:orderId,status:to};
 });
}

export async function activateRestaurant(pool:Pool,adminUserId:string,restaurantId:string,active:boolean){
 if(!uuid(restaurantId)||typeof active!=='boolean')invalid('INVALID_REQUEST','Geçersiz restoran değişikliği.');
 return transaction(pool,async db=>{
  const role=await db.query('SELECT 1 FROM platform_admins WHERE user_id=$1',[adminUserId]);
  if(!role.rowCount)invalid('ROLE_FORBIDDEN','Yönetici yetkisi gerekli.',403);
  // Serialize all activation/deactivation while the database UNIQUE and CHECK constraints defend invariant.
  await db.query('SELECT pg_advisory_xact_lock(50991250)');
  const rr=await db.query('SELECT id,active,active_slot FROM restaurants WHERE id=$1 FOR UPDATE',[restaurantId]);
  if(!rr.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
  let slot:number|null=null;
  if(active){
   // A draft without its merchant, an available menu, delivery and hours
   // must never be advertised as an active pilot restaurant.
   const readiness=await db.query(`SELECT
    EXISTS(SELECT 1 FROM restaurant_staff s
     JOIN users u ON u.id=s.user_id AND u.enabled=true
     WHERE s.restaurant_id=$1 AND s.role='owner') AS has_owner,
    EXISTS(SELECT 1 FROM products p WHERE p.restaurant_id=$1 AND p.available=true) AS has_menu,
    EXISTS(SELECT 1 FROM restaurant_hours h WHERE h.restaurant_id=$1) AS has_hours,
    EXISTS(SELECT 1 FROM restaurant_delivery_zones dz
     JOIN delivery_zones z ON z.id=dz.zone_id AND z.enabled=true
     WHERE dz.restaurant_id=$1 AND dz.enabled=true) AS has_delivery
    `,[restaurantId]);
   const checks=readiness.rows[0];
   if(!checks.has_owner||!checks.has_menu||!checks.has_hours||!checks.has_delivery)
    invalid('RESTAURANT_NOT_READY','Restoranı etkinleştirmek için doğrulanmış sahip, satıştaki ürün, çalışma saatleri ve teslimat mahallesi gerekli.',409);
   slot=rr.rows[0].active_slot;
   if(slot===null){const free=await db.query('SELECT s AS slot FROM generate_series(1,50) s WHERE NOT EXISTS(SELECT 1 FROM restaurants r WHERE r.active_slot=s) ORDER BY s LIMIT 1');if(!free.rowCount)invalid('CAPACITY_FULL','50 aktif restoran kapasitesi dolu.',409);slot=free.rows[0].slot;}
  }
  await db.query('UPDATE restaurants SET active=$1,active_slot=$2,is_open=CASE WHEN $1 THEN is_open ELSE false END,accepts_orders=CASE WHEN $1 THEN accepts_orders ELSE false END WHERE id=$3',[active,slot,restaurantId]);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[adminUserId,'restaurant_activation','restaurant',restaurantId,JSON.stringify({active,slot})]);
  return {id:restaurantId,active,slot};
 });
}

// Worker scans the durable queue, locks each order once, and writes status/outbox atomically.
export async function expirePending(pool:Pool,batch=100){return transaction(pool,async db=>{
 const due=await db.query(`SELECT id,restaurant_id,status FROM orders WHERE status='beklemede' AND expires_at<=now() ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT $1`,[Math.max(1,Math.min(500,batch))]);
 for(const order of due.rows){
  await db.query(`UPDATE orders SET status='suresi_doldu',updated_at=now() WHERE id=$1`,[order.id]);
  await db.query(`INSERT INTO order_events(order_id,previous_status,new_status,actor_type,reason) VALUES($1,'beklemede','suresi_doldu','system','Sipariş kabul süresi doldu')`,[order.id]);
  await db.query(`INSERT INTO notification_outbox(order_id,restaurant_id,type,payload) VALUES($1,$2,'order_status',$3::jsonb)`,[order.id,order.restaurant_id,JSON.stringify({orderId:order.id,status:'suresi_doldu'})]);
 }
 return due.rows.length;
})}

/** Verified quote: no order is written, price is read from authoritative product and delivery tables.
 * Checkout must still reconfirm the exact total in placeOrder transaction: TOCTOU safe.
 */
export async function quoteOrder(pool:Pool,subjectUserId:string,body:unknown){
 const request=parseOrder(body,'quote-preview-token-12345678');
 return transaction(pool,async db=>{
  const addr=await db.query('SELECT a.zone_id,z.enabled AS zone_enabled FROM addresses a JOIN delivery_zones z ON z.id=a.zone_id WHERE a.id=$1 AND a.user_id=$2 AND a.archived_at IS NULL',[request.addressId,subjectUserId]);
  if(!addr.rowCount||!addr.rows[0].zone_enabled)invalid('ADDRESS_UNAVAILABLE','Adres bulunamadı veya mahalle kapalı.',404);
  const rr=await db.query('SELECT id,active,is_open,is_busy,accepts_orders FROM restaurants WHERE id=$1',[request.restaurantId]);
  if(!rr.rowCount||!rr.rows[0].active||!rr.rows[0].is_open||rr.rows[0].is_busy||!rr.rows[0].accepts_orders)invalid('RESTAURANT_CLOSED','Restoran sipariş kabul etmiyor.',409);
  const dz=await db.query('SELECT min_basket_kurus,delivery_fee_kurus FROM restaurant_delivery_zones WHERE restaurant_id=$1 AND zone_id=$2 AND enabled=true',[request.restaurantId,addr.rows[0].zone_id]);
  if(!dz.rowCount)invalid('ZONE_UNAVAILABLE','Bu mahalleye teslimat yok.',409);
  const hours=await db.query(`SELECT EXISTS(SELECT 1 FROM restaurant_hours h WHERE h.restaurant_id=$1 AND
    ((h.open_time<h.close_time AND h.day_of_week=EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul')) AND (now() AT TIME ZONE 'Europe/Istanbul')::time >= h.open_time AND (now() AT TIME ZONE 'Europe/Istanbul')::time < h.close_time)
    OR (h.open_time>h.close_time AND ((h.day_of_week=EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul')) AND (now() AT TIME ZONE 'Europe/Istanbul')::time >= h.open_time)
    OR (h.day_of_week=(EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul'))::int+6)%7 AND (now() AT TIME ZONE 'Europe/Istanbul')::time < h.close_time))))) AS allowed`,[request.restaurantId]);
  if(!hours.rows[0].allowed)invalid('OUTSIDE_HOURS','Restoran çalışma saatleri dışında.',409);
  const closure=await db.query('SELECT 1 FROM restaurant_closures WHERE restaurant_id=$1 AND starts_at<=now() AND ends_at>now() LIMIT 1',[request.restaurantId]);
  if(closure.rowCount)invalid('RESTAURANT_CLOSED','Restoran geçici olarak kapalı.',409);
  const ids=[...new Set(request.items.map(x=>x.productId))];
  const pr=await db.query('SELECT id,name,price_kurus,available FROM products WHERE restaurant_id=$1 AND id=ANY($2::uuid[])',[request.restaurantId,ids]);
  if(pr.rows.length!==ids.length)invalid('PRODUCT_UNAVAILABLE','Ürün restorana ait değil.',409);
  const gr=await db.query('SELECT id,product_id,name,min_select,max_select FROM option_groups WHERE product_id=ANY($1::uuid[]) AND archived=false',[ids]);
  const groupIds=gr.rows.map(g=>g.id);
  const opts=groupIds.length?(await db.query('SELECT id,group_id,name,price_kurus,available FROM options WHERE group_id=ANY($1::uuid[])',[groupIds])).rows:[];
  const catalog:CatalogProduct[]=pr.rows.map(p=>({id:p.id,name:p.name,priceKurus:p.price_kurus,available:p.available,optionGroups:gr.rows.filter(g=>g.product_id===p.id).map(g=>({id:g.id,name:g.name,minSelect:g.min_select,maxSelect:g.max_select,options:opts.filter(o=>o.group_id===g.id).map(o=>({id:o.id,name:o.name,priceKurus:o.price_kurus,available:o.available}))}))}));
  const totals=calculateOrder(request.items,catalog,dz.rows[0].min_basket_kurus,dz.rows[0].delivery_fee_kurus);
  return {totals,quotedAt:new Date().toISOString(),message:'Sipariş vermeden önce toplamı onaylayın. Fiyat sipariş anında yeniden kontrol edilir.'};
 });
}
