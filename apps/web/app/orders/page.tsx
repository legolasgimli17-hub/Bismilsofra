'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import AuthGate from '@/components/auth-gate';
import {api} from '@/lib/api';
import {money,type Order,statusText} from '@/lib/types';
import {ChevronRight,RefreshCw} from 'lucide-react';

type OrderView='active'|'history';
type ListedOrder=Order&{restaurant_name:string};
type CaseSummary={id:string;order_id:string;issue_type:string;status:string;created_at:string;updated_at:string};
const caseStatus:Record<string,string>={acik:'Açık',incelemede:'İnceleniyor',cozuldu:'Çözüldü',kapandi:'Kapandı'};
export default function Orders(){return <AuthGate>{token=><Inner token={token}/>}</AuthGate>}
function Inner({token}:{token:()=>Promise<string>}){
 const [orders,setOrders]=useState<ListedOrder[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(true);
 const [attempt,setAttempt]=useState(0);
 const [view,setView]=useState<OrderView>('active');
 const [page,setPage]=useState(1);
 const [hasNext,setHasNext]=useState(false);
 function changeView(next:OrderView){
  if(next===view)return;
  setBusy(true);setError('');setView(next);setPage(1);setHasNext(false);
 }
 function changePage(next:number){setBusy(true);setError('');setHasNext(false);setPage(next)}
 useEffect(()=>{
  let active=true;
  token().then(t=>api<{orders:ListedOrder[];hasNext?:boolean}>(`/v1/me/orders?view=${view}&page=${page}`,t))
   .then(result=>{if(active){setOrders(result.orders);setHasNext(Boolean(result.hasNext))}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Siparişler yüklenemedi.')})
   .finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[token,attempt,view,page]);
 return <section className="container main-section">
  <div className="section-heading"><div><span className="overline">HESABIM</span>
   <h1>Siparişlerim</h1></div></div>
  <div className="merchant-settings-links" role="group" aria-label="Sipariş durumu filtresi">
   <button type="button" className={`btn ${view==='active'?'primary':'outline'}`} aria-pressed={view==='active'} onClick={()=>changeView('active')}>Devam edenler</button>
   <button type="button" className={`btn ${view==='history'?'primary':'outline'}`} aria-pressed={view==='history'} onClick={()=>changeView('history')}>Geçmiş siparişler</button>
  </div>
  {busy?<div className="empty" role="status">Siparişler yükleniyor…</div>:error?
   <div className="empty"><p role="alert">{error}</p>
    <button type="button" className="btn outline" onClick={()=>{setError('');setBusy(true);setAttempt(n=>n+1)}}>Tekrar dene</button></div>:orders.length===0?
   <div className="empty"><h2>{page>1?'Bu sayfada sipariş yok':view==='active'?'Devam eden siparişin yok':'Geçmiş siparişin yok'}</h2>
    {page===1&&(view==='active'?<button type="button" className="btn outline" onClick={()=>changeView('history')}>Geçmiş siparişleri gör</button>:<Link className="btn primary" href="/">Restoranları keşfet</Link>)}</div>:
   <div className="orders-list">{orders.map(order=>
    <article className="panel" key={order.id}>
    <Link href={`/orders/${order.id}`} className="order-row">
     <div><strong>{order.restaurant_name||'Restoran siparişi'}</strong>
      <p>{statusText[order.status]||order.status}</p>
      <small>#{order.id.slice(0,8).toUpperCase()} · {new Date(order.created_at).toLocaleString('tr-TR')}</small></div>
     <div><b>{money(order.total_kurus)}</b><ChevronRight size={22}/></div>
    </Link>
    <Link className="btn outline" href={`/orders/${order.id}#order-help`} aria-label={`${order.restaurant_name||'Restoran'} siparişi ${order.id.slice(0,8)} için yardım`}>Siparişle ilgili yardım</Link>
    </article>)}</div>}
  {(page>1||hasNext)&&<nav className="merchant-settings-links" aria-label="Sipariş sayfaları">
   <button type="button" className="btn outline" disabled={busy||page===1} onClick={()=>changePage(page-1)}>Önceki sayfa</button>
   <span aria-live="polite">Sayfa {page}</span>
   <button type="button" className="btn outline" disabled={busy||!hasNext} onClick={()=>changePage(page+1)}>Sonraki sayfa</button>
  </nav>}
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
 return <section id="support-requests" className="panel customer-support portal-anchor" aria-label="Destek taleplerim">
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
