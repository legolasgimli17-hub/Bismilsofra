'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {api} from '@/lib/api';
import {CheckCircle2,ShieldCheck,UserPlus,Users,RefreshCcw,AlertTriangle} from 'lucide-react';

type Role='owner'|'manager'|'staff';
type Member={user_id:string;email:string;enabled:boolean;role:Role;
 can_view_orders:boolean;can_manage_orders:boolean;can_manage_menu:boolean};
type Flags={role:'staff'|'manager';can_view_orders:boolean;can_manage_orders:boolean;can_manage_menu:boolean};
const defaultStaff:Flags={role:'staff',can_view_orders:true,can_manage_orders:false,can_manage_menu:false};
const asFlags=(record:Member):Flags=>({
 role:record.role==='manager'?'manager':'staff',can_view_orders:record.can_view_orders,
 can_manage_orders:record.can_manage_orders,can_manage_menu:record.can_manage_menu
});
const toWire=(flags:Flags)=>({role:flags.role,canViewOrders:flags.can_view_orders,
 canManageOrders:flags.can_manage_orders,canManageMenu:flags.can_manage_menu});
const fullManager:Flags={role:'manager',can_view_orders:true,can_manage_orders:true,can_manage_menu:true};
const roleName:Record<Role,string>={owner:'İşletme sahibi',manager:'Yönetici',staff:'Çalışan'};

export default function TeamManagement({restaurantId,token}:{restaurantId:string;token:()=>Promise<string>}){
 const [members,setMembers]=useState<Member[]>([]);
 const [operatorRole,setOperatorRole]=useState<'owner'|'manager'|null>(null);
 const [drafts,setDrafts]=useState<Record<string,Flags>>({});
 const [email,setEmail]=useState(''),[newRole,setNewRole]=useState<'staff'|'manager'>('staff');
 const [newFlags,setNewFlags]=useState<Flags>(defaultStaff);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 const current=useRef(0);
 const load=useCallback(async()=>{
  const seq=++current.current;setLoading(true);
  try{
   const data=await api<{members:Member[];operatorRole:'owner'|'manager'}>(
    `/v1/restaurant/${restaurantId}/team`,await token());
   if(seq!==current.current)return;
   setMembers(data.members);setOperatorRole(data.operatorRole);
   setDrafts(Object.fromEntries(data.members.filter(m=>m.role!=='owner').map(m=>[m.user_id,asFlags(m)])));
   setError('');
  }catch(e){if(seq===current.current){
   setMembers([]);setOperatorRole(null);setError(e instanceof Error?e.message:'Personel listesi yüklenemedi.');
  }}finally{if(seq===current.current)setLoading(false)}
 },[restaurantId,token]);
 useEffect(()=>{void load();return()=>{current.current++}},[load]);
 async function mutate(task:(access:string)=>Promise<unknown>,message:string){
  if(busy||loading)return;setBusy(true);setError('');setSuccess('');
  try{await task(await token());await load();setSuccess(message)}
  catch(e){setError(e instanceof Error?e.message:'Personel işlemi başarısız. Listeyi yenileyin.')}
  finally{setBusy(false)}
 }
 function add(e:FormEvent){
  e.preventDefault();
  void mutate(async access=>{
   await api(`/v1/restaurant/${restaurantId}/team`,access,{
    method:'POST',body:JSON.stringify({email,...toWire(newRole==='manager'?fullManager:newFlags)})
   });
   setEmail('');
  },'Çalışan eklendi. İşletme paneline erişmek için kendi hesabında MFA tamamlamalıdır.');
 }
 function update(m:Member){
  if(m.role==='owner'||(operatorRole==='manager'&&m.role!=='staff'))return;
  const edited=drafts[m.user_id];if(!edited)return;
  void mutate(async access=>{
   await api(`/v1/restaurant/${restaurantId}/team/${m.user_id}`,access,{
    method:'PATCH',body:JSON.stringify({expected:toWire(asFlags(m)),next:toWire(edited)})
   });
  },'Personel izinleri kaydedildi ve denetim kaydına işlendi.');
 }
 function remove(m:Member){
  if(m.role==='owner'||(operatorRole==='manager'&&m.role!=='staff'))return;
  if(!window.confirm(`${m.email} kişisinin bu restoran erişimini kaldırmak istiyor musunuz?`))return;
  void mutate(async access=>{
   await api(`/v1/restaurant/${restaurantId}/team/${m.user_id}/remove`,access,{
    method:'POST',body:JSON.stringify({expected:toWire(asFlags(m))})
   });
  },'Personelin restoran erişimi kaldırıldı; geçmiş siparişler korunur.');
 }
 function setFlag(id:string,k:keyof Omit<Flags,'role'>,checked:boolean){
  setDrafts(x=>({...x,[id]:{...x[id],[k]:checked,
   ...(k==='can_view_orders'&&!checked?{can_manage_orders:false}:{})}}));
 }
 const flags=(
  value:Flags,disabled:boolean,change:(key:keyof Omit<Flags,'role'>,checked:boolean)=>void
 )=><div className="team-flags">
  {([{key:'can_view_orders',label:'Siparişleri gör'},
    {key:'can_manage_orders',label:'Sipariş durumunu değiştir'},
    {key:'can_manage_menu',label:'Menüyü düzenle'}] as const).map(item=>
   <label key={item.key}><input type="checkbox" checked={value[item.key]} disabled={disabled}
    onChange={e=>change(item.key,e.target.checked)}/>{item.label}</label>)}
 </div>;
 return <section className="panel team-management" aria-label="Restoran personel yönetimi">
  <header className="team-head">
   <div><h2><Users size={22}/> Ekip ve yetkiler</h2>
    <p className="muted">Restoran başına en fazla 25 kişi. Başka restoranların personeline veya müşteri verilerine erişim verilmez.</p></div>
   <button className="btn outline" disabled={busy||loading} onClick={()=>void load()}>
    <RefreshCcw size={17}/>{loading?'Yükleniyor…':'Yenile'}</button>
  </header>
  {error&&<p role="alert" className="notice error"><AlertTriangle size={16}/>{error}</p>}
  {success&&<p role="status" className="notice"><CheckCircle2 size={16}/>{success}</p>}
  {operatorRole&&<>
   <form className="team-add" onSubmit={add}>
    <h3><UserPlus size={18}/> Yeni ekip üyesi</h3>
    <p className="muted">Kişi önce kendi doğrulanmış e-postasıyla kayıt olmalı; bu işlem yeni hesap veya geçici parola üretmez.</p>
    <div className="team-form-row">
     <label>E-posta adresi<input type="email" required value={email} placeholder="personel@example.com"
      onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
     <label>Rol<select value={newRole} onChange={e=>{
      const role=e.target.value as 'staff'|'manager';setNewRole(role);
      if(role==='manager')setNewFlags(fullManager);
     }} disabled={busy}>
      <option value="staff">Çalışan</option>
      {operatorRole==='owner'&&<option value="manager">Yönetici</option>}
     </select></label>
    </div>
    {flags(newRole==='manager'?fullManager:newFlags,busy||newRole==='manager',(key,checked)=>{
     setNewFlags(old=>({...old,[key]:checked,...(key==='can_view_orders'&&!checked?{can_manage_orders:false}:{})}));
    })}
    <button type="submit" className="btn primary" disabled={busy||loading||!email}>
     <UserPlus size={16}/> Kişiyi ekle</button>
   </form>
   <div className="team-list">{members.map(m=>{
    const editable=m.role!=='owner'&&(operatorRole==='owner'||m.role==='staff');
    const d=drafts[m.user_id]||asFlags(m);
    return <article className="team-person" key={m.user_id}>
     <div className="team-person-title">
      <div><strong>{m.email}</strong><small>{roleName[m.role]} · {m.enabled?'Hesap aktif':'Hesap kısıtlı'}</small></div>
      {m.role==='owner'&&<span className="team-owner"><ShieldCheck size={15}/> Korunan sahip</span>}
     </div>
     {m.role!=='owner'&&<>
      <div className="team-form-row"><label>Rol<select value={d.role} disabled={!editable||busy}
       onChange={e=>setDrafts(x=>({...x,[m.user_id]:e.target.value==='manager'?fullManager:
        {...x[m.user_id],role:'staff'}}))}>
       <option value="staff">Çalışan</option>
       {operatorRole==='owner'&&<option value="manager">Yönetici</option>}
      </select></label></div>
      {flags(d,!editable||busy||d.role==='manager',(key,checked)=>setFlag(m.user_id,key,checked))}
      {editable&&<div className="team-actions">
       <button className="btn outline" type="button" disabled={busy||loading} onClick={()=>update(m)}>Yetkileri kaydet</button>
       <button className="btn outline team-remove" type="button" disabled={busy||loading} onClick={()=>remove(m)}>Erişimi kaldır</button>
      </div>}
     </>}
    </article>
   })}
   {members.length===0&&<p className="muted">Bu restorana henüz personel atanmadı.</p>}
   </div>
  </>}
 </section>;
}
