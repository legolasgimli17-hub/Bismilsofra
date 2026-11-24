'use client';
import {useCallback,useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {AlertCircle,CheckCircle2,ClipboardList,RefreshCw} from 'lucide-react';

type Status='acik'|'incelemede'|'cozuldu'|'kapandi';
type QueueFilter=Status|'unresolved'|'all';
type CaseSummary={
 id:string;order_id:string;issue_type:string;status:Status;
 restaurant_name:string;created_at:string;updated_at:string
};
type CaseDetail=CaseSummary&{description:string};
const statusText:Record<Status,string>={
 acik:'Açık',incelemede:'İnceleniyor',cozuldu:'Çözüldü',kapandi:'Kapandı'
};
const issueText:Record<string,string>={
 eksik_urun:'Eksik ürün',yanlis_urun:'Yanlış ürün',gecikme:'Gecikme',teslimat:'Teslimat',diger:'Diğer'
};
const actions:Record<Status,readonly Status[]>={
 acik:['incelemede','cozuldu'],incelemede:['cozuldu'],
 cozuldu:['incelemede','kapandi'],kapandi:[]
};
export default function SupportOperations({token}:{token:()=>Promise<string>}){
 const [filter,setFilter]=useState<QueueFilter>('unresolved');
 const [cases,setCases]=useState<CaseSummary[]>([]);
 const [page,setPage]=useState(1);
 const [hasNext,setHasNext]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [expanded,setExpanded]=useState<string|null>(null);
 const [detail,setDetail]=useState<CaseDetail|null>(null);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');

 const reload=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const access=await token();
   const query=new URLSearchParams({page:String(page)});
   if(filter!=='all')query.set('status',filter);
   const result=await api<{cases:CaseSummary[];hasNext?:boolean}>(`/v1/admin/support-cases?${query}`,access);
   setCases(result.cases);setHasNext(Boolean(result.hasNext));setLoaded(true);setExpanded(null);setDetail(null);
  }catch(e){setError(e instanceof Error?e.message:'Destek talepleri yüklenemedi.')}
  finally{setLoading(false)}
 },[filter,page,token]);
 useEffect(()=>{void reload()},[reload]);
 async function toggle(record:CaseSummary){
  if(expanded===record.id){setExpanded(null);setDetail(null);return}
  setBusy(true);setError('');setExpanded(null);setDetail(null);
  try{
   const response=await api<{case:CaseDetail}>(`/v1/admin/support-cases/${record.id}`,await token());
   setDetail(response.case);setExpanded(record.id);
  }catch(e){setError(e instanceof Error?e.message:'Talep açıklaması alınamadı.')}
  finally{setBusy(false)}
 }
 async function move(record:CaseSummary,to:Status){
  if(busy)return;
  if(to==='kapandi'&&!window.confirm('Bu destek talebi kapatılsın mı?'))return;
  setBusy(true);setError('');setSuccess('');
  try{
   await api(`/v1/admin/support-cases/${record.id}/status`,await token(),{
    method:'POST',body:JSON.stringify({expectedStatus:record.status,to})
   });
   setSuccess('Talep durumu güncellendi. Değişiklik denetim kayıtlarına işlendi.');
   if(page===1)await reload();
   else changePage(1);
  }catch(e){setError(e instanceof Error?e.message:'Durum güncellenemedi. Listeyi yenileyin.')}
  finally{setBusy(false)}
 }
 function changePage(next:number){
  setLoading(true);setLoaded(false);setHasNext(false);setCases([]);setExpanded(null);setDetail(null);setPage(next);
 }
 return <section className="panel support-console" aria-label="Müşteri destek talebi yönetimi">
  <div className="support-console-head"><div>
   <h2><ClipboardList size={22}/> Müşteri destek talepleri</h2>
   <p className="muted">Açıklamalar yalnızca yetkili yönetici talebi açınca getirilir. Adres veya telefon burada gösterilmez.</p>
  </div><div className="support-console-filters">
   <label>Durum <select disabled={loading||busy} value={filter} onChange={event=>{setFilter(event.target.value as QueueFilter);setLoading(true);setSuccess('');changePage(1)}}>
    <option value="unresolved">Yanıt bekleyenler</option>
    <option value="acik">Açık</option><option value="incelemede">İnceleniyor</option>
    <option value="cozuldu">Çözüldü</option><option value="kapandi">Kapandı</option>
    <option value="all">Tümü</option></select></label>
   <button className="btn outline" disabled={loading||busy} onClick={()=>void reload()}>
    <RefreshCw size={17}/>{loading?'Yükleniyor…':'Yenile'}</button>
  </div></div>
  {error&&<p className="notice error" role="alert"><AlertCircle size={17}/> {error}</p>}
  {success&&<p className="notice" role="status"><CheckCircle2 size={17}/> {success}</p>}
  {loading&&<p className="muted" role="status">Destek talepleri yükleniyor…</p>}
  {loaded&&cases.length===0&&<p className="muted">Bu sayfada destek talebi bulunmuyor.</p>}
  {loaded&&<div className="support-case-list">{cases.map(record=><article className="support-case" key={record.id}>
   <div className="support-case-top"><div>
    <h3>{issueText[record.issue_type]||'Destek talebi'} · {record.restaurant_name}</h3>
    <p className="muted">Sipariş #{record.order_id.slice(0,8)} · {new Date(record.created_at).toLocaleString('tr-TR')}</p>
   </div><strong className="support-status">{statusText[record.status]}</strong></div>
   <div className="support-case-controls"><button className="btn outline" disabled={busy||loading}
    aria-expanded={expanded===record.id} onClick={()=>void toggle(record)}>
    {expanded===record.id?'Açıklamayı gizle':'Açıklamayı görüntüle'}</button>
    {actions[record.status].map(next=><button className="btn outline" disabled={busy||loading}
     onClick={()=>void move(record,next)} key={next}>{next==='kapandi'?'Talebi kapat':statusText[next]+' yap'}</button>)}
   </div>
   {expanded===record.id&&detail&&<div className="support-case-detail"><strong>Müşterinin açıklaması</strong>
    <p>{detail.description}</p><small className="muted">Son güncelleme: {new Date(detail.updated_at).toLocaleString('tr-TR')}</small>
   </div>}
  </article>)}</div>}
  {(page>1||hasNext)&&<nav className="support-console-filters" aria-label="Destek talebi sayfaları">
   <button type="button" className="btn outline" disabled={loading||busy||page===1} onClick={()=>changePage(page-1)}>Önceki sayfa</button>
   <span aria-live="polite">Sayfa {page}</span>
   <button type="button" className="btn outline" disabled={loading||busy||!hasNext} onClick={()=>changePage(page+1)}>Sonraki sayfa</button>
  </nav>}
 </section>;
}
