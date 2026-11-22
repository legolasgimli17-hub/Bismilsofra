/** Read-only HTTPS staging health check. No customer data and no mutations. */
import {validateStagingTarget} from './staging-target.mjs';
const raw=process.env.STAGING_API_URL;
if(!raw)throw Error('STAGING_API_URL is required.');
const base=validateStagingTarget(raw);
const checks=[['/healthz','status','ok'],['/readyz','status','ready'],
 ['/v1/zones','zones',null],['/v1/categories','categories',null],
 ['/v1/restaurants','restaurants',null]];
const results=[];
for(const [path,key,exact] of checks){
 const response=await fetch(base+path,{headers:{Accept:'application/json'},
  signal:AbortSignal.timeout(5000),cache:'no-store'});
 if(response.status!==200)throw Error(path+' returned HTTP '+response.status);
 const data=await response.json();
 if(exact!==null&&data[key]!==exact)throw Error(path+' returned invalid status');
 if(exact===null&&!Array.isArray(data[key]))throw Error(path+' missing '+key+' array');
 results.push({path,status:response.status});
}
console.log(JSON.stringify({target:base,checks:results}));
