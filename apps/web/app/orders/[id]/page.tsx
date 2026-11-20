'use client';import {useCallback,useEffect,useState} from 'react';import {useParams,useRouter} from 'next/navigation';import Link from 'next/link';import {ArrowLeft,RefreshCw,AlertCircle} from 'lucide-react';import AuthGate from '@/components/auth-gate';import {api} from '@/lib/api';import {useOrderEventStream} from '@/hooks/use-order-event-stream';import {money,type Order,type MenuProduct,type Restaurant,statusText} from '@/lib/types';import {useCart} from '@/components/providers';import {buildReorderPreview,type PastOrderLine,type ReorderPreview} from '@/lib/reorder-preview';import {Repeat2,ShoppingBag} from 'lucide-react';
type Detail={order:Order;items:PastOrderLine[];events:{previous_status:string|null;new_status:string;created_at:string;reason:string|null}[]};
export default function OrderDetail(){return <AuthGate>{token=><Inner token={token}/>}</AuthGate>}
function Inner({token}:{token:()=>Promise<string>}){const {id}=useParams<{id:string}>(),router=useRouter();const [detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[issue,setIssue]=useState(''),[description,setDescription]=useState(''),[sent,setSent]=useState(false);
 const {cart,replaceCart}=useCart();
 const [reorderBusy,setReorderBusy]=useState(false),[reorder,setReorder]=useState<ReorderPreview|null>(null);
 const load=useCallback(async()=>{const t=await token();const d=await api<Detail>(`/v1/me/orders/${id}`,t);setDetail(d);setError('')},[id,token]);
 const realtime=useOrderEventStream(id?'/v1/me/orders/'+id+'/events':null,token,
  ()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Durum güncellenemedi.'))});
 useEffect(()=>{
  void load().catch(e=>setError(e.message));
  // Polling remains the durable reconciliation path even when SSE is healthy.
  const poll=setInterval(()=>{if(document.visibilityState==='visible')void load().catch(()=>{})},
   realtime==='live'?20_000:10_000);
  return()=>clearInterval(poll);
 },[load,realtime]);
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
 async function cancel(){if(!detail||!window.confirm('Beklemedeki sipariş iptal edilsin mi?'))return;setBusy(true);try{await api(`/v1/me/orders/${id}/cancel`,await token(),{method:'POST'});await load()}catch(e){setError(e instanceof Error?e.message:'İptal edilemedi.')}finally{setBusy(false)}}
 async function support(){if(!issue||description.trim().length<10)return;setBusy(true);try{await api('/v1/me/support-cases',await token(),{method:'POST',body:JSON.stringify({orderId:id,issueType:issue,description})});setSent(true)}catch(e){setError(e instanceof Error?e.message:'Destek kaydı açılamadı.')}finally{setBusy(false)}}
 return <section className="container main-section"><div className="breadcrumb"><Link href="/orders"><ArrowLeft size={17}/> Siparişlerim</Link></div><div className="section-heading"><div><span className="overline">SİPARİŞ DETAYI</span><h1>Sipariş takibi</h1><p>#{id.slice(0,8).toUpperCase()}</p></div><button className="btn outline" onClick={()=>void load()}><RefreshCw size={17}/> Yenile</button></div>{error&&<div role="alert" className="notice error">{error}</div>}{!detail?<div className="empty">Sipariş yükleniyor…</div>:<div className="checkout-layout"><div className="checkout-main"><div className="panel"><span className="overline">GÜNCEL DURUM</span><h2 className="tracking-title">{statusText[detail.order.status]||detail.order.status}</h2><p className="muted" role="status">{realtime==='live'?'Sipariş durumu canlı olay akışıyla güncelleniyor.':'Bağlantı yeniden deneniyor; sipariş durumu 10 saniyede bir kontrol ediliyor.'} Bu bir GPS kurye takibi değildir.</p>{detail.order.status==='beklemede'&&<button className="btn outline" disabled={busy} onClick={()=>void cancel()}>Siparişi iptal et</button>}</div><div className="panel reorder-panel">
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
 <div className="panel"><h2>Durum geçmişi</h2><ol className="timeline">{detail.events.map((e,i)=><li key={`${e.new_status}-${i}`}><b>{statusText[e.new_status]||e.new_status}</b><small>{new Date(e.created_at).toLocaleString('tr-TR')}</small>{e.reason&&<p>{e.reason}</p>}</li>)}</ol></div><div className="panel"><h2>Bir sorun mu var?</h2>{sent?<p>Destek talebin kaydedildi.</p>:<><label className="field-label">Sorun türü<select value={issue} onChange={e=>setIssue(e.target.value)}><option value="">Seçiniz</option><option value="eksik_urun">Eksik ürün</option><option value="yanlis_urun">Yanlış ürün</option><option value="gecikme">Gecikme</option><option value="teslimat">Teslimat sorunu</option><option value="diger">Diğer</option></select></label><textarea placeholder="Sorunu en az 10 karakterle açıkla…" value={description} onChange={e=>setDescription(e.target.value)} /><button className="btn outline" disabled={busy||!issue||description.trim().length<10} onClick={()=>void support()}><AlertCircle size={17}/> Talep gönder</button></>}</div></div><aside className="checkout-aside"><div className="panel"><h2>Sipariş özeti</h2>{detail.items.map((i,n)=><div className="summary-row" key={n}><span>{i.quantity} × {i.product_name_snapshot}</span><strong>{money(i.line_total_kurus)}</strong></div>)}<div className="summary-row"><span>Teslimat</span><strong>{money(detail.order.delivery_fee_kurus)}</strong></div><div className="summary-total"><span>Toplam</span><strong>{money(detail.order.total_kurus)}</strong></div><p className="muted">Ödeme: {detail.order.payment_method==='cash'?'Kapıda nakit':'Kapıda POS'}</p></div></aside></div>}</section>}
