/** OIDC post-login return path, always constrained to the current origin.
 * Auth0 handles token verification; this only protects browser navigation.
 */
export function safeAuthReturnTo(raw:unknown):string{
 if(typeof raw!=='string'||raw.length>2048||!raw.startsWith('/')||
  raw.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(raw))return '/';
 try{
  const origin='https://bismilsofra.local.invalid';
  const uri=new URL(raw,origin);
  if(uri.origin!==origin||!uri.pathname.startsWith('/'))return '/';
  return uri.pathname+uri.search+uri.hash;
 }catch{return '/'}
}
