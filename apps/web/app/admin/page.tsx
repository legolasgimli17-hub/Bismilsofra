'use client';
import {useCallback,useEffect,useState} from 'react';
import AuthGate from '@/components/auth-gate';
import SupportOperations from '@/components/support-operations';
import PilotOnboarding from '@/components/pilot-onboarding';
import UserAccessOperations from '@/components/user-access-operations';
import {api} from '@/lib/api';
import {AlertTriangle,ShieldCheck,RefreshCcw,WifiOff,BellRing,Clock3} from 'lucide-react';

type AlertGroup={restaurant_id:string;count:number};
type WorkerHealth={
 name:'outbox'|'escalation'|'expiry';
 status:'running'|'delivery_error'|'error'|'stale'|'missing';
 lastSeenAt:string|null;lastSuccessfulCycleAt:string|null;
 lastWorkAt:string|null;lastFailureAt:string|null
};
type AdminAlerts={
 latePending:AlertGroup[];notificationIssues:AlertGroup[];escalationIssues:AlertGroup[];
 workers:WorkerHealth[]
};
const workerLabels:Record<WorkerHealth['name'],string>={
 outbox:'İlk sipariş bildirimi',escalation:'Bağımsız ikinci alarm',expiry:'Sipariş süresi takibi'
};
const workerStatuses:Record<WorkerHealth['status'],string>={
 running:'İşçi çevrimi güncel',delivery_error:'İletim hatası görüldü',
 error:'İşçi çevrimi hatalı',stale:'Kalp atışı gecikti',missing:'İşçi henüz rapor vermedi'
};
const count=(records:AlertGroup[]|undefined)=>records?.reduce((sum,x)=>sum+x.count,0)||0;

export default function AdminPage(){return <AuthGate>{token=><Inner token={token}/>}</AuthGate>}
function Inner({token}:{token:()=>Promise<string>}){
 const [alerts,setAlerts]=useState<AdminAlerts|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [lastSync,setLastSync]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const t=await token();
   const response=await api<AdminAlerts>('/v1/admin/alerts',t);
   setAlerts(response);setLastSync(new Date().toLocaleTimeString('tr-TR'));setError('');
  }catch(e){setError(e instanceof Error?e.message:'Bağlantı başarısız oldu.')}
  finally{setLoading(false)}
 },[token]);
 useEffect(()=>{
  void load();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},20_000);
  const refresh=()=>{if(document.visibilityState==='visible')void load()};
  document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh)};
 },[load]);
 const boxes=[
  {label:'Geciken bekleyen siparişler',description:'Restoranın henüz cevaplamadığı siparişleri kontrol edin.',data:alerts?.latePending||[],icon:'time'},
  {label:'Birincil bildirim sorunları',description:'Başarısız veya tekrarlanan normal bildirim girişimleri.',data:alerts?.notificationIssues||[],icon:'primary'},
  {label:'İkincil uyarı sorunları',description:'Kabul edilmemiş siparişler için ayrı kanaldaki gecikme ve hatalar.',data:alerts?.escalationIssues||[],icon:'fallback'}
 ] as const;
 return <section className="container main-section">
  <div className="section-heading"><div><span className="overline">PLATFORM YÖNETİMİ</span><h1>Platform yönetimi</h1><p>Restoran kurulumları, sipariş uyarıları ve destek operasyonları</p></div>
   <button className="btn outline" type="button" disabled={loading} onClick={()=>void load()}><RefreshCcw size={17}/>{loading?'Kontrol ediliyor…':'Yenile'}</button>
  </div>
  <div className="merchant-banner"><ShieldCheck size={20}/><span>Yalnızca doğrulanmış yönetici ve MFA erişebilir. Burada müşteri adresleri veya telefonları bulunmaz.</span></div>
  <div className="merchant-connection healthy" role="status">
   <Clock3 size={18}/><div><strong>{lastSync?'Son başarılı kontrol: '+lastSync:'Bağlantı kontrolü'}</strong>
    <span>Bu ekran açıkken 20 saniyede bir güncellenir. Kapalı sekmede gerçek zamanlı bildirim garantisi yoktur.</span></div>
  </div>
  {error&&<div role="alert" className="notice error"><WifiOff size={18}/> {error} Son görüntülenen veriler güncel olmayabilir.</div>}
  <div className="admin-grid">
   {boxes.map(box=><article className="panel" key={box.icon}>
    <h2><AlertTriangle size={20}/> {box.label}</h2>
    <div className="admin-alert-count">{alerts?count(box.data):'—'}</div>
    <p className="muted">{box.description}</p>
    {!alerts?<p className="muted">Henüz veri yüklenmedi.</p>:box.data.length===0?
     <p className="muted">Son kontrol sırasında uyarı yoktu.</p>:box.data.map(x=>
      <p key={x.restaurant_id} className="admin-alert-row">
       <BellRing size={16}/> Restoran: <code>{x.restaurant_id.slice(0,8)}</code> · {x.count} kayıt
      </p>)}
   </article>)}
  </div>
  <PilotOnboarding token={token}/>
  <UserAccessOperations token={token}/>
  <section className="panel admin-worker-watchdog" aria-label="Sipariş işçileri sağlık kontrolü">
   <h2><Clock3 size={20}/> Sipariş işçileri</h2>
   <p className="muted">Bu kontrol arka plan süreçlerinin durumunu gösterir. Bir işçinin çalışması, bildirim sağlayıcısının veya restoran telefonunun alarmı aldığını kanıtlamaz.</p>
   {!alerts?<p className="muted">İşçi durumu henüz alınamadı.</p>:
    <div className="admin-worker-grid">{(alerts.workers||[]).map(worker=>{
     const healthy=worker.status==='running';
     return <article className={`admin-worker-card ${healthy?'admin-worker-ok':'admin-worker-fault'}`} key={worker.name}>
      <strong>{workerLabels[worker.name]}</strong>
      <p className="admin-worker-label" role={healthy?'status':'alert'}>
       {healthy?<ShieldCheck size={17}/>:<AlertTriangle size={17}/>}
       {workerStatuses[worker.status]}
      </p>
      <small>Son çalışma: {worker.lastSeenAt?new Date(worker.lastSeenAt).toLocaleString('tr-TR'):'Kayıt yok'}</small>
      <small>Son tamamlanan iş: {worker.lastWorkAt?new Date(worker.lastWorkAt).toLocaleString('tr-TR'):'Henüz kayıtlı değil'}</small>
     </article>
    })}</div>}
   {alerts?.workers?.some(x=>x.status!=='running')&&
    <p className="notice error" role="alert">Bir veya daha fazla arka plan işçisi kontrol edilmeli. Süreç/DB bağlantısını ve bildirim sağlayıcısını doğrulayın; gerekirse operasyon sorumlusuna haber verin.</p>}
  </section>
  <SupportOperations token={token}/>
  <p className="muted">Uyarı sıfır görünse bile pilot öncesi gerçek SMS/push ve bağımsız yedek kanal testleri gereklidir. Destek talebi durumları müşterinin Siparişlerim ekranında görülebilir; otomatik müşteri mesajı veya para iadesi yapılmaz.</p>
 </section>;
}
