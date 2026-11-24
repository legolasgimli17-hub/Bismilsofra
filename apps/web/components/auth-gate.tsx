'use client';
import {useAuth0} from '@auth0/auth0-react';
import {authReady} from './providers';
import {useCallback,useState,type ReactNode} from 'react';
// Separate component so hooks are only invoked when provider exists.
function Inner({children}:{children:(token:()=>Promise<string>)=>ReactNode}){
 const {isAuthenticated,isLoading,loginWithRedirect,getAccessTokenSilently}=useAuth0();
 const [loginError,setLoginError]=useState('');
 // A stable callback prevents dependent polling effects restarting on every render.
 const token=useCallback(async()=>{
  const accessToken=await getAccessTokenSilently();
  if(typeof accessToken!=='string'||accessToken.length===0)
   throw new Error('Oturum belirteci alınamadı. Tekrar giriş yapın.');
  return accessToken;
 },[getAccessTokenSilently]);
 if(isLoading)return <div className="empty">Oturum kontrol ediliyor…</div>;
 if(!isAuthenticated)return <section className="empty"><h2>Devam etmek için giriş yap</h2><p>E-posta doğrulaması ve güvenli giriş sağlayıcısı üzerinden oturum açılır.</p><button className="btn primary" onClick={()=>{
  setLoginError('');
  void loginWithRedirect({authorizationParams:{redirect_uri:window.location.origin},
   appState:{returnTo:window.location.pathname+window.location.search+window.location.hash}
  }).catch(()=>setLoginError('Giriş ekranı açılamadı. Bağlantınızı kontrol edin.'));
 }}>Giriş yap / kayıt ol</button>{loginError&&<p role="alert">{loginError}</p>}</section>;
 return <>{children(token)}</>;
}
export default function AuthGate({children}:{children:(token:()=>Promise<string>)=>ReactNode}){if(!authReady)return <section className="empty"><h2>Giriş sistemi henüz bağlanmadı</h2><p>Geliştirme ortamında Auth0 yapılandırması yapılana kadar gerçek hesap/sipariş işlemleri kapalıdır.</p></section>;return <Inner>{children}</Inner>}
