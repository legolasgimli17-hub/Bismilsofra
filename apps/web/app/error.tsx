'use client';
import Link from 'next/link';
import {AlertTriangle,House,RotateCcw} from 'lucide-react';
/** Never display raw exception text or internal trace identifiers to customers. */
export default function RouteError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <section className="container main-section recovery-wrap" role="alert" aria-labelledby="route-error-title">
  <div className="recovery-panel"><AlertTriangle className="recovery-icon" size={35} aria-hidden="true"/>
   <span className="overline">BİSMİL SOFRA</span>
   <h1 id="route-error-title">Bir şeyler ters gitti</h1>
   <p>Sayfayı şu an gösteremiyoruz. Sipariş gönderdiysen tekrar göndermeden önce Siparişlerim bölümünden kontrol et.</p>
   <div className="recovery-actions"><button className="btn primary" type="button" onClick={reset}><RotateCcw size={17}/> Yeniden dene</button>
    <Link href="/orders" className="btn outline">Siparişlerim</Link>
    <Link href="/" className="recovery-link"><House size={16}/> Ana sayfaya dön</Link></div>
  </div>
 </section>;
}
