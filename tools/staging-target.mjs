/** Only explicitly isolated staging/localhost URLs are safe for probes. */
export function validateStagingTarget(raw){
 const u=new URL(raw);
 const loopback=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
 const staging=u.hostname.toLowerCase().includes('staging');
 if((!loopback&&!staging)||(loopback?u.protocol!=='http:':u.protocol!=='https:')||
  !u.host||u.username||u.password||u.pathname!=='/'||u.search||u.hash||
  (loopback&&!u.port))
  throw Error('Refusing target: use localhost fixture or a dedicated HTTPS staging host.');
 return u.origin;
}
