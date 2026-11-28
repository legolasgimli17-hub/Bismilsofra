'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Auth0Provider,useAuth0} from '@auth0/auth0-react';
import {addCartLine,clearOrderedCart,EMPTY_CART,updateLine,readStoredCart,restoreCartSnapshot} from '@/lib/cart';
import type {Cart,CartLine} from '@/lib/types';
import {safeAuthReturnTo} from '@/lib/auth-redirect';
type CartActions={
 cart:Cart;ready:boolean;
 add:(id:string,name:string,line:CartLine,replace:boolean)=>void;
 change:(index:number,delta:number)=>void;replaceCart:(next:Cart)=>void;clear:()=>void;clearSubmitted:(submitted:Cart)=>void
};
const CartCtx=createContext<CartActions>({
 cart:EMPTY_CART,ready:false,add:()=>{},change:()=>{},replaceCart:()=>{},clear:()=>{},clearSubmitted:()=>{}
});
export const useCart=()=>useContext(CartCtx);
const auth={domain:process.env.NEXT_PUBLIC_AUTH0_DOMAIN||'',clientId:process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID||'',audience:process.env.NEXT_PUBLIC_AUTH0_AUDIENCE||''};
export const authReady=Boolean(auth.domain&&auth.clientId&&auth.audience);
export function useUserAccess(){const a=useAuth0();return { ...a, async token(){if(!a.isAuthenticated)throw Error('Giriş gerekli');return a.getAccessTokenSilently()},login(){void a.loginWithRedirect({authorizationParams:{redirect_uri:window.location.origin},appState:{returnTo:window.location.pathname+window.location.search+window.location.hash}})},logoutUser(){a.logout({logoutParams:{returnTo:window.location.origin}})} }}

const CART_STORAGE_KEY='sofra-cart-v22';
const LEGACY_SESSION_KEY='sofra-cart-v07';

function CartProvider({children}:{children:ReactNode}){
 const [cart,setCart]=useState<Cart>(EMPTY_CART);
 const [ready,setReady]=useState(false);
 const cartRef=useRef<Cart>(EMPTY_CART);

 useEffect(()=>{
  let current:string|null=null,legacy:string|null=null;
  try{current=window.localStorage.getItem(CART_STORAGE_KEY)}catch{}
  if(current===null)try{legacy=window.sessionStorage.getItem(LEGACY_SESSION_KEY)}catch{}
  const restored=restoreCartSnapshot(current,legacy);
  cartRef.current=restored;
  setCart(restored);
  // Persist migration from the old tab-scoped key. Nothing sensitive is stored.
  try{
   window.localStorage.setItem(CART_STORAGE_KEY,JSON.stringify(restored));
   window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
  }catch{}
  setReady(true);
  const onStorage=(event:StorageEvent)=>{
   if(event.storageArea!==window.localStorage||
    (event.key!==CART_STORAGE_KEY&&event.key!==null))return;
   const next=readStoredCart(event.key===null?window.localStorage.getItem(CART_STORAGE_KEY):event.newValue);
   cartRef.current=next;setCart(next);
  };
  window.addEventListener('storage',onStorage);
  return()=>window.removeEventListener('storage',onStorage);
 },[]);

 // Read the latest shared snapshot *when* applying an action rather than using
 // a stale render closure. Same-tab rapid clicks and already-delivered cross-tab
 // updates are preserved. Simultaneous cross-tab writes are not transactional;
 // the server's idempotency and confirmed totals remain authoritative.
 const apply=(fn:(current:Cart)=>Cart)=>{
  let previous=cartRef.current;
  try{
   const raw=window.localStorage.getItem(CART_STORAGE_KEY);
   if(raw!==null)previous=readStoredCart(raw);
  }catch{}
  const next=fn(previous);
  cartRef.current=next;
  setCart(next);
  try{window.localStorage.setItem(CART_STORAGE_KEY,JSON.stringify(next))}catch{}
 };
 return <CartCtx.Provider value={{
  cart,ready,
  add:(id,name,line,replace)=>apply(current=>addCartLine(current,id,name,line,replace)),
  change:(index,delta)=>apply(current=>updateLine(current,index,delta)),
  replaceCart:(next)=>apply(()=>next),
  clear:()=>apply(()=>EMPTY_CART),
  clearSubmitted:submitted=>apply(current=>clearOrderedCart(current,submitted))
 }}>{children}</CartCtx.Provider>;
}
export default function Providers({children}:{children:ReactNode}){
 const router=useRouter();
 const origin=typeof window==='undefined'?undefined:window.location.origin;
 useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})},[]);
 const sdk=authReady?<Auth0Provider domain={auth.domain} clientId={auth.clientId} authorizationParams={{redirect_uri:origin,audience:auth.audience,scope:'openid profile email'}} cacheLocation="memory" useRefreshTokens
  onRedirectCallback={appState=>{
   // Keep the provider mounted so the SDK retains its in-memory session.
   router.replace(safeAuthReturnTo(appState?.returnTo));
  }}>{children}</Auth0Provider>:<>{children}</>;
 return <CartProvider>{sdk}</CartProvider>;
}
