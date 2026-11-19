/** Bismil Sofra: pure, server-side business rules. All currency amounts are integer kuruş. */
import { createHash } from 'node:crypto';

export const MAX_ACTIVE_RESTAURANTS = 50;
export const PENDING_MINUTES = 4;
export const STATUSES = ['beklemede','kabul_edildi','reddedildi','suresi_doldu','musteri_iptal','hazirlaniyor','hazir','yolda','teslim_edildi','restoran_iptal','teslim_edilemedi'] as const;
export type Status = typeof STATUSES[number];
export type Actor = 'customer' | 'restaurant' | 'system';
export type PaymentMethod = 'cash' | 'pos';
export type OrderLineInput = {productId: string;quantity: number;optionIds: string[]};
export type OrderInput = {restaurantId:string;addressId:string;paymentMethod:PaymentMethod;items:OrderLineInput[];note:string;idempotencyKey:string};
export type Money = number;

export class DomainError extends Error {
  code:string; statusCode:number;
  constructor(code:string, message:string, statusCode=400){super(message);this.name='DomainError';this.code=code;this.statusCode=statusCode}
}
export const invalid=(code:string,message:string,statusCode=400):never=>{throw new DomainError(code,message,statusCode)};
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const price=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=100_000_000;
export const cleanNote=(v:unknown,max=400):string=>typeof v==='string'?v.trim().slice(0,max):'';

export function parseOrder(body:unknown,key:unknown):OrderInput {
 if(!body||typeof body!=='object'||Array.isArray(body))invalid('INVALID_REQUEST','Geçersiz sipariş isteği.');
 const b=body as Record<string,unknown>;
 if(!uuid(b.restaurantId)||!uuid(b.addressId))invalid('INVALID_ID','Restoran veya adres geçersiz.');
 if(b.paymentMethod!=='cash'&&b.paymentMethod!=='pos')invalid('PAYMENT_INVALID','Yalnızca kapıda nakit veya POS geçerlidir.');
 if(typeof key!=='string'||!/^[a-zA-Z0-9_.:-]{16,100}$/.test(key))invalid('IDEMPOTENCY_REQUIRED','16–100 karakterli Idempotency-Key gerekli.');
 if(!Array.isArray(b.items)||b.items.length===0||b.items.length>40)invalid('CART_INVALID','Sepet 1–40 kalem içermelidir.');
 let totalQty=0;
 const items:OrderLineInput[]=b.items.map((item:unknown)=>{
  if(!item||typeof item!=='object'||Array.isArray(item))invalid('CART_INVALID','Sepette geçersiz ürün.');
  const l=item as Record<string,unknown>;
  if(!uuid(l.productId)||!Number.isInteger(l.quantity)||Number(l.quantity)<1||Number(l.quantity)>25)invalid('ITEM_INVALID','Ürün veya adet hatalı.');
  if(!Array.isArray(l.optionIds)||l.optionIds.length>24||l.optionIds.some(x=>!uuid(x)))invalid('OPTION_INVALID','Ürün seçenekleri hatalı.');
  const ids=l.optionIds as string[];
  if(new Set(ids).size!==ids.length)invalid('OPTION_DUPLICATE','Aynı seçenek tekrar seçilemez.');
  totalQty+=Number(l.quantity);
  return {productId:l.productId as string,quantity:l.quantity as number,optionIds:[...ids].sort()};
 });
 if(totalQty>100)invalid('CART_TOO_LARGE','Sepette en çok 100 adet ürün olabilir.');
 // Repeated same product must be expressed as quantities, not different lines.
 if(new Set(items.map(i=>i.productId+'|'+i.optionIds.join(','))).size!==items.length)invalid('ITEM_DUPLICATE','Aynı ürün ve seçenekler için adet artırılmalıdır.');
 return {restaurantId:b.restaurantId as string,addressId:b.addressId as string,paymentMethod:b.paymentMethod as PaymentMethod,items,note:cleanNote(b.note),idempotencyKey:key as string};
}
export function payloadHash(input:OrderInput):string {
 // Client-provided price is never part of the hash or totals.
 const normalized={r:input.restaurantId,a:input.addressId,p:input.paymentMethod,n:input.note,items:input.items.map(i=>[i.productId,i.quantity,[...i.optionIds].sort()]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};
 return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
export type CatalogProduct={id:string;name:string;priceKurus:number;available:boolean;optionGroups:OptionGroup[]};
export type OptionGroup={id:string;name:string;minSelect:number;maxSelect:number;options:{id:string;name:string;priceKurus:number;available:boolean}[]};
export type Snapshot={productId:string;name:string;qty:number;unitKurus:number;lineKurus:number;optionSnapshots:{id:string;name:string;priceKurus:number}[]};
export function calculateOrder(lines:OrderLineInput[],products:CatalogProduct[],minimumKurus:number,deliveryFeeKurus:number){
 if(!price(minimumKurus)||!price(deliveryFeeKurus))invalid('DELIVERY_INVALID','Teslimat fiyatı geçersiz.',500);
 const lookup=new Map(products.map(p=>[p.id,p]));
 const snapshots:Snapshot[]=[];
 let subtotalKurus=0;
 for(const l of lines){
  const p=lookup.get(l.productId);
  if(!p||!p.available)invalid('PRODUCT_UNAVAILABLE','Sepetteki ürün artık satışta değil.',409);
  if(!price(p.priceKurus))invalid('PRICE_INVALID','Ürün fiyatı geçersiz.',500);
  const optIds=new Set(l.optionIds);const optionSnapshots:Snapshot['optionSnapshots']=[];
  for(const g of p.optionGroups){
   const chosen=g.options.filter(o=>optIds.has(o.id));
   if(chosen.length<g.minSelect||chosen.length>g.maxSelect)invalid('OPTION_SELECTION','Zorunlu seçimler veya seçim sayısı hatalı.',409);
   for(const o of chosen){if(!o.available||!price(o.priceKurus))invalid('OPTION_UNAVAILABLE','Seçilen ek ürün satışta değil.',409);optionSnapshots.push({id:o.id,name:o.name,priceKurus:o.priceKurus});optIds.delete(o.id)}
  }
  if(optIds.size)invalid('OPTION_FOREIGN','Seçilen seçenek bu ürüne ait değil.',409);
  const unitKurus=p.priceKurus+optionSnapshots.reduce((sum,o)=>sum+o.priceKurus,0);
  const lineKurus=unitKurus*l.quantity;
  if(!Number.isSafeInteger(lineKurus)||lineKurus>100_000_000)invalid('PRICE_LIMIT','Sipariş miktarı limit dışı.',409);
  subtotalKurus+=lineKurus;
 }
 if(subtotalKurus<minimumKurus)invalid('MINIMUM_NOT_MET','Restoranın minimum sepet tutarına ulaşılmadı.',409);
 const totalKurus=subtotalKurus+deliveryFeeKurus;
 if(!Number.isSafeInteger(totalKurus)||totalKurus>100_000_000)invalid('PRICE_LIMIT','Sipariş toplamı limit dışı.',409);
 // Reassemble exact line snapshots only after validation has succeeded.
 for(const l of lines){const p=lookup.get(l.productId)!;const opts=p.optionGroups.flatMap(g=>g.options).filter(o=>l.optionIds.includes(o.id)).map(o=>({id:o.id,name:o.name,priceKurus:o.priceKurus}));const unitKurus=p.priceKurus+opts.reduce((s,o)=>s+o.priceKurus,0);snapshots.push({productId:p.id,name:p.name,qty:l.quantity,unitKurus,lineKurus:unitKurus*l.quantity,optionSnapshots:opts})}
 return {items:snapshots,subtotalKurus,deliveryFeeKurus,totalKurus};
}
const transitions:Record<string,readonly Status[]>={
 beklemede:['kabul_edildi','reddedildi','suresi_doldu','musteri_iptal'],
 kabul_edildi:['hazirlaniyor','restoran_iptal'],
 hazirlaniyor:['hazir','restoran_iptal'],
 hazir:['yolda'],yolda:['teslim_edildi','teslim_edilemedi']
};
export function assertTransition(from:Status,to:Status,actor:Actor,reason:string,createdAt:Date,at=new Date(),explicitExpiresAt?:Date):void {
 if(!transitions[from]?.includes(to))invalid('INVALID_TRANSITION','Bu durum değişikliğine izin verilmiyor.',409);
 if(to==='musteri_iptal'&&actor!=='customer'||to==='suresi_doldu'&&actor!=='system'||!['musteri_iptal','suresi_doldu'].includes(to)&&actor!=='restaurant')invalid('ROLE_FORBIDDEN','Bu işlemi yapma yetkiniz yok.',403);
 if(['reddedildi','restoran_iptal','teslim_edilemedi'].includes(to)&&reason.trim().length<5)invalid('REASON_REQUIRED','En az 5 karakterli açıklama gereklidir.',400);
 const deadline=explicitExpiresAt?.getTime()??createdAt.getTime()+PENDING_MINUTES*60_000;
 if(!Number.isFinite(deadline))invalid('DEADLINE_INVALID','Sipariş son kabul süresi hatalı.',500);
 if(to==='suresi_doldu'&&at.getTime()<deadline)invalid('NOT_EXPIRED','Kabul süresi henüz dolmadı.',409);
 if(from==='beklemede'&&to!=='suresi_doldu'&&at.getTime()>=deadline)invalid('EXPIRED','Restoranın kabul süresi doldu.',409);
}

/** Staff permissions are deny-by-default. Owners/managers have full restaurant permissions. */
export type StaffCapability='view'|'order'|'menu'|null;
export function canStaff(row:{role:string;can_view_orders?:boolean;can_manage_orders?:boolean;can_manage_menu?:boolean},capability:StaffCapability):boolean {
 if(row.role==='owner'||row.role==='manager')return true;
 if(row.role!=='staff')return false;
 if(capability===null)return true;
 return row[{view:'can_view_orders',order:'can_manage_orders',menu:'can_manage_menu'}[capability]]===true;
}
