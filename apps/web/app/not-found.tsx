import Link from 'next/link';
import {SearchX,House} from 'lucide-react';
export default function NotFound(){
 return <section className="container main-section recovery-wrap" aria-labelledby="not-found-title">
  <div className="recovery-panel"><SearchX className="recovery-icon" size={36} aria-hidden="true"/>
   <span className="overline">404 · SAYFA BULUNAMADI</span>
   <h1 id="not-found-title">Aradığın sayfa bulunamadı</h1>
   <p>Bağlantı değişmiş veya sayfa kaldırılmış olabilir. Restoranları yeniden keşfedebilirsin.</p>
   <div className="recovery-actions"><Link className="btn primary" href="/"><House size={17}/> Restoranları keşfet</Link>
    <Link className="btn outline" href="/checkout">Sepetime git</Link></div>
  </div>
 </section>;
}
