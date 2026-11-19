'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Auth0Provider,useAuth0} from '@auth0/auth0-react';
import {addCartLine,EMPTY_CART,updateLine} from '@/lib/cart';
import type {Cart,CartLine} from '@/lib/types';
const CartCtx=createContext<{cart:Cart;add:(id:string,name:string,line:CartLine,replace:boolean)=>void;change:(index:number,delta:number)=>void;clear:()=>void}>({cart:EMPTY_CART,add:()=>{},change:()=>{},clear:()=>{}});
export const useCart=()=>useContext(CartCtx);
const auth={domain:process.env.NEXT_PUBLIC_AUTH0_DOMAIN||'',clientId:process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID||'',audience:process.env.NEXT_PUBLIC_AUTH0_AUDIENCE||''};
export const authReady=Boolean(auth.domain&&auth.clientId&&auth.audience);
export function useUserAccess(){const a=useAuth0();return { ...a, async token(){if(!a.isAuthenticated)throw Error('Giriş gerekli');return a.getAccessTokenSilently()},login(){void a.loginWithRedirect()},logoutUser(){a.logout({logoutParams:{returnTo:window.location.origin}})} }}
function CartProvider({children}:{children:ReactNode}){
 const [cart,setCart]=useState<Cart>(EMPTY_CART);
 useEffect(()=>{try{const raw=sessionStorage.getItem('sofra-cart-v07');if(raw){const obj=JSON.parse(raw) as Cart;if(obj&&typeof obj.restaurantId==='string'&&Array.isArray(obj.lines))setCart(obj)}}catch{}},[]);
 const save=(next:Cart)=>{setCart(next);try{sessionStorage.setItem('sofra-cart-v07',JSON.stringify(next))}catch{}};
 return <CartCtx.Provider value={{cart,add:(id,name,line,replace)=>{const next=addCartLine(cart,id,name,line,replace);save(next)},change:(index,delta)=>save(updateLine(cart,index,delta)),clear:()=>save(EMPTY_CART)}}>{children}</CartCtx.Provider>;
}
export default function Providers({children}:{children:ReactNode}){
 const [origin,setOrigin]=useState('http://127.0.0.1:3000');useEffect(()=>{setOrigin(window.location.origin);if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})},[]);
 const sdk=authReady?<Auth0Provider domain={auth.domain} clientId={auth.clientId} authorizationParams={{redirect_uri:origin,audience:auth.audience,scope:'openid profile email'}} cacheLocation="memory" useRefreshTokens>{children}</Auth0Provider>:<>{children}</>;
 return <CartProvider>{sdk}</CartProvider>;
}
