/** Remember only the selected *restaurant UUID*, never customer data or auth. */
export const MERCHANT_SELECTED_KEY='bismil-merchant-selected-v1';
export function selectedMerchantId<T extends {id:string}>(restaurants:T[],preferred:unknown):string{
 if(!Array.isArray(restaurants)||restaurants.length===0)return '';
 return typeof preferred==='string'&&restaurants.some(r=>r.id===preferred)?preferred:restaurants[0].id;
}
export function readSelectedMerchantId<T extends {id:string}>(restaurants:T[]):string{
 let preferred:string|null=null;
 try{if(typeof window!=='undefined')preferred=window.sessionStorage.getItem(MERCHANT_SELECTED_KEY)}catch{}
 return selectedMerchantId(restaurants,preferred);
}
export function saveSelectedMerchantId(id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))return;
 try{if(typeof window!=='undefined')window.sessionStorage.setItem(MERCHANT_SELECTED_KEY,id)}catch{}
}
