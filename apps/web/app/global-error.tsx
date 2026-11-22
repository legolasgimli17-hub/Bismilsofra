'use client';
/** This is a last-resort boundary. Root layout/CSS/providers may be unavailable. */
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <html lang="tr"><body style={{margin:0,background:'#fffefa',color:'#252126',fontFamily:'Arial,sans-serif'}}>
  <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
   <section role="alert" aria-labelledby="fatal-title" style={{maxWidth:520,width:'100%',background:'white',border:'1px solid #e8e6dd',borderRadius:18,padding:28}}>
    <p style={{fontSize:12,fontWeight:700,color:'#256b4e',letterSpacing:2}}>BİSMİL SOFRA</p>
    <h1 id="fatal-title" style={{fontSize:28,margin:'12px 0'}}>Sayfa şu an açılamıyor</h1>
    <p style={{lineHeight:1.7,color:'#635d59'}}>Bağlantını kontrol edip yeniden deneyebilirsin. Daha önce sipariş gönderdiysen iki kez göndermeden önce sipariş geçmişini kontrol et.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:24}}>
     <button type="button" onClick={reset} style={{border:0,borderRadius:10,background:'#1b6b4e',color:'#fff',padding:'13px 18px',fontWeight:700,cursor:'pointer'}}>Yeniden dene</button>
     <a href="/" style={{borderRadius:10,border:'1px solid #ccc',padding:'12px 18px',textDecoration:'none',color:'#282822'}}>Ana sayfaya dön</a>
    </div>
   </section>
  </main>
 </body></html>;
}
