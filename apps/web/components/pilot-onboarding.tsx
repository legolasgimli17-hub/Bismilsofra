'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';
import {inputToKurus} from '@/lib/merchant-settings';
import {Building2,CheckCircle2,MapPinned,Plus,RefreshCw,ShieldCheck} from 'lucide-react';

type PilotRestaurant={
 id:string;name:string;slug:string;phone:string|null;active:boolean;
 is_open:boolean;accepts_orders:boolean;active_slot:number|null;
 has_owner:boolean;has_menu:boolean;has_hours:boolean;has_delivery:boolean
};
type Zone={id:string;name:string};
const ready=(r:PilotRestaurant)=>r.has_owner&&r.has_menu&&r.has_hours&&r.has_delivery;
const slugify=(s:string)=>s.toLocaleLowerCase('tr-TR')
 .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
 .replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]+/g,'-')
 .replace(/^-|-$/g,'').slice(0,70);

export default function PilotOnboarding({token}:{token:()=>Promise<string>}){
 const [records,setRecords]=useState<PilotRestaurant[]>([]);
 const [zones,setZones]=useState<Zone[]>([]);
 const [selectedId,setSelectedId]=useState('');
 const [draftName,setDraftName]=useState(''),[draftSlug,setDraftSlug]=useState(''),[draftPhone,setDraftPhone]=useState('');
 const [ownerEmail,setOwnerEmail]=useState('');
 const [newZoneName,setNewZoneName]=useState('');
 const [zoneId,setZoneId]=useState('');
 const [minimum,setMinimum]=useState(''),[fee,setFee]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 const selected=records.find(r=>r.id===selectedId);

 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const auth=await token();
   const [result,zoneResult]=await Promise.all([
    api<{restaurants:PilotRestaurant[]}>('/v1/admin/restaurants',auth),
    api<{zones:Zone[]}>('/v1/zones',auth)
   ]);
   setRecords(result.restaurants);
   setZones(zoneResult.zones);
   setSelectedId(id=>result.restaurants.some(r=>r.id===id)?id:result.restaurants[0]?.id||'');
   setZoneId(id=>zoneResult.zones.some(z=>z.id===id)?id:zoneResult.zones[0]?.id||'');
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Restoranlar yüklenemedi.')}
  finally{setLoading(false)}
 },[token]);
 useEffect(()=>{void load()},[load]);

 async function mutate(fn:(access:string)=>Promise<void>,message:string){
  if(busy)return;
  setBusy(true);setError('');setSuccess('');
  try{await fn(await token());await load();setSuccess(message)}
  catch(e){setError(e instanceof Error?e.message:'İşlem gerçekleştirilemedi.')}
  finally{setBusy(false)}
 }
 const submitDraft=(e:FormEvent)=>{
  e.preventDefault();
  void mutate(async auth=>{
   const result=await api<{restaurant:PilotRestaurant}>('/v1/admin/restaurants',auth,{
    method:'POST',body:JSON.stringify({name:draftName,slug:draftSlug,phone:draftPhone.trim()})
   });
   setSelectedId(result.restaurant.id);setDraftName('');setDraftSlug('');setDraftPhone('');
  },'Kapalı restoran taslağı oluşturuldu. Bir sonraki adım: sahibi ve mahalleyi bağlayın.');
 };
 const assignOwner=(e:FormEvent)=>{
  e.preventDefault();if(!selected)return;
  void mutate(async auth=>{
   await api('/v1/admin/restaurants/'+selected.id+'/owner',auth,{
    method:'POST',body:JSON.stringify({email:ownerEmail})
   });setOwnerEmail('');
  },'İşletme sahibi doğrulanmış hesabıyla bağlandı.');
 };
 const createZone=(e:FormEvent)=>{
  e.preventDefault();
  void mutate(async auth=>{
   const result=await api<{zone:Zone}>('/v1/admin/zones',auth,{
    method:'POST',body:JSON.stringify({name:newZoneName})
   });
   setZoneId(result.zone.id);setNewZoneName('');
  },'Yeni teslimat mahallesi sisteme eklendi.');
 };
 const linkZone=(e:FormEvent)=>{
  e.preventDefault();if(!selected)return;
  const min=inputToKurus(minimum),delivery=inputToKurus(fee);
  if(min===null||delivery===null){setError('Minimum sepet ve teslimat ücreti TL olarak doğru girilmeli.');return}
  void mutate(async auth=>{
   await api('/v1/admin/restaurants/'+selected.id+'/zones',auth,{
    method:'POST',body:JSON.stringify({zoneId,enabled:true,minBasketKurus:min,deliveryFeeKurus:delivery})
   });
  },'Teslimat bölgesi, minimum sepet ve ücret ayarları kaydedildi.');
 };
 async function activate(next:boolean){
  if(!selected)return;
  if(next&&!ready(selected)){setError('Önce sahip, ürün, çalışma saatleri ve mahalle hazırlanmalı.');return}
  if(!window.confirm(next?'Restoranı müşterilerin görebileceği şekilde etkinleştirmek istiyor musunuz?':'Restoranı pasifleştirmek istiyor musunuz?'))return;
  await mutate(async auth=>{
   await api('/v1/admin/restaurants/'+selected.id+'/activation',auth,{
    method:'POST',body:JSON.stringify({active:next})
   });
  },next?'Restoran aktif edildi; sipariş almak için işletme ayrıca açık/sipariş kabul ediyor ayarlarını açmalıdır.':'Restoran pasifleştirildi.');
 }
 return <section className="panel pilot-onboarding" aria-label="Pilot restoran kurulumu">
  <div className="pilot-heading">
   <div><span className="overline">ŞARTNAME • 5 RESTORAN PİLOTU</span>
    <h2><Building2 size={23}/> Restoran kurulum merkezi</h2>
    <p className="muted">Taslak oluştur → doğrulanmış sahibi bağla → teslimat mahallelerini ayarla → işletme menü ve saatleri hazırlasın → etkinleştir.</p>
   </div>
   <button className="btn outline" type="button" disabled={busy||loading} onClick={()=>void load()}>
    <RefreshCw size={17}/>{loading?'Yükleniyor…':'Yenile'}
   </button>
  </div>
  {error&&<div role="alert" className="notice error">{error}</div>}
  {success&&<div role="status" className="notice pilot-success"><CheckCircle2 size={18}/>{success}</div>}
  <form className="pilot-form" onSubmit={submitDraft}>
   <h3><Plus size={18}/> Yeni restoran taslağı</h3>
   <div className="pilot-fields">
    <label>Restoranın adı<input required minLength={2} maxLength={120} value={draftName}
     onChange={e=>{setDraftName(e.target.value);setDraftSlug(slugify(e.target.value))}} placeholder="İşletmenin gerçek adı"/></label>
    <label>Bağlantı adı (slug)<input required minLength={3} maxLength={70} pattern="[a-z0-9]+(-[a-z0-9]+)*"
     value={draftSlug} onChange={e=>setDraftSlug(e.target.value)} placeholder="restoran-adi"/></label>
    <label>İşletme telefonu (isteğe bağlı)<input inputMode="tel" value={draftPhone}
     onChange={e=>setDraftPhone(e.target.value)} placeholder="05XXXXXXXXX"/></label>
   </div>
   <button className="btn primary" type="submit" disabled={busy||loading||!draftName||!draftSlug}>
    <Plus size={16}/> Kapalı taslak oluştur
   </button>
   <small className="muted">Yeni restoran müşterilere görünmez ve otomatik sipariş kabul etmez. Gerçek restoran adı ve yetki alınmadan demo hesabı açmayın.</small>
  </form>
  <div className="pilot-select">
   <label htmlFor="pilot-restaurant-select">Kurulumu yapılan restoran
    <select id="pilot-restaurant-select" value={selectedId}
     onChange={e=>setSelectedId(e.target.value)} disabled={busy||loading}>
     {records.length===0&&<option value="">Henüz restoran eklenmedi</option>}
     {records.map(r=><option key={r.id} value={r.id}>{r.name} · {r.active?'Aktif':'Taslak'}</option>)}
    </select>
   </label>
   <small className="muted">{records.filter(r=>r.active).length} aktif restoran (bu listede) · en fazla 50 aktif restoran</small>
  </div>
  {selected&&<>
   <div className="pilot-readiness" aria-label="Restoran kurulum kontrol listesi">
    {([{label:'Doğrulanmış sahip',pass:selected.has_owner},
      {label:'Teslimat mahallesi',pass:selected.has_delivery},
      {label:'Çalışma saatleri',pass:selected.has_hours},
      {label:'Satıştaki ürün',pass:selected.has_menu}] as const)
      .map(item=><span className={item.pass?'pilot-check yes':'pilot-check no'} key={item.label}>
       {item.pass?<CheckCircle2 size={16}/>:<span aria-hidden="true">○</span>} {item.label}
      </span>)}
   </div>
   <div className="pilot-setup-grid">
    <form onSubmit={assignOwner} className="pilot-form">
     <h3><ShieldCheck size={18}/> İşletme sahibini bağla</h3>
     <p className="muted">Sahip, e-postası doğrulanmış hesabıyla en az bir kez giriş yapmış olmalı. MFA işletme panelinde ayrıca zorunludur.</p>
     <label>Sahibin kayıtlı e-postası<input required type="email" value={ownerEmail}
      onChange={e=>setOwnerEmail(e.target.value)} placeholder="isletme@example.com"/></label>
     <button className="btn outline" type="submit" disabled={busy||selected.has_owner}>Sahibi bağla</button>
    </form>
    <div className="pilot-form">
     <h3><MapPinned size={18}/> Mahalle ve teslimat</h3>
     <form onSubmit={createZone} className="pilot-mini-form">
      <label>Listede olmayan mahalle/site<input value={newZoneName} minLength={2} maxLength={110}
       onChange={e=>setNewZoneName(e.target.value)} placeholder="Mahalle adı"/></label>
      <button className="btn outline" disabled={busy||!newZoneName.trim()} type="submit">Mahalle ekle</button>
     </form>
     <form onSubmit={linkZone} className="pilot-mini-form">
      <label>Teslimat mahallesi<select required value={zoneId} onChange={e=>setZoneId(e.target.value)}>
       {zones.map(z=><option value={z.id} key={z.id}>{z.name}</option>)}</select></label>
      <div className="pilot-money">
       <label>Minimum sepet (TL)<input required inputMode="decimal" placeholder="Gerçek tutar" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
       <label>Teslimat ücreti (TL)<input required inputMode="decimal" placeholder="Gerçek tutar" value={fee} onChange={e=>setFee(e.target.value)}/></label>
      </div>
      <button className="btn outline" disabled={busy||!zoneId} type="submit">Mahalleyi bağla / güncelle</button>
     </form>
    </div>
   </div>
   <div className="pilot-activation">
    <div><strong>İşletmenin menüsü ve saatleri</strong>
     <p className="muted">Sahip, kendi MFA korumalı hesabıyla <Link href="/restaurant/manage">restoran yönetimi</Link> ekranından kategori, ürün, fiyat ve çalışma saatlerini tamamlar. Yönetici kontrol listesini yeniler.</p>
     <small>Aktivasyon tek başına restoranı açık duruma getirmez; işletme ayrıca sipariş kabulünü etkinleştirir.</small>
    </div>
    <button className={`btn ${selected.active?'outline':'primary'}`} type="button"
     disabled={busy||loading||(!selected.active&&!ready(selected))} onClick={()=>void activate(!selected.active)}>
     {selected.active?'Restoranı pasifleştir':'Hazır restoranı aktifleştir'}
    </button>
   </div>
  </>}
 </section>;
}
