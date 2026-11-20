'use client';
import {useRef,useState,type FormEvent} from 'react';
import {api} from '@/lib/api';
import {money,statusText} from '@/lib/types';
import {Search,ClipboardList,ShieldCheck,AlertTriangle,Clock3,PackageSearch} from 'lucide-react';

type OrderRecord={
 id:string;restaurant_id:string;restaurant_name:string;status:string;
 created_at:string;updated_at:string;expires_at:string;
 accepted_at:string|null;delivered_at:string|null;
 total_kurus:number;payment_method:'cash'|'pos'
};
type Detail={
 order:OrderRecord&{subtotal_kurus:number;delivery_fee_kurus:number};
 items:{product_name_snapshot:string;unit_kurus:number;quantity:number;line_total_kurus:number;
  options_snapshot:{name:string}[]}[];
 events:{previous_status:string|null;new_status:string;actor_type:string;
  reason:string;created_at:string}[]
};
const date=(s:string)=>new Date(s).toLocaleString('tr-TR');

export default function AdminOrderInvestigation({token}:{token:()=>Promise<string>}){
 const [key,setKey]=useState('');
 const [records,setRecords]=useState<OrderRecord[]>([]);
 const [searched,setSearched]=useState(false);
 const [more,setMore]=useState(false);
 const [note,setNote]=useState('');
 const [detail,setDetail]=useState<Detail|null>(null);
 const [busy,setBusy]=useState(false),[loadingId,setLoadingId]=useState('');
 const [error,setError]=useState('');
 const sequence=useRef(0);
 async function search(e:FormEvent){
  e.preventDefault();
  const seq=++sequence.current;
  setBusy(true);setError('');setRecords([]);setDetail(null);setSearched(false);
  const cleaned=key.trim().toLowerCase();
  if(!/^(?:[a-f0-9]{8}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(cleaned)){
   setError('Sipariş numarasının ilk 8 karakterini veya numaranın tamamını yazın.');
   setBusy(false);return;
  }
  try{
   const result=await api<{orders:OrderRecord[];more:boolean;note:string}>(
    '/v1/admin/orders?key='+encodeURIComponent(cleaned),await token());
   if(seq!==sequence.current)return;
   setRecords(result.orders);setSearched(true);setMore(result.more);setNote(result.note);
  }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'Sipariş bulunamadı.')}
  finally{if(seq===sequence.current)setBusy(false)}
 }
 async function inspect(record:OrderRecord){
  if(loadingId)return;
  const seq=++sequence.current;
  setError('');setDetail(null);setLoadingId(record.id);
  try{
   const result=await api<Detail>('/v1/admin/orders/'+record.id,await token());
   if(seq===sequence.current)setDetail(result);
  }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'Sipariş geçmişi yüklenemedi.')}
  finally{if(seq===sequence.current)setLoadingId('')}
 }
 return <section className="panel admin-order-investigation" aria-label="Sipariş durum incelemesi">
  <div className="admin-order-head"><h2><PackageSearch size={22}/> Sipariş inceleme</h2>
   <p className="muted">Müşteri veya restoran bir sorun bildirdiğinde sipariş numarasını girin. Toplu müşteri listesi, adres veya telefon gösterilmez.</p></div>
  <form onSubmit={e=>void search(e)} className="admin-order-search">
   <label>Sipariş numarası<input type="text" required value={key} autoComplete="off" spellCheck={false}
    maxLength={36} placeholder="Örn. 1A2B3C4D" onChange={e=>{
     setKey(e.target.value);setRecords([]);setDetail(null);setSearched(false);sequence.current++;
    }}/></label>
   <button type="submit" className="btn primary" disabled={busy||Boolean(loadingId)||!key.trim()}>
    <Search size={17}/>{busy?'Aranıyor…':'Siparişi ara'}</button>
  </form>
  {error&&<p className="notice error" role="alert"><AlertTriangle size={17}/>{error}</p>}
  {searched&&<p className="muted">{records.length} eşleşme. {note}{more?' Başka eşleşmeler de var; tam numarayla arayın.':''}</p>}
  {searched&&records.length===0&&<div className="empty">Bu numarayla sipariş bulunamadı.</div>}
  <div className="admin-order-results">{records.map(row=>
   <article key={row.id} className="admin-order-result">
    <div><strong>#{row.id.slice(0,8).toUpperCase()}</strong><span>{row.restaurant_name}</span>
     <small><Clock3 size={14}/> {date(row.created_at)}</small></div>
    <div className="admin-order-result-status"><strong>{statusText[row.status]||row.status}</strong>
     <span>{money(row.total_kurus)} · {row.payment_method==='cash'?'Kapıda nakit':'Kapıda POS'}</span></div>
    <button className="btn outline" type="button" disabled={busy||Boolean(loadingId)}
     onClick={()=>void inspect(row)}><ClipboardList size={17}/>{loadingId===row.id?'Yükleniyor…':'Geçmişi incele'}</button>
   </article>
  )}</div>
  {detail&&<div className="admin-order-detail" aria-label="Sipariş geçmişi">
   <h3><ShieldCheck size={20}/> #{detail.order.id.slice(0,8).toUpperCase()} · {detail.order.restaurant_name}</h3>
   <div className="admin-order-facts">
    <div><span>Güncel durum</span><strong>{statusText[detail.order.status]||detail.order.status}</strong></div>
    <div><span>Ara toplam</span><strong>{money(detail.order.subtotal_kurus)}</strong></div>
    <div><span>Teslimat</span><strong>{money(detail.order.delivery_fee_kurus)}</strong></div>
    <div><span>Sipariş toplamı</span><strong>{money(detail.order.total_kurus)}</strong></div>
   </div>
   <h4>Ürünler ve miktarlar</h4>
   <div className="admin-order-lines">{detail.items.map((item,i)=>
    <div key={i}><span><strong>{item.quantity} × {item.product_name_snapshot}</strong>
     {Array.isArray(item.options_snapshot)&&item.options_snapshot.length>0&&<small>
      {item.options_snapshot.map(option=>option.name).join(' · ')}</small>}</span>
     <strong>{money(item.line_total_kurus)}</strong></div>)}</div>
   <h4>Durum ve olay geçmişi</h4>
   <ol className="admin-order-history">{detail.events.map((event,i)=>
    <li key={i}><div><strong>{statusText[event.new_status]||event.new_status}</strong>
     <small>{date(event.created_at)} · {event.actor_type}</small></div>
     {event.reason&&<p>{event.reason}</p>}</li>)}</ol>
   <p className="muted">Bu inceleme yönetici denetim kaydına işlendi. Ödeme kapıda restorana yapılır; buradaki toplam tahsilat kanıtı değildir.</p>
  </div>}
 </section>;
}
