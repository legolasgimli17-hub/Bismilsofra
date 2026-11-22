export default function Loading(){
 return <section className="container main-section" role="status" aria-live="polite" aria-label="Sayfa yükleniyor">
  <div className="premium-skeleton-grid">{Array.from({length:3},(_,i)=><div key={i} className="premium-skeleton" aria-hidden="true"/>)}</div>
  <p className="recovery-loading-label">Sayfa yükleniyor…</p>
 </section>;
}
