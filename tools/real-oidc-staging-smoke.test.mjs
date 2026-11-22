/** No external traffic. Fail-closed contract tests for provider-issued Auth0 checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExternalOidcConfig,probeRealOidc} from './real-oidc-staging-smoke.mjs';

const token=n=>'provider-signed-jwt-placeholder-'+String(n).repeat(70);
const good={
 STAGING_API_URL:'https://api.sofra-staging.example.invalid/',
 STAGING_OIDC_ISSUER:'https://sofra-auth-staging.us.auth0.com/',
 STAGING_OIDC_AUDIENCE:'https://api.sofra-staging.example.invalid',
 STAGING_CUSTOMER_ACCESS_TOKEN:token(1),
 STAGING_MERCHANT_ACCESS_TOKEN:token(2),
 STAGING_ADMIN_ACCESS_TOKEN:token(3)
};
test('real IdP verifier rejects missing real provider test accounts',()=>{
 assert.throws(()=>validateExternalOidcConfig({STAGING_API_URL:good.STAGING_API_URL,STAGING_OIDC_ISSUER:good.STAGING_OIDC_ISSUER,STAGING_OIDC_AUDIENCE:good.STAGING_OIDC_AUDIENCE}),/STAGING_CUSTOMER_ACCESS_TOKEN/);
});
test('no probing accidental production API or unencrypted Auth0 issuer',()=>{
 assert.throws(()=>validateExternalOidcConfig({...good,STAGING_API_URL:'https://api.production.example.com/'}),/Refusing target/);
 assert.throws(()=>validateExternalOidcConfig({...good,STAGING_OIDC_ISSUER:'http://auth.example.com/'}),/HTTPS/);
 assert.throws(()=>validateExternalOidcConfig({...good,STAGING_OIDC_ISSUER:'https://username:pw@auth.example.com/'}),/HTTPS/);
});
test('three distinct externally issued test access tokens are mandatory',()=>{
 assert.throws(()=>validateExternalOidcConfig({...good,STAGING_ADMIN_ACCESS_TOKEN:token(2)}),/three different/);
 const config=validateExternalOidcConfig(good);
 assert.equal(config.api,'https://api.sofra-staging.example.invalid');
 assert.equal(config.issuer,good.STAGING_OIDC_ISSUER);
 assert.equal(config.audience,good.STAGING_OIDC_AUDIENCE);
});
test('OIDC discovery issuer mismatch fails before requesting JWKS, API or personal data',async()=>{
 let visits=0;
 const config=validateExternalOidcConfig(good);
 await assert.rejects(probeRealOidc(config,async()=>{
  visits++;
  return {status:200,json:async()=>({issuer:'https://other-domain.example/',
   jwks_uri:'https://other-domain.example/jwks.json'})};
 }),/issuer mismatch/);
 assert.equal(visits,1);
});
