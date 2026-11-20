/** Customer address book: no hard delete of order-linked addresses.
 * All reads/writes are owner-scoped; archived addresses cannot be used for
 * checkout even if an old browser tab still holds the ID.
 */
import type {Pool} from 'pg';
import {invalid,uuid} from './domain.ts';
import {transaction} from './order-service.ts';
export type AddressDraft={zoneId:string;label:string;fullAddress:string;directions:string;phone:string};

export function parseAddressDraft(raw:unknown):AddressDraft{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))
  invalid('ADDRESS_INVALID','Adres bilgileri geçersiz.');
 const b=raw as Record<string,unknown>;
 if(!uuid(b.zoneId)||typeof b.fullAddress!=='string'||typeof b.phone!=='string')
  invalid('ADDRESS_INVALID','Mahalle, adres ve telefon gerekli.');
 const fullAddress=(b.fullAddress as string).trim();
 const phone=(b.phone as string).trim();
 const label=b.label===undefined||b.label===null?'Ev':b.label;
 const directions=b.directions===undefined||b.directions===null?'':b.directions;
 if(typeof label!=='string'||typeof directions!=='string')
  invalid('ADDRESS_INVALID','Başlık ve adres tarifi geçersiz.');
 const normalizedLabel=(label as string).trim().replace(/\s+/g,' ')||'Ev';
 const normalizedDirections=(directions as string).trim();
 if(fullAddress.length<8||fullAddress.length>900||
  /[<>\x00-\x1f]/.test(fullAddress)||
  normalizedLabel.length>45||/[<>\x00-\x1f]/.test(normalizedLabel)||
  normalizedDirections.length>400||/\x00/.test(normalizedDirections)||
  !/^05\d{9}$/.test(phone))
  invalid('ADDRESS_INVALID','Adres, başlık veya telefon bilgilerini kontrol edin.');
 return {zoneId:b.zoneId as string,label:normalizedLabel,fullAddress,directions:normalizedDirections,phone};
}
async function enabledZone(db:{query:Pool['query']},zoneId:string){
 const result=await db.query('SELECT 1 FROM delivery_zones WHERE id=$1 AND enabled=true',[zoneId]);
 if(!result.rowCount)invalid('ZONE_INVALID','Mahalle uygun değil veya kapalı.',409);
}
export async function listCustomerAddresses(pool:Pool,userId:string){
 const result=await pool.query(`SELECT id,label,zone_id,full_address,directions,phone
  FROM addresses WHERE user_id=$1 AND archived_at IS NULL
  ORDER BY created_at DESC LIMIT 30`,[userId]);
 return {addresses:result.rows};
}
export async function addCustomerAddress(pool:Pool,userId:string,raw:unknown){
 const input=parseAddressDraft(raw);
 return transaction(pool,async db=>{
  await enabledZone(db,input.zoneId);
  const count=await db.query('SELECT count(*)::int AS n FROM addresses WHERE user_id=$1 AND archived_at IS NULL',[userId]);
  if(count.rows[0].n>=30)invalid('ADDRESS_LIMIT','En fazla 30 kayıtlı adres olabilir. Önce kullanılmayan bir adresi arşivleyin.',409);
  const result=await db.query(`INSERT INTO addresses
   (user_id,zone_id,label,full_address,directions,phone) VALUES($1,$2,$3,$4,$5,$6)
   RETURNING id`,[userId,input.zoneId,input.label,input.fullAddress,input.directions,input.phone]);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'customer_address_add','address',$2,'{}'::jsonb)`,[userId,result.rows[0].id]);
  return {id:result.rows[0].id};
 });
}
export async function editCustomerAddress(pool:Pool,userId:string,addressId:string,raw:unknown){
 if(!uuid(addressId))invalid('INVALID_ID','Adres numarası geçersiz.');
 const input=parseAddressDraft(raw);
 return transaction(pool,async db=>{
  const existing=await db.query(`SELECT id FROM addresses
   WHERE id=$1 AND user_id=$2 AND archived_at IS NULL FOR UPDATE`,[addressId,userId]);
  if(!existing.rowCount)invalid('NOT_FOUND','Adres bulunamadı veya kullanım dışı.',404);
  await enabledZone(db,input.zoneId);
  const result=await db.query(`UPDATE addresses SET zone_id=$1,label=$2,full_address=$3,
   directions=$4,phone=$5 WHERE id=$6 AND user_id=$7 AND archived_at IS NULL
   RETURNING id,label,zone_id,full_address,directions,phone`,
   [input.zoneId,input.label,input.fullAddress,input.directions,input.phone,addressId,userId]);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'customer_address_update','address',$2,'{}'::jsonb)`,[userId,addressId]);
  return {address:result.rows[0]};
 });
}
export async function archiveCustomerAddress(pool:Pool,userId:string,addressId:string){
 if(!uuid(addressId))invalid('INVALID_ID','Adres numarası geçersiz.');
 return transaction(pool,async db=>{
  const result=await db.query(`UPDATE addresses SET archived_at=now()
   WHERE id=$1 AND user_id=$2 AND archived_at IS NULL RETURNING id`,[addressId,userId]);
  if(!result.rowCount)invalid('NOT_FOUND','Adres bulunamadı veya kullanım dışı.',404);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'customer_address_archive','address',$2,'{}'::jsonb)`,[userId,addressId]);
  return {id:result.rows[0].id,archived:true};
 });
}
