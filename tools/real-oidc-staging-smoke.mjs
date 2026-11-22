/** Read-only real Auth0/OIDC + staging API verification.
 * Never creates accounts, never orders, never prints tokens or customer data.
 * Requires 3 provider-issued, verified test-user access tokens. Not a CI mock.
 * Invoke manually only after the owner configures real staging secrets.
 */
import {jwtVerify,createRemoteJWKSet} from 'jose';
import {validateStagingTarget} from './staging-target.mjs';

export function validateExternalOidcConfig(env){
 const api=validateStagingTarget(env.STAGING_API_URL||'');
 const issuer=new URL(env.STAGING_OIDC_ISSUER||'');
 if(issuer.protocol!=='https:'||!issuer.hostname||issuer.username||issuer.password||issuer.search||issuer.hash||
  !issuer.pathname.endsWith('/'))throw Error('OIDC issuer must be an HTTPS origin/path ending in /');
 const audience=env.STAGING_OIDC_AUDIENCE;
 if(!audience||audience.length>500)throw Error('Dedicated staging OIDC audience required');
 for(const key of ['STAGING_CUSTOMER_ACCESS_TOKEN','STAGING_MERCHANT_ACCESS_TOKEN','STAGING_ADMIN_ACCESS_TOKEN']){
  if(!env[key]||env[key].length<40)throw Error(key+' must be set privately with an actual provider-issued token');
 }
 if(new Set([env.STAGING_CUSTOMER_ACCESS_TOKEN,env.STAGING_MERCHANT_ACCESS_TOKEN,env.STAGING_ADMIN_ACCESS_TOKEN]).size!==3)
  throw Error('Staging identities must be three different signed access tokens');
 return {api,issuer:issuer.href,audience,tokens:{
  customer:env.STAGING_CUSTOMER_ACCESS_TOKEN,merchant:env.STAGING_MERCHANT_ACCESS_TOKEN,admin:env.STAGING_ADMIN_ACCESS_TOKEN}};
}

export async function probeRealOidc(config,fetchImpl=fetch){
 const issuer=new URL(config.issuer);
 const metadataUrl=new URL('.well-known/openid-configuration',issuer);
 if(metadataUrl.origin!==issuer.origin)throw Error('OIDC discovery escaped issuer origin');
 const response=await fetchImpl(metadataUrl,{redirect:'error',signal:AbortSignal.timeout(8000)});
 if(response.status!==200)throw Error('Identity provider discovery failed: HTTP '+response.status);
 const metadata=await response.json();
 if(metadata.issuer!==issuer.href)throw Error('OIDC issuer mismatch');
 const jwksUrl=new URL(metadata.jwks_uri);
 if(jwksUrl.protocol!=='https:'||jwksUrl.username||jwksUrl.password||jwksUrl.hash||
  !jwksUrl.hostname)throw Error('Unsafe JWKS endpoint');
 const jwks=createRemoteJWKSet(jwksUrl,{timeoutDuration:8000});
 const verified={};
 for(const [role,token] of Object.entries(config.tokens)){
  const {payload}=await jwtVerify(token,jwks,{issuer:config.issuer,audience:config.audience,algorithms:['RS256','ES256','EdDSA'],clockTolerance:'5s'});
  const emailVerified=payload.email_verified===true||payload['https://bismilsofra.example/claims/email_verified']===true;
  if(!emailVerified)throw Error(role+' email verification missing in signed access token');
  const email=payload.email||payload['https://bismilsofra.example/claims/email'];
  if(typeof email!=='string'||email.length<3)throw Error(role+' signed email claim missing');
  if(role!=='customer'){
   const signedMfa=payload['https://bismilsofra.example/claims/mfa']===true;
   const amr=Array.isArray(payload.amr)&&payload.amr.includes('mfa');
   if(!signedMfa&&!amr)throw Error(role+' signed MFA proof missing');
   if(role==='admin'){
    const at=payload['https://bismilsofra.example/claims/mfa_at']??payload.auth_time;
    if(!Number.isFinite(at)||Date.now()/1000-at>600||Date.now()/1000-at<0)
     throw Error('Administrator MFA reauthentication is not recent (10min)');
   }
  }
  if(typeof payload.sub!=='string'||!payload.sub)throw Error('Missing signed subject');
  verified[role]=payload.sub;
 }
 if(new Set(Object.values(verified)).size!==3)throw Error('Customer/merchant/admin must be distinct provider accounts');
 async function get(path,token){
  const r=await fetchImpl(config.api+path,{headers:token?{Authorization:'Bearer '+token,Accept:'application/json'}:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});
  return {status:r.status,body:r.status===200?await r.json():null};
 }
 const readiness=await get('/readyz');
 if(readiness.status!==200||readiness.body?.status!=='ready')throw Error('Remote staging API /readyz failed');
 const anonymous=await get('/v1/me/addresses');
 if(anonymous.status!==401)throw Error('Anonymous customer access was not rejected');
 const customer=await get('/v1/me/addresses',config.tokens.customer);
 if(customer.status!==200||!Array.isArray(customer.body?.addresses))throw Error('Real Auth0 customer authorization failed');
 const merchant=await get('/v1/me/staff-restaurants',config.tokens.merchant);
 if(merchant.status!==200||!Array.isArray(merchant.body?.restaurants)||merchant.body.restaurants.length<1)
  throw Error('Real Auth0 MFA merchant has no correctly assigned restaurant');
 const admin=await get('/v1/admin/alerts',config.tokens.admin);
 if(admin.status!==200||!Array.isArray(admin.body?.latePending))throw Error('Real Auth0 MFA admin authorization failed');
 const forbidden=await get('/v1/admin/alerts',config.tokens.customer);
 if(forbidden.status!==403)throw Error('Customer unexpectedly authorized as administrator');
 return {provider:'REAL_OIDC',apiReady:true,verifiedTestAccounts:3,customer:customer.status,
  merchant:merchant.status,admin:admin.status,anonymous:anonymous.status,crossRoleDenied:forbidden.status,
  testCategory:'provider-issued-tokens-read-only'};
}

if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
 try{
  const config=validateExternalOidcConfig(process.env);
  console.log(JSON.stringify(await probeRealOidc(config)));
 }catch{
  console.error('REAL_OIDC_STAGING_NOT_VERIFIED: configuration, provider JWT or read-only role check failed. No sensitive details logged.');
  process.exitCode=2;
 }
}
