'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import AuthGate from '@/components/auth-gate';
import {api} from '@/lib/api';
import {money,type Order,statusText} from '@/lib/types';
import {ChevronRight,RefreshCw} from 'lucide-react';

type CaseSummary={id:string;order_id:string;issue_type:string;status:string;created_at:string;updated_at:string};
const caseStatus:Record<string,string>={acik:'Açık',incelemede:'İnceleniyor',cozuldu:'Çözüldü',kapandi:'Kapandı'};
export default function Orders(){return <AuthGate>{token=><Inner token={token}/>}</AuthGate>}
function Inner({token}:{token:()=>Promise<string>}){
 const [orders,setOrders]=useState<Order[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(true);
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;
  token().then(t=>api<{orders:Order[]}>('/v1/me/orders',t))
   .then(result=>{if(active)setOrders(result.orders)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Siparişler yüklenemedi.')})
   .finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[token,attempt]);
 return <section className="container main-section">
  <div className="section-heading"><div><span className="overline">HESABIM</span>
   <h1>Siparişlerim</h1><p>Geçmiş ve aktif siparişlerinin tümü</p></div></div>
  {busy?<div className="empty" role="status">Siparişler yükleniyor…</div>:error?
   <div className="empty"><p role="alert">{error}</p>
    <button type="button" className="btn outline" onClick={()=>{setError('');setBusy(true);setAttempt(n=>n+1)}}>Tekrar dene</button></div>:orders.length===0?
   <div className="empty"><h2>Henüz siparişin yok</h2>
    <p>Restoranları keşfederek başlayabilirsin.</p><Link className="btn primary" href="/">Restoranları keşfet</Link></div>:
   <div className="orders-list">{orders.map(order=>
    <Link href={`/orders/${order.id}`} className="order-row" key={order.id}>
     <div><strong>#{order.id.slice(0,8).toUpperCase()}</strong>
      <p>{statusText[order.status]||order.status}</p>
      <small>{new Date(order.created_at).toLocaleString('tr-TR')}</small></div>
     <div><b>{money(order.total_kurus)}</b><ChevronRight size={22}/></div>
    </Link>)}</div>}
  <CustomerSupport token={token}/>
 </section>;
}
function CustomerSupport({token}:{token:()=>Promise<string>}){
 const [cases,setCases]=useState<CaseSummary[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{const response=await api<{cases:CaseSummary[]}>('/v1/me/support-cases',await token());
   setCases(response.cases);setLoaded(true)}
  catch(e){setError(e instanceof Error?e.message:'Destek talepleri yüklenemedi.')}
  finally{setBusy(false)}
 },[token]);
 useEffect(()=>{void load()},[load]);
 return <section className="panel customer-support" aria-label="Destek taleplerim">
  <div className="support-console-head"><div><h2>Destek taleplerim</h2>
   <p className="muted">Açtığın taleplerin güncel durumunu buradan takip edebilirsin.</p></div>
   <button className="btn outline" disabled={busy} onClick={()=>void load()}>
    <RefreshCw size={17}/>{busy?'Yükleniyor…':'Yenile'}</button></div>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {busy&&<p className="muted" role="status">Destek talepleri yükleniyor…</p>}
  {loaded&&cases.length===0&&<p className="muted">Henüz destek talebin yok.</p>}
  {loaded&&cases.length>0&&<div className="customer-support-list">{cases.map(c=>
   <div className="customer-support-row" key={c.id}>
    <div><Link href={`/orders/${c.order_id}`}>Sipariş #{c.order_id.slice(0,8)}</Link>
     <small>{new Date(c.updated_at).toLocaleString('tr-TR')}</small></div>
    <strong className="support-status">{caseStatus[c.status]||c.status}</strong>
   </div>)}</div>}
 </section>;
}
