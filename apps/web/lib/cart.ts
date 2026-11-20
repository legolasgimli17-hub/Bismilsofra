import type {Cart,CartLine} from './types.ts';
export const EMPTY_CART:Cart={restaurantId:'',restaurantName:'',lines:[]};
export function cartTotal(cart:Cart){return cart.lines.reduce((s,l)=>s+(l.priceKurus+l.optionExtraKurus)*l.quantity,0)}
export function cartCount(cart:Cart){return cart.lines.reduce((s,l)=>s+l.quantity,0)}
export function addCartLine(cart:Cart,restaurantId:string,restaurantName:string,line:CartLine,confirmReplacement:boolean):Cart{
 if(cart.lines.length&&cart.restaurantId!==restaurantId&&!confirmReplacement)throw Error('OTHER_RESTAURANT');
 const fresh=cart.restaurantId!==restaurantId?[]:cart.lines;
 const idx=fresh.findIndex(l=>l.productId===line.productId&&[...l.optionIds].sort().join() === [...line.optionIds].sort().join());
 if(idx<0)return {restaurantId,restaurantName,lines:[...fresh,{...line,optionIds:[...line.optionIds].sort()}]};
 const next=[...fresh];const qty=next[idx].quantity+line.quantity;if(qty>25)throw Error('QUANTITY_LIMIT');next[idx]={...next[idx],quantity:qty};return {restaurantId,restaurantName,lines:next};
}
export function updateLine(cart:Cart,index:number,amount:number):Cart{const lines=cart.lines.map((l,i)=>i===index?{...l,quantity:Math.min(25,Math.max(0,l.quantity+amount))}:l).filter(x=>x.quantity>0);return lines.length?{...cart,lines}:EMPTY_CART}
export function orderBody(cart:Cart,addressId:string,paymentMethod:'cash'|'pos',note:string){return {restaurantId:cart.restaurantId,addressId,paymentMethod,note,items:cart.lines.map(l=>({productId:l.productId,quantity:l.quantity,optionIds:l.optionIds}))}}

/**
 * sessionStorage is untrusted, including values written by browser extensions
 * or an older app version. Refuse malformed snapshots rather than rendering
 * unbounded values. Actual availability/pricing remain exclusively server-side.
 */
export function readStoredCart(raw:string|null):Cart{
 if(!raw||raw.length>80_000)return EMPTY_CART;
 let value:unknown;
 try{value=JSON.parse(raw)}catch{return EMPTY_CART}
 if(!value||typeof value!=='object'||Array.isArray(value))return EMPTY_CART;
 const data=value as Record<string,unknown>;
 const allowedId=(id:unknown)=>typeof id==='string'&&
  (/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)||/^demo-[a-z0-9-]{1,80}$/.test(id));
 const text=(v:unknown,max:number)=>typeof v==='string'&&v.length>0&&v.length<=max;
 const money=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=100_000_000;
 if(!allowedId(data.restaurantId)||!text(data.restaurantName,140)||
  !Array.isArray(data.lines)||data.lines.length<1||data.lines.length>40)return EMPTY_CART;
 const lines:CartLine[]=[];let totalQty=0,totalKurus=0;
 for(const unknownLine of data.lines as unknown[]){
  if(!unknownLine||typeof unknownLine!=='object'||Array.isArray(unknownLine))return EMPTY_CART;
  const l=unknownLine as Record<string,unknown>;
  if(!allowedId(l.productId)||!text(l.name,160)||
   !(l.imageUrl===null||(typeof l.imageUrl==='string'&&l.imageUrl.length<=2048))||
   !money(l.priceKurus)||!money(l.optionExtraKurus)||
   !Number.isInteger(l.quantity)||Number(l.quantity)<1||Number(l.quantity)>25||
   !Array.isArray(l.optionIds)||l.optionIds.length>24||!l.optionIds.every(allowedId)||
   new Set(l.optionIds).size!==l.optionIds.length||
   !Array.isArray(l.optionLabels)||l.optionLabels.length!==l.optionIds.length||
   !l.optionLabels.every((v:unknown)=>text(v,100)))return EMPTY_CART;
  const qty=l.quantity as number,unit=(l.priceKurus as number)+(l.optionExtraKurus as number);
  if(unit>100_000_000)return EMPTY_CART;
  totalQty+=qty;totalKurus+=unit*qty;
  if(totalQty>100||totalKurus>100_000_000||!Number.isSafeInteger(totalKurus))return EMPTY_CART;
  lines.push({
   productId:l.productId as string,name:l.name as string,imageUrl:l.imageUrl as string|null,
   priceKurus:l.priceKurus as number,quantity:qty,optionIds:[...(l.optionIds as string[])],
   optionLabels:[...(l.optionLabels as string[])],optionExtraKurus:l.optionExtraKurus as number
  });
 }
 return {restaurantId:data.restaurantId as string,restaurantName:data.restaurantName as string,lines};
}

/** Existing localStorage (including an explicit empty basket) takes precedence.
 * Older sessionStorage carts are migrated only if there is no new snapshot.
 */
export function restoreCartSnapshot(local:string|null,legacySession:string|null):Cart{
 return readStoredCart(local===null?legacySession:local);
}
