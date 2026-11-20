'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {money} from '@/lib/types';
import {BarChart3,RefreshCcw,ReceiptText,Clock3,AlertTriangle} from 'lucide-react';

type Summary={
 orders:number;pending:number;accepted:number;delivered:number;expired:number;rejected:number;
 cancelled:number;delivery_failed:number;in_progress:number;repeat_customers:number;
 delivered_total_kurus:string;avg_accept_seconds:number
};
type Daily={day:string;orders:number;delivered:number;expired:number;delivered_total_kurus:string};
type RestaurantRow={id:string;name:string;active:boolean;orders:number;delivered:number;expired:number;cancelled:number;delivered_total_kurus:string};
type Report={periodDays:7|30;scope:'platform'|'restaurant';summary:Summary;daily:Daily[];restaurants?:RestaurantRow[]};
const rate=(numerator:number,denominator:number)=>denominator?Math.round(numerator/denominator*100)+'%':'—';
const dateShort=(iso:string)=>{const [y,m,d]=iso.split('-');return d+'.'+m};
const currency=(raw:string)=>money(Number(raw));
export default function PilotReports({token,restaurantId}:{token:()=>Promise<string>;restaurantId?:string}){
 const [days,setDays]=useState<7|30>(7);
 const [report,setReport]=useState<Report|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0);
 const load=useCallback(async()=>{
  const seq=++sequence.current;
  setLoading(true);setError('');
  const route=restaurantId?
   `/v1/restaurant/${restaurantId}/reports?days=${days}`:
   `/v1/admin/reports?days=${days}`;
  try{
   const result=await api<Report>(route,await token());
   if(seq===sequence.current)setReport(result);
  }catch(e){
   if(seq===sequence.current){setReport(null);setError(e instanceof Error?e.message:'Rapor alınamadı.')}
  }finally{if(seq===sequence.current)setLoading(false)}
 },[restaurantId,days,token]);
 useEffect(()=>{void load();return()=>{sequence.current++}},[load]);
 const summary=report?.summary;
 const top=Math.max(1,...(report?.daily||[]).map(row=>row.orders));
 const tiles=summary?[
  {label:'Oluşturulan sipariş',value:summary.orders.toLocaleString('tr-TR'),note:'Seçili dönemde'},
  {label:'Teslim edildi',value:summary.delivered.toLocaleString('tr-TR'),note:'Restoranın teslim edildi beyanı'},
  {label:'Kabul oranı',value:rate(summary.accepted,summary.orders),note:'Kabul zamanı kaydı bulunan / tüm sipariş'},
  {label:'Ortalama kabul',value:summary.accepted?Math.round(summary.avg_accept_seconds)+' sn':'—',note:'Kabul edilen siparişler'},
  {label:'Süresi dolan',value:summary.expired.toLocaleString('tr-TR'),note:'Restoranın cevap vermediği'},
  {label:'İptal ve ret',value:(summary.cancelled+summary.rejected).toLocaleString('tr-TR'),note:'Müşteri/restoran iptali veya ret'},
  {label:'Tekrar sipariş müşterisi',value:summary.repeat_customers.toLocaleString('tr-TR'),note:'Bu dönemde en az 2 sipariş veren'},
  {label:'Teslim edildi değeri',value:currency(summary.delivered_total_kurus),note:'Kapıda ödeme beyanı, tahsilat kanıtı değil'}
 ]:[];
 return <section className="panel pilot-report" aria-label={restaurantId?'Restoran sipariş raporları':'Platform pilot raporları'}>
  <header className="pilot-report-heading">
   <div><span className="overline">BİSMİL SOFRA · PİLOT ÖLÇÜMLERİ</span>
    <h2><BarChart3 size={22}/> {restaurantId?'Restoran performans raporu':'Günlük sipariş ve platform raporları'}</h2>
    <p className="muted">Türkiye saatine göre günler, sunucudaki gerçek sipariş kayıtlarından hesaplanır. Müşteri telefonu/adresi rapora alınmaz.</p>
   </div>
   <div className="pilot-report-controls">
    <label htmlFor={restaurantId?'merchant-report-days':'admin-report-days'}>Dönem
     <select id={restaurantId?'merchant-report-days':'admin-report-days'} value={days}
      onChange={e=>setDays(e.target.value==='30'?30:7)} disabled={loading}>
      <option value="7">Son 7 gün</option><option value="30">Son 30 gün</option>
     </select>
    </label>
    <button className="btn outline" disabled={loading} type="button" onClick={()=>void load()}>
     <RefreshCcw size={16}/>{loading?'Hesaplanıyor…':'Yenile'}</button>
   </div>
  </header>
  {error&&<p className="notice error" role="alert"><AlertTriangle size={16}/>{error}</p>}
  {loading&&!report&&<p role="status" className="muted">Raporlar hesaplanıyor…</p>}
  {report&&summary&&<>
   <div className="pilot-report-tiles">{tiles.map(tile=>
    <article className="pilot-report-tile" key={tile.label}>
     <span>{tile.label}</span><strong>{tile.value}</strong><small>{tile.note}</small>
    </article>)}</div>
   <div className="pilot-report-graph">
    <h3><Clock3 size={18}/> Günlük siparişler</h3>
    <div className="pilot-report-scroll">
     <div className="pilot-report-bars" style={{minWidth:days===30?'960px':'100%'}}>
      {report.daily.map(row=><div className="pilot-report-bar-cell" key={row.day}
       title={row.day+': '+row.orders+' sipariş, '+row.delivered+' teslim'}>
       <span className="pilot-report-count">{row.orders}</span>
       <div className="pilot-report-bar-track">
        <div className="pilot-report-bar-fill" style={{height:Math.round(row.orders/top*100)+'%'}}/>
       </div>
       <small>{dateShort(row.day)}</small>
      </div>)}
     </div>
    </div>
    <p className="muted">Her sütun o gün oluşturulan sipariş sayısıdır. Sıfır siparişli günler de gösterilir.</p>
   </div>
   <div className="pilot-report-facts">
    <span><ReceiptText size={17}/> Henüz açık: {summary.pending+summary.in_progress}</span>
    <span>Başarısız teslim: {summary.delivery_failed}</span>
    <span>Süresi dolma oranı: {rate(summary.expired,summary.orders)}</span>
   </div>
   {report.restaurants&&<div className="pilot-report-restaurants">
    <h3>Restoran bazlı sonuçlar</h3>
    <div className="pilot-report-table-scroll"><table>
     <thead><tr><th scope="col">Restoran</th><th scope="col">Sipariş</th>
      <th scope="col">Teslim</th><th scope="col">Süresi dolan</th>
      <th scope="col">İptal</th><th scope="col">Teslim edildi değeri</th></tr></thead>
     <tbody>{report.restaurants.map(row=><tr key={row.id}>
      <td><strong>{row.name}</strong><small>{row.active?'Aktif':'Pasif'}</small></td>
      <td>{row.orders}</td><td>{row.delivered}</td><td>{row.expired}</td>
      <td>{row.cancelled}</td><td>{currency(row.delivered_total_kurus)}</td>
     </tr>)}
     {report.restaurants.length===0&&<tr><td colSpan={6}>Bu dönem için restoran kaydı yok.</td></tr>}
     </tbody>
    </table></div>
    <p className="muted">En fazla 50 restoran gösterilir; önce en çok sipariş almış işletmeler listelenir.</p>
   </div>}
   <p className="muted pilot-report-disclaimer">Muhasebe notu: Teslim edildi değeri restorana ait kapıda nakit/POS sipariş tutarlarının toplamıdır. Gerçek tahsilat, iade, platform komisyonu veya banka mutabakatı anlamına gelmez. Bu rapor müşteri ziyaret→sipariş dönüşümünü ölçmez; bunun için ayrı, izinli analitik gerekir.</p>
  </>}
 </section>;
}
