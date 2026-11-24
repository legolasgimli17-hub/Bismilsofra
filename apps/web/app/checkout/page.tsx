'use client';
import {useCallback,useEffect,useRef,useState} from 'react';import {useRouter} from 'next/navigation';import Link from 'next/link';import {ArrowLeft,ShoppingBag,MapPin,Plus,LockKeyhole,ShieldCheck} from 'lucide-react';
import AuthGate from '@/components/auth-gate';import {useCart} from '@/components/providers';import {api,ApiError} from '@/lib/api';import {cartCount,cartTotal,orderBody} from '@/lib/cart';import {money,type Address,type Quote,type Zone} from '@/lib/types';
export default function Checkout(){const {cart,ready}=useCart();if(!ready)return <section className="container main-section empty" role="status">Sepetin yükleniyor…</section>;if(cart.lines.length===0)return <section className="container main-section empty"><ShoppingBag size={40}/><h1 className="empty-page-title">Sepetin henüz boş</h1><p>Restoran seçip menüden bir ürün ekle.</p><Link className="btn primary" href="/">Restoranları keşfet</Link></section>;if(cart.restaurantId.startsWith('demo-'))return <DemoBasket/>;return <AuthGate>{token=><CheckoutInner token={token}/>}</AuthGate>}
function DemoBasket(){const {cart,change,clear}=useCart();if(cart.lines.length===0)return <section className="container main-section empty"><ShoppingBag size={38}/><h1 className="empty-page-title">Sepetin boş</h1><Link className="btn primary" href="/">Restoranlara dön</Link></section>;
 return <section className="container main-section"><div className="breadcrumb"><Link href="/"><ArrowLeft size={17}/> Restoranlara dön</Link></div><div className="section-heading"><div><span className="overline">ÖRNEK SEPET</span><h1>Sepetin</h1><p>{cart.restaurantName}</p></div></div><div className="demo-mode-ribbon"><b>TASARIM ÖNİZLEMESİ</b> Bu sepet yalnızca ekranları deneyebilmen içindir. Sipariş oluşturulmaz ve gerçek ödeme alınmaz.</div><div className="checkout-layout"><div className="panel"><h2>Seçtiğin ürünler</h2>{cart.lines.map((line,i)=><div className="cart-line" key={`${line.productId}-${i}`}><div><strong>{line.name}</strong>{line.optionLabels.length>0&&<p>{line.optionLabels.join(', ')}</p>}<small>{money(line.priceKurus+line.optionExtraKurus)} / adet</small></div><div className="line-right"><strong>{money((line.priceKurus+line.optionExtraKurus)*line.quantity)}</strong><div className="stepper tiny"><button onClick={()=>change(i,-1)} aria-label={`${line.name} miktarını azalt`}>−</button><span>{line.quantity}</span><button onClick={()=>change(i,1)} aria-label={`${line.name} miktarını artır`}>+</button></div></div></div>)}</div><aside className="panel checkout-aside"><h2>Örnek sipariş özeti</h2><div className="summary-row"><span>Ürünler</span><strong>{money(cartTotal(cart))}</strong></div><div className="summary-row"><span>Teslimat</span><strong>Mahalle seçildiğinde hesaplanır</strong></div><div className="summary-total"><span>Kesin toplam</span><strong>Hesaplanmadı</strong></div><p className="summary-disclaimer">Gerçek siparişte kapıda nakit/POS ve sunucuda fiyat doğrulaması uygulanır.</p><Link href="/" className="btn primary full">Restoranları keşfet</Link><button className="text-btn center" onClick={clear}>Örnek sepeti temizle</button></aside></div></section>;
}
function CheckoutInner({token}:{token:()=>Promise<string>}){const {cart,change,clearSubmitted}=useCart(),router=useRouter();const [addresses,setAddresses]=useState<Address[]>([]),[zones,setZones]=useState<Zone[]>([]),[addressId,setAddressId]=useState(''),[payment,setPayment]=useState<'cash'|'pos'>('cash'),[note,setNote]=useState(''),[quoted,setQuoted]=useState<{requestBody:string;value:Quote}|null>(null),[approved,setApproved]=useState(false),[addAddress,setAddAddress]=useState(false),[newZone,setNewZone]=useState(''),[newLabel,setNewLabel]=useState('Ev'),[newPhone,setNewPhone]=useState(''),[newFull,setNewFull]=useState(''),[newDirections,setNewDirections]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [staleOptions,setStaleOptions]=useState(false);
 const requestBody=JSON.stringify(orderBody(cart,addressId,payment,note));
 const quote=quoted?.requestBody===requestBody?quoted.value:null;
 const operation=useRef(false);
 const orderAttempt=useRef<{body:string;key:string}|null>(null);
 const fetchAddresses=useCallback(async()=>{const t=await token();const r=await api<{addresses:Address[]}>('/v1/me/addresses',t);setAddresses(r.addresses);setAddressId(old=>r.addresses.some(address=>address.id===old)?old:r.addresses[0]?.id||'')},[token]);
 useEffect(()=>{fetchAddresses().catch(e=>setError(e.message));api<{zones:Zone[]}>('/v1/zones').then(r=>setZones(r.zones)).catch(()=>{})},[fetchAddresses]);
 useEffect(()=>{setQuoted(null);setApproved(false);setStaleOptions(false)},[cart,addressId,payment,note]);
 async function getQuote(){
  if(!cart.lines.length||!addressId||operation.current)return;
  operation.current=true;setBusy(true);setError('');setStaleOptions(false);setApproved(false);
  try{
   const value=await api<Quote>('/v1/orders/quote',await token(),{method:'POST',body:requestBody});
   setQuoted({requestBody,value});
  }catch(e){setQuoted(null);
  if(e instanceof ApiError&&['OPTION_SELECTION','OPTION_UNAVAILABLE','OPTION_FOREIGN','PRODUCT_UNAVAILABLE'].includes(e.code)){
   setStaleOptions(true);
   setError('Sepetindeki bir ürünün seçenekleri değişmiş veya ürün satıştan kaldırılmış. Eski ürünü sepetten çıkarıp güncel menüden yeniden seçmelisin.');
  }else setError(e instanceof Error?e.message:'Teklif alınamadı.');
 }finally{operation.current=false;setBusy(false)}}
 async function saveAddress(){
  if(operation.current)return;
  operation.current=true;setError('');setBusy(true);
  try{
   const result=await api<{id:string;address?:Address}>('/v1/me/addresses',await token(),{
    method:'POST',body:JSON.stringify({zoneId:newZone,label:newLabel,phone:newPhone,fullAddress:newFull,directions:newDirections})
   });
   const address=result.address??{
    id:result.id,label:newLabel.trim().replace(/\s+/g,' ')||'Ev',zone_id:newZone,
    full_address:newFull.trim(),directions:newDirections.trim()||null,phone:newPhone.trim()
   };
   setAddresses(list=>[address,...list.filter(item=>item.id!==address.id)]);
   setAddressId(address.id);setAddAddress(false);
   setNewLabel('Ev');setNewPhone('');setNewFull('');setNewDirections('');
  }catch(e){setError(e instanceof Error?e.message:'Adres eklenemedi.')}
  finally{operation.current=false;setBusy(false)}
 }
 async function submit(){
  if(!quote||!approved||operation.current)return;
  const payload=JSON.stringify({...orderBody(cart,addressId,payment,note),confirmedTotalKurus:quote.totals.totalKurus});
  const previous=orderAttempt.current;
  const requestKey=previous?.body===payload?previous.key:globalThis.crypto?.randomUUID?.();
  if(!requestKey){setError('Siparişi onaylamak için güvenli bağlantı gerekiyor.');return}
  operation.current=true;setBusy(true);setError('');
  orderAttempt.current={body:payload,key:requestKey};
  try{
   const result=await api<{id:string}>('/v1/orders',await token(),{
    method:'POST',body:payload,headers:{'Idempotency-Key':requestKey}
   });
   clearSubmitted(cart);router.replace(`/orders/${result.id}`);
  }catch(e){
   if(e instanceof ApiError&&e.code==='PRICE_CHANGED'){
    setQuoted(null);setApproved(false);orderAttempt.current=null;
    setError('Sipariş tutarı değişti. Yeni teklifi alıp tekrar onaylaman gerekiyor.');
   }else if(e instanceof ApiError&&e.code==='NETWORK'){
    try{
     const res=await api<{order:{id:string}}>(`/v1/me/orders/by-key/${encodeURIComponent(requestKey)}`,await token());
     clearSubmitted(cart);router.replace(`/orders/${res.order.id}`);
    }catch{
     setError('Siparişin sonucu doğrulanamadı. Siparişlerim sayfasını kontrol edebilir veya aynı sepeti yeniden onaylayabilirsin.');
    }
   }else setError(e instanceof Error?e.message:'Sipariş oluşturulamadı.');
  }finally{operation.current=false;setBusy(false)}
 }
 if(cartCount(cart)===0)return <section className="container main-section empty"><ShoppingBag size={42}/><h1 className="empty-page-title">Sepetin henüz boş</h1><p>Önce restoran seçip ürün ekle.</p><Link className="btn primary" href="/">Restoranları keşfet</Link></section>;
 const isDemo=cart.restaurantId.startsWith('demo-');
 return <section className="container main-section"><div className="breadcrumb"><Link href="/"><ArrowLeft size={17}/> Restoranlara dön</Link></div><div className="section-heading"><div><span className="overline">SİPARİŞİN</span><h1>Sepet ve ödeme</h1><p>{cart.restaurantName} · Kapıda ödeme</p></div></div>{isDemo&&<div className="notice">Bu ürünler örnek menüye aittir; demo üzerinden sipariş verilemez.</div>}{error&&<div className="notice error" role="alert">{error}
  {staleOptions&&<p><Link href={'/restaurants/'+encodeURIComponent(cart.restaurantId)}>Restoranın güncel menüsünü aç</Link></p>}
 </div>}
 <div className="checkout-layout"><div className="checkout-main"><div className="panel"><div className="panel-title"><h2>Sepetim</h2><span>{cartCount(cart)} ürün</span></div>{cart.lines.map((l,i)=><div className="cart-line" key={`${l.productId}-${l.optionIds.join()}`}><div><strong>{l.name}</strong>{l.optionLabels.length>0&&<p>{l.optionLabels.join(', ')}</p>}<small>{money(l.priceKurus+l.optionExtraKurus)} / adet</small></div><div className="line-right"><strong>{money((l.priceKurus+l.optionExtraKurus)*l.quantity)}</strong><div className="stepper tiny"><button disabled={busy} aria-label="Azalt" onClick={()=>change(i,-1)}>−</button>{l.quantity}<button disabled={busy} aria-label="Artır" onClick={()=>change(i,1)}>+</button></div></div></div>)}</div>
 <div className="panel"><div className="panel-title"><h2><MapPin size={21}/> Teslimat adresi</h2><button className="text-btn" disabled={busy} onClick={()=>setAddAddress(v=>!v)}><Plus size={16}/> Yeni adres</button></div>{addresses.map(a=><label className={`address-option ${addressId===a.id?'chosen':''}`} key={a.id}><input type="radio" disabled={busy} name="address" checked={addressId===a.id} onChange={()=>setAddressId(a.id)}/><span><b>{a.label}</b><small>{a.full_address}</small></span></label>)}{!addresses.length&&!addAddress&&<p className="muted">Sipariş için adres eklemen gerekiyor.</p>}<Link className="address-manage-link" href="/account">Kayıtlı adreslerini düzenle veya kaldır</Link>{addAddress&&<div className="address-form"><select disabled={busy} aria-label="Mahalle" value={newZone} onChange={e=>setNewZone(e.target.value)}><option value="">Mahalle seç</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select><input disabled={busy} placeholder="Adres başlığı (Ev, İş)" value={newLabel} onChange={e=>setNewLabel(e.target.value)}/><input type="tel" disabled={busy} placeholder="05xxxxxxxxx" value={newPhone} onChange={e=>setNewPhone(e.target.value)}/><textarea disabled={busy} placeholder="Sokak, bina, kat, kapı numarası" value={newFull} onChange={e=>setNewFull(e.target.value)}/><textarea disabled={busy} placeholder="Adres tarifi (isteğe bağlı)" value={newDirections} onChange={e=>setNewDirections(e.target.value)}/><button disabled={busy||!newZone||newFull.trim().length<8||!/^05\d{9}$/.test(newPhone)} className="btn primary" onClick={()=>void saveAddress()}>Adresi kaydet</button></div>}</div>
 <div className="panel"><h2>Ödeme yöntemi</h2><div className="payment-options"><label className={payment==='cash'?'chosen':''}><input type="radio" disabled={busy} name="payment" checked={payment==='cash'} onChange={()=>setPayment('cash')}/> Kapıda nakit</label><label className={payment==='pos'?'chosen':''}><input type="radio" disabled={busy} name="payment" checked={payment==='pos'} onChange={()=>setPayment('pos')}/> Kapıda kart (restoran POS)</label></div><label className="field-label">Sipariş notu (isteğe bağlı)<textarea disabled={busy} value={note} onChange={e=>setNote(e.target.value.slice(0,400))} placeholder="Yemeğin için bir not yaz…"/></label></div></div>
 <aside className="checkout-aside"><div className="panel summary-panel"><h2>Sipariş özeti</h2><div className="summary-row"><span>Sepet (tahmini)</span><strong>{money(cartTotal(cart))}</strong></div><p className="muted small">Güncel ürün fiyatları sunucudan tekrar kontrol edilir.</p>{quote?<><div className="summary-row"><span>Sunucu ara toplamı</span><strong>{money(quote.totals.subtotalKurus)}</strong></div><div className="summary-row"><span>Teslimat</span><strong>{money(quote.totals.deliveryFeeKurus)}</strong></div><div className="summary-total"><span>Toplam</span><strong>{money(quote.totals.totalKurus)}</strong></div><label className="confirm-line"><input type="checkbox" disabled={busy} checked={approved} onChange={e=>setApproved(e.target.checked)}/> <span>Bu toplamı ve kapıda ödeme şeklini onaylıyorum.</span></label><button disabled={!approved||busy||isDemo} className="btn primary full" onClick={()=>void submit()}><ShieldCheck size={19}/> {busy?'İşlem yapılıyor…':'Siparişi onayla'}</button><button className="text-btn center" disabled={busy} onClick={()=>void getQuote()}>Fiyatları yeniden kontrol et</button></>:<><div className="summary-total"><span>Kesin toplam</span><strong>Kontrol edilmeli</strong></div><button className="btn primary full" disabled={!addressId||busy||isDemo} onClick={()=>void getQuote()}><LockKeyhole size={19}/> {busy?'Kontrol ediliyor…':'Güncel toplamı getir'}</button></>}
 <p className="summary-disclaimer">Kart bilgisi alınmaz. Online ödeme bu sürümün kapsamında değildir. Siparişi restoranın kendi kuryesi getirir.</p></div></aside></div></section>}
