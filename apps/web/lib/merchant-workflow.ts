/** Merchant UI mirrors the server state machine. Never authorize transitions client-side. */
export type MerchantAction={to:string;label:string;requiresReason:boolean;kind:'primary'|'outline'|'danger'};
const actions:Record<string,readonly MerchantAction[]>={
 beklemede:[
  {to:'kabul_edildi',label:'Siparişi kabul et',requiresReason:false,kind:'primary'},
  {to:'reddedildi',label:'Reddet',requiresReason:true,kind:'danger'}
 ],
 kabul_edildi:[
  {to:'hazirlaniyor',label:'Hazırlamaya başla',requiresReason:false,kind:'primary'},
  {to:'restoran_iptal',label:'İptal et',requiresReason:true,kind:'danger'}
 ],
 hazirlaniyor:[
  {to:'hazir',label:'Sipariş hazır',requiresReason:false,kind:'primary'},
  {to:'restoran_iptal',label:'İptal et',requiresReason:true,kind:'danger'}
 ],
 hazir:[{to:'yolda',label:'Kuryeye teslim edildi',requiresReason:false,kind:'primary'}],
 yolda:[
  {to:'teslim_edildi',label:'Teslim edildi',requiresReason:false,kind:'primary'},
  {to:'teslim_edilemedi',label:'Teslim edilemedi',requiresReason:true,kind:'danger'}
 ]
};
export function merchantNextActions(status:string):readonly MerchantAction[]{return actions[status]??[]}
export function canSubmitMerchantAction(status:string,to:string,reason:string,online:boolean,canManage:boolean):boolean{
 if(!online||!canManage)return false;
 const next=merchantNextActions(status).find(x=>x.to===to);
 if(!next)return false;
 return !next.requiresReason||reason.trim().length>=5;
}
export const isMerchantOpenStatus=(status:string)=>status==='beklemede'||['kabul_edildi','hazirlaniyor','hazir','yolda'].includes(status);

export function acceptanceSeconds(expiresAt:string,estimatedServerNow:number):number|null{
 const expiry=Date.parse(expiresAt);
 if(!Number.isFinite(expiry)||!Number.isFinite(estimatedServerNow))return null;
 return Math.max(0,Math.ceil((expiry-estimatedServerNow)/1000));
}
