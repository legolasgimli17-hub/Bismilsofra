'use client';
import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api';
import {AlertTriangle,CheckCircle2,Search,ShieldAlert} from 'lucide-react';
type User={id:string;email:string;enabled:boolean;is_admin:boolean};
const reasonOptions=[
 {value:'abuse',label:'Hesap kötüye kullanımı'},
 {value:'suspicious_activity',label:'Şüpheli etkinlik'},
 {value:'support_request',label:'Destek talebi'},
 {value:'appeal',label:'İtiraz sonrası yeniden açma'},
 {value:'other',label:'Diğer'}
] as const;
export default function UserAccessOperations({token}:{token:()=>Promise<string>}){
 const [email,setEmail]=useState('');
 const [record,setRecord]=useState<User|null>(null);
 const [reasonCode,setReasonCode]=useState<(typeof reasonOptions)[number]['value']>('suspicious_activity');
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 async function lookup(e?:FormEvent){
  e?.preventDefault();
  if(loading||busy)return;
  setLoading(true);setError('');setSuccess('');setRecord(null);
  try{
   const result=await api<{users:User[]}>(`/v1/admin/users?email=${encodeURIComponent(email.trim())}`,await token());
   if(result.users.length!==1){setError('Bu e-postayla doğrulanmış tek bir hesap bulunamadı.');return}
   setRecord(result.users[0]);
  }catch(e){setError(e instanceof Error?e.message:'Kullanıcı aranamadı.')}
  finally{setLoading(false)}
 }
 async function toggle(){
  if(!record||busy)return;
  const next=!record.enabled;
  const verb=next?'yeniden etkinleştirmek':'kısıtlamak';
  if(!window.confirm(`${record.email} hesabını ${verb} istiyor musunuz? İşlem denetim kayıtlarına yazılır.`))return;
  setBusy(true);setError('');setSuccess('');
  try{
   await api(`/v1/admin/users/${record.id}/access`,await token(),{
    method:'POST',body:JSON.stringify({enabled:next,expectedEnabled:record.enabled,reasonCode})
   });
   setRecord({...record,enabled:next});
   setSuccess('Hesap durumu kaydedildi. Kritik erişim değişikliği denetim kaydına işlendi.');
  }catch(e){setError(e instanceof Error?e.message:'İşlem başarısız. Güncel durumu yeniden arayın.')}
  finally{setBusy(false)}
 }
 return <section className="panel admin-user-operations" aria-label="Hesap erişim yönetimi">
  <header><h2><ShieldAlert size={21}/> Kullanıcı erişim yönetimi</h2>
   <p className="muted">Yalnızca tam e-posta eşleşmesiyle arayın; toplu müşteri listesi görüntülenmez. İşlem için son 10 dakika MFA gerekir.</p></header>
  <form className="admin-user-form" onSubmit={e=>void lookup(e)}>
   <label>Kayıtlı e-posta<input value={email} type="email" required disabled={busy||loading}
    onChange={e=>{setEmail(e.target.value);setRecord(null);setSuccess('');setError('')}} placeholder="kullanici@example.com"/></label>
   <button type="submit" className="btn outline" disabled={busy||loading}><Search size={16}/>{loading?'Aranıyor…':'Hesabı bul'}</button>
  </form>
  {error&&<p className="notice error" role="alert"><AlertTriangle size={17}/>{error}</p>}
  {success&&<p className="notice" role="status"><CheckCircle2 size={17}/>{success}</p>}
  {record&&<div className="admin-user-result">
   <div><strong>{record.email}</strong><small>{record.is_admin?'Platform yöneticisi · ':''}{record.enabled?'Hesap aktif':'Hesap kısıtlanmış'}</small>
    <small>Kimlik: <code>{record.id.slice(0,8)}</code></small></div>
   <label>İşlem nedeni<select value={reasonCode} disabled={busy||loading}
    onChange={e=>setReasonCode(e.target.value as (typeof reasonOptions)[number]['value'])}>
    {reasonOptions.map(r=><option value={r.value} key={r.value}>{r.label}</option>)}
   </select></label>
   <button type="button" className={`btn ${record.enabled?'outline team-remove':'primary'}`}
    disabled={busy||loading} onClick={()=>void toggle()}>
    {record.enabled?'Hesabı kısıtla':'Hesabı yeniden etkinleştir'}
   </button>
  </div>}
  <p className="muted">Kendi hesabınızı ve aktif bir restoranın tek sahibini yanlışlıkla kapatamazsınız. Bu işlem kimlik sağlayıcısındaki oturumları otomatik sonlandırmaz; canlıda sağlayıcı oturum iptali ayrıca gerekir.</p>
 </section>;
}
