'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import AuthGate from '@/components/auth-gate';
import {api} from '@/lib/api';
import {money} from '@/lib/types';
import {readSelectedMerchantId,saveSelectedMerchantId} from '@/lib/merchant-selection';
import {ArrowRight,RefreshCw,Bell,ClipboardList,Store,UtensilsCrossed,ChartColumnIncreasing,Settings2,UsersRound,ShieldCheck,AlertTriangle,CheckCircle2,Clock3,Wallet} from 'lucide-react';

type Merchant={id:string;name:string;role:'owner'|'manager'|'staff';can_view_orders:boolean;can_manage_orders:boolean;can_manage_menu:boolean};
type Order={id:string;status:string;created_at:string;total_kurus:number};
type Inbox={pending:Order[];active:Order[];serverTime:string;pendingTruncated:boolean;activeTruncated:boolean};
type Report={periodDays:7|30;summary:{orders:number;delivered:number;expired:number;cancelled:number;rejected:number;avg_accept_seconds:number;delivered_total_kurus:string}};
export default function MerchantOverview(){return <AuthGate>{token=><Content token={token}/>}</AuthGate>}
function Content({token}:{token:()=>Promise<string>}){
 const [restaurants,setRestaurants]=useState<Merchant[]>([]);
 const [rid,setRid]=useState('');
 const [inbox,setInbox]=useState<Inbox|null>(null);
 const [report,setReport]=useState<Report|null>(null);
 const [error,setError]=useState('');
 const [reportError,setReportError]=useState('');
 const [loading,setLoading]=useState(true);
 const [lastSync,setLastSync]=useState('');
 const sequence=useRef(0);
 useEffect(()=>{
  let alive=true;
  token().then(t=>api<{restaurants:Merchant[]}>('/v1/me/staff-restaurants',t)).then(result=>{
   if(!alive)return;
   const valid=result.restaurants.filter(r=>['owner','manager','staff'].includes(r.role));
   setRestaurants(valid);
   setRid(readSelectedMerchantId(valid));
  }).catch(e=>{if(alive){setError(e instanceof Error?e.message:'İşletmeler yüklenemedi.');setLoading(false)}});
  return()=>{alive=false};
 },[token]);
 const selected=restaurants.find(r=>r.id===rid);
 const financial=selected?.role==='owner'||selected?.role==='manager';
 const load=useCallback(async()=>{
  if(!rid)return;
  const run=++sequence.current;
  setLoading(true);
  const owner=restaurants.find(r=>r.id===rid);
  try{
   const jwt=await token();
   const next=await api<Inbox>('/v1/restaurant/'+rid+'/inbox',jwt);
   if(run!==sequence.current)return;
   setInbox(next);setError('');
   setLastSync(new Date(next.serverTime).toLocaleTimeString('tr-TR'));
   if(owner?.role==='owner'||owner?.role==='manager'){
    try{
     const stats=await api<Report>('/v1/restaurant/'+rid+'/reports?days=7',jwt);
     if(run===sequence.current){setReport(stats);setReportError('')}
    }catch(e){if(run===sequence.current){setReport(null);setReportError(e instanceof Error?e.message:'Finansal rapor okunamadı.')}}
   }else{setReport(null);setReportError('')}
  }catch(e){
   if(run===sequence.current){
    setInbox(null);setReport(null);setError(e instanceof Error?e.message:'Restoran verileri okunamadı.');
   }
  }finally{if(run===sequence.current)setLoading(false)}
 },[rid,restaurants,token]);
 useEffect(()=>{
  setInbox(null);setReport(null);setError('');setLastSync('');
  if(rid)void load();
  const timer=setInterval(()=>{if(document.visibilityState==='visible'&&rid)void load()},30000);
  return()=>{sequence.current++;clearInterval(timer)};
 },[rid,load]);
 function choose(id:string){if(!restaurants.some(r=>r.id===id))return;saveSelectedMerchantId(id);setRid(id)}
 const pending=inbox?.pending?.length;
 const active=inbox?.active?.length;
 const metrics=[
  {label:'Kabul bekleyen',value:pending===undefined?'—':String(pending),description:'Şu anda yeni siparişler',icon:Bell},
  {label:'Hazırlanan / yolda',value:active===undefined?'—':String(active),description:'Devam eden siparişler',icon:ClipboardList},
  {label:'Son 7 gün sipariş',value:financial&&report?String(report.summary.orders):'—',description:financial?'Gerçek kayıtlardan':'Yalnızca sahip/yönetici',icon:ChartColumnIncreasing},
  {label:'Teslim edildi tutarı',value:financial&&report?money(Number(report.summary.delivered_total_kurus)):'—',description:'Tahsilat kanıtı değildir',icon:Wallet}
 ];
 return <section className="container main-section portal-dashboard">
  <div className="portal-dash-intro">
   <div><span className="portal-dash-kicker">RESTORAN İŞ ORTAĞI · KONTROL PANELİ</span><h1>İşletmene hoş geldin.</h1><p>Siparişleri, menüyü ve işletme durumunu tek yerden yönet. Ekrandaki tüm ölçümler seçtiğin restoranın sunucu kayıtlarından gelir.</p></div>
   <div className="portal-dash-toolbar"><label htmlFor="merchant-overview-select" className="visually-hidden">Restoran seç</label>
    <select id="merchant-overview-select" value={rid} disabled={!restaurants.length||loading} onChange={e=>choose(e.target.value)}>
     {restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
    <button className="btn outline" type="button" disabled={loading||!rid} onClick={()=>void load()}><RefreshCw size={17}/>{loading?'Güncelleniyor…':'Yenile'}</button>
   </div>
  </div>
  {error&&<div className="portal-dashboard-error" role="alert"><AlertTriangle size={19}/>{error}</div>}
  {reportError&&<div className="portal-dashboard-error" role="alert"><AlertTriangle size={19}/> Finansal rapor: {reportError}</div>}
  {loading&&!inbox&&<p role="status" className="muted">Gerçek işletme verileri yükleniyor…</p>}
  {inbox?.pendingTruncated||inbox?.activeTruncated?<p className="portal-dashboard-error" role="alert"><AlertTriangle size={18}/> Liste limiti aşıldı. Operasyon merkezinden kontrol gerekli.</p>:null}
  <div className="portal-metrics">{metrics.map(({label,value,description,icon:Icon})=>
   <article className="portal-metric" key={label}><span className="portal-metric-icon"><Icon size={19}/></span>
    <span className="portal-metric-label">{label}</span><strong>{value}</strong><small>{description}</small>
   </article>)}</div>
  <div className="portal-dashboard-panels">
   <section className="portal-dashboard-block">
    <header className="portal-block-heading"><div><h2>İşletme işlemleri</h2><p>Günlük işleri kısa yoldan hallet.</p></div></header>
    <div className="portal-shortcuts">
     <Link className="portal-shortcut" href="/restaurant"><Bell size={20}/> Yeni siparişleri yönet <ArrowRight size={16}/></Link>
     {selected?.can_manage_menu&&<Link className="portal-shortcut" href="/restaurant/manage#merchant-menu"><UtensilsCrossed size={20}/> Menü ve fiyatları düzenle <ArrowRight size={16}/></Link>}
     {financial&&<Link className="portal-shortcut" href="/restaurant/manage#merchant-hours"><Clock3 size={20}/> Çalışma saatleri <ArrowRight size={16}/></Link>}
     {financial&&<Link className="portal-shortcut" href="/restaurant/manage#merchant-zones"><Store size={20}/> Teslimat bölgeleri <ArrowRight size={16}/></Link>}
     {financial&&<Link className="portal-shortcut" href="/restaurant/manage#merchant-team"><UsersRound size={20}/> Personel ve yetkiler <ArrowRight size={16}/></Link>}
     {financial&&<Link className="portal-shortcut" href="/restaurant/manage#merchant-reports"><ChartColumnIncreasing size={20}/> Ayrıntılı raporlar <ArrowRight size={16}/></Link>}
     <Link className="portal-shortcut" href="/restaurant/manage"><Settings2 size={20}/> İşletme yönetimi <ArrowRight size={16}/></Link>
    </div>
   </section>
   <section className="portal-dashboard-block">
    <header className="portal-block-heading"><div><h2>Operasyon durumu</h2><p>Son yüklenen sipariş listesi</p></div><Link href="/restaurant">Tümünü gör</Link></header>
    {!inbox?<div className="portal-dashboard-empty">Canlı sunucu doğrulanmadan sipariş adedi gösterilmez.</div>:
     inbox.pending.length+inbox.active.length===0?<div className="portal-dashboard-empty"><CheckCircle2 size={23}/><p>Şu an devam eden sipariş görünmüyor.</p></div>:
     <div className="portal-dashboard-list">{[...inbox.pending,...inbox.active].slice(0,5).map(o=>
      <div className="portal-dashboard-row" key={o.id}><div><strong>#{o.id.slice(0,8).toUpperCase()}</strong>
       <small>{new Date(o.created_at).toLocaleTimeString('tr-TR')} · {o.status}</small></div><span>{money(o.total_kurus)}</span></div>)}
     </div>}
    <p className="muted" style={{fontSize:11,marginTop:14}}>{lastSync?'Son sunucu eşitlemesi: '+lastSync:'Henüz başarılı eşitleme yok'}. Yeni sipariş sesi için operasyon ekranını açıp uyarıları etkinleştir.</p>
   </section>
  </div>
  <p className="portal-dashboard-note"><ShieldCheck size={18}/> Sipariş ve menü güncellemeleri API'de restoran yetkisi ile doğrulanır. Bu sayfa arka planda bildirim garantisi vermez; gerçek sipariş kabulü için bağımsız bildirim sağlayıcılarının doğrulanması gerekir.</p>
 </section>;
}
