/** API foundation for Bismil Sofra. Not exposed to the internet until provider, DB and integration tests are configured. */
import Fastify from 'fastify';
import {Pool} from 'pg';
import {DomainError,invalid,uuid,STATUSES,type Status,cleanNote} from './domain.ts';
import {verifyBearer,provisionVerifiedUser,requireMfa,requireStaff,requireAdmin} from './auth.ts';
import {placeOrder,quoteOrder,changeStatus,activateRestaurant,transaction} from './order-service.ts';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL gerekli');
const origin=process.env.CORS_ORIGIN;
if(!origin||origin==='*')throw new Error('CORS_ORIGIN tek bir güvenilir domain olmalı');
const port=Number(process.env.PORT||4000);
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:12,connectionTimeoutMillis:5000,statement_timeout:8000});
const app=Fastify({logger:{level:process.env.NODE_ENV==='production'?'info':'warn',redact:['req.headers.authorization','req.body.phone','req.body.fullAddress','req.body.address','res.headers.set-cookie']},bodyLimit:65536,trustProxy:false,requestTimeout:15000});
const hits=new Map<string,{count:number,expires:number}>();
app.addHook('onRequest',async(req,reply)=>{
 reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer').header('Cache-Control','no-store').header('X-Frame-Options','DENY');
 const sentOrigin=req.headers.origin;
 if(sentOrigin&&sentOrigin!==origin)return reply.code(403).send({code:'ORIGIN_FORBIDDEN',message:'Bu kaynaktan erişim engellendi.'});
 if(sentOrigin){reply.header('Access-Control-Allow-Origin',origin).header('Vary','Origin').header('Access-Control-Allow-Headers','Authorization,Content-Type,Idempotency-Key').header('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS')}
 if(req.method==='OPTIONS')return reply.code(204).send();
 const now=Date.now();if(hits.size>15000){for(const [k,v] of hits)if(v.expires<=now)hits.delete(k)}
 const key=req.ip;let v=hits.get(key);if(!v||v.expires<=now)v={count:0,expires:now+60000};v.count++;hits.set(key,v);
 if(v.count>120)return reply.code(429).send({code:'RATE_LIMIT',message:'Çok fazla istek. Biraz sonra yeniden deneyin.'});
});
app.setErrorHandler((error,req,reply)=>{
 if(error instanceof DomainError)return reply.code(error.statusCode).send({code:error.code,message:error.message});
 if((error as {validation?:unknown}).validation)return reply.code(400).send({code:'INVALID_REQUEST',message:'Gönderilen alanlar hatalı.'});
 req.log.error({err:error},'API failure');return reply.code(500).send({code:'INTERNAL_ERROR',message:'İşlem tamamlanamadı.'});
});
const idParam=(req:{params:unknown},key:string)=>{const x=req.params as Record<string,unknown>;if(!uuid(x[key]))invalid('INVALID_ID','Numara geçersiz.');return x[key] as string};
async function user(req:{headers:{authorization?:string}}){const identity=await verifyBearer(req.headers.authorization);const userId=await provisionVerifiedUser(pool,identity);return {identity,userId}}
async function staff(req:{headers:{authorization?:string}},restaurantId:string,capability:'view'|'order'|'menu'|null='view'){const u=await user(req);requireMfa(u.identity);const role=await requireStaff(pool,u.userId,restaurantId,capability);return {...u,role}}
async function admin(req:{headers:{authorization?:string}}){const u=await user(req);requireMfa(u.identity,true);await requireAdmin(pool,u.userId);return u}

app.get('/healthz',async()=>({status:'ok',service:'bismil-sofra-api'}));
app.get('/readyz',async()=>{await pool.query('SELECT 1');return {status:'db-ready'}});
app.get('/v1/zones',async()=>{
 const r=await pool.query('SELECT id,name FROM delivery_zones WHERE enabled=true ORDER BY name ASC');return {zones:r.rows};
});
app.get('/v1/restaurants',async(req)=>{
 const q=req.query as Record<string,unknown>;
 if(q.zoneId!==undefined&&!uuid(q.zoneId))invalid('ZONE_INVALID','Mahalle kimliği geçersiz.');
 if(q.search!==undefined&&(typeof q.search!=='string'||q.search.length>70))invalid('SEARCH_INVALID','Arama çok uzun.');
 if(q.category!==undefined&&(typeof q.category!=='string'||q.category.length>50))invalid('CATEGORY_INVALID','Kategori geçersiz.');
 const zone=uuid(q.zoneId)?q.zoneId:null;
 const search=typeof q.search==='string'?q.search.trim()||null:null;
 const category=typeof q.category==='string'?q.category.trim()||null:null;
 const r=await pool.query(`SELECT r.id,r.name,r.slug,r.cover_url,r.is_open,r.is_busy,r.accepts_orders,
 CASE WHEN $1::uuid IS NOT NULL THEN dz.min_basket_kurus ELSE NULL END AS min_basket_kurus,
 CASE WHEN $1::uuid IS NOT NULL THEN dz.delivery_fee_kurus ELSE NULL END AS delivery_fee_kurus FROM restaurants r
 LEFT JOIN LATERAL (SELECT zone_id,min_basket_kurus,delivery_fee_kurus FROM restaurant_delivery_zones z WHERE z.restaurant_id=r.id AND z.enabled=true AND EXISTS(SELECT 1 FROM delivery_zones v WHERE v.id=z.zone_id AND v.enabled=true) AND ($1::uuid IS NULL OR z.zone_id=$1) ORDER BY min_basket_kurus ASC LIMIT 1) dz ON TRUE
 WHERE r.active=true AND ($1::uuid IS NULL OR dz.zone_id IS NOT NULL)
 AND ($2::text IS NULL OR r.name ILIKE '%'||$2||'%' OR EXISTS(SELECT 1 FROM products p WHERE p.restaurant_id=r.id AND p.available=true AND p.name ILIKE '%'||$2||'%'))
 AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM categories c WHERE c.restaurant_id=r.id AND c.name ILIKE '%'||$3||'%'))
 ORDER BY r.name LIMIT 50`,[zone,search,category]);
 return {restaurants:r.rows};
});
app.get('/v1/restaurants/:id/menu',async(req)=>{
 const id=idParam(req,'id');
 const rest=await pool.query('SELECT id,name,cover_url,is_open,is_busy,accepts_orders FROM restaurants WHERE id=$1 AND active=true',[id]);
 if(!rest.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
 const ps=await pool.query('SELECT id,category_id,name,description,price_kurus,image_url,available FROM products WHERE restaurant_id=$1 ORDER BY sort_order,name LIMIT 500',[id]);
 const ids=ps.rows.map(p=>p.id);
 const gs=ids.length?await pool.query('SELECT id,product_id,name,min_select,max_select FROM option_groups WHERE product_id=ANY($1::uuid[])',[ids]):{rows:[]};
 const gids=gs.rows.map(g=>g.id);
 const os=gids.length?await pool.query('SELECT id,group_id,name,price_kurus,available FROM options WHERE group_id=ANY($1::uuid[])',[gids]):{rows:[]};
 return {restaurant:rest.rows[0],products:ps.rows.map(p=>({...p,optionGroups:gs.rows.filter(g=>g.product_id===p.id).map(g=>({...g,options:os.rows.filter(o=>o.group_id===g.id)}))}))};
});
app.get('/v1/me/addresses',async(req)=>{const {userId}=await user(req);const r=await pool.query('SELECT id,label,zone_id,full_address,directions,phone FROM addresses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',[userId]);return {addresses:r.rows}});
app.post('/v1/me/addresses',async(req,reply)=>{
 const {userId}=await user(req);const b=(req.body??{}) as Record<string,unknown>;
 if(!uuid(b.zoneId)||typeof b.fullAddress!=='string'||b.fullAddress.trim().length<8||b.fullAddress.length>900||typeof b.phone!=='string'||!/^05\d{9}$/.test(b.phone))invalid('ADDRESS_INVALID','Mahalle, adres ve telefon bilgilerini kontrol edin.');
 const zone=await pool.query('SELECT 1 FROM delivery_zones WHERE id=$1 AND enabled=true',[b.zoneId]);if(!zone.rowCount)invalid('ZONE_INVALID','Mahalle uygun değil.',400);
 const r=await pool.query('INSERT INTO addresses(user_id,zone_id,label,full_address,directions,phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[userId,b.zoneId,cleanNote(b.label||'Ev',45)||'Ev',b.fullAddress.trim(),cleanNote(b.directions,400),b.phone]);reply.code(201);return {id:r.rows[0].id};
});
app.post('/v1/orders/quote',async(req)=>{const {userId}=await user(req);return quoteOrder(pool,userId,req.body)});
app.post('/v1/orders',async(req,reply)=>{
 const {userId}=await user(req);
 const result=await placeOrder(pool,userId,req.body,req.headers['idempotency-key']);
 reply.code(result.replayed?200:201);return result;
});
app.get('/v1/me/orders',async(req)=>{
 const {userId}=await user(req);const r=await pool.query('SELECT id,restaurant_id,status,total_kurus,payment_method,created_at,updated_at FROM orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 40',[userId]);return {orders:r.rows};
});
// A network timeout must not cause blind duplicate order submission.
// Client checks the same Idempotency-Key then safely retries the original POST if absent.
app.get('/v1/me/orders/by-key/:key',async(req)=>{
 const {userId}=await user(req);const key=(req.params as Record<string,unknown>).key;
 if(typeof key!=='string'||!/^[a-zA-Z0-9_.:-]{16,100}$/.test(key))invalid('IDEMPOTENCY_REQUIRED','İşlem anahtarı hatalı.');
 const result=await pool.query(`SELECT id,status,restaurant_id,created_at FROM orders
  WHERE customer_id=$1 AND idempotency_key=$2`,[userId,key]);
 if(!result.rowCount)invalid('NOT_FOUND','Bu işlem anahtarıyla kayıtlı sipariş henüz bulunamadı.',404);
 return {order:result.rows[0]};
});
app.get('/v1/me/orders/:id',async(req)=>{
 const {userId}=await user(req),id=idParam(req,'id');
 const r=await pool.query('SELECT id,restaurant_id,status,subtotal_kurus,delivery_fee_kurus,total_kurus,payment_method,created_at,updated_at FROM orders WHERE id=$1 AND customer_id=$2',[id,userId]);
 if(!r.rowCount)invalid('NOT_FOUND','Sipariş bulunamadı.',404);
 const items=await pool.query('SELECT product_name_snapshot,unit_kurus,quantity,line_total_kurus,options_snapshot FROM order_items WHERE order_id=$1',[id]);
 const events=await pool.query('SELECT previous_status,new_status,created_at,reason FROM order_events WHERE order_id=$1 ORDER BY id',[id]);
 return {order:r.rows[0],items:items.rows,events:events.rows};
});
app.post('/v1/me/orders/:id/cancel',async(req)=>{
 const {userId}=await user(req);const id=idParam(req,'id');
 return changeStatus(pool,'customer',userId,id,'musteri_iptal');
});
app.get('/v1/me/staff-restaurants',async(req)=>{
 const {userId,identity}=await user(req);requireMfa(identity);
 const r=await pool.query(`SELECT r.id,r.name,s.role,s.can_view_orders,s.can_manage_orders FROM restaurant_staff s JOIN restaurants r ON r.id=s.restaurant_id WHERE s.user_id=$1 ORDER BY r.name LIMIT 50`,[userId]);
 return {restaurants:r.rows};
});
app.get('/v1/restaurant/:rid/orders',async(req)=>{
 const rid=idParam(req,'rid');await staff(req,rid);
 const r=await pool.query(`SELECT id,status,subtotal_kurus,delivery_fee_kurus,total_kurus,payment_method,created_at,expires_at,address_snapshot,note
  FROM orders WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 80`,[rid]);return {orders:r.rows};
});
// Order details are fetched only on demand and only for authenticated staff
// assigned to the same restaurant. Polling inboxes never include customer PII.
app.get('/v1/restaurant/:rid/orders/:id',async(req)=>{
 const rid=idParam(req,'rid'),id=idParam(req,'id');await staff(req,rid,'view');
 const order=await pool.query(`SELECT id,restaurant_id,status,subtotal_kurus,delivery_fee_kurus,total_kurus,
  payment_method,created_at,updated_at,expires_at,address_snapshot,note
  FROM orders WHERE id=$1 AND restaurant_id=$2`,[id,rid]);
 if(!order.rowCount)invalid('NOT_FOUND','Sipariş bulunamadı.',404);
 const items=await pool.query(`SELECT product_name_snapshot,unit_kurus,quantity,line_total_kurus,options_snapshot
  FROM order_items WHERE order_id=$1 ORDER BY id`,[id]);
 const events=await pool.query(`SELECT previous_status,new_status,created_at,reason
  FROM order_events WHERE order_id=$1 ORDER BY id`,[id]);
 return {order:order.rows[0],items:items.rows,events:events.rows};
});
app.post('/v1/restaurant/:rid/orders/:id/status',async(req)=>{
 const rid=idParam(req,'rid'),id=idParam(req,'id');const {userId}=await staff(req,rid,'order');
 const belongs=await pool.query('SELECT 1 FROM orders WHERE id=$1 AND restaurant_id=$2',[id,rid]);if(!belongs.rowCount)invalid('NOT_FOUND','Sipariş bulunamadı.',404);
 const body=(req.body??{}) as Record<string,unknown>;
 if(typeof body.to!=='string'||!STATUSES.includes(body.to as Status))invalid('STATUS_INVALID','Geçersiz sipariş durumu.');
 return changeStatus(pool,'restaurant',userId,id,body.to as Status,cleanNote(body.reason,400));
});
app.patch('/v1/restaurant/:rid/availability',async(req)=>{
 const rid=idParam(req,'rid'),{userId,role}=await staff(req,rid,null);
 if(role==='staff')invalid('ROLE_FORBIDDEN','Restoranın açılış/kapanış ayarını yalnızca yönetici değiştirebilir.',403);
 const b=(req.body??{}) as Record<string,unknown>;
 if(typeof b.isOpen!=='boolean'||typeof b.isBusy!=='boolean'||typeof b.acceptsOrders!=='boolean')invalid('INVALID_REQUEST','Restoran durumu için üç boolean alan gereklidir.');
 return transaction(pool,async db=>{
  const res=await db.query(`UPDATE restaurants SET is_open=$1,is_busy=$2,accepts_orders=$3 WHERE id=$4 AND active=true RETURNING id,is_open,is_busy,accepts_orders`,[b.isOpen,b.isBusy,b.acceptsOrders,rid]);
  if(!res.rowCount)invalid('NOT_FOUND','Restoran aktif değil veya bulunamadı.',404);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[userId,'availability_update','restaurant',rid,JSON.stringify({isOpen:b.isOpen,isBusy:b.isBusy,acceptsOrders:b.acceptsOrders})]);
  return res.rows[0];
 });
});
app.patch('/v1/restaurant/:rid/products/:pid',async(req)=>{
 const rid=idParam(req,'rid'),pid=idParam(req,'pid');const {userId}=await staff(req,rid,'menu');
 const body=(req.body??{}) as Record<string,unknown>;
 if(typeof body.available!=='boolean')invalid('INVALID_REQUEST','Ürün satış durumu boolean olmalı.');
 return transaction(pool,async db=>{
  const r=await db.query('UPDATE products SET available=$1 WHERE restaurant_id=$2 AND id=$3 RETURNING id,available',[body.available,rid,pid]);
  if(!r.rowCount)invalid('NOT_FOUND','Ürün bulunamadı.',404);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[userId,'product_availability','product',pid,JSON.stringify({restaurantId:rid,available:body.available})]);
  return r.rows[0];
 });
});
// Full pending snapshot supports reconnect/reconciliation when transient notifications fail.
app.get('/v1/restaurant/:rid/inbox',async(req)=>{
 const rid=idParam(req,'rid');await staff(req,rid,'view');
 const pending=await pool.query(`SELECT id,status,total_kurus,created_at,expires_at
  FROM orders WHERE restaurant_id=$1 AND status='beklemede' ORDER BY created_at ASC LIMIT 201`,[rid]);
 const active=await pool.query(`SELECT id,status,total_kurus,created_at,expires_at
  FROM orders WHERE restaurant_id=$1 AND status IN ('kabul_edildi','hazirlaniyor','hazir','yolda')
  ORDER BY updated_at DESC LIMIT 201`,[rid]);
 const recent=await pool.query(`SELECT id,status,updated_at FROM orders WHERE restaurant_id=$1
  ORDER BY updated_at DESC LIMIT 80`,[rid]);
 return {serverTime:new Date().toISOString(),pending:pending.rows.slice(0,200),active:active.rows.slice(0,200),
  recent:recent.rows,pendingTruncated:pending.rows.length>200,activeTruncated:active.rows.length>200};
});
// Support cases are linked to orders and scoped to their owner; no automatic payment reversal.
app.post('/v1/me/support-cases',async(req,reply)=>{
 const {userId}=await user(req);const b=(req.body??{}) as Record<string,unknown>;
 const allowed=['eksik_urun','yanlis_urun','gecikme','teslimat','diger'];
 if(!uuid(b.orderId)||typeof b.issueType!=='string'||!allowed.includes(b.issueType)||typeof b.description!=='string'||b.description.trim().length<10||b.description.length>1200)
  invalid('SUPPORT_INVALID','Sipariş, konu ve en az 10 karakterli açıklama gerekli.');
 const result=await pool.query(`INSERT INTO support_cases(customer_id,order_id,issue_type,description)
  SELECT $1,o.id,$3,$4 FROM orders o WHERE o.id=$2 AND o.customer_id=$1 RETURNING id,created_at`,
  [userId,b.orderId,b.issueType,b.description.trim()]);
 if(!result.rowCount)invalid('NOT_FOUND','Sipariş bulunamadı.',404);
 reply.code(201);return {caseId:result.rows[0].id,createdAt:result.rows[0].created_at};
});
app.get('/v1/me/support-cases',async(req)=>{
 const {userId}=await user(req);
 const result=await pool.query(`SELECT id,order_id,issue_type,status,created_at,updated_at
  FROM support_cases WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100`,[userId]);
 return {cases:result.rows};
});
// Read-only operational warnings. Does not expose address/phone details.
app.get('/v1/admin/alerts',async(req)=>{
 await admin(req);
 const pending=await pool.query(`SELECT restaurant_id,count(*)::int AS count
  FROM orders WHERE status='beklemede' AND created_at<now()-interval '2 minutes'
  GROUP BY restaurant_id ORDER BY count DESC LIMIT 50`);
 const delivery=await pool.query(`SELECT restaurant_id,count(*)::int AS count
  FROM notification_outbox WHERE sent_at IS NULL AND (dead_at IS NOT NULL OR attempts>0)
  GROUP BY restaurant_id ORDER BY count DESC LIMIT 50`);
 return {latePending:pending.rows,notificationIssues:delivery.rows};
});
// An operator can inspect dead letters without accessing customers' personal details.
app.get('/v1/admin/notifications/failed',async(req)=>{
 await admin(req);
 const result=await pool.query(`SELECT id,order_id,restaurant_id,type,attempts,created_at,next_attempt_at,dead_at,last_error
  FROM notification_outbox WHERE sent_at IS NULL AND (dead_at IS NOT NULL OR attempts>0)
  ORDER BY id DESC LIMIT 100`);
 return {notifications:result.rows};
});
app.post('/v1/admin/notifications/:id/retry',async(req)=>{
 const {userId}=await admin(req);const id=(req.params as Record<string,unknown>).id;
 if(typeof id!=='string'||!/^[1-9][0-9]{0,17}$/.test(id))invalid('INVALID_ID','Bildirim numarası hatalı.');
 return transaction(pool,async db=>{
  const res=await db.query(`UPDATE notification_outbox SET dead_at=NULL,attempts=0,last_error=NULL,next_attempt_at=now()
   WHERE id=$1 AND sent_at IS NULL RETURNING id,restaurant_id`,[id]);
  if(!res.rowCount)invalid('NOT_FOUND','Tekrar denenebilecek bildirim bulunamadı.',404);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,details) VALUES($1,$2,$3,$4::jsonb)',[userId,'notification_retry','notification',JSON.stringify({eventId:id,restaurantId:res.rows[0].restaurant_id})]);
  return {id:res.rows[0].id,requeued:true};
 });
});
app.post('/v1/admin/restaurants/:id/activation',async(req)=>{
 const id=idParam(req,'id'),{userId}=await admin(req);const body=(req.body??{}) as Record<string,unknown>;
 if(typeof body.active!=='boolean')invalid('INVALID_REQUEST','Aktiflik bilgisi boolean olmalı.');
 return activateRestaurant(pool,userId,id,body.active);
});

async function start(){
 try{await pool.query('SELECT 1');await app.listen({port:Number.isInteger(port)?port:4000,host:'127.0.0.1'});console.log('API http://127.0.0.1:'+port+' üzerinde. Canlı kullanım için yapılandırma ve testler gerekli.');}
 catch(err){console.error(err);process.exitCode=1;await app.close();await pool.end()}
}
await start();
process.on('SIGINT',()=>{void app.close().then(()=>pool.end())});
process.on('SIGTERM',()=>{void app.close().then(()=>pool.end())});
