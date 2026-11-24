'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import AuthGate from '@/components/auth-gate';
import {api,ApiError} from '@/lib/api';
import {readSelectedMerchantId,saveSelectedMerchantId} from '@/lib/merchant-selection';
import {money,statusText} from '@/lib/types';
import {canActOnInbox,currentInboxRequest,inboxLabel,unseenPendingIds,type InboxHealth} from '@/lib/inbox-health';
import {canSubmitMerchantAction,merchantNextActions} from '@/lib/merchant-workflow';
import {useOrderEventStream} from '@/hooks/use-order-event-stream';
import {RefreshCcw,Bell,ShieldCheck,WifiOff,Wifi,AlertTriangle,ChevronDown,Clock3,PackageCheck,MapPin,ClipboardList} from 'lucide-react';
type Merchant={id:string;name:string;role:string;can_view_orders:boolean;can_manage_orders:boolean;can_manage_menu:boolean};
type Summary={id:string;status:string;total_kurus:number;created_at:string;expires_at:string};
type SnapshotOption={name:string;priceKurus:number};
type OrderDetail={
 order:Summary&{address_snapshot:{zone?:string;address?:string;directions?:string;phone?:string;label?:string};note:string;payment_method:string};
 items:{product_name_snapshot:string;unit_kurus:number;quantity:number;line_total_kurus:number;options_snapshot:SnapshotOption[]}[];
 events:{previous_status:string|null;new_status:string;created_at:string;reason?:string}[];
};
export default function RestaurantPanel(){return <AuthGate>{token=><Inner token={token}/>}</AuthGate>}
function Inner({token}:{token:()=>Promise<string>}){
 const [list,setList]=useState<Merchant[]>([]);
 const [rid,setRid]=useState('');const [pending,setPending]=useState<Summary[]>([]);const [active,setActive]=useState<Summary[]>([]);
 const [error,setError]=useState(''),[busyOrder,setBusyOrder]=useState('');
 const [lastSync,setLastSync]=useState(''),[lastSyncMs,setLastSyncMs]=useState(0);
 const [state,setState]=useState<InboxHealth>('connecting'),[truncated,setTruncated]=useState(false),[now,setNow]=useState(Date.now());
 const [details,setDetails]=useState<Record<string,OrderDetail>>({}),[openOrder,setOpenOrder]=useState<string|null>(null);
 const [detailLoading,setDetailLoading]=useState(''),[reasons,setReasons]=useState<Record<string,string>>({});
 const ridRef=useRef(rid);
 const requestSequence=useRef(0);
 const requestController=useRef<AbortController|null>(null);
 const [browserOnline,setBrowserOnline]=useState(true);
 const seenIds=useRef<string[]>([]);
 const sawSnapshot=useRef(false);
 const alarmHealth=useRef({pending:0,state:'connecting' as InboxHealth,syncAt:0,online:true});
 const alertAudio=useRef<AudioContext|null>(null);
 const soundOnRef=useRef(false);
 const [soundOn,setSoundOn]=useState(false);
 const [incomingCount,setIncomingCount]=useState(0);
 function playChime(){
  const audio=alertAudio.current;
  if(!audio||audio.state!=='running')return;
  try{
   const oscillator=audio.createOscillator(),volume=audio.createGain();
   oscillator.type='sine';
   oscillator.frequency.setValueAtTime(740,audio.currentTime);
   oscillator.frequency.setValueAtTime(960,audio.currentTime+0.14);
   volume.gain.setValueAtTime(0.0001,audio.currentTime);
   volume.gain.exponentialRampToValueAtTime(0.08,audio.currentTime+0.03);
   volume.gain.exponentialRampToValueAtTime(0.0001,audio.currentTime+0.38);
   oscillator.connect(volume);volume.connect(audio.destination);
   oscillator.start();oscillator.stop(audio.currentTime+0.39);
  }catch{setError('Sesli uyarı çalınamadı; ekrandaki yeni siparişleri kontrol edin.')}
 }
 async function toggleSound(){
  if(soundOnRef.current){soundOnRef.current=false;setSoundOn(false);return}
  try{
   const audio=alertAudio.current||new AudioContext();
   alertAudio.current=audio;await audio.resume();
   if(audio.state!=='running')throw Error('Tarayıcı sesi başlatamadı.');
   soundOnRef.current=true;setSoundOn(true);playChime();
  }catch{setError('Sesli uyarı etkinleştirilemedi. Tarayıcı izinlerini kontrol edin.')}
 }
 useEffect(()=>()=>{soundOnRef.current=false;void alertAudio.current?.close()},[]);
 // The user must explicitly enable browser audio once. Thereafter the chime
 // repeats while an unaccepted order is present, not just on its first arrival.
 useEffect(()=>{
  alarmHealth.current={pending:pending.length,state,syncAt:lastSyncMs,online:browserOnline};
 },[pending.length,state,lastSyncMs,browserOnline]);
 useEffect(()=>{
  const timer=setInterval(()=>{
   const h=alarmHealth.current;
   if(soundOnRef.current&&h.pending>0&&document.visibilityState==='visible'&&
      navigator.onLine&&canActOnInbox(h.state,h.syncAt,Date.now(),h.online))
    playChime();
  },11_000);
  return()=>clearInterval(timer);
 },[]);
 useEffect(()=>{
  ridRef.current=rid;requestSequence.current++;
  requestController.current?.abort();requestController.current=null;
  seenIds.current=[];sawSnapshot.current=false;setIncomingCount(0);
  setPending([]);setActive([]);setDetails({});setOpenOrder(null);
  setTruncated(false);setLastSync('');setLastSyncMs(0);
  setState('connecting');setError('');
 },[rid]);
 const load=useCallback(async(priority=false)=>{
  if(!rid)return;
  // Periodic reconciliation is single-flight; SSE/manual refresh can supersede.
  // Slow mobile requests must not be cancelled every 7 seconds forever.
  if(!priority&&requestController.current&&!requestController.current.signal.aborted)return;
  if(!navigator.onLine){
   requestSequence.current++;requestController.current?.abort();
   setBrowserOnline(false);setState('offline');setNow(Date.now());return;
  }
  const sequence=++requestSequence.current;
  requestController.current?.abort();
  const controller=new AbortController();
  requestController.current=controller;
  try{
   const t=await token();
   if(controller.signal.aborted)return;
   const r=await api<{pending:Summary[];active:Summary[];serverTime:string;pendingTruncated:boolean;activeTruncated:boolean}>(
    `/v1/restaurant/${rid}/inbox`,t,{signal:controller.signal});
   if(!currentInboxRequest(rid,ridRef.current,sequence,requestSequence.current,
     controller.signal.aborted,navigator.onLine))return;
   const currentIds=r.pending.map(o=>o.id);
   const newIds=unseenPendingIds(seenIds.current,currentIds);
   if(sawSnapshot.current&&newIds.length>0){
    setIncomingCount(n=>n+newIds.length);
    if(soundOnRef.current&&document.visibilityState==='visible')playChime();
   }
   seenIds.current=currentIds;sawSnapshot.current=true;
   setPending(r.pending);setActive(r.active);setTruncated(Boolean(r.pendingTruncated||r.activeTruncated));
   setLastSync(new Date(r.serverTime).toLocaleTimeString('tr-TR'));
   const stamp=Date.now();setLastSyncMs(stamp);setNow(stamp);setBrowserOnline(true);setState('connected');setError('');
  }catch(e){
   if(controller.signal.aborted||ridRef.current!==rid||sequence!==requestSequence.current)return;
   setBrowserOnline(navigator.onLine);setState('offline');
   if(e instanceof ApiError&&[401,403].includes(e.status)){
    setPending([]);setActive([]);setDetails({});seenIds.current=[];sawSnapshot.current=false;
   }
   setError(e instanceof Error?e.message:'Bağlantı hatası');
  }finally{
   if(requestController.current===controller)requestController.current=null;
  }
 },[rid,token]);
 const realtime=useOrderEventStream(rid?'/v1/restaurant/'+rid+'/events':null,
  token,()=>{void load(true)});
 useEffect(()=>{let running=true;token().then(t=>api<{restaurants:Merchant[]}>('/v1/me/staff-restaurants',t)).then(r=>{
  if(running){setList(r.restaurants);setRid(readSelectedMerchantId(r.restaurants))}
 }).catch(e=>{if(running){setState('offline');setError(e instanceof Error?e.message:'Restoran listesi yüklenemedi')}});
  return()=>{running=false}},[token]);
 useEffect(()=>{
  const offline=()=>{
   requestSequence.current++;requestController.current?.abort();
   setBrowserOnline(false);setState('offline');setNow(Date.now());
   setError('Bu cihaz internete bağlı değil. Siparişler güncellenemiyor.');
  };
  const online=()=>{
   setBrowserOnline(true);setNow(Date.now());setState('connecting');
   if(document.visibilityState==='visible')void load(true);
  };
  const resume=()=>{
   setNow(Date.now());
   if(document.visibilityState==='visible'){
    if(navigator.onLine)online();else offline();
   }
  };
  if(!navigator.onLine)offline();else void load();
  const timer=setInterval(()=>{
   setNow(Date.now());
   if(document.visibilityState==='visible'&&navigator.onLine)void load();
  },7000);
  window.addEventListener('online',online);
  window.addEventListener('offline',offline);
  document.addEventListener('visibilitychange',resume);
  return()=>{
   clearInterval(timer);
   window.removeEventListener('online',online);window.removeEventListener('offline',offline);
   document.removeEventListener('visibilitychange',resume);
   requestController.current?.abort();
  };
 },[load]);
 const connected=canActOnInbox(state,lastSyncMs,now,browserOnline);
 const selectedMerchant=list.find(r=>r.id===rid);
 const canManageIntake=selectedMerchant?.role==='owner'||selectedMerchant?.role==='manager';
 const canManage=canManageIntake||selectedMerchant?.can_manage_orders===true;
 async function toggleDetail(id:string){
  if(openOrder===id){setOpenOrder(null);return}setOpenOrder(id);
  if(details[id])return;
  setDetailLoading(id);const requestedRid=rid;
  try{const data=await api<OrderDetail>(`/v1/restaurant/${rid}/orders/${id}`,await token());if(ridRef.current===requestedRid)setDetails(d=>({...d,[id]:data}))}
  catch(e){setError(e instanceof Error?e.message:'Sipariş detayları yüklenemedi.')}
  finally{setDetailLoading('')}
 }
 async function move(order:Summary,to:string){
  const reason=reasons[order.id]||'';
  if(!canSubmitMerchantAction(order.status,to,reason,connected,Boolean(canManage))||busyOrder)return;
  setBusyOrder(order.id);
  try{
   await api(`/v1/restaurant/${rid}/orders/${order.id}/status`,await token(),{method:'POST',body:JSON.stringify({to,reason})});
   setDetails(d=>{const copy={...d};delete copy[order.id];return copy});setReasons(r=>({...r,[order.id]:''}));
   await load(true);
  }catch(e){setError(e instanceof Error?e.message:'İşlem başarısız.');setState('offline')}
  finally{setBusyOrder('')}
 }
 function orderCard(o:Summary){const expanded=openOrder===o.id,detail=details[o.id];const reason=reasons[o.id]||'';
  const actions=merchantNextActions(o.status);const requireReason=actions.some(a=>a.requiresReason);
  return <article className="merchant-order-v09" key={o.id}>
   <div className="merchant-order-head">
    <div><span className="merchant-order-kicker">SİPARİŞ #{o.id.slice(0,8).toUpperCase()}</span><h3>{money(o.total_kurus)}</h3>
     <span className="merchant-status-tag">{statusText[o.status]||o.status}</span>
     <div className="merchant-order-dates"><span><Clock3 size={14}/> {new Date(o.created_at).toLocaleTimeString('tr-TR')}</span>
       {o.status==='beklemede'&&<span><AlertTriangle size={14}/> Son kabul: {new Date(o.expires_at).toLocaleTimeString('tr-TR')}</span>}</div>
    </div>
    <button className="btn outline merchant-details-toggle" aria-expanded={expanded} aria-controls={`merchant-detail-${o.id}`} onClick={()=>void toggleDetail(o.id)}>
     <ClipboardList size={17}/> {expanded?'Detayları kapat':'Ürünleri ve adresi gör'} <ChevronDown size={16}/>
    </button>
   </div>
   <div id={`merchant-detail-${o.id}`} hidden={!expanded} className="merchant-detail-section">
    {detailLoading===o.id?<p className="muted">Sipariş ayrıntıları yükleniyor…</p>:detail?<>
     <h4>Hazırlanacak ürünler</h4>
     {detail.items.map((item,i)=><div className="merchant-product-line" key={`${o.id}-${i}`}>
      <strong>{item.quantity} × {item.product_name_snapshot}</strong><span>{money(item.line_total_kurus)}</span>
      {Array.isArray(item.options_snapshot)&&item.options_snapshot.length>0&&<p>{item.options_snapshot.map(option=>option.name).join(' · ')}</p>}
     </div>)}
     {detail.order.note&&<p className="merchant-order-note"><strong>Müşteri notu:</strong> {detail.order.note}</p>}
     <h4><MapPin size={17}/> Teslimat adresi</h4>
     <p>{detail.order.address_snapshot?.zone||'Mahalle belirtilmemiş'} · {detail.order.address_snapshot?.address||'Adres belirtilmemiş'}</p>
     {detail.order.address_snapshot?.directions&&<p className="muted">Tarif: {detail.order.address_snapshot.directions}</p>}
     {detail.order.address_snapshot?.phone&&<p>İletişim: {detail.order.address_snapshot.phone}</p>}
     <p className="muted">Ödeme: {detail.order.payment_method==='cash'?'Kapıda nakit':'Kapıda POS'}</p>
    </>:<p className="muted">Detaylar yüklenemedi. Yeniden denemek için kapatıp açın.</p>}
   </div>
   {requireReason&&<label className="merchant-reason-label">Ret, iptal veya teslim edilememe gerekçesi
    <textarea value={reason} maxLength={400} rows={2} placeholder="Gerekli işlemler için en az 5 karakter açıklama yazın" onChange={e=>setReasons(r=>({...r,[o.id]:e.target.value}))}/>
   </label>}
   {actions.length>0&&<div className="merchant-order-actions">
    {actions.map(a=><button key={a.to} className={`btn ${a.kind==='danger'?'merchant-danger':a.kind}`} disabled={Boolean(busyOrder)||!canSubmitMerchantAction(o.status,a.to,reason,connected,Boolean(canManage))} onClick={()=>void move(o,a.to)}>{a.label}</button>)}
   </div>}
  </article>;
 }
 return <section className="container main-section merchant-v09">
  <div className="section-heading"><div><span className="overline">RESTORAN YÖNETİMİ</span><h1>Sipariş operasyon merkezi</h1><p>Yalnızca yetkili olduğun restoranların kayıtları</p></div>
   <button className="btn outline" disabled={Boolean(busyOrder)} onClick={()=>void load(true)}><RefreshCcw size={17}/> Güncelle</button></div>
  <div className={`merchant-connection ${connected?'healthy':'lost'}`} role="status" aria-live="polite">{connected?<Wifi size={19}/>:<WifiOff size={19}/>}
   <div><strong>{inboxLabel(state,connected)}</strong><span>{connected?`Son eşitleme: ${lastSync}`:'İnternet veya sunucu bağlantısını doğrulayın. Durum değişikliği şu anda engellendi.'}</span></div></div>
  <div className="merchant-banner"><ShieldCheck size={20}/><span>Restoran erişimi MFA ile korunur. {realtime==='live'?'Anlık sipariş sinyali bağlı (SSE).':'Anlık sinyal yok; 7 saniyelik sunucu eşitlemesi devrede.'} Eşitleme sürekli yedek olarak çalışır. Telefon uyurken veya sekme kapalıyken ses garantisi yoktur; bağımsız uyarı kanalı gereklidir.</span></div>
  <div className="merchant-sound-row">
   <button type="button" className="btn outline" onClick={()=>void toggleSound()} aria-pressed={soundOn}>
    <Bell size={17}/> {soundOn?'Sesli uyarıyı kapat':'Sesli uyarıyı aç ve dene'}
   </button>
   {pending.length>0&&<span role="alert" className="merchant-pending-critical"><Bell size={17}/> {pending.length} kabul bekleyen sipariş · {soundOn?'Sesli uyarı tekrar ediyor':'SES KAPALI — uyarıyı açın'}</span>}
   {incomingCount>0&&<span role="status" className="merchant-new-count">{incomingCount} yeni sipariş algılandı (bu oturum)</span>}
   <small>Ses yalnızca bu sekmede, açıkça etkinleştirildiğinde çalar.</small>
  </div>
  {error&&<div role="alert" className="notice error">{error}</div>}
  {truncated&&<div role="alert" className="notice error"><AlertTriangle size={18}/> Sipariş limiti aşıldı. Operasyon müdahalesi gerekli; listede tüm kayıtlar görünmeyebilir.</div>}
  <div className="panel merchant-control-bar"><label htmlFor="merchant-restaurant-select">Restoran
   <select id="merchant-restaurant-select" value={rid} onChange={e=>{saveSelectedMerchantId(e.target.value);setRid(e.target.value)}}>{list.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <div className="merchant-role-info">{canManage?'Sipariş yönetme yetkin var.':'Yalnızca görüntüleme yetkisi; işlem yapılamaz.'}</div></div>
  {rid&&canManageIntake&&<MerchantOrderIntake key={rid} rid={rid} token={token} connected={connected}/>}
  {!rid?<div className="empty">Bu hesap için restoran yetkisi tanımlı değil.</div>:<div className="merchant-columns">
   <section className="panel merchant-column"><div className="merchant-column-title"><h2><Bell size={19}/> Yeni siparişler</h2><span className="merchant-count">{pending.length}</span></div>
    {pending.length===0?<div className="empty"><h3>{connected?'Şu anda yeni sipariş yok':'Veriler eşitlenemedi'}</h3><p>{connected?'Yeni gelen siparişler burada gösterilecek.':'Yeniden bağlanınca liste güncellenecek.'}</p></div>:pending.map(orderCard)}</section>
   <section className="panel merchant-column"><div className="merchant-column-title"><h2><PackageCheck size={19}/> Hazırlanan ve yoldaki siparişler</h2><span className="merchant-count">{active.length}</span></div>
    {active.length===0?<div className="empty"><h3>{connected?'Devam eden sipariş yok':'Veriler eşitlenemedi'}</h3></div>:active.map(orderCard)}</section>
  </div>}
  <div className="notice">Bu operasyon paneli bir geliştirme sürümüdür. Üretim için güvenilir push/ikincil alarm, gerçek PostgreSQL ve kimlik sağlayıcısı entegrasyonu test edilmelidir.</div>
  <div className="merchant-settings-links"><Link href="/restaurant/overview" className="btn outline">Genel bakış</Link>{(selectedMerchant?.role==='owner'||selectedMerchant?.role==='manager'||selectedMerchant?.can_manage_menu===true)&&<Link href="/restaurant/manage" className="btn primary">Restoranı ve menüyü yönet</Link>}<Link href="/">Müşteri görünümüne dön</Link></div>
 </section>;
}
type OrderIntake={active:boolean;accepts_orders:boolean};
function MerchantOrderIntake({rid,token,connected}:{rid:string;token:()=>Promise<string>;connected:boolean}){
 const [intake,setIntake]=useState<OrderIntake|null>(null);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 const path=`/v1/restaurant/${rid}/order-intake`;
 const read=useCallback(async()=>{
  setBusy(true);setError('');
  try{setIntake(await api<OrderIntake>(path,await token()))}
  catch(e){setIntake(null);setError(e instanceof Error?e.message:'Sipariş alım durumu okunamadı.')}
  finally{setBusy(false)}
 },[path,token]);
 useEffect(()=>{void read()},[read]);
 async function toggle(){
  if(!intake?.active||!connected||busy)return;
  const desired=!intake.accepts_orders;
  if(!desired&&!window.confirm('Yeni sipariş alımı durdurulsun mu? Mevcut siparişleri yönetmeye devam edebilirsiniz.'))return;
  setBusy(true);setError('');
  try{
   setIntake(await api<OrderIntake>(path,await token(),{
    method:'PATCH',body:JSON.stringify({acceptsOrders:desired,expectedAcceptsOrders:intake.accepts_orders})
   }));
  }catch(e){
   setIntake(null);
   setError(e instanceof Error?e.message:'Değişiklik doğrulanamadı. Sipariş alım durumunu yeniden kontrol edin.');
  }finally{setBusy(false)}
 }
 return <section className="panel merchant-control-bar" aria-label="Yeni sipariş alımı">
  <div>
   <strong role="status">{busy?'Sipariş alım durumu kontrol ediliyor…':
    !intake?'Sipariş alım durumu bilinmiyor':!intake.active?'Restoran yayında değil':
    intake.accepts_orders?'Yeni sipariş alım ayarı açık':'Yeni sipariş alımı duraklatıldı'}</strong>
   <p className="muted">Bu ayar yeni siparişleri etkiler. Çalışma saatleri ve teslimat bölgeleri ayrıca uygulanır.</p>
   {error&&<p className="notice error" role="alert">{error}</p>}
  </div>
  <div className="merchant-settings-links">
   {intake?.active&&<button type="button" className="btn outline" disabled={busy||!connected} onClick={()=>void toggle()}>
    {intake.accepts_orders?'Yeni siparişleri duraklat':'Yeni sipariş alımını aç'}
   </button>}
   <button type="button" className="btn outline" disabled={busy} onClick={()=>void read()}>Alım durumunu yenile</button>
  </div>
 </section>;
}
