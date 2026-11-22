'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAuth0} from '@auth0/auth0-react';
import {authReady} from './providers';
import type {Workspace} from '@/lib/workspace-access';
import {ChefHat,LayoutDashboard,ClipboardList,UtensilsCrossed,Settings2,UsersRound,ChartColumnIncreasing,LifeBuoy,ShieldCheck,Store,LogOut,ArrowLeft,AlertTriangle,Monitor,ChevronRight} from 'lucide-react';

const merchantLinks=[
 {href:'/restaurant/overview',label:'Genel bakış',Icon:LayoutDashboard},
 {href:'/restaurant',label:'Sipariş merkezi',Icon:ClipboardList},
 {href:'/restaurant/manage',label:'Menü ve işletme',Icon:UtensilsCrossed},
 {href:'/restaurant/manage#merchant-hours',label:'Çalışma saatleri',Icon:Settings2},
 {href:'/restaurant/manage#merchant-zones',label:'Teslimat bölgeleri',Icon:Store},
 {href:'/restaurant/manage#merchant-reports',label:'Satış raporları',Icon:ChartColumnIncreasing},
 {href:'/restaurant/manage#merchant-team',label:'Ekip ve yetkiler',Icon:UsersRound}
];
const adminLinks=[
 {href:'/admin/overview',label:'Kontrol paneli',Icon:LayoutDashboard},
 {href:'/admin',label:'Operasyon merkezi',Icon:Monitor},
 {href:'/admin#admin-onboarding',label:'Restoran kurulumları',Icon:Store},
 {href:'/admin#admin-reports',label:'Platform raporları',Icon:ChartColumnIncreasing},
 {href:'/admin#admin-users',label:'Kullanıcı yetkileri',Icon:UsersRound},
 {href:'/admin#admin-orders',label:'Sipariş inceleme',Icon:ClipboardList},
 {href:'/admin#admin-support',label:'Destek talepleri',Icon:LifeBuoy},
 {href:'/admin#admin-workers',label:'Sistem ve bildirim',Icon:AlertTriangle}
];
function PortalSession({compact=false}:{compact?:boolean}){
 const {isAuthenticated,logout,user}=useAuth0();
 if(!isAuthenticated)return null;
 return <div className={'portal-user-panel '+(compact?'portal-mobile-session':'')}>
  <div className="portal-user-avatar" aria-hidden="true">{(user?.name||user?.email||'H').slice(0,1).toUpperCase()}</div>
  <div className="portal-user-meta"><strong>{user?.name||'Yetkili hesap'}</strong><small>Doğrulanmış oturum</small></div>
  <button className="portal-logout" type="button" aria-label="Oturumu kapat" title="Oturumu kapat"
    onClick={()=>logout({logoutParams:{returnTo:window.location.origin+'/panel'}})}><LogOut size={18}/></button>
 </div>;
}
export default function OperationsShell({role,children}:{role:Exclude<Workspace,'customer'>;children:React.ReactNode}){
 const pathname=usePathname(),merchant=role==='merchant';
 const nav=merchant?merchantLinks:adminLinks;
 return <div className={'portal-root '+(merchant?'portal-merchant':'portal-admin')}>
  <a href="#main-content" className="skip-link">İçeriğe geç</a>
  <aside className="portal-sidebar" aria-label={merchant?'İşletme gezinmesi':'Platform yönetim gezinmesi'}>
   <Link href={merchant?'/restaurant/overview':'/admin/overview'} className="portal-brand">
    <span className="portal-brand-symbol"><ChefHat size={23}/></span>
    <span>Bismil <strong>Sofra</strong><small>{merchant?'İŞLETME MERKEZİ':'PLATFORM YÖNETİMİ'}</small></span>
   </Link>
   <div className="portal-sidebar-caption">{merchant?'RESTORAN OPERASYONLARI':'PLATFORM OPERASYONLARI'}</div>
   <nav className="portal-sidebar-nav" aria-label="Çalışma alanı menüsü">
    {nav.map(({href,label,Icon})=>{
     const path=href.split('#')[0];
     const active=pathname===path&&!href.includes('#');
     return <Link key={href} className={'portal-nav-link '+(active?'is-active':'')} href={href}
      aria-current={active?'page':undefined}>
      <Icon size={19} strokeWidth={active?2.5:1.9}/><span>{label}</span><ChevronRight className="portal-nav-chevron" size={15}/></Link>;
    })}
   </nav>
   <div className="portal-sidebar-bottom">
    <div className="portal-safe-note"><ShieldCheck size={18}/><span>Rol ve erişim kontrolleri sunucuda yapılır. Pilot henüz gerçek siparişe açık değildir.</span></div>
    {authReady&&<PortalSession/>}
    <Link className="portal-customer-link" href="/"><ArrowLeft size={17}/> Müşteri sitesine dön</Link>
   </div>
  </aside>
  <div className="portal-main-column">
   <header className="portal-topbar">
    <div className="portal-topbar-label"><Store size={18}/><span>{merchant?'Restoran iş ortağı paneli':'Platform yönetici paneli'}</span></div>
    <div className="portal-topbar-side"><span className="portal-stage-indicator"><span/> Pilot hazırlık</span><Link href="/panel" className="portal-topbar-switch">Panel seçimi</Link>{authReady&&<PortalSession compact/>}</div>
   </header>
   <main id="main-content" className="portal-main" tabIndex={-1}>{children}</main>
   <footer className="portal-footer">© Bismil Sofra · {merchant?'Restoran iş ortağı':'Platform yönetimi'} · Üretim siparişleri henüz açılmadı</footer>
  </div>
 </div>;
}
