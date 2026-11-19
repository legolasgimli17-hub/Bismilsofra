'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import AuthGate from '@/components/auth-gate';
import MenuEditor,{type EditorCategory,type EditorProduct} from '@/components/menu-editor';
import {api} from '@/lib/api';
import {money} from '@/lib/types';
import {inputToKurus,kurusToInput,newTimeSlot,WEEKDAY_NAMES,type MerchantScheduleSlot} from '@/lib/merchant-settings';
import {Settings2,Clock3,MapPin,RefreshCcw,ShieldCheck,CheckCircle2,AlertTriangle,ArrowLeft,Save} from 'lucide-react';

type Merchant={id:string;name:string;role:string;can_manage_menu?:boolean};
type Product=EditorProduct;
type Zone={zone_id:string;name:string;enabled:boolean;min_basket_kurus:number;delivery_fee_kurus:number};
type Availability={is_open:boolean;is_busy:boolean;accepts_orders:boolean};
type Model={
 restaurant:Availability&{id:string;name:string;active:boolean};
 products:Product[];categories:EditorCategory[];hours:MerchantScheduleSlot[];zones:Zone[];
 permissions:{canManageMenu:boolean;canManageSettings:boolean};
};
type ZoneDraft={enabled:boolean;minimum:string;delivery:string};

export default function MerchantManagement(){return <AuthGate>{token=><ManagementScreen token={token}/>}</AuthGate>}

function ManagementScreen({token}:{token:()=>Promise<string>}){
 const [merchants,setMerchants]=useState<Merchant[]>([]);
 const [rid,setRid]=useState('');
 const [model,setModel]=useState<Model|null>(null);
 const [availability,setAvailability]=useState<Availability>({is_open:false,is_busy:false,accepts_orders:false});
 const [hours,setHours]=useState<MerchantScheduleSlot[]>([]);
 const [zoneDrafts,setZoneDrafts]=useState<Record<string,ZoneDraft>>({});
 const [busy,setBusy]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const requests=useRef(0);

 useEffect(()=>{
  let active=true;
  token().then(t=>api<{restaurants:Merchant[]}>('/v1/me/staff-restaurants',t))
   .then(result=>{if(!active)return;setMerchants(result.restaurants);setRid(result.restaurants[0]?.id||'');setLoading(false)})
   .catch(e=>{if(active){setError(e instanceof Error?e.message:'Yetkili işletmeler yüklenemedi.');setLoading(false)}});
  return()=>{active=false};
 },[token]);

 const load=useCallback(async(throwOnError=false)=>{
  if(!rid)return;
  const seq=++requests.current;
  setLoading(true);
  try{
   const result=await api<Model>(`/v1/restaurant/${rid}/management`,await token());
   if(seq!==requests.current)return;
   setModel(result);
   setAvailability({is_open:result.restaurant.is_open,is_busy:result.restaurant.is_busy,accepts_orders:result.restaurant.accepts_orders});
   setHours(result.hours);
   setZoneDrafts(Object.fromEntries(result.zones.map(z=>[z.zone_id,{
    enabled:z.enabled,minimum:kurusToInput(z.min_basket_kurus),delivery:kurusToInput(z.delivery_fee_kurus)
   }])));
   setError('');
  }catch(e){if(seq===requests.current){setModel(null);setError(e instanceof Error?e.message:'İşletme ayarları yüklenemedi.')}if(throwOnError)throw e}
  finally{if(seq===requests.current)setLoading(false)}
 },[rid,token]);

 useEffect(()=>{
  setModel(null);setError('');setNotice('');
  if(rid)void load();
  return()=>{requests.current++};
 },[rid,load]);

 async function save(label:string,task:()=>Promise<unknown>){
  if(busy||!model)return;
  setBusy(label);setNotice('');setError('');
  try{
   await task();
   await load(true);
   setNotice(label+' başarıyla kaydedildi.');
  }catch(e){setError(e instanceof Error?e.message:'Değişiklik kaydedilemedi.')}
  finally{setBusy('')}
 }
 const disabled=loading||Boolean(busy);
 const editable=model?.permissions.canManageSettings===true;

 function updateZone(id:string,next:Partial<ZoneDraft>){
  setZoneDrafts(all=>({...all,[id]:{...all[id],...next}}));
 }
 function updateHour(index:number,field:'openTime'|'closeTime',value:string){
  setHours(all=>all.map((s,i)=>i===index?{...s,[field]:value}:s));
 }
 function saveZone(z:Zone){
  const draft=zoneDrafts[z.zone_id];
  if(!draft)return;
  const min=inputToKurus(draft.minimum),fee=inputToKurus(draft.delivery);
  if(min===null||fee===null){setError('Minimum sepet ve teslimat ücreti geçerli TL tutarı olmalı (örnek 125,50).');return}
  void save(z.name+' teslimat bölgesi',async()=>api(`/v1/restaurant/${rid}/zones/${z.zone_id}`,await token(),{
   method:'PATCH',body:JSON.stringify({enabled:draft.enabled,minBasketKurus:min,deliveryFeeKurus:fee})
  }));
 }

 return <main className="container main-section merchant-settings">
  <div className="merchant-settings-heading">
   <div>
    <Link href="/restaurant" className="merchant-settings-back"><ArrowLeft size={17}/> Sipariş operasyon merkezine dön</Link>
    <span className="overline">BİSMİL SOFRA · İŞLETME PANELİ</span>
    <h1>Restoran yönetimi</h1>
    <p>Sipariş uygunluğunu, menünüzü, çalışma saatlerinizi ve mahalle ücretlerinizi tek yerden yönetin.</p>
   </div>
   <button className="btn outline" type="button" disabled={disabled||!rid} onClick={()=>void load()}>
    <RefreshCcw size={17}/> Yenile
   </button>
  </div>

  <div className="merchant-banner"><ShieldCheck size={19}/> Bütün değişiklikler sunucuda restoran yetkileriyle doğrulanır ve işlem geçmişine kaydedilir.</div>
  {error&&<div className="notice error" role="alert"><AlertTriangle size={18}/>{error}</div>}
  {notice&&<div className="notice" role="status"><CheckCircle2 size={18}/>{notice}</div>}

  <section className="panel merchant-settings-selector">
   <label htmlFor="merchant-settings-select">Yönettiğiniz restoran</label>
   <select id="merchant-settings-select" value={rid} onChange={e=>setRid(e.target.value)} disabled={disabled}>
    {merchants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
   </select>
   {model&&!model.restaurant.active&&<span className="merchant-settings-warning">Bu restoran henüz platformda aktif değil. Sipariş alamaz.</span>}
  </section>

  {!rid?<div className="empty">Bu hesap için bir restoran tanımlanmamış.</div>:loading&&!model?
   <div className="empty" role="status">Restoran yönetim bilgileri yükleniyor…</div>:!model?
   <div className="empty">Restoran bilgileri görüntülenemedi. Bağlantıyı ve menü yönetimi yetkisini kontrol edin.</div>:<>
   <div className="merchant-settings-grid">
    <section className="panel merchant-settings-card">
     <div className="merchant-settings-title"><Settings2 size={20}/><div><h2>Sipariş alma durumu</h2><p>Açık görünmeniz, çalışma saatleri ve teslimat bölgeleri kontrolüne de bağlıdır.</p></div></div>
     {([
      {key:'is_open' as const,label:'Restoran açık',description:'İşletmenin manuel açık/kapalı anahtarı'},
      {key:'accepts_orders' as const,label:'Yeni sipariş kabul et',description:'Sipariş almayı geçici olarak durdurabilirsiniz'},
      {key:'is_busy' as const,label:'Restoran meşgul',description:'Meşgulken müşteriler yeni sipariş veremez'}
     ]).map(control=><label key={control.key} className="merchant-settings-toggle">
      <span><strong>{control.label}</strong><small>{control.description}</small></span>
      <input type="checkbox" checked={availability[control.key]} disabled={disabled||!editable}
       onChange={e=>setAvailability(cur=>({...cur,[control.key]:e.target.checked}))}/>
     </label>)}
     <button className="btn primary" type="button" disabled={disabled||!editable} onClick={()=>void save('Restoran durumu',async()=>api(
      `/v1/restaurant/${rid}/availability`,await token(),{method:'PATCH',
       body:JSON.stringify({isOpen:availability.is_open,isBusy:availability.is_busy,acceptsOrders:availability.accepts_orders})}
     ))}><Save size={17}/> Değişiklikleri kaydet</button>
     {!editable&&<p className="muted">Bu bölüm yalnızca restoran sahibi veya yöneticisi tarafından değiştirilebilir.</p>}
    </section>

    <section className="panel merchant-settings-card">
     <div className="merchant-settings-title"><Clock3 size={20}/><div><h2>Haftalık çalışma saatleri</h2><p>Gece yarısını aşan saatleri destekler. En fazla üç aralık/gün.</p></div></div>
     <div className="merchant-hours-list">
      {WEEKDAY_NAMES.map((day,index)=>{
       const daySlots=hours.map((slot,i)=>({...slot,index:i})).filter(s=>s.dayOfWeek===index);
       return <div className="merchant-day" key={day}>
        <div className="merchant-day-head"><strong>{day}</strong>
         <button type="button" className="merchant-mini-button" disabled={disabled||!editable||daySlots.length>=3||hours.length>=21}
          onClick={()=>setHours(all=>[...all,newTimeSlot(index)])}>+ Saat ekle</button></div>
        {daySlots.length===0?<span className="muted">Kapalı</span>:daySlots.map(slot=>
         <div className="merchant-hour-row" key={slot.index}>
          <label>Başlangıç <input type="time" value={slot.openTime} step={60} disabled={disabled||!editable}
            onChange={e=>updateHour(slot.index,'openTime',e.target.value)}/></label>
          <label>Bitiş <input type="time" value={slot.closeTime} step={60} disabled={disabled||!editable}
            onChange={e=>updateHour(slot.index,'closeTime',e.target.value)}/></label>
          <button className="merchant-mini-button" type="button" aria-label={day+' çalışma aralığını sil'}
           disabled={disabled||!editable} onClick={()=>setHours(all=>all.filter((_,i)=>i!==slot.index))}>Sil</button>
         </div>)}
       </div>;
      })}
     </div>
     <button className="btn primary" type="button" disabled={disabled||!editable} onClick={()=>void save('Çalışma saatleri',async()=>api(
      `/v1/restaurant/${rid}/hours`,await token(),{method:'PUT',body:JSON.stringify({slots:hours})}
     ))}><Save size={17}/> Haftalık saatleri kaydet</button>
     <p className="muted">Tüm günleri boş bırakırsanız restoran çalışma saatleri dışında sayılır. Güncellemeler canlı sipariş uygunluğunu etkiler.</p>
    </section>
   </div>

   <MenuEditor key={rid} restaurantId={rid} products={model.products} categories={model.categories}
    token={token} onRefresh={()=>load(true)} disabled={disabled} canEdit={model.permissions.canManageMenu}/>

   <section className="panel merchant-settings-section">
    <div className="merchant-settings-title"><MapPin size={21}/><div><h2>Teslimat mahalleleri</h2><p>Yalnızca restorana daha önce tanımlanmış bölgeler yönetilebilir.</p></div></div>
    <div className="merchant-zone-grid">
     {model.zones.map(z=>{
      const draft=zoneDrafts[z.zone_id];
      if(!draft)return null;
      return <article key={z.zone_id} className="merchant-zone-card">
       <div className="merchant-zone-heading"><h3>{z.name}</h3>
        <label><input type="checkbox" checked={draft.enabled} disabled={disabled||!editable}
         onChange={e=>updateZone(z.zone_id,{enabled:e.target.checked})}/> Teslimata açık</label>
       </div>
       <div className="merchant-zone-inputs">
        <label>Minimum sepet (TL)
         <input inputMode="decimal" type="text" value={draft.minimum} disabled={disabled||!editable}
          onChange={e=>updateZone(z.zone_id,{minimum:e.target.value})} placeholder="150,00"/></label>
        <label>Teslimat ücreti (TL)
         <input inputMode="decimal" type="text" value={draft.delivery} disabled={disabled||!editable}
          onChange={e=>updateZone(z.zone_id,{delivery:e.target.value})} placeholder="20,00"/></label>
       </div>
       <button className="btn outline" type="button" disabled={disabled||!editable}
        onClick={()=>saveZone(z)}><Save size={16}/> Mahalleyi kaydet</button>
      </article>;
     })}
     {model.zones.length===0&&<div className="empty">Henüz teslimat mahallesi tanımlanmamış. Platform yöneticisiyle iletişime geçin.</div>}
    </div>
    <p className="muted">Ücretler kuruş olarak kaydedilir. Müşteri siparişi son onay sırasında sunucudan tekrar hesaplanır; fiyat değişmişse yeniden onay istenir.</p>
   </section>
  </>}
 </main>;
}
