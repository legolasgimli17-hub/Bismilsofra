/** Pilot-access workflows: no global staff directory, no cross-merchant privileges.
 * MFA and verified identity are enforced by routes, then roles are rechecked
 * inside the same transaction that mutates permissions.
 */
import type {Pool,PoolClient} from 'pg';
import {invalid,uuid} from './domain.ts';
import {transaction} from './order-service.ts';
import {parseOwnerEmail} from './admin-onboarding.ts';

type MemberRole='staff'|'manager';
type MemberPermissions={
 role:MemberRole;can_view_orders:boolean;can_manage_orders:boolean;can_manage_menu:boolean
};
type MemberSnapshot=MemberPermissions|{role:'owner';can_view_orders:boolean;can_manage_orders:boolean;can_manage_menu:boolean};
export type StaffRow=MemberSnapshot&{user_id:string;email:string;enabled:boolean};
const REASONS=['abuse','suspicious_activity','support_request','appeal','other'] as const;
type AccessReason=typeof REASONS[number];

const object=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))invalid('ACCESS_INVALID','Yetki bilgisi geçersiz.');
 return v as Record<string,unknown>;
};
const bool=(v:unknown)=>typeof v==='boolean';
export function parseMemberPermissions(value:unknown):MemberPermissions{
 const b=object(value);
 if(b.role!=='staff'&&b.role!=='manager')invalid('ROLE_INVALID','Sadece çalışan veya yönetici rolü atanabilir.');
 if(!bool(b.canViewOrders)||!bool(b.canManageOrders)||!bool(b.canManageMenu))
  invalid('PERMISSIONS_INVALID','Üç personel yetkisi de açıkça belirtilmelidir.');
 if(b.role==='staff'&&b.canManageOrders===true&&b.canViewOrders!==true)
  invalid('PERMISSIONS_INVALID','Sipariş yöneten çalışan siparişleri de görebilmeli.');
 // Manager privileges come from role, NOT from client-controlled flag values.
 if(b.role==='manager'&&(!b.canViewOrders||!b.canManageOrders||!b.canManageMenu))
  invalid('PERMISSIONS_INVALID','Restoran yöneticisi tüm yönetim izinlerine sahip olmalı.');
 return {role:b.role as MemberRole,can_view_orders:b.canViewOrders as boolean,
  can_manage_orders:b.canManageOrders as boolean,can_manage_menu:b.canManageMenu as boolean};
}
export function parseStaffGrant(value:unknown):{email:string;access:MemberPermissions}{
 const b=object(value);
 const email=parseOwnerEmail({email:b.email});
 return {email,access:parseMemberPermissions(b)};
}
export function parseStaffUpdate(value:unknown):{expected:MemberSnapshot;next:MemberPermissions}{
 const b=object(value);
 const e=object(b.expected);
 const role=e.role;
 if(role!=='staff'&&role!=='manager')invalid('ROLE_INVALID','Sahip yetkisi bu ekrandan değiştirilemez.');
 if(!bool(e.canViewOrders)||!bool(e.canManageOrders)||!bool(e.canManageMenu))
  invalid('PERMISSIONS_INVALID','Önce mevcut personel yetkilerini doğrulayın.');
 return {expected:{role:role as MemberRole,can_view_orders:e.canViewOrders as boolean,
  can_manage_orders:e.canManageOrders as boolean,can_manage_menu:e.canManageMenu as boolean},
  next:parseMemberPermissions(b.next)};
}
export function parseMemberRemoval(value:unknown):MemberSnapshot{
 const b=object(value);
 return parseStaffUpdate({expected:b.expected,next:{
  role:'staff',canViewOrders:false,canManageOrders:false,canManageMenu:false
 }}).expected;
}
export function parseAdminAccess(value:unknown):{
 enabled:boolean;expectedEnabled:boolean;reasonCode:AccessReason
}{
 const b=object(value);
 if(!bool(b.enabled)||!bool(b.expectedEnabled)||!REASONS.includes(b.reasonCode as AccessReason))
  invalid('ACCESS_INVALID','Aktiflik, önceki durum ve neden kodu gerekli.');
 if(b.enabled===b.expectedEnabled)invalid('ACCESS_INVALID','Durum değişmedi.');
 return {enabled:b.enabled as boolean,expectedEnabled:b.expectedEnabled as boolean,
  reasonCode:b.reasonCode as AccessReason};
}
async function lockRestaurant(db:PoolClient,rid:string){
 const r=await db.query('SELECT id FROM restaurants WHERE id=$1 FOR UPDATE',[rid]);
 if(!r.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
}
async function operator(db:PoolClient,rid:string,actorId:string):Promise<'owner'|'manager'>{
 const a=await db.query('SELECT role FROM restaurant_staff WHERE restaurant_id=$1 AND user_id=$2',[rid,actorId]);
 if(!a.rowCount||(a.rows[0].role!=='owner'&&a.rows[0].role!=='manager'))
  invalid('ROLE_FORBIDDEN','Personeli yalnızca restoran sahibi veya yöneticisi yönetebilir.',403);
 return a.rows[0].role as 'owner'|'manager';
}
const memberMatches=(r:Record<string,unknown>,x:MemberSnapshot)=>
 r.role===x.role&&r.can_view_orders===x.can_view_orders&&
 r.can_manage_orders===x.can_manage_orders&&r.can_manage_menu===x.can_manage_menu;
const audit=async(db:PoolClient,actorId:string,action:string,rid:string,details:Record<string,unknown>)=>
 db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
  VALUES($1,$2,'restaurant',$3,$4::jsonb)`,[actorId,action,rid,JSON.stringify(details)]);

export async function getRestaurantTeam(pool:Pool,rid:string,actorId:string){
 // Never list other businesses or customers. Owners/managers must have MFA at the route.
 const who=await pool.query(`SELECT role FROM restaurant_staff WHERE restaurant_id=$1 AND user_id=$2`,[rid,actorId]);
 if(!who.rowCount||!['owner','manager'].includes(who.rows[0].role))
  invalid('ROLE_FORBIDDEN','Personel listesine erişiminiz yok.',403);
 const members=await pool.query(`SELECT s.user_id,u.verified_email AS email,u.enabled,s.role,
  s.can_view_orders,s.can_manage_orders,s.can_manage_menu
  FROM restaurant_staff s JOIN users u ON u.id=s.user_id
  WHERE s.restaurant_id=$1 ORDER BY s.role,u.verified_email LIMIT 51`,[rid]);
 return {members:members.rows as StaffRow[],operatorRole:who.rows[0].role as 'owner'|'manager'};
}
export async function addRestaurantMember(pool:Pool,rid:string,actorId:string,raw:unknown){
 const {email,access}=parseStaffGrant(raw);
 return transaction(pool,async db=>{
  await lockRestaurant(db,rid);
  const role=await operator(db,rid,actorId);
  if(role==='manager'&&access.role==='manager')
   invalid('ROLE_FORBIDDEN','Yönetici yalnızca çalışan ekleyebilir.',403);
  const count=await db.query('SELECT count(*)::int AS count FROM restaurant_staff WHERE restaurant_id=$1',[rid]);
  if(count.rows[0].count>=25)invalid('TEAM_LIMIT','Bir restoranda en fazla 25 personel olabilir.',409);
  const target=await db.query(`SELECT id FROM users WHERE enabled=true AND lower(verified_email)=$1
   ORDER BY id LIMIT 2`,[email]);
  if(!target.rowCount)invalid('STAFF_NOT_REGISTERED','Çalışan önce doğrulanmış hesabıyla giriş yapmalı.',404);
  if(target.rows.length!==1)invalid('STAFF_AMBIGUOUS','E-posta birden fazla hesapta; manuel doğrulama gerekli.',409);
  const targetId=target.rows[0].id as string;
  const inserted=await db.query(`INSERT INTO restaurant_staff(user_id,restaurant_id,role,
   can_view_orders,can_manage_orders,can_manage_menu)
   VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING user_id`,
   [targetId,rid,access.role,access.can_view_orders,access.can_manage_orders,access.can_manage_menu]);
  if(!inserted.rowCount)invalid('STAFF_EXISTS','Bu kullanıcı restoran ekibinde.',409);
  await audit(db,actorId,'restaurant_staff_add',rid,{memberId:targetId,role:access.role,view:access.can_view_orders,orders:access.can_manage_orders,menu:access.can_manage_menu});
  return {userId:targetId,role:access.role};
 });
}
export async function updateRestaurantMember(pool:Pool,rid:string,actorId:string,targetId:string,raw:unknown){
 if(!uuid(targetId))invalid('INVALID_ID','Kullanıcı kimliği geçersiz.');
 const {expected,next}=parseStaffUpdate(raw);
 return transaction(pool,async db=>{
  await lockRestaurant(db,rid);
  const role=await operator(db,rid,actorId);
  if(role==='manager'&&(expected.role!=='staff'||next.role!=='staff'))
   invalid('ROLE_FORBIDDEN','Yönetici, yöneticilerin yetkisini değiştiremez.',403);
  const current=await db.query(`SELECT role,can_view_orders,can_manage_orders,can_manage_menu
   FROM restaurant_staff WHERE restaurant_id=$1 AND user_id=$2 FOR UPDATE`,[rid,targetId]);
  if(!current.rowCount)invalid('NOT_FOUND','Kullanıcı bu restoranda bulunamadı.',404);
  if(current.rows[0].role==='owner')invalid('OWNER_PROTECTED','İşletme sahibi rolü değiştirilemez.',403);
  if(!memberMatches(current.rows[0],expected))invalid('STAFF_CONFLICT','Personel yetkisi değişmiş, listeyi yenileyin.',409);
  const result=await db.query(`UPDATE restaurant_staff SET role=$1,can_view_orders=$2,
   can_manage_orders=$3,can_manage_menu=$4 WHERE restaurant_id=$5 AND user_id=$6
   RETURNING user_id,role,can_view_orders,can_manage_orders,can_manage_menu`,
   [next.role,next.can_view_orders,next.can_manage_orders,next.can_manage_menu,rid,targetId]);
  await audit(db,actorId,'restaurant_staff_update',rid,{memberId:targetId,from:expected.role,to:next.role,
   view:next.can_view_orders,orders:next.can_manage_orders,menu:next.can_manage_menu});
  return {member:result.rows[0]};
 });
}
export async function removeRestaurantMember(pool:Pool,rid:string,actorId:string,targetId:string,raw:unknown){
 if(!uuid(targetId))invalid('INVALID_ID','Kullanıcı kimliği geçersiz.');
 const expected=parseMemberRemoval(raw);
 return transaction(pool,async db=>{
  await lockRestaurant(db,rid);
  const role=await operator(db,rid,actorId);
  if(role==='manager'&&expected.role!=='staff')
   invalid('ROLE_FORBIDDEN','Yönetici başka bir yöneticiyi kaldıramaz.',403);
  const current=await db.query(`SELECT role,can_view_orders,can_manage_orders,can_manage_menu
   FROM restaurant_staff WHERE restaurant_id=$1 AND user_id=$2 FOR UPDATE`,[rid,targetId]);
  if(!current.rowCount)invalid('NOT_FOUND','Kullanıcı bu restoranda bulunamadı.',404);
  if(current.rows[0].role==='owner')invalid('OWNER_PROTECTED','İşletme sahibi ekipten kaldırılamaz.',403);
  if(role==='manager'&&current.rows[0].role==='manager')
   invalid('ROLE_FORBIDDEN','Yönetici başka bir yöneticiyi kaldıramaz.',403);
  if(!memberMatches(current.rows[0],expected))invalid('STAFF_CONFLICT','Personel yetkisi değişmiş, listeyi yenileyin.',409);
  await db.query('DELETE FROM restaurant_staff WHERE restaurant_id=$1 AND user_id=$2',[rid,targetId]);
  await audit(db,actorId,'restaurant_staff_remove',rid,{memberId:targetId,from:expected.role});
  return {removed:true};
 });
}
export async function exactAdminUserLookup(pool:Pool,emailRaw:unknown){
 const email=parseOwnerEmail({email:emailRaw});
 const users=await pool.query(`SELECT u.id,u.verified_email AS email,u.enabled,
  EXISTS(SELECT 1 FROM platform_admins p WHERE p.user_id=u.id) AS is_admin
  FROM users u WHERE lower(u.verified_email)=$1 ORDER BY u.id LIMIT 2`,[email]);
 if(users.rows.length>1)invalid('USER_AMBIGUOUS','Bu e-posta birden fazla kullanıcıya ait; hesap ID doğrulaması gerekli.',409);
 return {users:users.rows};
}
export async function setAdminUserAccess(pool:Pool,actorId:string,targetId:string,raw:unknown){
 if(!uuid(targetId))invalid('INVALID_ID','Kullanıcı kimliği geçersiz.');
 const change=parseAdminAccess(raw);
 return transaction(pool,async db=>{
  // Prevent concurrent admins from each disabling a different last-admin.
  await db.query('SELECT pg_advisory_xact_lock(50991254)');
  const admin=await db.query(`SELECT 1 FROM platform_admins p
   JOIN users u ON u.id=p.user_id AND u.enabled=true WHERE p.user_id=$1`,[actorId]);
  if(!admin.rowCount)invalid('ROLE_FORBIDDEN','Aktif platform yöneticisi gerekli.',403);
  if(targetId===actorId)invalid('SELF_LOCK','Kendi hesabınızı bu panelden değiştiremezsiniz.',403);
  const current=await db.query('SELECT id,enabled FROM users WHERE id=$1 FOR UPDATE',[targetId]);
  if(!current.rowCount)invalid('NOT_FOUND','Kullanıcı bulunamadı.',404);
  if(current.rows[0].enabled!==change.expectedEnabled)
   invalid('USER_CONFLICT','Hesap durumu değişmiş. Kullanıcıyı yeniden sorgulayın.',409);
  if(!change.enabled){
   const last=await db.query(`SELECT EXISTS(SELECT 1 FROM platform_admins a
    WHERE a.user_id=$1) AS is_admin`,[targetId]);
   if(last.rows[0].is_admin){
    const count=await db.query(`SELECT count(*)::int AS total
     FROM platform_admins a JOIN users u ON u.id=a.user_id WHERE u.enabled=true`);
    if(count.rows[0].total<=1)invalid('LAST_ADMIN','Son aktif platform yöneticisi kısıtlanamaz.',409);
   }
   const owner=await db.query(`SELECT EXISTS(
    SELECT 1 FROM restaurant_staff s
     JOIN restaurants r ON r.id=s.restaurant_id AND r.active=true
     WHERE s.user_id=$1 AND s.role='owner'
      AND NOT EXISTS(SELECT 1 FROM restaurant_staff another
        JOIN users enabled_owner ON enabled_owner.id=another.user_id AND enabled_owner.enabled=true
        WHERE another.restaurant_id=s.restaurant_id AND another.role='owner'
          AND another.user_id<>$1)
    ) AS sole_active_owner`,[targetId]);
   if(owner.rows[0].sole_active_owner)
    invalid('SOLE_OWNER','Aktif restoranın tek sahibi kısıtlanamaz. Önce restoranı kapatın.',409);
  }
  const result=await db.query('UPDATE users SET enabled=$1 WHERE id=$2 RETURNING id,enabled',[change.enabled,targetId]);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'admin_user_access','user',$2,$3::jsonb)`,
   [actorId,targetId,JSON.stringify({from:change.expectedEnabled,to:change.enabled,reasonCode:change.reasonCode})]);
  return {user:result.rows[0]};
 });
}
