/** MFA-only operator onboarding. A new restaurant is a PRIVATE, CLOSED draft. */
import type {Pool} from 'pg';
import {invalid,uuid} from './domain.ts';
import {transaction} from './order-service.ts';
import {parseZonePolicy} from './merchant-management.ts';

type Draft={name:string;slug:string;phone:string|null};
function textName(value:unknown,min:number,max:number,label:string){
 if(typeof value!=='string')invalid('ONBOARD_INVALID',label+' gerekli.');
 const cleaned=(value as string).trim().replace(/\s+/g,' ');
 if(cleaned.length<min||cleaned.length>max||/[<>\x00-\x1f\x7f]/.test(cleaned))
  invalid('ONBOARD_INVALID',label+' uzunluğu veya karakterleri geçersiz.');
 return cleaned;
}
export function parseRestaurantDraft(raw:unknown):Draft{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))
  invalid('ONBOARD_INVALID','Restoran taslağı geçersiz.');
 const r=raw as Record<string,unknown>;
 const name=textName(r.name,2,120,'Restoran adı');
 if(typeof r.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||r.slug.length>70||r.slug.length<3)
  invalid('ONBOARD_INVALID','Bağlantı adı 3–70 küçük harf, rakam veya tire içermeli.');
 const phone=r.phone===undefined||r.phone===null||r.phone===''?null:r.phone;
 if(phone!==null&&(typeof phone!=='string'||!/^05[0-9]{9}$/.test(phone)))
  invalid('ONBOARD_INVALID','İşletme telefonu 05XXXXXXXXX biçiminde olmalı.');
 return {name,slug:r.slug as string,phone:phone as string|null};
}
export function parseOwnerEmail(raw:unknown):string{
 const b=raw as Record<string,unknown>|null;
 if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.email!=='string')
  invalid('OWNER_INVALID','Kayıtlı ve e-postası doğrulanmış kullanıcı gerekli.');
 const email=(b?.email as string).trim().toLowerCase();
 if(email.length<5||email.length>250||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  invalid('OWNER_INVALID','Geçerli e-posta girin.');
 return email;
}
export function parseDeliveryZoneDraft(raw:unknown):string{
 const b=raw as Record<string,unknown>|null;
 return textName(b&&!Array.isArray(b)?b.name:undefined,2,110,'Mahalle');
}
export function parseRestaurantZone(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))
  invalid('ZONE_POLICY_INVALID','Teslimat bölgesi geçersiz.');
 const b=raw as Record<string,unknown>;
 if(!uuid(b.zoneId))invalid('ZONE_INVALID','Geçerli mahalle seçin.');
 return {zoneId:b.zoneId as string,...parseZonePolicy(b)};
}
export async function listPilotRestaurants(pool:Pool){
 const result=await pool.query(`SELECT r.id,r.name,r.slug,r.phone,r.active,r.is_open,r.accepts_orders,r.active_slot,
  EXISTS(SELECT 1 FROM restaurant_staff s
   JOIN users u ON u.id=s.user_id AND u.enabled=true
   WHERE s.restaurant_id=r.id AND s.role='owner') AS has_owner,
  EXISTS(SELECT 1 FROM products p WHERE p.restaurant_id=r.id AND p.available=true) AS has_menu,
  EXISTS(SELECT 1 FROM restaurant_hours h WHERE h.restaurant_id=r.id) AS has_hours,
  EXISTS(SELECT 1 FROM restaurant_delivery_zones dz
   JOIN delivery_zones z ON z.id=dz.zone_id AND z.enabled=true
   WHERE dz.restaurant_id=r.id AND dz.enabled=true) AS has_delivery
 FROM restaurants r ORDER BY r.created_at DESC,r.id LIMIT 200`);
 return {restaurants:result.rows};
}
export async function createPilotRestaurant(pool:Pool,actor:string,raw:unknown){
 const draft=parseRestaurantDraft(raw);
 return transaction(pool,async db=>{
  // A bounded draft list prevents administrative setup mistakes from silently accumulating.
  await db.query('SELECT pg_advisory_xact_lock(50991251)');
  const count=await db.query('SELECT count(*)::int AS n FROM restaurants WHERE active=false');
  if(count.rows[0].n>=150)invalid('DRAFT_LIMIT','Taslak restoran sayısı sınırda.',409);
  const result=await db.query(`INSERT INTO restaurants(name,slug,phone,active,is_open,accepts_orders)
   VALUES($1,$2,$3,false,false,false) ON CONFLICT(slug) DO NOTHING
   RETURNING id,name,slug,phone,active,is_open,accepts_orders`,
   [draft.name,draft.slug,draft.phone]);
  if(!result.rowCount)invalid('SLUG_EXISTS','Bu restoran bağlantı adı kullanılıyor.',409);
  const item=result.rows[0];
  await db.query('INSERT INTO restaurant_settings(restaurant_id,accept_minutes) VALUES($1,4)',[item.id]);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'admin_restaurant_create','restaurant',$2,$3::jsonb)`,
   [actor,item.id,JSON.stringify({name:draft.name,slug:draft.slug})]);
  return item;
 });
}
export async function assignPilotOwner(pool:Pool,actor:string,restaurantId:string,raw:unknown){
 const email=parseOwnerEmail(raw);
 return transaction(pool,async db=>{
  const rest=await db.query('SELECT id,active FROM restaurants WHERE id=$1 FOR UPDATE',[restaurantId]);
  if(!rest.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
  if(rest.rows[0].active)invalid('OWNER_ACTIVE','Aktif işletme sahibi bu akışla değiştirilemez.',409);
  const owners=await db.query("SELECT 1 FROM restaurant_staff WHERE restaurant_id=$1 AND role='owner'",[restaurantId]);
  if(owners.rowCount)invalid('OWNER_EXISTS','Restoranın zaten bir sahibi var.',409);
  const users=await db.query(`SELECT id FROM users WHERE lower(verified_email)= $1 AND enabled=true
   ORDER BY id LIMIT 2`,[email]);
  if(!users.rowCount)invalid('OWNER_NOT_REGISTERED','Önce işletme sahibi doğrulanmış hesabıyla giriş yapmalı.',404);
  if(users.rows.length>1)invalid('OWNER_AMBIGUOUS','E-posta birden fazla hesapta bulunuyor; manuel inceleme gerekli.',409);
  const ownerId=users.rows[0].id as string;
  const inserted=await db.query(`INSERT INTO restaurant_staff(user_id,restaurant_id,role)
   VALUES($1,$2,'owner') ON CONFLICT DO NOTHING RETURNING user_id`,[ownerId,restaurantId]);
  if(!inserted.rowCount)invalid('STAFF_CONFLICT','Kullanıcı zaten restoran ekibinde, önce yetkisini inceleyin.',409);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'admin_restaurant_owner','restaurant',$2,$3::jsonb)`,
   [actor,restaurantId,JSON.stringify({ownerId})]);
  return {restaurantId,ownerAssigned:true};
 });
}
export async function linkPilotDeliveryZone(pool:Pool,actor:string,restaurantId:string,raw:unknown){
 const input=parseRestaurantZone(raw);
 return transaction(pool,async db=>{
  const rest=await db.query('SELECT id FROM restaurants WHERE id=$1 FOR UPDATE',[restaurantId]);
  if(!rest.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
  const valid=await db.query('SELECT id FROM delivery_zones WHERE id=$1 AND enabled=true',[input.zoneId]);
  if(!valid.rowCount)invalid('ZONE_UNAVAILABLE','Mahalle bulunamadı veya kapalı.',404);
  const result=await db.query(`INSERT INTO restaurant_delivery_zones
   (restaurant_id,zone_id,enabled,min_basket_kurus,delivery_fee_kurus)
   VALUES($1,$2,$3,$4,$5)
   ON CONFLICT(restaurant_id,zone_id) DO UPDATE SET
    enabled=EXCLUDED.enabled,min_basket_kurus=EXCLUDED.min_basket_kurus,
    delivery_fee_kurus=EXCLUDED.delivery_fee_kurus
   RETURNING zone_id,enabled,min_basket_kurus,delivery_fee_kurus`,
   [restaurantId,input.zoneId,input.enabled,input.minBasketKurus,input.deliveryFeeKurus]);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'admin_restaurant_zone','restaurant',$2,$3::jsonb)`,
   [actor,restaurantId,JSON.stringify({zoneId:input.zoneId,enabled:input.enabled,minBasketKurus:input.minBasketKurus,deliveryFeeKurus:input.deliveryFeeKurus})]);
  return result.rows[0];
 });
}
export async function createPilotDeliveryZone(pool:Pool,actor:string,raw:unknown){
 const name=parseDeliveryZoneDraft(raw);
 return transaction(pool,async db=>{
  await db.query('SELECT pg_advisory_xact_lock(50991252)');
  const existing=await db.query('SELECT id FROM delivery_zones WHERE lower(name)=lower($1)',[name]);
  if(existing.rowCount)invalid('ZONE_EXISTS','Bu mahalle zaten kayıtlı.',409);
  const result=await db.query('INSERT INTO delivery_zones(name) VALUES($1) RETURNING id,name,enabled',[name]);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'admin_zone_create','delivery_zone',$2,$3::jsonb)`,
   [actor,result.rows[0].id,JSON.stringify({name})]);
  return result.rows[0];
 });
}
