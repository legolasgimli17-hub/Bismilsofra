'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {api} from '@/lib/api';
import {type Address,type Zone} from '@/lib/types';
import {MapPin,MapPinned,Pencil,Trash2,Plus,Save,RefreshCw,AlertTriangle,CheckCircle2} from 'lucide-react';

type Draft={zoneId:string;label:string;fullAddress:string;directions:string;phone:string};
const empty:Draft={zoneId:'',label:'Ev',fullAddress:'',directions:'',phone:''};
const draftOf=(a:Address):Draft=>({
 zoneId:a.zone_id,label:a.label,fullAddress:a.full_address,
 directions:a.directions||'',phone:a.phone
});

export default function CustomerAddressBook({token}:{token:()=>Promise<string>}){
 const [addresses,setAddresses]=useState<Address[]>([]);
 const [zones,setZones]=useState<Zone[]>([]);
 const [editing,setEditing]=useState<string|null>(null);
 const [draft,setDraft]=useState<Draft>(empty);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const auth=await token();
   const [r,z]=await Promise.all([
    api<{addresses:Address[]}>('/v1/me/addresses',auth),
    api<{zones:Zone[]}>('/v1/zones')
   ]);
   setAddresses(r.addresses);setZones(z.zones);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Adresler yüklenemedi.')}
  finally{setLoading(false)}
 },[token]);
 useEffect(()=>{void load()},[load]);
 const update=(key:keyof Draft,value:string)=>setDraft(d=>({...d,[key]:value}));
 const openEdit=(a:Address)=>{setEditing(a.id);setDraft(draftOf(a));setError('');setMessage('')};
 const openAdd=()=>{setEditing('new');setDraft({...empty,zoneId:zones[0]?.id||''});setError('');setMessage('')};
 const cancel=()=>{setEditing(null);setError('')};
 async function save(e:FormEvent){
  e.preventDefault();if(!editing||busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const path=editing==='new'?'/v1/me/addresses':'/v1/me/addresses/'+editing;
   await api(path,await token(),{
    method:editing==='new'?'POST':'PATCH',
    body:JSON.stringify(draft)
   });
   setEditing(null);await load();
   setMessage('Adres kaydedildi. Güncel siparişlerde yeni bilgiler kullanılacak.');
  }catch(e){setError(e instanceof Error?e.message:'Adres kaydedilemedi.')}
  finally{setBusy(false)}
 }
 async function archive(a:Address){
  if(busy)return;
  if(!window.confirm(`"${a.label}" adresini kayıtlı adreslerinden kaldırmak istiyor musun? Eski siparişlerin değişmeyecek.`))return;
  setBusy(true);setError('');setMessage('');
  try{
   await api('/v1/me/addresses/'+a.id+'/archive',await token(),{method:'POST'});
   if(editing===a.id)setEditing(null);
   await load();
   setMessage('Adres kayıtlı adreslerinden kaldırıldı. Eski siparişlerin adres geçmişi korunur.');
  }catch(e){setError(e instanceof Error?e.message:'Adres kaldırılamadı.')}
  finally{setBusy(false)}
 }
 return <section className="panel customer-address-book" aria-label="Kayıtlı teslimat adreslerim">
  <div className="address-book-head"><div>
   <h2><MapPinned size={22}/> Adreslerim</h2>
   <p className="muted">Sipariş verirken kullandığın adresleri düzenle ve artık kullanmadıklarını kaldır.</p>
  </div><div className="address-book-toolbar">
   <button className="btn outline" type="button" disabled={busy||loading} onClick={()=>void load()}>
    <RefreshCw size={16}/>{loading?'Yükleniyor…':'Yenile'}</button>
   <button className="btn primary" type="button" disabled={busy||loading||addresses.length>=30} onClick={openAdd}>
    <Plus size={16}/> Yeni adres</button>
  </div></div>
  {error&&<p className="notice error" role="alert"><AlertTriangle size={16}/>{error}</p>}
  {message&&<p className="notice" role="status"><CheckCircle2 size={16}/>{message}</p>}
  {!loading&&addresses.length===0&&<div className="empty"><MapPin size={28}/><p>Henüz kayıtlı teslimat adresin yok.</p></div>}
  <div className="address-book-list">{addresses.map(a=><article key={a.id} className="address-book-item">
   <div><strong><MapPin size={16}/>{a.label}</strong>
    <span>{zones.find(z=>z.id===a.zone_id)?.name||'Mahalle'}</span>
    <p>{a.full_address}</p>
    {a.directions&&<small>Adres tarifi: {a.directions}</small>}
    <small>Telefon: {a.phone}</small>
   </div>
   <div className="address-book-actions">
    <button className="btn outline" type="button" disabled={busy||loading}
     onClick={()=>openEdit(a)}><Pencil size={16}/> Düzenle</button>
    <button className="btn outline address-book-delete" type="button" disabled={busy||loading}
     onClick={()=>void archive(a)}><Trash2 size={16}/> Kaldır</button>
   </div>
  </article>)}</div>
  {editing&&<form className="address-book-form" onSubmit={e=>void save(e)}>
   <h3>{editing==='new'?'Yeni teslimat adresi':'Adresi düzenle'}</h3>
   <div className="address-book-input-grid">
    <label>Mahalle<select required value={draft.zoneId} onChange={e=>update('zoneId',e.target.value)}>
     <option value="">Mahalle seç</option>
     {zones.map(z=><option value={z.id} key={z.id}>{z.name}</option>)}
    </select></label>
    <label>Adres başlığı<input maxLength={45} required value={draft.label}
     onChange={e=>update('label',e.target.value)} placeholder="Ev, İş"/></label>
    <label>Telefon<input type="tel" inputMode="tel" pattern="05[0-9]{9}" maxLength={11}
     required value={draft.phone} onChange={e=>update('phone',e.target.value)} placeholder="05XXXXXXXXX"/></label>
   </div>
   <label>Adres detayları<textarea minLength={8} maxLength={900} required rows={3}
    value={draft.fullAddress} onChange={e=>update('fullAddress',e.target.value)}
    placeholder="Sokak, bina, kat, daire numarası"/></label>
   <label>Adres tarifi (isteğe bağlı)<textarea maxLength={400} rows={2}
    value={draft.directions} onChange={e=>update('directions',e.target.value)}
    placeholder="Kapı, giriş veya teslimat tarifi"/></label>
   <div className="address-book-actions">
    <button className="btn primary" type="submit" disabled={busy||!draft.zoneId||draft.fullAddress.trim().length<8||!/^05\d{9}$/.test(draft.phone)}>
     <Save size={17}/>{busy?'Kaydediliyor…':'Adresi kaydet'}</button>
    <button className="btn outline" type="button" disabled={busy} onClick={cancel}>Vazgeç</button>
   </div>
  </form>}
  <p className="muted address-book-note">Kaldırılan adresle yeni sipariş oluşturulamaz. Önceki siparişlerde kaydedilmiş teslimat adresi, sipariş geçmişinin doğruluğu için değişmez.</p>
 </section>;
}
