import {createRemoteJWKSet,jwtVerify,type JWTPayload} from 'jose';
import type {Pool} from 'pg';
import {invalid,canStaff,type StaffCapability} from './domain.ts';
const issuer=process.env.OIDC_ISSUER;
const audience=process.env.OIDC_AUDIENCE;
const jwksUrl=process.env.OIDC_JWKS_URL;
if(!issuer||!audience||!jwksUrl||issuer.includes('REPLACE-')||audience.includes('REPLACE-')||jwksUrl.includes('REPLACE-')){
 throw new Error('OIDC_ISSUER / OIDC_AUDIENCE / OIDC_JWKS_URL yapılandırılmamış. Güvenli doğrulama olmadan API başlamaz.');
}
const jwks=createRemoteJWKSet(new URL(jwksUrl));
export type Identity={sub:string,email?:string;emailVerified:boolean;amr:string[];authTime?:number};
export async function verifyBearer(header:unknown):Promise<Identity>{
 const authHeader=typeof header==='string'?header:'';
 if(!authHeader.startsWith('Bearer '))invalid('AUTH_REQUIRED','Oturum açmak gerekiyor.',401);
 const token=authHeader.slice(7).trim();
 if(!token||token.length>12000)invalid('AUTH_REQUIRED','Geçersiz kimlik bilgisi.',401);
 let p:JWTPayload;
 try{
  const verified=await jwtVerify(token,jwks,{issuer,audience,algorithms:['RS256','ES256','EdDSA'],clockTolerance:'5s'});
  p=verified.payload;
 }catch{invalid('AUTH_INVALID','Oturum geçersiz veya süresi dolmuş.',401)}
 if(typeof p!.sub!=='string'||p!.sub.length>250)invalid('AUTH_INVALID','Kimlik doğrulanamadı.',401);
 return {sub:p!.sub!,email:typeof p!.email==='string'?p!.email:undefined,emailVerified:p!.email_verified===true,amr:Array.isArray(p!.amr)?p!.amr.filter(x=>typeof x==='string') as string[]:[],authTime:typeof p!.auth_time==='number'?p!.auth_time:undefined};
}
export function requireVerifiedEmail(identity:Identity){if(!identity.emailVerified)invalid('EMAIL_NOT_VERIFIED','Sipariş için doğrulanmış e-posta gerekli.',403)}
export function requireMfa(identity:Identity,recent=false){
 // Deliberate fail-closed; map provider-specific trusted AMR values before connecting a real provider.
 if(!identity.amr.some(x=>['mfa','otp','totp','webauthn','hwk'].includes(x)))invalid('MFA_REQUIRED','Restoran/yönetici hesabında iki aşamalı doğrulama gerekli.',403);
 if(recent&&(!identity.authTime||Date.now()/1000-identity.authTime>600))invalid('REAUTH_REQUIRED','Kritik işlem için son 10 dakika içinde yeniden doğrulama gerekiyor.',403);
}
export async function provisionVerifiedUser(pool:Pool,ident:Identity):Promise<string>{
 requireVerifiedEmail(ident);
 const r=await pool.query(`INSERT INTO users(oidc_subject,verified_email) VALUES($1,$2) ON CONFLICT (oidc_subject) DO UPDATE SET verified_email=EXCLUDED.verified_email RETURNING id,enabled`,[ident.sub,ident.email??null]);
 if(!r.rows[0].enabled)invalid('ACCOUNT_DISABLED','Bu hesap kısıtlanmış.',403);
 return r.rows[0].id;
}
export async function requireStaff(pool:Pool,userId:string,restaurantId:string,capability:StaffCapability='view'){
 const r=await pool.query('SELECT role,can_view_orders,can_manage_orders,can_manage_menu FROM restaurant_staff WHERE user_id=$1 AND restaurant_id=$2',[userId,restaurantId]);
 if(!r.rowCount)invalid('ROLE_FORBIDDEN','Bu restoran için yetkiniz yok.',403);
 const row=r.rows[0];
 if(!canStaff(row,capability))invalid('ROLE_FORBIDDEN','Bu işlem için restoran yetkiniz yok.',403);
 return row.role as 'owner'|'manager'|'staff';
}
export async function requireAdmin(pool:Pool,userId:string){
 const r=await pool.query('SELECT 1 FROM platform_admins WHERE user_id=$1',[userId]);
 if(!r.rowCount)invalid('ROLE_FORBIDDEN','Yönetici yetkisi gerekli.',403);
}
