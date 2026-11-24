'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import AuthGate from '@/components/auth-gate';
import {api,ApiError} from '@/lib/api';
import {money} from '@/lib/types';
import {ArrowRight,RefreshCw,ShieldCheck,Store,ClipboardList,AlertTriangle,ChartColumnIncreasing,UsersRound,LifeBuoy,Activity,CheckCircle2,LockKeyhole} from 'lucide-react';

type Restaurant={id:string;name:string;active:boolean;has_owner:boolean;has_menu:boolean;has_hours:boolean;has_delivery:boolean};
type Alerts={latePending:{restaurant_id:string;count:number}[];notificationIssues:{restaurant_id:string;count:number}[];escalationIssues:{restaurant_id:string;count:number}[];workers:{name:string;status:string;lastSeenAt:string|null}[];supportQueue?:{unresolved:number;oldestAt:string|null}};
type Report={summary:{orders:number;delivered:number;delivered_total_kurus:string}};
const setupReady=(r:Restaurant)=>r.has_owner&&r.has_menu&&r.has_hours&&r.has_delivery;
const accessDenied=(error:unknown)=>error instanceof ApiError&&[401,403].includes(error.status);
const total=(rows:{count:number}[])=>(rows||[]).reduce((sum,r)=>sum+r.count,0);
export default function AdminOverview(){return <AuthGate>{token=><Content token={token}/>}</AuthGate>}
function Content({token}:{token:()=>Promise<string>}){
 const [restaurants,setRestaurants]=useState<Restaurant[]|null>(null);
 const [alerts,setAlerts]=useState<Alerts|null>(null);
 const [report,setReport]=useState<Report|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[lastSync,setLastSync]=useState('');
 const inFlight=useRef(false);
 const load=useCallback(async()=>{
  if(inFlight.current)return;
  inFlight.current=true;setLoading(true);
  try{
   const jwt=await token();
   const [r,a,s]=await Promise.allSettled([
    api<{restaurants:Restaurant[]}>('/v1/admin/restaurants',jwt),
    api<Alerts>('/v1/admin/alerts',jwt),
    api<Report>('/v1/admin/reports?days=7',jwt)
   ]);
   if(r.status==='fulfilled')setRestaurants(r.value.restaurants);
   else if(accessDenied(r.reason))setRestaurants(null);
   if(a.status==='fulfilled')setAlerts(a.value);
   else if(accessDenied(a.reason))setAlerts(null);
   if(s.status==='fulfilled')setReport(s.value);
   else if(accessDenied(s.reason))setReport(null);
   const failed=[
    r.status==='rejected'?'restoranlar':null,
    a.status==='rejected'?'operasyon uyarıları':null,
    s.status==='rejected'?'sipariş raporu':null
   ].filter(Boolean);
   setError(failed.length?'Güncellenemeyen veriler: '+failed.join(', ')+'.':'');
   if(!failed.length)setLastSync(new Date().toLocaleTimeString('tr-TR'));
  }catch(e){setError(e instanceof Error?e.message:'Platform verileri alınamadı.')}
  finally{inFlight.current=false;setLoading(false)}
 },[token]);
 useEffect(()=>{
  void load();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);
  return()=>clearInterval(timer);
 },[load]);
 const active=restaurants?.filter(r=>r.active).length;
 const setup=restaurants?.filter(r=>!setupReady(r))||[];
 const orderedRestaurants=restaurants&&[...restaurants].sort((a,b)=>Number(setupReady(a))-Number(setupReady(b))||Number(a.active)-Number(b.active));
 const alertsTotal=alerts?total(alerts.latePending)+total(alerts.notificationIssues)+total(alerts.escalationIssues):null;
 const unhealthy=alerts?.workers?.filter(x=>x.status!=='running')||[];
 const metrics=[
  {label:'Aktif restoran',value:active===undefined?'—':String(active),description:'Yayındaki işletmeler',icon:Store},
  {label:'Kurulumu bekleyen',value:restaurants?String(setup.length):'—',description:'Eksik sahibi/menüsü/saatleri/bölgesi olan',icon:UsersRound},
  {label:'Sipariş uyarısı',value:alertsTotal===null?'—':String(alertsTotal),description:'Gecikme ve bildirim hatası',icon:AlertTriangle},
  {label:'Son 7 gün sipariş',value:report?String(report.summary.orders):'—',description:'Platformdaki gerçek kayıtlar',icon:ClipboardList}
 ];
 return <section className="container main-section portal-dashboard">
  <div className="portal-dash-intro"><div><span className="portal-dash-kicker">PLATFORM OPERASYONLARI · KONTROL PANELİ</span>
   <h1>Bismil Sofra yönetimi.</h1><p>Restoran kurulumları, sipariş güvenilirliği ve destek operasyonları yalnızca yetkili yönetici hesabı ile görüntülenir.</p></div>
   <div className="portal-dash-toolbar"><button className="btn outline" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/>{loading?'Güncelleniyor…':'Yenile'}</button></div>
  </div>
  {error&&<div className="portal-dashboard-error" role="alert"><AlertTriangle size={19}/>{error} Önceki değerler güncel olmayabilir.</div>}
  {loading&&!restaurants&&<p className="muted" role="status">Platform verileri sunucudan yükleniyor…</p>}
  <div className="portal-metrics">{metrics.map(({label,value,description,icon:Icon})=>
   <article className="portal-metric" key={label}><span className="portal-metric-icon"><Icon size={19}/></span><span className="portal-metric-label">{label}</span><strong>{value}</strong><small>{description}</small></article>)}</div>
  <div className="portal-dashboard-panels">
   <section className="portal-dashboard-block">
    <header className="portal-block-heading"><div><h2>Yönetim araçları</h2><p>Platform operasyonunu güvenle yönet.</p></div><Link href="/admin">Tüm işlemler</Link></header>
    <div className="portal-shortcuts">
     <Link className="portal-shortcut" href="/admin#admin-onboarding"><Store size={20}/> Restoran ekle ve onayla <ArrowRight size={16}/></Link>
     <Link className="portal-shortcut" href="/admin#admin-orders"><ClipboardList size={20}/> Sipariş incele <ArrowRight size={16}/></Link>
     <Link className="portal-shortcut" href="/admin#admin-reports"><ChartColumnIncreasing size={20}/> Performans raporları <ArrowRight size={16}/></Link>
     <Link className="portal-shortcut" href="/admin#admin-users"><UsersRound size={20}/> Kullanıcı yetkileri <ArrowRight size={16}/></Link>
     <Link className="portal-shortcut" href="/admin#admin-support"><LifeBuoy size={20}/> <span>Destek talepleri{alerts?.supportQueue&&<> · {alerts.supportQueue.unresolved} bekliyor</>}</span> <ArrowRight size={16}/></Link>
     <Link className="portal-shortcut" href="/admin#admin-workers"><Activity size={20}/> Bildirim / işçi durumu <ArrowRight size={16}/></Link>
    </div>
    {alerts?.supportQueue?.oldestAt&&<p className="muted">En uzun süredir bekleyen destek talebi: <time dateTime={alerts.supportQueue.oldestAt}>{new Date(alerts.supportQueue.oldestAt).toLocaleString('tr-TR')}</time></p>}
   </section>
   <section className="portal-dashboard-block">
    <header className="portal-block-heading"><div><h2>Pilot restoranların durumu</h2><p>Gerçek kurulum kayıtları; restoranı otomatik yayına almaz.</p></div><Link href="/admin#admin-onboarding">Yönet</Link></header>
    {!restaurants?<div className="portal-dashboard-empty">Sunucudan restoran listesi henüz gelmedi.</div>:
     restaurants.length===0?<div className="portal-dashboard-empty">Henüz restoran kaydı bulunmuyor.</div>:
     <div className="portal-dashboard-list">{orderedRestaurants?.slice(0,7).map(r=>{
      const ready=setupReady(r);
      const label=!ready?'Kurulum eksik':r.active?'Aktif':'Kurulum hazır';
      return <div className="portal-dashboard-row" key={r.id}><div><strong>{r.name}</strong>
       <small>{r.has_owner?'Sahip ✓':'Sahip eksik'} · {r.has_menu?'Menü ✓':'Menü eksik'} · {r.has_hours?'Saatler ✓':'Saatler eksik'} · {r.has_delivery?'Bölge ✓':'Bölge eksik'}</small></div><span>{label}</span></div>
     })}</div>}
   </section>
  </div>
  <div className="portal-dashboard-panels">
   <section className="portal-dashboard-block">
    <header className="portal-block-heading"><div><h2>Uyarı ve sistem sağlığı</h2><p>Son kontrol anındaki işçi çevrimleri, teslimat kanıtı değildir.</p></div><Link href="/admin#admin-workers">Ayrıntılar</Link></header>
    {!alerts?<div className="portal-dashboard-empty">Sistem durumu henüz doğrulanmadı.</div>:
     <div className="portal-dashboard-list">
      <div className="portal-dashboard-row"><div><strong>Geciken sipariş</strong><small>Henüz kabul edilmemiş</small></div><span>{total(alerts.latePending)}</span></div>
      <div className="portal-dashboard-row"><div><strong>İlk bildirim hataları</strong><small>Outbox tekrarları / hatalar</small></div><span>{total(alerts.notificationIssues)}</span></div>
      <div className="portal-dashboard-row"><div><strong>İkincil alarm hataları</strong><small>Bağımsız bildirim kanalı</small></div><span>{total(alerts.escalationIssues)}</span></div>
      <div className="portal-dashboard-row"><div><strong>Çalışmayan / geciken süreç</strong><small>Gerçek provider teslimatı ayrıca doğrulanmalı</small></div><span>{unhealthy.length}</span></div>
     </div>}
   </section>
   <section className="portal-dashboard-block">
    <header className="portal-block-heading"><div><h2>7 günlük operasyon özeti</h2><p>Sipariş tutarı restoranın kapıda tahsilat beyanıdır.</p></div><Link href="/admin#admin-reports">Raporlar</Link></header>
    {!report?<div className="portal-dashboard-empty">Finansal ve sipariş raporları henüz doğrulanmadı.</div>:<div className="portal-dashboard-list">
     <div className="portal-dashboard-row"><div><strong>Oluşturulan sipariş</strong></div><span>{report.summary.orders}</span></div>
     <div className="portal-dashboard-row"><div><strong>Teslim edildi</strong></div><span>{report.summary.delivered}</span></div>
     <div className="portal-dashboard-row"><div><strong>Teslim edildi sipariş değeri</strong></div><span>{money(Number(report.summary.delivered_total_kurus))}</span></div>
    </div>}
    <p className="muted" style={{fontSize:11,marginTop:15}}>Son tam güncelleme: {lastSync||'Başarılı kontrol yok'}. Bu ekran gerçek müşteri tahsilatı veya platform kazancı olarak yorumlanamaz.</p>
   </section>
  </div>
  <p className="portal-dashboard-note"><LockKeyhole size={18}/> Erişim için kimlik sağlayıcısından gerçek MFA + platform yöneticisi yetkisi gerekir. <ShieldCheck size={18}/> Yeni sipariş kabulü, bağımsız uyarı ve dış kontroller tamamlanmadan kapalı tutulur.</p>
 </section>;
}
