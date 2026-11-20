'use client';
import {useMemo,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {money} from '@/lib/types';
import {parseMenuImportTsv,MENU_IMPORT_HEADER} from '@/lib/menu-import-preview';
import {ClipboardPaste,UploadCloud,ShieldCheck,AlertTriangle,CheckCircle2} from 'lucide-react';

type Imported={importId:string;productsCreated:number;categoriesCreated:number;
 replayed:boolean;productsAvailable:boolean};
export default function AdminMenuImport({
 restaurantId,active,token,onImported
}:{restaurantId:string;active:boolean;token:()=>Promise<string>;onImported:()=>Promise<unknown>}){
 const [source,setSource]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const currentKey=useRef<string|null>(null);
 const preview=useMemo(()=>{
  if(!source.trim())return {rows:[] as ReturnType<typeof parseMenuImportTsv>,error:''};
  try{return {rows:parseMenuImportTsv(source),error:''}}
  catch(e){return {rows:[],error:e instanceof Error?e.message:'Tablo okunamadı.'}}
 },[source]);
 async function importMenu(){
  if(busy||active||preview.error||!preview.rows.length)return;
  if(!window.confirm(`${preview.rows.length} ürünü kapalı taslak olarak eklemek istiyor musunuz? Satışa açılmaları için işletme sahibinin ürünleri incelemesi gerekir.`))return;
  setBusy(true);setError('');setSuccess('');
  // The same key survives network retry; a new paste yields a new key.
  if(!currentKey.current)currentKey.current=crypto.randomUUID();
  try{
   const result=await api<Imported>(`/v1/admin/restaurants/${restaurantId}/menu-import`,await token(),{
    method:'POST',body:JSON.stringify({importKey:currentKey.current,rows:preview.rows})
   });
   if(result.productsAvailable)throw Error('İşlem güvenlik koşulunu karşılamadı. Menü kontrol edilmeli.');
   setSuccess(`${result.productsCreated} ürün ve ${result.categoriesCreated} yeni kategori ${result.replayed?'yeniden oluşturulmadan doğrulandı':'kaydedildi'}. Tüm ürünler satışa kapalıdır.`);
   currentKey.current=null;
   setSource('');
   try{await onImported()}catch{/* save succeeded; operator can manually refresh */}
  }catch(e){setError(e instanceof Error?e.message:'Menü kaydedilemedi. Aynı içerikle tekrar deneyin.')}
  finally{setBusy(false)}
 }
 return <section className="pilot-menu-import" aria-label="Restorana toplu menü aktarımı">
  <div className="pilot-menu-import-heading"><h3><ClipboardPaste size={20}/> Toplu menü aktarımı</h3>
   <p className="muted">Gerçek işletmenin sağladığı menüyü Excel / Google Sheets'ten 4 sütun halinde kopyalayıp yapıştırın. Başka restoranın menüsünü izinsiz çoğaltmayın.</p>
   <p className="muted">Sütun sırası: <strong>Kategori · Ürün · Açıklama · Fiyat (TL)</strong>. Açıklama boş olabilir. İlk satıra başlık eklemek isteğe bağlıdır.</p>
  </div>
  <div className="pilot-menu-import-template"><span>Başlık satırı (isteğe bağlı)</span>
   <code>{MENU_IMPORT_HEADER.replaceAll('\t','  |  ')}</code></div>
  <label className="pilot-import-label">Excel veya Sheets'ten kopyalanan satırlar
   <textarea value={source} onChange={e=>{setSource(e.target.value);currentKey.current=null;setSuccess('');setError('')}}
    rows={6} maxLength={14_000} disabled={active||busy}
    placeholder="Kategori  [TAB]  Ürün  [TAB]  Açıklama  [TAB]  Fiyat (TL)"/></label>
  {active&&<p className="notice error" role="alert">Bu restoran aktif. Toplu menü aktarımı yalnız kapalı kurulum taslaklarında mümkündür.</p>}
  {preview.error&&<p className="notice error" role="alert"><AlertTriangle size={17}/>{preview.error}</p>}
  {error&&<p className="notice error" role="alert"><AlertTriangle size={17}/>{error}</p>}
  {success&&<p className="notice" role="status"><CheckCircle2 size={17}/>{success}</p>}
  {preview.rows.length>0&&<div className="pilot-import-preview">
   <strong>Aktarım önizlemesi: {preview.rows.length} ürün · {new Set(preview.rows.map(r=>r.categoryName.toLocaleLowerCase('tr-TR'))).size} kategori</strong>
   <div className="pilot-import-scroll"><table><thead><tr><th>Kategori</th><th>Ürün</th><th>TL</th><th>Durum</th></tr></thead>
    <tbody>{preview.rows.map((r,i)=><tr key={i}>
     <td>{r.categoryName}</td><td>{r.productName}</td><td>{money(r.priceKurus)}</td><td>Kapalı</td>
    </tr>)}</tbody></table></div></div>}
  <button className="btn primary" type="button" disabled={busy||active||!preview.rows.length||Boolean(preview.error)}
   onClick={()=>void importMenu()}><UploadCloud size={17}/>{busy?'Kaydediliyor…':'Ürünleri satışa kapalı aktar'}</button>
  <p className="muted pilot-import-disclaimer"><ShieldCheck size={16}/> Bir işlemde en fazla 50 ürün; mevcut ürünler silinmez veya üzerine yazılmaz. Aynı isimli ürün varsa aktarım güvenli biçimde durur. Tüm ürünleri sonradan işletme sahibi fiyat, fotoğraf ve seçenekleriyle kontrol edip satışa açmalıdır.</p>
 </section>;
}
