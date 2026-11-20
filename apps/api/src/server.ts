/** API foundation for Bismil Sofra. Not exposed to the internet until provider, DB and integration tests are configured. */
import Fastify from 'fastify';
import {Pool} from 'pg';
import {DomainError,invalid,uuid,STATUSES,type Status,cleanNote} from './domain.ts';
import {verifyBearer,provisionVerifiedUser,requireMfa,requireStaff,requireAdmin} from './auth.ts';
import {placeOrder,quoteOrder,changeStatus,activateRestaurant,transaction} from './order-service.ts';
import {MERCHANT_SUMMARY_QUERY,hasRequiredMigrations,CURRENTLY_ACCEPTING_SQL,REQUIRED_MIGRATIONS} from './operations.ts';
import {parseWeeklyHours,parseZonePolicy} from './merchant-management.ts';
import {parseProductDraft,parseCategoryDraft} from './merchant-menu.ts';
import {prepareRestaurantPhoto,photoStorageSettings,s3MediaStorage,photoObjectKey,photoPublicUrl,MAX_PHOTO_UPLOAD_BYTES} from './media-service.ts';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL gerekli');
const origin=process.env.CORS_ORIGIN;
if(!origin||origin==='*')throw new Error('CORS_ORIGIN tek bir güvenilir domain olmalı');
const port=Number(process.env.PORT||4000);
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:12,connectionTimeoutMillis:5000,statement_timeout:8000});
const app=Fastify({logger:{level:process.env.NODE_ENV==='production'?'info':'warn',redact:['req.headers.authorization','req.body.phone','req.body.fullAddress','req.body.address','res.headers.set-cookie']},bodyLimit:65536,trustProxy:false,requestTimeout:15000});
app.addContentTypeParser('application/octet-stream',{parseAs:'buffer',bodyLimit:MAX_PHOTO_UPLOAD_BYTES},
 (_request,body,done)=>done(null,body));
const hits=new Map<string,{count:number,expires:number}>();
app.addHook('onRequest',async(req,reply)=>{
 reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer').header('Cache-Control','no-store').header('X-Frame-Options','DENY');
 const sentOrigin=req.headers.origin;
 if(sentOrigin&&sentOrigin!==origin)return reply.code(403).send({code:'ORIGIN_FORBIDDEN',message:'Bu kaynaktan erişim engellendi.'});
 if(sentOrigin){reply.header('Access-Control-Allow-Origin',origin).header('Vary','Origin').header('Access-Control-Allow-Headers','Authorization,Content-Type,Idempotency-Key,X-Photo-Rights-Affirmed').header('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS')}
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
app.get('/readyz',async(_req,reply)=>{
 try{
  const result=await pool.query('SELECT filename FROM schema_migrations WHERE filename = ANY($1::text[])',[[...REQUIRED_MIGRATIONS]]);
  if(!hasRequiredMigrations(result.rows))return reply.code(503).send({status:'migrations-pending'});
  return {status:'ready'};
 }catch{return reply.code(503).send({status:'db-unavailable'});}
});
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
 (${CURRENTLY_ACCEPTING_SQL}) AS is_orderable,
 dz.min_basket_kurus AS min_basket_kurus,
 dz.delivery_fee_kurus AS delivery_fee_kurus FROM restaurants r
 -- Without a selected neighborhood, DO NOT show an arbitrary neighborhood's price.
 LEFT JOIN LATERAL (SELECT z.zone_id,z.min_basket_kurus,z.delivery_fee_kurus FROM restaurant_delivery_zones z WHERE z.restaurant_id=r.id AND z.enabled=true AND $1::uuid IS NOT NULL AND z.zone_id=$1::uuid AND EXISTS(SELECT 1 FROM delivery_zones v WHERE v.id=z.zone_id AND v.enabled=true) LIMIT 1) dz ON TRUE
 WHERE r.active=true AND ($1::uuid IS NULL OR dz.zone_id IS NOT NULL)
 AND ($2::text IS NULL OR r.name ILIKE '%'||$2||'%' OR EXISTS(SELECT 1 FROM products p WHERE p.restaurant_id=r.id AND p.available=true AND p.name ILIKE '%'||$2||'%'))
 AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM categories c WHERE c.restaurant_id=r.id AND c.name ILIKE '%'||$3||'%'))
 ORDER BY r.name LIMIT 50`,[zone,search,category]);
 return {restaurants:r.rows};
});
app.get('/v1/restaurants/:id/menu',async(req)=>{
 const id=idParam(req,'id');
 const rest=await pool.query(`SELECT r.id,r.name,r.cover_url,r.is_open,r.is_busy,r.accepts_orders, (${CURRENTLY_ACCEPTING_SQL}) AS is_orderable FROM restaurants r WHERE r.id=$1 AND r.active=true`,[id]);
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
 const address=typeof b.fullAddress==='string'?b.fullAddress:'';
 if(!uuid(b.zoneId)||address.trim().length<8||address.length>900||typeof b.phone!=='string'||!/^05\d{9}$/.test(b.phone))invalid('ADDRESS_INVALID','Mahalle, adres ve telefon bilgilerini kontrol edin.');
 const zone=await pool.query('SELECT 1 FROM delivery_zones WHERE id=$1 AND enabled=true',[b.zoneId]);if(!zone.rowCount)invalid('ZONE_INVALID','Mahalle uygun değil.',400);
 const r=await pool.query('INSERT INTO addresses(user_id,zone_id,label,full_address,directions,phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[userId,b.zoneId,cleanNote(b.label||'Ev',45)||'Ev',address.trim(),cleanNote(b.directions,400),b.phone]);reply.code(201);return {id:r.rows[0].id};
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
 const r=await pool.query(`SELECT r.id,r.name,s.role,s.can_view_orders,s.can_manage_orders,s.can_manage_menu FROM restaurant_staff s JOIN restaurants r ON r.id=s.restaurant_id WHERE s.user_id=$1 ORDER BY r.name LIMIT 50`,[userId]);
 return {restaurants:r.rows};
});
app.get('/v1/restaurant/:rid/orders',async(req)=>{
 const rid=idParam(req,'rid');await staff(req,rid);
 // This list is summary-only; addresses and customer notes are only loaded
 // after a separate authenticated, restaurant-scoped details request.
 const r=await pool.query(MERCHANT_SUMMARY_QUERY,[rid]);return {orders:r.rows};
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
// Business-operable restaurant management: only assigned personnel with menu
// permission, no customer order PII. Availability and pricing changes are
// server-scoped and audited; client code never chooses a restaurant to impersonate.
app.get('/v1/restaurant/:rid/management',async(req)=>{
 const rid=idParam(req,'rid');const {role}=await staff(req,rid,'menu');
 const [restaurant,products,hours,zones,categories]=await Promise.all([
  pool.query('SELECT id,name,active,is_open,is_busy,accepts_orders FROM restaurants WHERE id=$1',[rid]),
  pool.query(`SELECT p.id,p.name,p.description,p.price_kurus,p.available,p.image_url,p.category_id,p.revision,
   c.name AS category_name
   FROM products p JOIN categories c ON c.restaurant_id=p.restaurant_id AND c.id=p.category_id
   WHERE p.restaurant_id=$1 ORDER BY c.sort_order,c.name,p.sort_order,p.name LIMIT 500`,[rid]),
  pool.query(`SELECT day_of_week AS "dayOfWeek",
    to_char(open_time,'HH24:MI') AS "openTime",
    to_char(close_time,'HH24:MI') AS "closeTime"
    FROM restaurant_hours WHERE restaurant_id=$1 ORDER BY day_of_week,open_time`,[rid]),
  pool.query(`SELECT dz.zone_id,z.name,dz.enabled,dz.min_basket_kurus,dz.delivery_fee_kurus
    FROM restaurant_delivery_zones dz JOIN delivery_zones z ON z.id=dz.zone_id
    WHERE dz.restaurant_id=$1 ORDER BY z.name LIMIT 100`,[rid]),
  pool.query('SELECT id,name,sort_order FROM categories WHERE restaurant_id=$1 ORDER BY sort_order,name LIMIT 50',[rid])
 ]);
 if(!restaurant.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
 return {restaurant:restaurant.rows[0],products:products.rows,hours:hours.rows,zones:zones.rows,categories:categories.rows,
  permissions:{canManageMenu:true,canManageSettings:role==='owner'||role==='manager'}};
});
// New menu entries start unavailable so an unfinished draft can never be
// ordered. All writes are audited and bound to the authenticated restaurant.
app.post('/v1/restaurant/:rid/categories',async(req,reply)=>{
 const rid=idParam(req,'rid'),{userId}=await staff(req,rid,'menu');
 const name=parseCategoryDraft(req.body);
 const category=await transaction(pool,async db=>{
  const rest=await db.query('SELECT id FROM restaurants WHERE id=$1 FOR UPDATE',[rid]);
  if(!rest.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
  const current=await db.query('SELECT id,name FROM categories WHERE restaurant_id=$1',[rid]);
  if(current.rows.length>=40)invalid('CATEGORY_LIMIT','Restoranda en çok 40 kategori bulunabilir.',409);
  if(current.rows.some(c=>(c.name as string).toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')))
   invalid('CATEGORY_EXISTS','Bu kategori zaten mevcut.',409);
  const result=await db.query('INSERT INTO categories(restaurant_id,name) VALUES($1,$2) RETURNING id,name,sort_order',[rid,name]);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
   [userId,'menu_category_create','category',result.rows[0].id,JSON.stringify({restaurantId:rid,name})]);
  return result.rows[0];
 });
 reply.code(201);return {category};
});
app.patch('/v1/restaurant/:rid/categories/:cid',async(req)=>{
 const rid=idParam(req,'rid'),cid=idParam(req,'cid'),{userId}=await staff(req,rid,'menu');
 const name=parseCategoryDraft(req.body);
 return transaction(pool,async db=>{
  const rest=await db.query('SELECT id FROM restaurants WHERE id=$1 FOR UPDATE',[rid]);
  if(!rest.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
  const current=await db.query('SELECT id,name FROM categories WHERE restaurant_id=$1',[rid]);
  const existing=current.rows.find(c=>c.id===cid);
  if(!existing)invalid('NOT_FOUND','Kategori bu restoranda bulunamadı.',404);
  if(current.rows.some(c=>c.id!==cid&&(c.name as string).toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')))
   invalid('CATEGORY_EXISTS','Bu kategori zaten mevcut.',409);
  const changed=await db.query('UPDATE categories SET name=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING id,name,sort_order',[name,cid,rid]);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
   [userId,'menu_category_rename','category',cid,JSON.stringify({restaurantId:rid,oldName:existing.name,newName:name})]);
  return {category:changed.rows[0]};
 });
});
// A file upload is not the same as accepting an arbitrary remote photo URL.
// The route checks MFA before receiving a 5 MB binary request body, strips
// metadata and stores a WebP with an immutable restaurant-owned media record.
app.post('/v1/restaurant/:rid/photos',{
 bodyLimit:MAX_PHOTO_UPLOAD_BYTES,
 onRequest:async req=>{await staff(req,idParam(req,'rid'),'menu')}
},async(req,reply)=>{
 const rid=idParam(req,'rid'),{userId}=await staff(req,rid,'menu');
 if(req.headers['x-photo-rights-affirmed']!=='true')
  invalid('PHOTO_RIGHTS_REQUIRED','Yalnızca paylaşma hakkınız olan restoran fotoğraflarını yükleyebilirsiniz.',400);
 const settings=photoStorageSettings();
 if(!settings)invalid('PHOTO_STORAGE_NOT_READY','Fotoğraf yükleme sunucusu henüz yapılandırılmadı.',503);
 if(!Buffer.isBuffer(req.body))
  invalid('PHOTO_TYPE','Fotoğrafı JPEG, PNG veya WebP dosyası olarak gönderin.',415);
 const current=await pool.query(`SELECT
   count(*)::int AS total,
   count(*) FILTER (WHERE created_at>now()-interval '1 hour')::int AS recent
  FROM restaurant_media WHERE restaurant_id=$1`,[rid]);
 if(current.rows[0].total>=1000||current.rows[0].recent>=40)
  invalid('PHOTO_LIMIT','Fotoğraf kotasına ulaşıldı; eski fotoğrafları düzenleyin.',429);
 const photo=await prepareRestaurantPhoto(req.body);
 const key=photoObjectKey(rid);
 const url=photoPublicUrl(settings,key);
 const storage=s3MediaStorage(settings);
 await storage.put(key,photo.bytes);
 try{
  const result=await transaction(pool,async db=>{
   const r=await db.query(`INSERT INTO restaurant_media
    (restaurant_id,uploaded_by,object_key,public_url,byte_size,width,height)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    RETURNING id,public_url,width,height,byte_size`,
    [rid,userId,key,url,photo.bytes.length,photo.width,photo.height]);
   await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
    VALUES($1,$2,$3,$4,$5::jsonb)`,
    [userId,'restaurant_photo_upload','media',r.rows[0].id,
     JSON.stringify({restaurantId:rid,sourceFormat:photo.sourceFormat,rightsConfirmed:true})]);
   return r.rows[0];
  });
  reply.code(201);
  return {mediaId:result.id,imageUrl:result.public_url,width:result.width,
   height:result.height,sizeBytes:result.byte_size};
 }catch(error){
  try{await storage.remove(key)}catch{req.log.error('orphaned media object after failed DB write')}
  throw error;
 }
});
async function verifyRestaurantPhotoOwnership(db:{query:typeof pool.query},restaurantId:string,url:string|null){
 if(url?.startsWith('https://')){
  const proof=await db.query('SELECT 1 FROM restaurant_media WHERE restaurant_id=$1 AND public_url=$2',[restaurantId,url]);
  if(!proof.rowCount)invalid('PHOTO_NOT_OWNED','Bu fotoğraf bu restorana ait değil veya yüklenmemiş.',409);
 }
}
app.post('/v1/restaurant/:rid/products',async(req,reply)=>{
 const rid=idParam(req,'rid'),{userId}=await staff(req,rid,'menu');
 const input=parseProductDraft(req.body);
 const product=await transaction(pool,async db=>{
  // Restaurant lock serializes two employees attempting to fill the last slot.
  const rest=await db.query('SELECT id FROM restaurants WHERE id=$1 FOR UPDATE',[rid]);
  if(!rest.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
  const count=await db.query('SELECT count(*)::int AS count FROM products WHERE restaurant_id=$1',[rid]);
  if(count.rows[0].count>=500)invalid('PRODUCT_LIMIT','Bu restoran için 500 ürün sınırına ulaşıldı.',409);
  const cat=await db.query('SELECT id FROM categories WHERE restaurant_id=$1 AND id=$2',[rid,input.categoryId]);
  if(!cat.rowCount)invalid('CATEGORY_INVALID','Kategori bu restorana ait değil.',409);
  await verifyRestaurantPhotoOwnership(db,rid,input.imageUrl);
  const p=await db.query(`INSERT INTO products(restaurant_id,category_id,name,description,price_kurus,image_url,available)
   VALUES($1,$2,$3,$4,$5,$6,false)
   RETURNING id,category_id,name,description,price_kurus,image_url,available,revision`,
   [rid,input.categoryId,input.name,input.description,input.priceKurus,input.imageUrl]);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
   [userId,'menu_product_create','product',p.rows[0].id,JSON.stringify({restaurantId:rid,categoryId:input.categoryId,priceKurus:input.priceKurus})]);
  return p.rows[0];
 });
 reply.code(201);return {product};
});
app.patch('/v1/restaurant/:rid/products/:pid/details',async(req)=>{
 const rid=idParam(req,'rid'),pid=idParam(req,'pid'),{userId}=await staff(req,rid,'menu');
 const input=parseProductDraft(req.body);
 const body=req.body as Record<string,unknown>;
 if(!Number.isInteger(body.revision)||Number(body.revision)<1||Number(body.revision)>2147483647)
  invalid('REVISION_REQUIRED','Ürün güncellemesi için geçerli sürüm numarası gerekli.');
 const revision=body.revision as number;
 return transaction(pool,async db=>{
  const cat=await db.query('SELECT id FROM categories WHERE restaurant_id=$1 AND id=$2',[rid,input.categoryId]);
  if(!cat.rowCount)invalid('CATEGORY_INVALID','Kategori bu restorana ait değil.',409);
  await verifyRestaurantPhotoOwnership(db,rid,input.imageUrl);
  const p=await db.query(`UPDATE products SET category_id=$1,name=$2,description=$3,price_kurus=$4,image_url=$5,
   revision=revision+1 WHERE restaurant_id=$6 AND id=$7 AND revision=$8
   RETURNING id,category_id,name,description,price_kurus,image_url,available,revision`,
   [input.categoryId,input.name,input.description,input.priceKurus,input.imageUrl,rid,pid,revision]);
  if(!p.rowCount){
   const exists=await db.query('SELECT 1 FROM products WHERE restaurant_id=$1 AND id=$2',[rid,pid]);
   if(!exists.rowCount)invalid('NOT_FOUND','Ürün bu restoranda bulunamadı.',404);
   invalid('PRODUCT_CONFLICT','Ürün başka bir işlemde değişti. Önce menüyü yenileyin.',409);
  }
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
   [userId,'menu_product_update','product',pid,JSON.stringify({restaurantId:rid,categoryId:input.categoryId,priceKurus:input.priceKurus,revisionBefore:revision})]);
  return {product:p.rows[0]};
 });
});
app.put('/v1/restaurant/:rid/hours',async(req)=>{
 const rid=idParam(req,'rid'),{userId,role}=await staff(req,rid,null);
 if(role==='staff')invalid('ROLE_FORBIDDEN','Çalışma saatlerini yalnızca restoran sahibi veya yöneticisi değiştirebilir.',403);
 const body=(req.body??{}) as Record<string,unknown>;
 const slots=parseWeeklyHours(body.slots);
 return transaction(pool,async db=>{
  const rest=await db.query('SELECT id FROM restaurants WHERE id=$1 FOR UPDATE',[rid]);
  if(!rest.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
  await db.query('DELETE FROM restaurant_hours WHERE restaurant_id=$1',[rid]);
  for(const slot of slots){
   await db.query('INSERT INTO restaurant_hours(restaurant_id,day_of_week,open_time,close_time) VALUES($1,$2,$3,$4)',
    [rid,slot.dayOfWeek,slot.openTime,slot.closeTime]);
  }
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
   [userId,'restaurant_hours_update','restaurant',rid,JSON.stringify({slots})]);
  return {restaurantId:rid,hours:slots};
 });
});
app.patch('/v1/restaurant/:rid/zones/:zid',async(req)=>{
 const rid=idParam(req,'rid'),zid=idParam(req,'zid'),{userId,role}=await staff(req,rid,null);
 if(role==='staff')invalid('ROLE_FORBIDDEN','Teslimat bölgelerini yalnızca restoran sahibi veya yöneticisi değiştirebilir.',403);
 const input=parseZonePolicy(req.body);
 return transaction(pool,async db=>{
  const zone=await db.query(`UPDATE restaurant_delivery_zones
    SET enabled=$1,min_basket_kurus=$2,delivery_fee_kurus=$3
    WHERE restaurant_id=$4 AND zone_id=$5
    RETURNING zone_id,enabled,min_basket_kurus,delivery_fee_kurus`,
   [input.enabled,input.minBasketKurus,input.deliveryFeeKurus,rid,zid]);
  if(!zone.rowCount)invalid('NOT_FOUND','Bu mahalle restorana tanımlı değil.',404);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
   [userId,'restaurant_zone_update','restaurant',rid,JSON.stringify({zoneId:zid,...input})]);
  return {zone:zone.rows[0]};
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
 const description=typeof b.description==='string'?b.description:'';
 if(!uuid(b.orderId)||typeof b.issueType!=='string'||!allowed.includes(b.issueType)||description.trim().length<10||description.length>1200)
  invalid('SUPPORT_INVALID','Sipariş, konu ve en az 10 karakterli açıklama gerekli.');
 const result=await pool.query(`INSERT INTO support_cases(customer_id,order_id,issue_type,description)
  SELECT $1,o.id,$3,$4 FROM orders o WHERE o.id=$2 AND o.customer_id=$1 RETURNING id,created_at`,
  [userId,b.orderId,b.issueType,description.trim()]);
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
 const escalations=await pool.query(`SELECT restaurant_id,count(*)::int AS count
  FROM restaurant_escalations
  WHERE sent_at IS NULL AND cancelled_at IS NULL
   AND (dead_at IS NOT NULL OR (next_attempt_at<=now() AND due_at<now()-interval '20 seconds'))
  GROUP BY restaurant_id ORDER BY count DESC LIMIT 50`);
 return {latePending:pending.rows,notificationIssues:delivery.rows,escalationIssues:escalations.rows};
});
// MFA-protected diagnostic list: never returns customer PII.
app.get('/v1/admin/escalations',async(req)=>{
 await admin(req);
 const result=await pool.query(`SELECT e.order_id,e.restaurant_id,e.due_at,e.next_attempt_at,
   e.attempts,e.sent_at,e.dead_at,o.status
  FROM restaurant_escalations e JOIN orders o ON o.id=e.order_id
  WHERE e.dead_at IS NOT NULL OR
   (e.sent_at IS NULL AND e.cancelled_at IS NULL AND e.next_attempt_at<=now())
  ORDER BY e.next_attempt_at ASC LIMIT 100`);
 return {escalations:result.rows};
});
app.post('/v1/admin/escalations/:id/retry',async(req)=>{
 const {userId}=await admin(req);
 const orderId=idParam(req,'id');
 return transaction(pool,async db=>{
  const result=await db.query(`UPDATE restaurant_escalations e
   SET attempts=0,dead_at=NULL,last_error=NULL,next_attempt_at=now()
   FROM orders o WHERE e.order_id=$1 AND e.order_id=o.id
    AND e.sent_at IS NULL AND e.cancelled_at IS NULL
    AND o.status='beklemede' AND o.expires_at>now()
   RETURNING e.order_id,e.restaurant_id`,[orderId]);
  if(!result.rowCount)invalid('NOT_RETRYABLE','Sipariş artık beklemede değil veya uyarı zaten teslim edildi.',409);
  await db.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
   [userId,'escalation_retry','order',orderId,JSON.stringify({restaurantId:result.rows[0].restaurant_id})]);
  return {orderId,requeued:true};
 });
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
 const active=typeof body.active==='boolean'?body.active:invalid('INVALID_REQUEST','Aktiflik bilgisi boolean olmalı.');
 return activateRestaurant(pool,userId,id,active);
});

async function start(){
 try{
  const applied=await pool.query('SELECT filename FROM schema_migrations WHERE filename=ANY($1::text[])',[[...REQUIRED_MIGRATIONS]]);
  if(!hasRequiredMigrations(applied.rows))throw new Error('Required database migrations missing. Refusing to start API.');
  await app.listen({port:Number.isInteger(port)?port:4000,host:'127.0.0.1'});
  console.log('API http://127.0.0.1:'+port+' üzerinde. Canlı kullanım için yapılandırma ve testler gerekli.');
 }
 catch(err){console.error(err);process.exitCode=1;await app.close();await pool.end()}
}
await start();
process.on('SIGINT',()=>{void app.close().then(()=>pool.end())});
process.on('SIGTERM',()=>{void app.close().then(()=>pool.end())});
