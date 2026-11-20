/**
 * Real HTTP + PostgreSQL + cryptographic OIDC verifier integration.
 * Local JWKS is ONLY a test fixture. Does not prove live Auth0 configuration.
 * Requires a disposable localhost PostgreSQL database ending in _test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {exportJWK,generateKeyPair,SignJWT} from 'jose';
import {dispatchOutbox} from '../src/notification-service.ts';
import sharp from 'sharp';

const connection=process.env.INTEGRATION_DATABASE_URL;
if(!connection)throw Error('Only a disposable INTEGRATION_DATABASE_URL is allowed.');
const parsed=new URL(connection);
if(!parsed.pathname.endsWith('_test')||!['localhost','127.0.0.1'].includes(parsed.hostname))
 throw Error('Refusing non-local or non-test database.');

const rid='11111111-1111-4111-8111-111111111111';
const zid='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
const pid='33333333-3333-4333-8333-333333333333';
const extra='55555555-5555-4555-8555-555555555555';

async function freePort(){
 const listener=createServer();
 await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));
 const address=listener.address();if(!address||typeof address==='string')throw Error('No test port');
 const port=address.port;
 await new Promise<void>((resolve,reject)=>listener.close(err=>err?reject(err):resolve()));
 return port;
}
async function waitFor(base:string,child:ChildProcess){
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error('API exited before becoming ready, code='+child.exitCode);
  try{const r=await fetch(base+'/readyz',{signal:AbortSignal.timeout(1000)});if(r.ok)return}catch{}
  await new Promise(resolve=>setTimeout(resolve,130));
 }
 throw Error('Test API did not become ready.');
}

test('HTTP: verified JWT, owner MFA, real order, isolation, reconnect and durable notification retry', {timeout:60000},async t=>{
 const pool=new Pool({connectionString:connection,max:6});
 const {publicKey,privateKey}=await generateKeyPair('RS256',{extractable:true});
 const jwk={...(await exportJWK(publicKey)),kid:'ci-key',alg:'RS256',use:'sig'};
 const jwks=createServer((req,res)=>{
  if(req.url!=='/.well-known/jwks.json'){res.writeHead(404);res.end();return}
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({keys:[jwk]}));
 });
 await new Promise<void>(resolve=>jwks.listen(0,'127.0.0.1',resolve));
 const addr=jwks.address();if(!addr||typeof addr==='string')throw Error('No JWKS bind');
 const jwksPort=addr.port;
 const fakeObjects:Array<{method:string;url:string;bytes:Buffer;contentType:string}>=[]; 
 const fakeStore=createServer((req,res)=>{
  const chunks:Buffer[]=[];
  req.on('data',(part:Buffer)=>chunks.push(part));
  req.on('end',()=>{
   fakeObjects.push({method:req.method||'UNKNOWN',url:req.url||'',bytes:Buffer.concat(chunks),contentType:String(req.headers['content-type']||'')});
   res.writeHead(req.method==='DELETE'?204:200,req.method==='DELETE'?{}:{etag:'"fake-media-test"'});
   res.end();
  });
 });
 await new Promise<void>(resolve=>fakeStore.listen(0,'127.0.0.1',resolve));
 const fakeAddress=fakeStore.address();
 if(!fakeAddress||typeof fakeAddress==='string')throw Error('No fake S3 port');
 const fakePort=fakeAddress.port;
 const basePort=await freePort();
 const issuer='http://127.0.0.1:'+jwksPort+'/';
 const base='http://127.0.0.1:'+basePort;
 const audience='bismil-sofra-integration';
 let output='';
 const child=spawn(process.execPath,['--experimental-strip-types','apps/api/src/server.ts'],{
  cwd:process.cwd(),stdio:['ignore','pipe','pipe'],
  env:{...process.env,DATABASE_URL:connection,CORS_ORIGIN:'http://127.0.0.1:3000',
   OIDC_ISSUER:issuer,OIDC_AUDIENCE:audience,OIDC_JWKS_URL:issuer+'.well-known/jwks.json',
   PORT:String(basePort),NODE_ENV:'test',
   S3_ENDPOINT:'http://127.0.0.1:'+fakePort+'/',S3_BUCKET:'bismil-sofra-test',
   S3_REGION:'auto',S3_ACCESS_KEY_ID:'ci-only-access',S3_SECRET_ACCESS_KEY:'ci-secret-not-production',
   MEDIA_PUBLIC_ORIGIN:'https://assets.bismilsofra.example',
   PUBLIC_IMAGE_CDN_HOST:'assets.bismilsofra.example'}
 });
 child.stdout?.on('data',x=>{output+=String(x).slice(-2000)});
 child.stderr?.on('data',x=>{output+=String(x).slice(-2000)});
 t.after(async()=>{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1000))]);
  if(child.exitCode===null)child.kill('SIGKILL');
  await pool.end();
  await new Promise<void>(resolve=>jwks.close(()=>resolve()));
  await new Promise<void>(resolve=>fakeStore.close(()=>resolve()));
 });
 try{await waitFor(base,child)}catch(e){throw Error(String(e)+' (server output: '+output.slice(-1000)+')')}
 const nonce=randomUUID();
 const subject=(who:string)=>'ci-http-'+nonce+'-'+who;
 const now=Math.floor(Date.now()/1000);
 const sign=async(who:string,claims:Record<string,unknown>={},secret=privateKey)=>
  new SignJWT({email:who+'@example.invalid',email_verified:true,...claims})
   .setProtectedHeader({alg:'RS256',kid:'ci-key'}).setSubject(subject(who))
   .setIssuer(issuer).setAudience(audience).setIssuedAt(now).setExpirationTime(now+120)
   .sign(secret);
 const customer=await sign('customer');
 const stranger=await sign('stranger');
 const owner=await sign('owner',{amr:['pwd','mfa'],auth_time:now});
 const noMfa=await sign('owner',{amr:['pwd'],auth_time:now});
 const otpOnly=await sign('owner',{amr:['otp'],auth_time:now});
 const webauthnOnly=await sign('owner',{amr:['webauthn'],auth_time:now});
 const administrator=await sign('administrator',{amr:['pwd','mfa'],auth_time:now});
 const oldAdministrator=await sign('administrator',{amr:['pwd','mfa'],auth_time:now-720});
 const unverified=await sign('unverified',{email_verified:false});
 const namespaced=await sign('namespaced',{
  email:undefined,email_verified:undefined,amr:undefined,auth_time:undefined,
  'https://bismilsofra.example/claims/email_verified':true,
  'https://bismilsofra.example/claims/email':'namespaced@example.invalid',
  'https://bismilsofra.example/claims/mfa':true,
  'https://bismilsofra.example/claims/mfa_at':now
 });
 const namespacedWithoutMfa=await sign('namespaced-no-mfa',{
  email:undefined,email_verified:undefined,amr:undefined,
  'https://bismilsofra.example/claims/email_verified':true,
  'https://bismilsofra.example/claims/email':'namespaced-no-mfa@example.invalid'
 });
 const {privateKey:wrongKey}=await generateKeyPair('RS256');
 const forgery=await sign('forgery',{},wrongKey);
 type HttpResult={status:number;body:Record<string,any>};
 async function request(route:string,opts:{method?:string;token?:string;body?:unknown;headers?:Record<string,string>}={}):Promise<HttpResult>{
  const headers:Record<string,string>={...(opts.headers||{})};
  if(opts.token)headers.Authorization='Bearer '+opts.token;
  if(opts.body!==undefined)headers['Content-Type']='application/json';
  const res=await fetch(base+route,{method:opts.method||'GET',headers,
   body:opts.body===undefined?undefined:JSON.stringify(opts.body),signal:AbortSignal.timeout(4000)});
  return {status:res.status,body:await res.json() as Record<string,any>};
 }
 assert.equal((await request('/readyz')).status,200);
 assert.equal((await request('/v1/me/addresses')).status,401);
 assert.equal((await request('/v1/me/addresses',{token:forgery})).status,401);
 assert.equal((await request('/v1/me/addresses',{token:unverified})).status,403);
 assert.equal((await request('/v1/me/addresses',{token:namespaced})).status,200);
 assert.equal((await request('/v1/me/staff-restaurants',{token:namespaced})).status,200);
 assert.equal((await request('/v1/me/staff-restaurants',{token:namespacedWithoutMfa})).status,403);
 assert.equal((await request('/v1/zones',{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await request('/v1/categories?zoneId=not-a-uuid')).status,400);
 const productCategory=await pool.query('SELECT c.name FROM categories c JOIN products p ON p.category_id=c.id WHERE p.id=$1',[pid]);
 assert.equal(productCategory.rowCount,1);
 const categoryName=productCategory.rows[0].name as string;
 const liveCategories=await request('/v1/categories?zoneId='+zid);
 assert.equal(liveCategories.status,200);
 assert.ok(liveCategories.body.categories.includes(categoryName));
 const categoryRestaurants=await request('/v1/restaurants?zoneId='+zid+'&category='+encodeURIComponent(categoryName));
 assert.equal(categoryRestaurants.status,200);
 assert.ok(categoryRestaurants.body.restaurants.some((r:{id:string})=>r.id===rid));
 const nowhere=await request('/v1/categories?zoneId='+randomUUID());
 assert.deepEqual(nowhere.body.categories,[]);

 assert.equal((await request('/v1/me/addresses',{token:customer})).status,200);
 const userBefore=await pool.query('SELECT xmin::text AS row_version FROM users WHERE oidc_subject=$1',[subject('customer')]);
 for(let i=0;i<3;i++)assert.equal((await request('/v1/me/addresses',{token:customer})).status,200);
 const userAfter=await pool.query('SELECT xmin::text AS row_version FROM users WHERE oidc_subject=$1',[subject('customer')]);
 assert.equal(userAfter.rows[0].row_version,userBefore.rows[0].row_version,
  'routine authenticated requests must not rewrite the users row');
 assert.equal((await request('/v1/me/staff-restaurants',{token:noMfa})).status,403);
 assert.equal((await request('/v1/me/staff-restaurants',{token:otpOnly})).status,403,
  'single-factor OTP must not grant merchant access');
 assert.equal((await request('/v1/me/staff-restaurants',{token:webauthnOnly})).status,403,
  'a standalone passkey must not count as completed MFA');
 assert.equal((await request('/v1/me/staff-restaurants',{token:owner})).status,200);
 const ownerRow=await pool.query('SELECT id FROM users WHERE oidc_subject=$1',[subject('owner')]);
 const ownerId=ownerRow.rows[0].id;
 await pool.query('INSERT INTO restaurant_staff(user_id,restaurant_id,role) VALUES($1,$2,$3)',[ownerId,rid,'owner']);
 assert.equal((await request('/v1/me/addresses',{token:administrator})).status,200);
 const adminRow=await pool.query('SELECT id FROM users WHERE oidc_subject=$1',[subject('administrator')]);
 await pool.query('INSERT INTO platform_admins(user_id) VALUES($1)',[adminRow.rows[0].id]);
 assert.equal((await request('/v1/admin/alerts',{token:customer})).status,403);
 assert.equal((await request('/v1/admin/alerts',{token:oldAdministrator})).status,403);
 assert.equal((await request('/v1/admin/alerts',{token:administrator})).status,200);
 const address=await request('/v1/me/addresses',{method:'POST',token:customer,
  body:{zoneId:zid,fullAddress:'CI Test Sokak 12 Daire 3',label:'Ev',phone:'05000000000',directions:'Kapının önünde'}});
 assert.equal(address.status,201,JSON.stringify(address.body));
 const addrId=address.body.id as string;
 const payload={restaurantId:rid,addressId:addrId,paymentMethod:'cash',items:[{productId:pid,quantity:1,optionIds:[extra]}],note:'Az acılı'};
 const quote=await request('/v1/orders/quote',{method:'POST',token:customer,body:payload});
 assert.equal(quote.status,200,JSON.stringify(quote.body));
 assert.equal(quote.body.totals.totalKurus,21500);
 const orderKey='ci-http-'+randomUUID();
 const stale=await request('/v1/orders',{method:'POST',token:customer,headers:{'Idempotency-Key':orderKey},
  body:{...payload,confirmedTotalKurus:21499}});
 assert.equal(stale.status,409);
 assert.equal(stale.body.code,'PRICE_CHANGED');
 const correct={...payload,confirmedTotalKurus:quote.body.totals.totalKurus};
 const placed=await request('/v1/orders',{method:'POST',token:customer,headers:{'Idempotency-Key':orderKey},body:correct});
 assert.equal(placed.status,201,JSON.stringify(placed.body));
 const orderId=placed.body.id as string;
 const retry=await request('/v1/orders',{method:'POST',token:customer,headers:{'Idempotency-Key':orderKey},body:correct});
 assert.equal(retry.status,200);
 assert.equal(retry.body.id,orderId);
 assert.equal((await request('/v1/me/orders/by-key/'+orderKey,{token:customer})).body.order.id,orderId);
 const ownOrder=await request('/v1/me/orders/'+orderId,{token:customer});
 assert.equal(ownOrder.status,200);
 // Reorder source is owner-scoped and exposes historical IDs, never another customer's basket.
 assert.equal(ownOrder.body.items[0].product_id,pid);
 assert.ok(ownOrder.body.items[0].options_snapshot.some((o:{id:string})=>o.id===extra));
 assert.equal((await request('/v1/me/orders/'+orderId,{token:stranger})).status,404);
 // Support access is owner-scoped and operators cannot change terminal cases
 // or overwrite another operator's state without matching expectedStatus.
 const supportCreate=await request('/v1/me/support-cases',{method:'POST',token:customer,
  body:{orderId,issueType:'gecikme',description:'Siparişimle ilgili yardım gerekiyor.'}});
 assert.equal(supportCreate.status,201,JSON.stringify(supportCreate.body));
 const caseId=supportCreate.body.caseId as string;
 assert.equal((await request('/v1/me/support-cases',{token:stranger})).body.cases.some((c:{id:string})=>c.id===caseId),false);
 assert.equal((await request('/v1/me/support-cases',{token:customer})).body.cases.some((c:{id:string})=>c.id===caseId),true);
 assert.equal((await request('/v1/me/support-cases',{method:'POST',token:stranger,
  body:{orderId,issueType:'diger',description:'Başkasının siparişi'}})).status,404);
 assert.equal((await request('/v1/admin/support-cases',{token:customer})).status,403);
 assert.equal((await request('/v1/admin/support-cases',{token:oldAdministrator})).status,403);
 const caseList=await request('/v1/admin/support-cases?status=acik',{token:administrator});
 assert.equal(caseList.status,200);
 assert.ok(caseList.body.cases.some((c:{id:string})=>c.id===caseId));
 assert.equal(caseList.body.cases.find((c:{id:string})=>c.id===caseId).description,undefined,
  'admin list must never return free-text customer details');
 const caseDetail=await request('/v1/admin/support-cases/'+caseId,{token:administrator});
 assert.equal(caseDetail.status,200);
 assert.match(caseDetail.body.case.description,/Siparişimle/);
 assert.equal((await request('/v1/admin/support-cases?status=not-a-status',{token:administrator})).status,400);
 const supportPath='/v1/admin/support-cases/'+caseId+'/status';
 const invalidMove=await request(supportPath,{method:'POST',token:administrator,
  body:{expectedStatus:'acik',to:'kapandi'}});
 assert.equal(invalidMove.status,409);
 assert.equal((await request(supportPath,{method:'POST',token:customer,
  body:{expectedStatus:'acik',to:'incelemede'}})).status,403);
 const acceptedCase=await request(supportPath,{method:'POST',token:administrator,
  body:{expectedStatus:'acik',to:'incelemede'}});
 assert.equal(acceptedCase.status,200,JSON.stringify(acceptedCase.body));
 assert.equal((await request(supportPath,{method:'POST',token:administrator,
  body:{expectedStatus:'acik',to:'cozuldu'})).status,409,
  'stale concurrent support edits must be rejected');
 const resolvedCase=await request(supportPath,{method:'POST',token:administrator,
  body:{expectedStatus:'incelemede',to:'cozuldu'}});
 assert.equal(resolvedCase.status,200);
 assert.equal((await request(supportPath,{method:'POST',token:administrator,
  body:{expectedStatus:'cozuldu',to:'kapandi'})).status,200);
 assert.equal((await request(supportPath,{method:'POST',token:administrator,
  body:{expectedStatus:'kapandi',to:'incelemede'})).status,409);
 const customerCases=await request('/v1/me/support-cases',{token:customer});
 assert.equal(customerCases.body.cases.find((c:{id:string})=>c.id===caseId).status,'kapandi');
 const history=await pool.query("SELECT details FROM audit_logs WHERE action='support_case_status' AND target_id=$1 ORDER BY id",[caseId]);
 assert.equal(history.rowCount,3);
 assert.deepEqual(history.rows.map(r=>r.details),[
  {from:'acik',to:'incelemede'},{from:'incelemede',to:'cozuldu'},{from:'cozuldu',to:'kapandi'}]);

 assert.equal((await request('/v1/restaurant/'+rid+'/inbox',{token:noMfa})).status,403);
 assert.equal((await request('/v1/restaurant/'+rid+'/inbox',{token:customer})).status,403);
 const inbox=await request('/v1/restaurant/'+rid+'/inbox',{token:owner});
 assert.equal(inbox.status,200);
 assert.ok(inbox.body.pending.some((o:{id:string})=>o.id===orderId),'new order must appear in restaurant inbox');
 const detail=await request('/v1/restaurant/'+rid+'/orders/'+orderId,{token:owner});
 assert.equal(detail.status,200);
 assert.equal(detail.body.order.address_snapshot.address,'CI Test Sokak 12 Daire 3');
 const accepted=await request('/v1/restaurant/'+rid+'/orders/'+orderId+'/status',{
  method:'POST',token:owner,body:{to:'kabul_edildi'}});
 assert.equal(accepted.status,200,JSON.stringify(accepted.body));
 assert.equal((await request('/v1/me/orders/'+orderId,{token:customer})).body.order.status,'kabul_edildi');
 // Real merchant management endpoints: staff authorization, menu, hours and
 // configured neighborhood fees. All read/write requests use signed tokens.
 const baseManagement=await request('/v1/restaurant/'+rid+'/management',{token:owner});
 assert.equal(baseManagement.status,200,JSON.stringify(baseManagement.body));
 assert.equal(baseManagement.body.restaurant.id,rid);
 assert.ok(baseManagement.body.products.some((item:{id:string})=>item.id===pid));
 assert.ok(baseManagement.body.zones.some((item:{zone_id:string})=>item.zone_id===zid));
 assert.equal(baseManagement.body.permissions.canManageSettings,true);
 assert.equal((await request('/v1/restaurant/'+rid+'/management',{token:customer})).status,403);
 assert.equal((await request('/v1/restaurant/'+rid+'/management',{token:noMfa})).status,403);
 const toggleOff=await request('/v1/restaurant/'+rid+'/products/'+pid,{method:'PATCH',token:owner,body:{available:false}});
 assert.equal(toggleOff.status,200,JSON.stringify(toggleOff.body));
 const blockedMenu=await request('/v1/restaurants/'+rid+'/menu');
 assert.equal(blockedMenu.body.products.find((p:{id:string})=>p.id===pid)?.available,false);
 assert.equal((await request('/v1/restaurant/'+rid+'/products/'+pid,{method:'PATCH',token:customer,body:{available:true}})).status,403);
 assert.equal((await request('/v1/restaurant/'+rid+'/products/'+pid,{method:'PATCH',token:owner,body:{available:true}})).status,200);

 const originallyOpen=baseManagement.body.restaurant;
 assert.equal((await request('/v1/restaurant/'+rid+'/availability',{method:'PATCH',token:customer,body:{isOpen:false,isBusy:false,acceptsOrders:false}})).status,403);
 const closed=await request('/v1/restaurant/'+rid+'/availability',{method:'PATCH',token:owner,body:{isOpen:false,isBusy:false,acceptsOrders:false}});
 assert.equal(closed.status,200,JSON.stringify(closed.body));
 assert.equal((await request('/v1/restaurants/'+rid+'/menu')).body.restaurant.is_orderable,false);
 assert.equal((await request('/v1/restaurant/'+rid+'/availability',{method:'PATCH',token:owner,
  body:{isOpen:originallyOpen.is_open,isBusy:originallyOpen.is_busy,acceptsOrders:originallyOpen.accepts_orders}})).status,200);

 const badHours=await request('/v1/restaurant/'+rid+'/hours',{method:'PUT',token:owner,body:{slots:[
  {dayOfWeek:1,openTime:'10:00',closeTime:'16:00'},
  {dayOfWeek:1,openTime:'15:00',closeTime:'18:00'}]}});
 assert.equal(badHours.status,400);
 assert.equal(badHours.body.code,'HOURS_OVERLAP');
 assert.equal((await request('/v1/restaurant/'+rid+'/hours',{method:'PUT',token:customer,body:{slots:[]}})).status,403);
 const shutWeek=await request('/v1/restaurant/'+rid+'/hours',{method:'PUT',token:owner,body:{slots:[]}});
 assert.equal(shutWeek.status,200,JSON.stringify(shutWeek.body));
 assert.equal((await request('/v1/restaurants/'+rid+'/menu')).body.restaurant.is_orderable,false);
 const restoreHours=await request('/v1/restaurant/'+rid+'/hours',{method:'PUT',token:owner,body:{slots:baseManagement.body.hours}});
 assert.equal(restoreHours.status,200,JSON.stringify(restoreHours.body));

 const originalZone=(baseManagement.body.zones as Array<{zone_id:string;enabled:boolean;min_basket_kurus:number;delivery_fee_kurus:number}>)
  .find(z=>z.zone_id===zid);
 assert.ok(originalZone);
 const policy=(enabled:boolean)=>({enabled,minBasketKurus:originalZone!.min_basket_kurus,deliveryFeeKurus:originalZone!.delivery_fee_kurus});
 assert.equal((await request('/v1/restaurant/'+rid+'/zones/'+zid,{method:'PATCH',token:customer,body:policy(false)})).status,403);
 const disabledZone=await request('/v1/restaurant/'+rid+'/zones/'+zid,{method:'PATCH',token:owner,body:policy(false)});
 assert.equal(disabledZone.status,200,JSON.stringify(disabledZone.body));
 const discoveryWithoutZone=await request('/v1/restaurants?zoneId='+zid);
 assert.equal(discoveryWithoutZone.status,200);
 assert.equal(discoveryWithoutZone.body.restaurants.some((r:{id:string})=>r.id===rid),false);
 assert.equal((await request('/v1/restaurant/'+rid+'/zones/'+randomUUID(),{
  method:'PATCH',token:owner,body:policy(true)})).status,404);
 assert.equal((await request('/v1/restaurant/'+rid+'/zones/'+zid,{method:'PATCH',token:owner,body:policy(originalZone!.enabled)})).status,200);
 const savedManagement=await request('/v1/restaurant/'+rid+'/management',{token:owner});
 assert.equal(savedManagement.status,200);
 assert.deepEqual(savedManagement.body.hours,baseManagement.body.hours);
 assert.equal(savedManagement.body.zones.find((z:{zone_id:string})=>z.zone_id===zid).enabled,originalZone!.enabled);
 assert.equal((await request('/v1/restaurants/'+rid+'/menu')).body.restaurant.is_orderable,true);
 // Real restaurant menu editing: category ownership, draft products,
 // approved images, stale-write prevention and immutable past order prices.
 const ownCategory=(baseManagement.body.products as Array<{id:string;category_id:string;name:string;description:string;price_kurus:number;image_url:string|null;revision:number}>)
  .find(p=>p.id===pid);
 assert.ok(ownCategory,'seed product must be available in merchant management');
 const newCategory=await request('/v1/restaurant/'+rid+'/categories',{
  method:'POST',token:owner,body:{name:'CI Yeni Lezzetler'}});
 assert.equal(newCategory.status,201,JSON.stringify(newCategory.body));
 const categoryId=newCategory.body.category.id as string;
 assert.equal((await request('/v1/restaurant/'+rid+'/categories',{
  method:'POST',token:owner,body:{name:'cı yeni lezzetler'}})).status,409);
 assert.equal((await request('/v1/restaurant/'+rid+'/categories',{
  method:'POST',token:customer,body:{name:'Yetkisiz Kategori'}})).status,403);
 assert.equal((await request('/v1/restaurant/'+rid+'/categories/'+categoryId,{
  method:'PATCH',token:owner,body:{name:'CI Yeni Menüler'}})).status,200);
 // Signed binary photo upload: reject non-merchant or non-consenting request
 // BEFORE accepting customer-controlled image content.
 const photoUpload=(jwt:string,body:Buffer,rights='true')=>fetch(base+'/v1/restaurant/'+rid+'/photos',{
  method:'POST',headers:{Authorization:'Bearer '+jwt,
   'Content-Type':'application/octet-stream',
   'X-Photo-Rights-Affirmed':rights},
  body,signal:AbortSignal.timeout(10000)
 });
 const jpg=await sharp({create:{width:220,height:170,channels:3,
  background:{r:220,g:110,b:60}}}).jpeg({quality:87}).toBuffer();
 const customerPhoto=await photoUpload(customer,jpg);
 assert.equal(customerPhoto.status,403,'customer must never upload restaurant pictures');
 const unverifiedPhoto=await photoUpload(noMfa,jpg);
 assert.equal(unverifiedPhoto.status,403,'MFA required for photo upload');
 const missingRights=await photoUpload(owner,jpg,'false');
 assert.equal(missingRights.status,400);
 const invalidPhoto=await photoUpload(owner,Buffer.from('<svg><script>alert(1)</script></svg>'));
 assert.equal(invalidPhoto.status,415);
 const validPhoto=await photoUpload(owner,jpg);
 assert.equal(validPhoto.status,201,await validPhoto.clone().text());
 const published=await validPhoto.json() as {mediaId:string;imageUrl:string;width:number;height:number;sizeBytes:number};
 assert.match(published.imageUrl,/^https:\/\/assets\.bismilsofra\.example\/restaurants\//);
 assert.ok(published.sizeBytes>0&&published.width<=1600&&published.height<=1200);
 const stored=await pool.query('SELECT restaurant_id,uploaded_by,public_url,object_key FROM restaurant_media WHERE id=$1',[published.mediaId]);
 assert.equal(stored.rows[0].restaurant_id,rid);
 assert.equal(stored.rows[0].uploaded_by,ownerId);
 assert.equal(stored.rows[0].public_url,published.imageUrl);
 const put=fakeObjects.find(item=>item.method==='PUT');
 assert.ok(put,'fake S3 must receive a normalized image');
 assert.match(put!.url,/bismil-sofra-test\/restaurants\//);
 assert.equal(put!.contentType,'image/webp');
 const otherRestaurantAsset='https://assets.bismilsofra.example/restaurants/'+randomUUID()+'/photos/'+randomUUID()+'.webp';
 const foreignMedia=await request('/v1/restaurant/'+rid+'/products',{method:'POST',token:owner,body:{
  categoryId,name:'Başkasının fotoğrafı',description:'Bu yükleme reddedilmeli',priceKurus:25000,imageUrl:otherRestaurantAsset
 }});
 assert.equal(foreignMedia.status,409,'restaurant cannot claim an unowned CDN image');
 assert.equal(foreignMedia.body.code,'PHOTO_NOT_OWNED');
  const productDraft={categoryId,name:'CI Test Pidesi',description:'Yalnızca test ortamında kayıtlı ürün',
  priceKurus:24000,imageUrl:published.imageUrl};
 assert.equal((await request('/v1/restaurant/'+rid+'/products',{method:'POST',token:customer,body:productDraft})).status,403);
 assert.equal((await request('/v1/restaurant/'+rid+'/products',{
  method:'POST',token:owner,body:{...productDraft,categoryId:randomUUID()}})).status,409);
 const badPicture=await request('/v1/restaurant/'+rid+'/products',{
  method:'POST',token:owner,body:{...productDraft,imageUrl:'https://images.unsplash.com/random'}}); 
 assert.equal(badPicture.status,400);
 const createdProduct=await request('/v1/restaurant/'+rid+'/products',{
  method:'POST',token:owner,body:productDraft});
 assert.equal(createdProduct.status,201,JSON.stringify(createdProduct.body));
 const newProductId=createdProduct.body.product.id as string;
 assert.equal(createdProduct.body.product.available,false,'new products are drafts');
 assert.equal(createdProduct.body.product.revision,1);
 assert.equal((await request('/v1/restaurants/'+rid+'/menu')).body.products.find((p:{id:string})=>p.id===newProductId)?.available,false);
 const newPrice=26000;
 const edited=await request('/v1/restaurant/'+rid+'/products/'+newProductId+'/details',{
  method:'PATCH',token:owner,body:{...productDraft,name:'CI Özel Pide',priceKurus:newPrice,revision:1}});
 assert.equal(edited.status,200,JSON.stringify(edited.body));
 assert.equal(edited.body.product.price_kurus,newPrice);
 assert.equal(edited.body.product.revision,2);
 const staleEditor=await request('/v1/restaurant/'+rid+'/products/'+newProductId+'/details',{
  method:'PATCH',token:owner,body:{...productDraft,priceKurus:15000,revision:1}});
 assert.equal(staleEditor.status,409);
 assert.equal(staleEditor.body.code,'PRODUCT_CONFLICT');
 assert.equal((await request('/v1/restaurant/'+rid+'/products/'+newProductId+'/details',{
  method:'PATCH',token:owner,body:{...productDraft,revision:2,categoryId:randomUUID()}})).status,409);
 assert.equal((await request('/v1/restaurant/'+randomUUID()+'/products/'+newProductId+'/details',{
  method:'PATCH',token:owner,body:{...productDraft,revision:2}})).status,403);
 const activated=await request('/v1/restaurant/'+rid+'/products/'+newProductId,{
  method:'PATCH',token:owner,body:{available:true}});
 assert.equal(activated.status,200);
 const publicCreated=(await request('/v1/restaurants/'+rid+'/menu')).body.products.find((p:{id:string})=>p.id===newProductId);
 assert.equal(publicCreated.name,'CI Özel Pide');
 assert.equal(publicCreated.price_kurus,newPrice);
 assert.equal(publicCreated.available,true);
 // Customer cannot manage extras; authenticated restaurant owner can.
 const optsBase='/v1/restaurant/'+rid+'/products/'+newProductId+'/option-groups';
 assert.equal((await request(optsBase,{token:customer})).status,403);
 assert.equal((await request(optsBase,{token:noMfa})).status,403);
 assert.equal((await request(optsBase,{token:owner})).status,200);
 assert.equal((await request(optsBase,{method:'POST',token:customer,body:{name:'Sahte Grup'}})).status,403);
 const groupCreated=await request(optsBase,{method:'POST',token:owner,body:{name:'Ekstra Malzemeler'}});
 assert.equal(groupCreated.status,201,JSON.stringify(groupCreated.body));
 const gid=groupCreated.body.group.id as string;
 assert.equal(groupCreated.body.group.min_select,0);
 assert.equal(groupCreated.body.group.max_select,1);
 assert.equal(groupCreated.body.group.revision,1);
 assert.equal((await request(optsBase,{method:'POST',token:owner,body:{name:'ekstra malzemeler'}})).status,409);
 const groupPath=optsBase+'/'+gid;
 const minTooSoon=await request(groupPath,{method:'PATCH',token:owner,
  body:{name:'Ekstra Malzemeler',minSelect:1,maxSelect:1,archived:false,revision:1}});
 assert.equal(minTooSoon.status,409);
 assert.equal(minTooSoon.body.code,'OPTION_MIN_REQUIRED');
 const firstExtra=await request(groupPath+'/options',{method:'POST',token:owner,
  body:{name:'Ekstra Kaşar',priceKurus:2500}});
 assert.equal(firstExtra.status,201,JSON.stringify(firstExtra.body));
 const kaşarId=firstExtra.body.option.id as string;
 assert.equal(firstExtra.body.option.revision,1);
 assert.equal((await request(groupPath+'/options',{method:'POST',token:owner,
  body:{name:'ekstra kaşar',priceKurus:2200}})).status,409);
 assert.equal((await request(groupPath+'/options',{method:'POST',token:owner,
  body:{name:'Ekstra',priceKurus:-100}})).status,400);
 const requiredGroup=await request(groupPath,{method:'PATCH',token:owner,
  body:{name:'Ekstra Malzemeler',minSelect:1,maxSelect:1,archived:false,revision:1}});
 assert.equal(requiredGroup.status,200);
 assert.equal(requiredGroup.body.group.revision,2);
 const prohibitedDisable=await request(groupPath+'/options/'+kaşarId,{method:'PATCH',token:owner,
  body:{name:'Ekstra Kaşar',priceKurus:2500,available:false,revision:1}});
 assert.equal(prohibitedDisable.status,409);
 assert.equal(prohibitedDisable.body.code,'OPTION_MIN_REQUIRED');
 const secondExtra=await request(groupPath+'/options',{method:'POST',token:owner,
  body:{name:'Sos',priceKurus:0}});
 assert.equal(secondExtra.status,201);
 const sosId=secondExtra.body.option.id as string;
 const disabled=await request(groupPath+'/options/'+kaşarId,{method:'PATCH',token:owner,
  body:{name:'Ekstra Kaşar',priceKurus:2500,available:false,revision:1}});
 assert.equal(disabled.status,200);
 assert.equal(disabled.body.option.revision,2);
 const staleOption=await request(groupPath+'/options/'+kaşarId,{method:'PATCH',token:owner,
  body:{name:'Eski Kaşar',priceKurus:2700,available:true,revision:1}});
 assert.equal(staleOption.status,409);
 assert.equal(staleOption.body.code,'OPTION_CONFLICT');
 const restoredOptions=await request(optsBase,{token:owner});
 assert.equal(restoredOptions.status,200);
 assert.ok(restoredOptions.body.groups.find((g:{id:string})=>g.id===gid));
 assert.equal(restoredOptions.body.groups.find((g:{id:string})=>g.id===gid).options.length,2);
 const userMenu=await request('/v1/restaurants/'+rid+'/menu');
 assert.equal(userMenu.status,200);
 const groupOnMenu=userMenu.body.products.find((p:{id:string})=>p.id===newProductId).optionGroups
  .find((g:{id:string})=>g.id===gid);
 assert.ok(groupOnMenu);
 assert.equal(groupOnMenu.min_select,1);
 assert.equal(groupOnMenu.options.find((o:{id:string})=>o.id===kaşarId).available,false);
 const extrasQuote=await request('/v1/orders/quote',{method:'POST',token:customer,
  body:{...payload,items:[{productId:newProductId,quantity:1,optionIds:[sosId]}]}});
 assert.equal(extrasQuote.status,200,JSON.stringify(extrasQuote.body));
 assert.equal(extrasQuote.body.totals.totalKurus,newPrice+quote.body.totals.deliveryFeeKurus);
 const archivedGroup=await request(groupPath,{method:'PATCH',token:owner,
  body:{name:'Ekstra Malzemeler',minSelect:1,maxSelect:1,archived:true,revision:2}});
 assert.equal(archivedGroup.status,200);
 const afterArchive=await request('/v1/restaurants/'+rid+'/menu');
 assert.equal(afterArchive.body.products.find((p:{id:string})=>p.id===newProductId)
  .optionGroups.some((g:{id:string})=>g.id===gid),false);
 // A hidden/archived mandatory group must not break checkout quotes.
 const quoteAfterArchive=await request('/v1/orders/quote',{method:'POST',token:customer,
  body:{...payload,items:[{productId:newProductId,quantity:1,optionIds:[]}]}});
 assert.equal(quoteAfterArchive.status,200,JSON.stringify(quoteAfterArchive.body));
 const archivedSelection=await request('/v1/orders/quote',{method:'POST',token:customer,
  body:{...payload,items:[{productId:newProductId,quantity:1,optionIds:[sosId]}]}});
 assert.equal(archivedSelection.status,409);
 assert.equal(archivedSelection.body.code,'OPTION_FOREIGN');
 const restoredGroup=await request(groupPath,{method:'PATCH',token:owner,
  body:{name:'Ekstra Malzemeler',minSelect:1,maxSelect:1,archived:false,revision:3}});
 assert.equal(restoredGroup.status,200);
 assert.equal(restoredGroup.body.group.revision,4);
 assert.equal((await request('/v1/restaurant/'+randomUUID()+'/products/'+newProductId+'/option-groups',{token:owner})).status,403);

 
 const snapshotBefore=await pool.query('SELECT unit_kurus,line_total_kurus FROM order_items WHERE order_id=$1',[orderId]);
 const changedOriginal=await request('/v1/restaurant/'+rid+'/products/'+pid+'/details',{
  method:'PATCH',token:owner,
  body:{categoryId:ownCategory.category_id,name:ownCategory.name,description:ownCategory.description,
   priceKurus:ownCategory.price_kurus+100,imageUrl:ownCategory.image_url,revision:ownCategory.revision}});
 assert.equal(changedOriginal.status,200,JSON.stringify(changedOriginal.body));
 const freshQuote=await request('/v1/orders/quote',{method:'POST',token:customer,body:payload});
 assert.equal(freshQuote.status,200,JSON.stringify(freshQuote.body));
 assert.equal(freshQuote.body.totals.totalKurus,quote.body.totals.totalKurus+100);
 const snapshotAfter=await pool.query('SELECT unit_kurus,line_total_kurus FROM order_items WHERE order_id=$1',[orderId]);
 assert.deepEqual(snapshotAfter.rows,snapshotBefore.rows,'historical order prices must not change');
 const restoredOriginal=await request('/v1/restaurant/'+rid+'/products/'+pid+'/details',{
  method:'PATCH',token:owner,
  body:{categoryId:ownCategory.category_id,name:ownCategory.name,description:ownCategory.description,
   priceKurus:ownCategory.price_kurus,imageUrl:ownCategory.image_url,revision:changedOriginal.body.product.revision}});
 assert.equal(restoredOriginal.status,200,JSON.stringify(restoredOriginal.body));


 // Recovery tools require administrator MFA with recent authentication, and
 // must refuse to reactivate notifications for an already accepted order.
 await pool.query("UPDATE restaurant_escalations SET next_attempt_at=now()-interval '1 second' WHERE order_id=$1",[orderId]);
 const escalations=await request('/v1/admin/escalations',{token:administrator});
 assert.equal(escalations.status,200);
 assert.ok(Array.isArray(escalations.body.escalations));
 assert.ok(escalations.body.escalations.some((item:{order_id:string})=>item.order_id===orderId));
 assert.equal((await request('/v1/admin/escalations',{token:customer})).status,403);
 assert.equal((await request('/v1/admin/escalations/'+orderId+'/retry',{token:administrator,method:'POST'})).status,409);
 // Reconnect: a fresh authenticated HTTP request reconstructs the active inbox after network loss.
 const afterReconnect=await request('/v1/restaurant/'+rid+'/inbox',{token:owner});
 assert.equal(afterReconnect.status,200);
 assert.ok(afterReconnect.body.active.some((o:{id:string})=>o.id===orderId));
 const cancellation=await request('/v1/me/orders/'+orderId+'/cancel',{method:'POST',token:customer});
 assert.equal(cancellation.status,409);
 // Failed delivery stays durable and is delivered on the next attempt.
 const event=(await pool.query("SELECT id FROM notification_outbox WHERE order_id=$1 AND type='new_order'",[orderId])).rows[0];
 const eventId=String(event.id);
 let failOnce=true;
 const first=await dispatchOutbox(pool,async e=>{
  if(String(e.id)===eventId&&failOnce){failOnce=false;throw Error('CI simulated offline webhook')}
 },30);
 assert.ok(first.failed>=1);
 const failed=await pool.query('SELECT sent_at,attempts FROM notification_outbox WHERE id=$1',[eventId]);
 assert.equal(failed.rows[0].sent_at,null);
 assert.equal(failed.rows[0].attempts,1);
 await pool.query('UPDATE notification_outbox SET next_attempt_at=now() WHERE id=$1',[eventId]);
 const sent=await dispatchOutbox(pool,async()=>{},30);
 assert.ok(sent.sent>=1);
 const done=await pool.query('SELECT sent_at,attempts FROM notification_outbox WHERE id=$1',[eventId]);
 assert.ok(done.rows[0].sent_at);
 assert.equal(done.rows[0].attempts,2);
 // Deliberately run last: spoofing a different client IP in X-Forwarded-For
 // must NOT bypass the per-origin order limiter when no peer is trusted.
 let responseCode=0;
 for(let i=0;i<15;i++){
  const response=await fetch(base+'/v1/orders',{method:'POST',
   headers:{'X-Forwarded-For':'192.0.2.'+(i+1)},signal:AbortSignal.timeout(4000)});
  responseCode=response.status;
 }
 assert.equal(responseCode,429,'untrusted forwarded IP must not evade order quota');
});
