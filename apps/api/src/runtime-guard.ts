/** Defensive runtime settings and explicit production order-intake switch. */
export type ApiSettings={host:'127.0.0.1'|'0.0.0.0'|'::1'|'::';port:number};
export function apiSettings(env:NodeJS.ProcessEnv):ApiSettings{
 const rawPort=env.PORT??'4000';
 if(!/^[0-9]{1,5}$/.test(rawPort)||Number(rawPort)<1||Number(rawPort)>65535)
  throw Error('PORT must be an integer between 1 and 65535.');
 const host=env.API_BIND_HOST||'127.0.0.1';
 if(!['127.0.0.1','0.0.0.0','::1','::'].includes(host))
  throw Error('API_BIND_HOST must be a literal loopback or container bind IP.');
 return {port:Number(rawPort),host:host as ApiSettings['host']};
}
export type IntakeStatus={enabled:boolean;reason:'allowed'|'disabled'|'missing-channels'|'shared-provider'|'insecure-origin'};
function httpsEndpoint(raw:string|undefined):URL|null{
 if(!raw)return null;
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password&&!url.hash?url:null;
 }catch{return null}
}
/** Production is closed by default. Different HTTPS hostnames are a
 * configuration guard, NOT a guarantee that providers will deliver alerts.
 */
export function pilotOrderIntake(env:NodeJS.ProcessEnv):IntakeStatus{
 if(env.NODE_ENV==='development'||env.NODE_ENV==='test')return {enabled:true,reason:'allowed'};
 if(env.PILOT_ACCEPT_ORDERS!=='true')return {enabled:false,reason:'disabled'};
 const origin=httpsEndpoint(env.CORS_ORIGIN);
 if(!origin||origin.pathname!=='/'||origin.search)return {enabled:false,reason:'insecure-origin'};
 const primary=httpsEndpoint(env.ALERT_WEBHOOK_URL);
 const fallback=httpsEndpoint(env.ESCALATION_WEBHOOK_URL);
 const secret1=env.ALERT_WEBHOOK_SECRET||'',secret2=env.ESCALATION_WEBHOOK_SECRET||'';
 if(!primary||!fallback||secret1.length<32||secret2.length<32)
  return {enabled:false,reason:'missing-channels'};
 if(primary.hostname===fallback.hostname||secret1===secret2)
  return {enabled:false,reason:'shared-provider'};
 return {enabled:true,reason:'allowed'};
}
