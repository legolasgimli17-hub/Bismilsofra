import Link from 'next/link';
import type {Metadata} from 'next';
import {ArrowRight,ChefHat,ClipboardList,ShieldCheck,Store,ArrowLeft,LockKeyhole} from 'lucide-react';
export const metadata:Metadata={title:'İşletme ve yönetici girişi | Bismil Sofra',description:'Bismil Sofra restoran iş ortakları ve platform yöneticileri için ayrılmış çalışma alanları.'};
export default function PanelGateway(){
 return <section className="container portal-gateway">
  <Link className="portal-gateway-back" href="/"><ArrowLeft size={17}/> Yemek keşfine dön</Link>
  <div className="portal-gateway-intro"><span className="portal-gateway-icon"><ChefHat size={28}/></span>
   <span className="overline">BİSMİL SOFRA · İŞ ORTAKLARI</span>
   <h1>Herkes için doğru çalışma alanı.</h1>
   <p>Müşteri alışverişi, restoran sipariş yönetimi ve platform operasyonları birbirinden ayrı tutulur. Yetkiler hesapla birlikte sunucudan doğrulanır.</p>
  </div>
  <div className="portal-gateway-grid">
   <article className="portal-gateway-card"><span className="portal-gateway-card-icon"><Store size={28}/></span>
    <span className="portal-gateway-eyebrow">RESTORAN SAHİBİ VE ÇALIŞANI</span>
    <h2>İşletme paneli</h2><p>Gelen siparişleri karşıla, menü ve fiyatları güncelle, çalışma saatlerini ayarla, raporları ve personel yetkilerini takip et.</p>
    <div className="portal-feature-list"><span><ClipboardList size={16}/> Canlı sipariş merkezi</span><span><ShieldCheck size={16}/> İşletmeye özel erişim</span></div>
    <Link href="/restaurant/overview" className="btn primary">İşletme paneline gir <ArrowRight size={18}/></Link>
   </article>
   <article className="portal-gateway-card portal-gateway-admin"><span className="portal-gateway-card-icon"><LockKeyhole size={28}/></span>
    <span className="portal-gateway-eyebrow">PLATFORM YÖNETİCİSİ</span>
    <h2>Yönetim merkezi</h2><p>Restoranları güvenle sisteme ekle, aktivasyon kontrollerini yönet, bildirim sorunlarını ve destek operasyonlarını incele.</p>
    <div className="portal-feature-list"><span><ShieldCheck size={16}/> Yönetici yetkisi + MFA</span><span><ClipboardList size={16}/> Operasyon ve denetim</span></div>
    <Link href="/admin/overview" className="btn outline">Yönetici alanına gir <ArrowRight size={18}/></Link>
   </article>
  </div>
  <p className="portal-gateway-disclaimer">Bu ekran bir giriş yönlendiricisidir; butonlar hesap yetkisi vermez. Sisteme kayıtlı olmayan kişi işletme veya platform verilerine ulaşamaz.</p>
 </section>;
}
