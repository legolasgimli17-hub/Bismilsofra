'use client';
import {useCallback,useEffect,useState} from 'react';
import {useAuth0} from '@auth0/auth0-react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,Check,Clock3,RefreshCw,ShoppingBag} from 'lucide-react';
import {api,apiConfigured} from '@/lib/api';
import {authReady,useCart} from '@/components/providers';
import {money,type Order,type MenuProduct,type Restaurant} from '@/lib/types';
import {latestCompletedOrder} from '@/lib/recent-orders';
import {buildReorderPreview,type PastOrderLine,type ReorderPreview} from '@/lib/reorder-preview';

type OrderDetailResponse={order:Order;items:PastOrderLine[]};

/** This component is optional: browsing and the demo never require login. */
export default function RecentOrderShortcut(){
 if(!authReady||!apiConfigured())return null;
 return <AuthenticatedRecentOrder/>;
}
function AuthenticatedRecentOrder(){
 const {isAuthenticated,isLoading,user,getAccessTokenSilently}=useAuth0();
 const {cart,ready,replaceCart}=useCart();
 const router=useRouter();
 const [recent,setRecent]=useState<Order|null>(null);
 const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState<ReorderPreview|null>(null);
 const [error,setError]=useState('');

 const token=useCallback(async()=>{
  const value=await getAccessTokenSilently();
  if(!value)throw new Error('Oturum doğrulanamadı.');
  return value;
 },[getAccessTokenSilently]);

 useEffect(()=>{
  let active=true;
  setRecent(null);setPreview(null);setError('');
  if(!isAuthenticated||isLoading)return()=>{active=false};
  void token()
   .then(t=>api<{orders:Order[]}>('/v1/me/orders',t))
   .then(response=>{if(active)setRecent(latestCompletedOrder(response.orders))})
   // Browsing should remain usable when the optional shortcut cannot load.
   .catch(()=>{if(active)setRecent(null)});
  return()=>{active=false};
 },[isAuthenticated,isLoading,user?.sub,token]);

 async function prepare(){
  if(!recent||busy)return;
  setBusy(true);setError('');setPreview(null);
  try{
   const t=await token();
   const detail=await api<OrderDetailResponse>(`/v1/me/orders/${encodeURIComponent(recent.id)}`,t);
   if(detail.order.id!==recent.id||detail.order.restaurant_id!==recent.restaurant_id||detail.order.status!=='teslim_edildi')
    throw new Error('Geçmiş sipariş doğrulanamadı. Siparişlerim sayfasından kontrol et.');
   const restaurantId=detail.order.restaurant_id;
   const menu=await api<{restaurant:Restaurant;products:MenuProduct[]}>(`/v1/restaurants/${encodeURIComponent(restaurantId)}/menu`);
   setPreview(buildReorderPreview(restaurantId,menu.restaurant.name,menu.restaurant.is_orderable===true,detail.items,menu.products));
  }catch(e){setError(e instanceof Error?e.message:'Güncel ürün bilgileri alınamadı.')}
  finally{setBusy(false)}
 }
 function confirm(){
  if(!preview?.cart||!ready)return;
  if(cart.lines.length&&!window.confirm('Sepetindeki mevcut ürünler silinecek. Onaylıyor musun?'))return;
  replaceCart(preview.cart);
  router.push('/checkout');
 }
 if(isLoading||!isAuthenticated||!recent)return null;
 return <section className="container home-reorder" aria-labelledby="home-reorder-title">
  <div className="home-reorder-shell">
   <div className="home-reorder-intro">
    <span className="overline"><RefreshCw size={14}/> YENİDEN SİPARİŞ</span>
    <h2 id="home-reorder-title">Geçen seferki lezzet, yeniden sofranda.</h2>
    <p>Son tamamlanan siparişini güncel menü ve fiyatlarla tekrar hazırlayabilirsin.</p>
    <div className="home-reorder-meta"><span><Clock3 size={14}/>{new Date(recent.created_at).toLocaleDateString('tr-TR')}</span><span>Sipariş #{recent.id.slice(0,8).toUpperCase()}</span><span>Önceki toplam: {money(recent.total_kurus)}</span></div>
   </div>
   <div className="home-reorder-actions">
    <button className="btn primary" type="button" disabled={busy} onClick={()=>void prepare()}><RefreshCw size={17}/>{busy?'Menü kontrol ediliyor…':'Tekrar sipariş hazırla'}</button>
    <Link className="home-reorder-history" href={`/orders/${recent.id}`}>Sipariş detayları <ArrowRight size={15}/></Link>
   </div>
  </div>
  {error&&<div role="alert" className="notice error home-reorder-feedback">{error} <Link href={`/orders/${recent.id}`}>Siparişi görüntüle</Link></div>}
  {preview?.issues.length?<div role="alert" className="notice error home-reorder-feedback"><strong>Bu sipariş şu anda aynen tekrarlanamıyor.</strong><ul>{preview.issues.map((issue,i)=><li key={i}>{issue.name}: {issue.message}</li>)}</ul><Link href={`/restaurants/${recent.restaurant_id}`}>Güncel menüyü incele</Link></div>:null}
  {preview?.cart&&<div className="home-reorder-preview" role="status">
   <div><h3><Check size={18}/> Sepetin hazır: {preview.cart.lines.length} ürün</h3><p>Kesin toplam ve teslimat ücreti sipariş onayından önce sunucuda yeniden hesaplanacak.</p>
   {preview.priceChanges.length>0&&<ul>{preview.priceChanges.map((change,i)=><li key={i}>{change.name}: {money(change.oldKurus)} → {money(change.currentKurus)}</li>)}</ul>}</div>
   <button type="button" className="btn primary" disabled={!ready} onClick={confirm}><ShoppingBag size={17}/> Sepete aktar <ArrowRight size={15}/></button>
  </div>}
 </section>;
}
