'use client';import {useCallback,useEffect,useRef,useState} from 'react';import {useParams,useRouter} from 'next/navigation';import Link from 'next/link';import {ArrowLeft,RefreshCw,AlertCircle} from 'lucide-react';import AuthGate from '@/components/auth-gate';import {api,ApiError} from '@/lib/api';import {useOrderEventStream} from '@/hooks/use-order-event-stream';import {inboxRefreshDecision} from '@/lib/inbox-health';
import {deliveryEstimateText,isTerminalOrderStatus,money,type Order,type MenuProduct,type Restaurant,statusText} from '@/lib/types';import {useCart} from '@/components/providers';import {buildReorderPreview,type PastOrderLine,type ReorderPreview} from '@/lib/reorder-preview';import {Repeat2,ShoppingBag} from 'lucide-react';
type Detail={order:Order;items:PastOrderLine[];events:{previous_status:string|null;new_status:string;created_at:string;reason:string|null}[]};
export default function OrderDetail(){
 const {id}=useParams<{id:string}>();
 return <AuthGate>{token=><Inner key={id} token={token} id={id}/>}</AuthGate>;
}
function Inner({token,id}:{token:()=>Promise<string>;id:string}){const router=useRouter();const [detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[issue,setIssue]=useState(''),[description,setDescription]=useState(''),[sent,setSent]=useState<null|'created'|'reused'>(null);
 const {cart,replaceCart}=useCart();
 const [reorderBusy,setReorderBusy]=useState(false),[reorder,setReorder]=useState<ReorderPreview|null>(null);
 const [trackingError,setTrackingError]=useState('');
 const trackingRequest=useRef<AbortController|null>(null);
 const queuedRefresh=useRef<AbortController|null>(null);
 const [online,setOnline]=useState(true);
 const terminal=isTerminalOrderStatus(detail?.order.status);
 const load=useCallback(async function refresh(mode:'poll'|'signal'|'replace'='poll'):Promise<void>{
  if(!navigator.onLine){setOnline(false);return}
  const running=trackingRequest.current;
  const decision=inboxRefreshDecision(mode,Boolean(running&&!running.signal.aborted));
  if(decision==='skip')return;
  if(decision==='queue'){queuedRefresh.current=running;return}
  running?.abort();
  const controller=new AbortController();
  trackingRequest.current=controller;
  let finished=false;
  try{
   const jwt=await token();
   if(controller.signal.aborted)return;
   const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
   const next=await api<Detail>(`/v1/me/orders/${id}`,jwt,{signal});
   if(!controller.signal.aborted){setDetail(next);setTrackingError('');finished=isTerminalOrderStatus(next.order.status)}
  }catch(e){
   if(controller.signal.aborted)return;
   if(e instanceof ApiError&&[401,403,404].includes(e.status))setDetail(null);
   setTrackingError(e instanceof Error?e.message:'Sipariş durumu güncellenemedi.');
  }finally{
   const queued=queuedRefresh.current===controller;
   if(queued)queuedRefresh.current=null;
   if(trackingRequest.current===controller){
    trackingRequest.current=null;
    if(queued&&!finished&&!controller.signal.aborted&&document.visibilityState==='visible'&&navigator.onLine)
     void refresh();
   }
  }
 },[id,token]);
 const realtime=useOrderEventStream(terminal?null:'/v1/me/orders/'+id+'/events',token,()=>{void load('signal')});
 useEffect(()=>{
  const reconcile=()=>{if(!terminal&&document.visibilityState==='visible')void load('signal')};
  const reconnect=()=>{setOnline(true);reconcile()};
  const disconnect=()=>{setOnline(false);trackingRequest.current?.abort()};
  if(navigator.onLine)reconnect();else disconnect();
  const poll=terminal?undefined:setInterval(()=>{
   if(navigator.onLine&&document.visibilityState==='visible')void load();
  },realtime==='live'?20_000:10_000);
  document.addEventListener('visibilitychange',reconcile);
  window.addEventListener('online',reconnect);
  window.addEventListener('offline',disconnect);
  return()=>{
   clearInterval(poll);
   document.removeEventListener('visibilitychange',reconcile);
   window.removeEventListener('online',reconnect);
   window.removeEventListener('offline',disconnect);
  };
 },[load,realtime,terminal]);
 useEffect(()=>()=>{trackingRequest.current?.abort();trackingRequest.current=null},[load]);
 useEffect(()=>{
  if(detail&&window.location.hash==='#order-help')
   document.getElementById('order-help')?.scrollIntoView();
 },[detail!==null]);
 async function prepareReorder(){
  if(!detail||reorderBusy)return;
  setReorderBusy(true);setReorder(null);setError('');
  try{
   const rid=detail.order.restaurant_id;
   const menu=await api<{restaurant:Restaurant;products:MenuProduct[]}>(`/v1/restaurants/${rid}/menu`);
   setReorder(buildReorderPreview(rid,menu.restaurant.name,menu.restaurant.is_orderable===true,
    detail.items,menu.products));
  }catch(e){setError(e instanceof Error?e.message:'Güncel restoran menüsü alınamadı.')}
  finally{setReorderBusy(false)}
 }
 function confirmReorder(){
  if(!reorder?.cart)return;
  if(cart.lines.length&&!window.confirm('Mevcut sepetindeki ürünler silinecek. Eski siparişi güncel fiyatlarla sepete almak istiyor musun?'))return;
  replaceCart(reorder.cart);
  router.push('/checkout');
 }
 async function cancel(){if(busy||!online||!detail||!window.confirm('Beklemedeki sipariş iptal edilsin mi?'))return;setBusy(true);setError('');try{await api(`/v1/me/orders/${id}/cancel`,await token(),{method:'POST'});await load('replace')}catch(e){setError(e instanceof Error?e.message:'İptal edilemedi.')}finally{setBusy(false)}}
 async function support(){if(busy||sent||!issue||description.trim().length<10||description.length>1200)return;setBusy(true);setError('');try{const response=await api<{reused?:boolean}>('/v1/me/support-cases',await token(),{method:'POST',body:JSON.stringify({orderId:id,issueType:issue,description})});setSent(response.reused?'reused':'created')}catch(e){setError(e instanceof Error?e.message:'Destek kaydı açılamadı.')}finally{setBusy(false)}}
 const estimate=detail?deliveryEstimateText(detail.order):null;
 return <section className="container main-section"><div className="breadcrumb"><Link href="/orders"><ArrowLeft size={17}/> Siparişlerim</Link></div><div className="section-heading"><div><span className="overline">SİPARİŞ DETAYI</span><h1>Sipariş takibi</h1><p>#{id.slice(0,8).toUpperCase()}</p></div><button className="btn outline" onClick={()=>void load('replace')}><RefreshCw size={17}/> Yenile</button></div>{error&&<div role="alert" className="notice error">{error}</div>}{!online&&<div className="notice" role="status">Bağlantı kesildi. {detail?'Son doğrulanan sipariş durumu gösteriliyor.':'Bağlantı geldiğinde sipariş bilgisi yüklenecek.'}</div>}{trackingError&&<div role="alert" className="notice error">{trackingError}{detail?' Son doğrulanan sipariş durumu aşağıda.':''}</div>}{!detail?<div className="empty" role="status">{trackingError?'Sipariş bilgisi alınamadı. Yenile düğmesiyle tekrar deneyebilirsin.':'Sipariş yükleniyor…'}</div>:<div className="checkout-layout"><div className="checkout-main"><div className="panel"><span className="overline">GÜNCEL DURUM</span><h2 className="tracking-title">{statusText[detail.order.status]||detail.order.status}</h2><p className="muted" role="status">{terminal?'Sipariş takibi sona erdi.':!online?'Bağlantı geldiğinde durum güncellenecek.':realtime==='live'?'Sipariş durumu canlı güncelleniyor.':'Sipariş durumu düzenli aralıklarla kontrol ediliyor.'}</p>{detail.order.status==='beklemede'&&<button className="btn outline" disabled={busy||!online} onClick={()=>void cancel()}>Siparişi iptal et</button>}</div><div className="panel reorder-panel">
  <div className="reorder-eyebrow"><Repeat2 size={16}/> KOLAY SİPARİŞ</div>
  <h2>Sevdiğin lezzetleri yeniden seç</h2>
  <p className="muted">Eski sipariş doğrudan gönderilmez. Ürünler, ekstra malzemeler ve güncel fiyatlar kontrol edilir; teslimat ücreti ve kesin tutar ödeme ekranında yeniden hesaplanır.</p>
  <button type="button" className="btn outline reorder-prepare" disabled={reorderBusy} onClick={()=>void prepareReorder()}>
   <Repeat2 size={17}/> {reorderBusy?'Menü doğrulanıyor…':'Güncel menüyle tekrar hazırla'}
  </button>
  {reorder?.issues.length? <div className="notice error reorder-feedback" role="alert">
   <strong>Bu sipariş doğrudan tekrarlanamaz.</strong>
   <ul>{reorder.issues.map((issue,i)=><li key={i}>{issue.name}: {issue.message}</li>)}</ul>
   <Link href={`/restaurants/${detail.order.restaurant_id}`}>Restoranın menüsünden seçim yap</Link>
  </div>:null}
  {reorder?.cart&&<div className="notice reorder-feedback" role="status">
   <p><strong>{reorder.cart.lines.length} ürün satırı</strong> güncel menüyle eşleşti.</p>
   {reorder.priceChanges.length>0&&<div>
    <strong>Fiyat değişiklikleri:</strong>
    <ul>{reorder.priceChanges.map((item,i)=><li key={i}>{item.name}: {money(item.oldKurus)} → {money(item.currentKurus)}</li>)}</ul>
   </div>}
   <p>Bu sepet taslaktır. Yeni toplam ve teslimat bedelini ayrıca onaylamalısın.</p>
   <button type="button" className="btn primary reorder-confirm" onClick={confirmReorder}><ShoppingBag size={17}/> Sepete aktar ve devam et</button>
  </div>}
 </div>
 <div className="panel"><h2>Durum geçmişi</h2><ol className="timeline">{detail.events.map((e,i)=><li key={`${e.new_status}-${i}`}><b>{statusText[e.new_status]||e.new_status}</b><small>{new Date(e.created_at).toLocaleString('tr-TR')}</small>{e.reason&&<p>{e.reason}</p>}</li>)}</ol></div><div id="order-help" className="panel portal-anchor"><h2>Siparişle ilgili yardım</h2>{sent?<p role="status">{sent==='reused'?'Bu destek talebin zaten inceleme kuyruğunda.':'Destek talebin kaydedildi.'}  <Link href="/orders#support-requests">Talebin durumunu takip et</Link></p>:<><label className="field-label">Sorun türü<select disabled={busy} value={issue} onChange={e=>setIssue(e.target.value)}><option value="">Seçiniz</option><option value="eksik_urun">Eksik ürün</option><option value="yanlis_urun">Yanlış ürün</option><option value="gecikme">Gecikme</option><option value="teslimat">Teslimat sorunu</option><option value="diger">Diğer</option></select></label><textarea aria-label="Sorunun açıklaması" disabled={busy} maxLength={1200} placeholder="Sorunu en az 10 karakterle açıkla…" value={description} onChange={e=>setDescription(e.target.value)} /><button className="btn outline" disabled={busy||!issue||description.trim().length<10} onClick={()=>void support()}><AlertCircle size={17}/> Talep gönder</button></>}</div></div><aside className="checkout-aside"><div className="panel"><h2>Sipariş özeti</h2>{detail.items.map((i,n)=><div className="summary-row" key={n}><span>{i.quantity} × {i.product_name_snapshot}</span><strong>{money(i.line_total_kurus)}</strong></div>)}<div className="summary-row"><span>Teslimat</span><strong>{money(detail.order.delivery_fee_kurus)}</strong></div>{estimate&&<div className="summary-row"><span>Sipariş anındaki teslimat tahmini</span><strong>{estimate}</strong></div>}<div className="summary-total"><span>Toplam</span><strong>{money(detail.order.total_kurus)}</strong></div><p className="muted">Ödeme: {detail.order.payment_method==='cash'?'Kapıda nakit':'Kapıda POS'}</p></div></aside></div>}</section>}
