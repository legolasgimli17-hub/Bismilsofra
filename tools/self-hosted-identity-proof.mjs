import assert from 'node:assert/strict';
import {randomBytes, createHash, createHmac} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const [mode, dir] = process.argv.slice(2);
const origin = 'http://127.0.0.1:8180';
const issuer = origin + '/realms/sofra-ci';
const endpoint = issuer + '/protocol/openid-connect';
const callback = 'http://127.0.0.1:3180/';
const credentials = join(dir, 'identities.json');
const random = () => randomBytes(32).toString('base64url');

async function prepare() {
  const realm = JSON.parse(await readFile(new URL('./fixtures/keycloak-ci-realm.json', import.meta.url), 'utf8'));
  const accounts = ['customer','merchant'].map(username => ({
    username, password:random(), otp:username === 'merchant' ? random() : undefined
  }));
  realm.users = accounts.map(({username,password,otp}) => ({
    username, email:username + '@example.invalid', emailVerified:true, enabled:true,
    firstName:'Test', lastName:username,
    credentials:[{type:'password', value:password, temporary:false}, ...(otp ? [{
      type:'otp', userLabel:'Disposable fixture',
      secretData:JSON.stringify({value:otp}),
      credentialData:JSON.stringify({subType:'totp', digits:6, period:30, algorithm:'HmacSHA1', counter:0})
    }] : [])]
  }));
  await writeFile(credentials, JSON.stringify(accounts), {mode:0o600,flag:'wx'});
  await writeFile(join(dir,'sofra-ci-realm.json'), JSON.stringify(realm), {mode:0o644,flag:'wx'});
}

function totp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const hash = createHmac('sha1',secret).update(counter).digest();
  return String((hash.readUInt32BE(hash.at(-1)&15)&0x7fffffff)%1_000_000).padStart(6,'0');
}

async function login(account) {
  const verifier = random();
  const state = random();
  const cookies = new Map();
  async function request(url, data) {
    assert.equal(new URL(url).origin, origin);
    const res = await fetch(url,{method:data ? 'POST':'GET', body:data && new URLSearchParams(data),
      headers:{cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}, redirect:'manual'});
    for (const header of res.headers.getSetCookie()) {
      const pair = header.split(';')[0];
      const split = pair.indexOf('=');
      cookies.set(pair.slice(0,split),pair.slice(split+1));
    }
    return res;
  }
  const query = new URLSearchParams({client_id:'sofra-web',redirect_uri:callback,response_type:'code',
    scope:'openid email profile',state,code_challenge_method:'S256',
    code_challenge:createHash('sha256').update(verifier).digest('base64url')});
  let response = await request(endpoint+'/auth?'+query);
  async function postForm(fields) {
    assert.equal(response.status,200);
    const html = await response.text();
    const action = html.match(/<form\b[^>]*\baction="([^"]+)"/i)?.[1];
    assert.ok(action,'Expected realm login form');
    response = await request(action.replaceAll('&amp;','&'), fields);
  }
  await postForm({username:account.username,password:account.password});
  if (account.otp) await postForm({otp:totp(account.otp)});
  assert.ok([302,303].includes(response.status),'Expected OAuth callback');
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin+location.pathname,callback);
  assert.equal(location.searchParams.get('state'),state);
  const token = await request(endpoint+'/token',{grant_type:'authorization_code',client_id:'sofra-web',
    redirect_uri:callback,code:location.searchParams.get('code'),code_verifier:verifier});
  assert.equal(token.status,200);
  return (await token.json()).access_token;
}

async function check() {
  process.env.OIDC_ISSUER=issuer;
  process.env.OIDC_AUDIENCE='sofra-api';
  process.env.OIDC_JWKS_URL=endpoint+'/certs';
  const {verifyBearer,requireMfa,requireVerifiedEmail} = await import('../apps/api/src/auth.ts');
  for (const account of JSON.parse(await readFile(credentials,'utf8'))) {
    const identity = await verifyBearer('Bearer '+await login(account));
    requireVerifiedEmail(identity);
    assert.equal(identity.email,account.username+'@example.invalid');
    if (account.otp) {
      requireMfa(identity,true);
      const now=Date.now()/1000;
      for (const authTime of [undefined,0,NaN,Infinity,now-601,now+60]) {
        assert.throws(()=>requireMfa({...identity,authTime},true),e=>e.code==='REAUTH_REQUIRED');
      }
      requireMfa({...identity,authTime:now-590},true);
      requireMfa({...identity,authTime:now+2},true);
      requireMfa({...identity,authTime:now-601}); // Ordinary access is not a recent-MFA operation.
    } else assert.throws(()=>requireMfa(identity), e=>e.code==='MFA_REQUIRED');
  }
  console.log('Verified password-only and two-factor sessions with the application guards.');
}

if (mode==='prepare') await prepare();
else if (mode==='check') await check();
else throw new Error('Use prepare or check and an isolated temporary directory.');
