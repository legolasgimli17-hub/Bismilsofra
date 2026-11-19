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
