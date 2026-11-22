'use client';
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {useAuth0} from '@auth0/auth0-react';
import Link from 'next/link';
import AuthGate from './auth-gate';
import {api,ApiError} from '@/lib/api';
import {canEnterMerchantPortal,type Workspace} from '@/lib/workspace-access';
import {AlertCircle,RefreshCw,ShieldAlert} from 'lucide-react';

type ProtectedWorkspace=Exclude<Workspace,'customer'>;
type Phase='checking'|'allowed'|'denied'|'unavailable';
export default function WorkspaceAccessGate({role,children}:{role:ProtectedWorkspace;children:ReactNode}){
 return <AuthGate>{token=><ValidateAccess role={role} token={token}>{children}</ValidateAccess>}</AuthGate>;
}
function ValidateAccess({role,token,children}:{role:ProtectedWorkspace;token:()=>Promise<string>;children:ReactNode}){
 const {user}=useAuth0();
 const subject=user?.sub||'';
 const [grantedSubject,setGrantedSubject]=useState('');
 const [phase,setPhase]=useState<Phase>('checking');
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 const check=useCallback(async()=>{
  const jwt=await token();
  if(role==='merchant'){
   const result=await api<{restaurants:unknown}>('/v1/me/staff-restaurants',jwt);
   if(!canEnterMerchantPortal(result.restaurants))throw new ApiError('ROLE_FORBIDDEN','Bu hesap henüz bir restorana yetkili olarak eklenmemiş.',403);
  }else{
   // This is an MFA + platform-admin-protected endpoint. Never infer admin
   // privileges from an Auth0 ID token, email or client-side claim.
   await api('/v1/admin/alerts',jwt);
  }
 },[role,token]);
 useEffect(()=>{
  let alive=true;
  setPhase('checking');
  Promise.resolve().then(async()=>{
   try{await check();if(alive){setGrantedSubject(subject);setPhase('allowed');setError('')}}
   catch(e){
    if(!alive)return;
    const denied=e instanceof ApiError&&[401,403].includes(e.status);
    setGrantedSubject('');
    setPhase(denied?'denied':'unavailable');
    setError(e instanceof Error?e.message:'Giriş yetkisi kontrol edilemedi.');
   }
  });
  return()=>{alive=false};
 },[check,revision,subject]);
 if(phase==='allowed'&&grantedSubject===subject&&Boolean(subject))return <>{children}</>;
 const display=phase==='allowed'?'checking':phase;
 return <section className="portal-access-card" role={display==='checking'?'status':'alert'}>
  <div className="portal-access-icon">{display==='denied'?<ShieldAlert size={27}/>:<AlertCircle size={27}/>}</div>
  <h1>{display==='checking'?'Yetkileriniz doğrulanıyor':display==='denied'?'Bu çalışma alanına erişim yok':'Bağlantı doğrulanamadı'}</h1>
  <p>{display==='checking'?'Sunucu tarafında gerçek hesap ve MFA yetkisi kontrol ediliyor…':error}</p>
  {display!=='checking'&&<div className="portal-access-actions">
   <button type="button" className="btn primary" onClick={()=>{setPhase('checking');setRevision(x=>x+1)}}><RefreshCw size={17}/> Yeniden dene</button>
   <Link href="/panel" className="btn outline">Panel seçimine dön</Link>
  </div>}
  <small>İşletme ve platform yetkileri yalnızca API tarafından verilir. Farklı bir giriş bağlantısı güvenlik kontrolünü geçersiz kılamaz.</small>
 </section>;
}
