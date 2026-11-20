/** Bounded in-process safety net. Production replicas also need edge/shared limits. */
import {isIP} from 'node:net';
export const WINDOW_MS=60_000;
export type RateBucket='read'|'write'|'quote'|'order'|'upload'|'management'|'import'|'account';
export type RateDecision={allowed:boolean;retryAfter:number;bucket:RateBucket|null};
function rateGroup(method:string,url:string):{bucket:RateBucket;limit:number}|null{
 if(method==='OPTIONS')return null;
 const path=url.split('?',1)[0];
 if(method==='POST'&&path==='/v1/orders')return {bucket:'order',limit:12};
 if(method==='POST'&&path==='/v1/orders/quote')return {bucket:'quote',limit:48};
 if(method==='POST'&&/^\/v1\/restaurant\/[^/]+\/photos$/.test(path))
  return {bucket:'upload',limit:8};
 // Separate management writes from ordinary checkout mutations, while still
 // bounding admin/team operations per IP (never an unlimited exception).
 if((method==='POST'||method==='PATCH')&&
   (/^\/v1\/admin\/users\/[^/]+\/access$/.test(path)||
    /^\/v1\/restaurant\/[^/]+\/team(?:\/[^/]+(?:\/remove)?)?$/.test(path)))
  return {bucket:'management',limit:40};
 if(method==='POST'&&/^\/v1\/admin\/restaurants\/[^/]+\/menu-import$/.test(path))
  return {bucket:'import',limit:12};
 if((method==='POST'||method==='PATCH')&&
   /^\/v1\/me\/addresses(?:\/[a-f0-9-]{36}(?:\/archive)?)?$/i.test(path))
  return {bucket:'account',limit:30};
 if(method==='GET'||method==='HEAD')return {bucket:'read',limit:300};
 return {bucket:'write',limit:80};
}
/** Trust forwarded addresses only when the peer is a deliberately configured
 * narrow proxy CIDR. With default false, untrusted X-Forwarded-For is ignored.
 */
export function trustedProxyCidrs(raw:string|undefined):string[]|false{
 if(!raw)return false;
 const values=raw.split(',').map(s=>s.trim());
 if(values.length===0||values.length>12||values.some(s=>!s))
  throw Error('TRUSTED_PROXY_CIDRS geçersiz.');
 return values.map(value=>{
  const parts=value.split('/');
  if(parts.length>2)throw Error('TRUSTED_PROXY_CIDRS içinde geçersiz CIDR var.');
  const family=isIP(parts[0]),max=family===4?32:family===6?128:0;
  if(!max||(parts.length===2&&!/^[0-9]{1,3}$/.test(parts[1])))
   throw Error('TRUSTED_PROXY_CIDRS içinde geçersiz IP/CIDR var.');
  const prefix=parts.length===2?Number(parts[1]):max;
  if(prefix<(family===4?16:48)||prefix>max)
   throw Error('TRUSTED_PROXY_CIDRS yalnızca dar ve güvenilir proxy ağlarını kabul eder.');
  return parts[0]+'/'+prefix;
 });
}
/** Fixed window keyed by remote IP and endpoint class. 
 * Capacity overflow blocks new IP keys rather than leaking memory.
 */
export class RequestLimiter{
 private readonly entries=new Map<string,{count:number;expires:number}>();
 private readonly maxEntries:number;
 constructor(maxEntries=20_000){
  this.maxEntries=maxEntries;
  if(!Number.isInteger(maxEntries)||maxEntries<1)throw Error('Invalid limiter capacity');
 }
 check(ip:string,method:string,url:string,now=Date.now()):RateDecision{
  const group=rateGroup(method,url);
  if(!group)return {allowed:true,retryAfter:0,bucket:null};
  const key=ip+'|'+group.bucket;
  let state=this.entries.get(key);
  if(state&&state.expires<=now){this.entries.delete(key);state=undefined}
  if(!state){
   if(this.entries.size>=this.maxEntries){
    for(const [k,v] of this.entries)if(v.expires<=now)this.entries.delete(k);
    if(this.entries.size>=this.maxEntries)
     return {allowed:false,retryAfter:60,bucket:group.bucket};
   }
   state={count:0,expires:now+WINDOW_MS};
   this.entries.set(key,state);
  }
  state.count++;
  const allowed=state.count<=group.limit;
  return {allowed,retryAfter:allowed?0:Math.max(1,Math.ceil((state.expires-now)/1000)),
   bucket:group.bucket};
 }
 get size(){return this.entries.size}
}
