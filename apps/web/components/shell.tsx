'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {House,ShoppingBag,ClipboardList,UserRound,ChefHat,MapPin} from 'lucide-react';
import {cartCount} from '@/lib/cart';
import {workspaceForPath} from '@/lib/workspace-access';
import OperationsShell from './operations-shell';
import {useCart} from './providers';

const nav=[{href:'/',label:'Keşfet',Icon:House},{href:'/checkout',label:'Sepet',Icon:ShoppingBag},{href:'/orders',label:'Siparişlerim',Icon:ClipboardList},{href:'/account',label:'Hesabım',Icon:UserRound}];

export default function Shell({children}:{children:React.ReactNode}){
 const pathname=usePathname(),{cart}=useCart();
 const workspace=workspaceForPath(pathname);
 if(workspace!=='customer')return <OperationsShell role={workspace}>{children}</OperationsShell>;
 return <>
  <a href="#main-content" className="skip-link">Ana içeriğe geç</a>
  <header className="topbar"><div className="container header-inner">
   <Link href="/" className="wordmark"><span className="mark"><ChefHat size={22}/></span><span>Bismil <strong>Sofra</strong></span></Link>
   <span className="region"><MapPin size={16}/> Bismil, Diyarbakır</span>
   <div className="header-right"><Link href="/panel" className="small-link">İşletme girişi</Link>
    <Link href="/checkout" className="cart-button"><ShoppingBag size={18}/> Sepet {cartCount(cart)>0&&<b>{cartCount(cart)}</b>}</Link>
   </div>
  </div></header>
  <main id="main-content" tabIndex={-1}>{children}</main>
  <nav className="mobile-nav" aria-label="Alt gezinme">{nav.map(({href,label,Icon})=><Link key={href} href={href} aria-current={pathname===href?'page':undefined}>
   <Icon size={22} strokeWidth={pathname===href?2.6:1.8}/><span>{label}</span>{href==='/checkout'&&cartCount(cart)>0&&<i>{cartCount(cart)}</i>}</Link>)}</nav>
  <footer className="footer"><div className="container"><span>© Bismil Sofra · Yerel yemek sipariş platformu</span><span>Pilot hazırlık aşaması · Gerçek sipariş altyapısı henüz yayınlanmadı</span></div></footer>
 </>;
}
