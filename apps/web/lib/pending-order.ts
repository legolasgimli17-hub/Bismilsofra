const prefix='sofra-pending-order:';
export type PendingOrder={key:string;body:string};
export const pendingOrderKey=(subject:string)=>prefix+subject;

export function readPendingOrder(raw:string|null):PendingOrder|null{
 if(!raw||raw.length>65_536)return null;
 try{
  const value=JSON.parse(raw);
  if(!value||typeof value.key!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.key)||typeof value.body!=='string')return null;
  const body=JSON.parse(value.body);
  if(!body||typeof body.restaurantId!=='string'||!Array.isArray(body.items)||
     !Number.isSafeInteger(body.confirmedTotalKurus))return null;
  return {key:value.key,body:value.body};
 }catch{return null}
}
export function hasPendingOrder(storage:Pick<Storage,'length'|'key'|'getItem'>){
 for(let index=0;index<storage.length;index++){
  const key=storage.key(index);
  if(key?.startsWith(prefix)&&readPendingOrder(storage.getItem(key)))return true;
 }
 return false;
}
export function samePendingCart(attempt:PendingOrder,restaurantId:string,items:unknown){
 const submitted=JSON.parse(attempt.body);
 return submitted.restaurantId===restaurantId&&JSON.stringify(submitted.items)===JSON.stringify(items);
}
// These responses are produced after the server has checked for an existing order.
export const canResetPendingOrder=(code:string)=>[
 'PRICE_CHANGED','DELIVERY_ESTIMATE_CHANGED','ADDRESS_UNAVAILABLE','RESTAURANT_CLOSED',
 'ZONE_UNAVAILABLE','OUTSIDE_HOURS','PRODUCT_UNAVAILABLE','OPTION_UNAVAILABLE',
 'OPTION_SELECTION','OPTION_FOREIGN','MINIMUM_BASKET','MIN_BASKET'
].includes(code);
