'use client';

import {useEffect,useState} from 'react';
import FoodImage from './food-image';
import {api} from '@/lib/api';
import {money} from '@/lib/types';
import {inputToKurus,kurusToInput} from '@/lib/merchant-settings';
import {CheckCircle2,FolderPlus,Image as ImageIcon,Plus,Save,Search,SquarePen,Tag,Undo2} from 'lucide-react';

export type EditorCategory={id:string;name:string;sort_order:number};
export type EditorProduct={
 id:string;name:string;description:string;category_id:string;category_name:string;
 price_kurus:number;image_url:string|null;available:boolean;revision:number;
};
type Props={restaurantId:string;categories:EditorCategory[];products:EditorProduct[];
 token:()=>Promise<string>;onRefresh:()=>Promise<void>;disabled?:boolean;canEdit:boolean};
type Draft={categoryId:string;name:string;description:string;price:string;imageUrl:string};
const blank=(categories:EditorCategory[]):Draft=>({categoryId:categories[0]?.id||'',name:'',description:'',price:'',imageUrl:''});
const friendly=(value:unknown)=>value instanceof Error?value.message:'Kayıt yapılamadı. Bağlantınızı kontrol edin.';

export default function MenuEditor({restaurantId,categories,products,token,onRefresh,disabled=false,canEdit}:Props){
 const [editingId,setEditingId]=useState<string|null>(null);
 const [draft,setDraft]=useState<Draft>(()=>blank(categories));
 const [search,setSearch]=useState('');
 const [newCategory,setNewCategory]=useState('');
 const [renameId,setRenameId]=useState<string|null>(null);
 const [renameName,setRenameName]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const locked=disabled||busy||!canEdit;
 const selected=editingId?products.find(p=>p.id===editingId):null;
 const filtered=products.filter(p=>(p.name+' '+p.category_name).toLocaleLowerCase('tr-TR').includes(search.trim().toLocaleLowerCase('tr-TR')));
 useEffect(()=>{
  if(!editingId&&categories.length>0&&!categories.some(c=>c.id===draft.categoryId)){
   setDraft(d=>({...d,categoryId:categories[0].id}));
  }
 },[categories,editingId,draft.categoryId]);

 function change<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(d=>({...d,[key]:value}))}
 function edit(product:EditorProduct){
  setEditingId(product.id);
  setDraft({categoryId:product.category_id,name:product.name,description:product.description||'',
   price:kurusToInput(product.price_kurus),imageUrl:product.image_url||''});
  setError('');setMessage('');
 }
 function startNew(){setEditingId(null);setDraft(blank(categories));setError('');setMessage('')}
 async function operation(fn:()=>Promise<unknown>,messageText:string,after?:()=>void){
  if(locked)return;
  setBusy(true);setError('');setMessage('');
  try{
   await fn();await onRefresh();
   after?.();setMessage(messageText);
  }catch(e){setError(friendly(e))}
  finally{setBusy(false)}
 }

 function submitProduct(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  const priceKurus=inputToKurus(draft.price);
  if(priceKurus===null){setError('Fiyat geçersiz. Örnek: 149,90 TL');return}
  if(!draft.categoryId){setError('Ürün için önce kategori oluşturun.');return}
  const body={categoryId:draft.categoryId,name:draft.name,description:draft.description,
   priceKurus,imageUrl:draft.imageUrl.trim()||null};
  if(editingId){
   const revision=selected?.revision;
   if(!Number.isInteger(revision)){setError('Ürün bilgisi eski. Yeniden yükleyin.');return}
   void operation(async()=>api(`/v1/restaurant/${restaurantId}/products/${editingId}/details`,
    await token(),{method:'PATCH',body:JSON.stringify({...body,revision})}),
   'Ürün güncellendi; yeni fiyat sipariş onayında tekrar hesaplanacak.',startNew);
  }else{
   void operation(async()=>api(`/v1/restaurant/${restaurantId}/products`,await token(),
    {method:'POST',body:JSON.stringify(body)}),
   'Ürün eklendi. Kontrol edene kadar satışa kapalıdır.',startNew);
  }
 }
 function addCategory(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  void operation(async()=>api(`/v1/restaurant/${restaurantId}/categories`,await token(),
   {method:'POST',body:JSON.stringify({name:newCategory})}),
   'Kategori eklendi.',()=>setNewCategory(''));
 }
 function renameCategory(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!renameId)return;
  void operation(async()=>api(`/v1/restaurant/${restaurantId}/categories/${renameId}`,
   await token(),{method:'PATCH',body:JSON.stringify({name:renameName})}),
   'Kategori adı güncellendi.',()=>{setRenameId(null);setRenameName('')});
 }
 function changeAvailability(product:EditorProduct){
  void operation(async()=>api(`/v1/restaurant/${restaurantId}/products/${product.id}`,await token(),
   {method:'PATCH',body:JSON.stringify({available:!product.available})}),
   product.available?'Ürün satıştan kaldırıldı.':'Ürün artık satışta.');
 }

 return <section className="panel merchant-settings-section merchant-menu-editor">
  <div className="merchant-settings-title"><Tag size={21}/><div>
   <h2>Menü ve ürün düzenleyicisi</h2>
   <p>Kategorilerinizi oluşturun, ürünlerinizi ekleyin, fiyatları düzenleyin ve satışa açın.</p>
  </div></div>

  {error&&<div className="notice error" role="alert">{error}</div>}
  {message&&<div className="notice" role="status"><CheckCircle2 size={17}/> {message}</div>}

  <div className="merchant-menu-columns">
   <div className="merchant-menu-left">
    <div className="merchant-menu-row-title"><h3>Kategoriler</h3><span>{categories.length}/40</span></div>
    <div className="merchant-category-chips">
     {categories.map(c=><button key={c.id} type="button" disabled={locked} className="merchant-category-pill"
      onClick={()=>{setRenameId(c.id);setRenameName(c.name)}} aria-label={c.name+' kategorisini yeniden adlandır'}>
      <SquarePen size={14}/> {c.name}
     </button>)}
     {!categories.length&&<p className="muted">Ürün eklemek için ilk kategoriyi oluşturun.</p>}
    </div>
    <form onSubmit={addCategory} className="merchant-menu-miniform">
     <label htmlFor="merchant-create-category">Yeni kategori adı</label>
     <div className="merchant-menu-inline">
      <input id="merchant-create-category" value={newCategory} onChange={e=>setNewCategory(e.target.value)}
       maxLength={90} minLength={2} placeholder="Örn. Izgara Çeşitleri" required disabled={locked||categories.length>=40}/>
      <button className="btn outline" type="submit" disabled={locked||categories.length>=40}>
       <FolderPlus size={17}/> Ekle
      </button>
     </div>
    </form>
    {renameId&&<form className="merchant-menu-miniform" onSubmit={renameCategory}>
      <label htmlFor="merchant-rename-category">Kategori adını değiştir</label>
      <div className="merchant-menu-inline">
       <input id="merchant-rename-category" value={renameName} onChange={e=>setRenameName(e.target.value)}
        minLength={2} maxLength={90} disabled={locked} required/>
       <button className="btn primary" type="submit" disabled={locked}><Save size={16}/> Kaydet</button>
       <button className="btn outline" type="button" disabled={busy} onClick={()=>setRenameId(null)}>Vazgeç</button>
      </div>
     </form>}

    <div className="merchant-menu-row-title"><h3>Ürünler</h3><span>{products.length}/500</span></div>
    <label className="merchant-search-label" htmlFor="merchant-menu-search"><Search size={16}/> Ürün ara
     <input id="merchant-menu-search" type="search" placeholder="Ad veya kategori"
      value={search} onChange={e=>setSearch(e.target.value)} maxLength={70}/>
    </label>
    <div className="merchant-editor-product-list">
     {filtered.map(p=><article className={'merchant-editor-item'+(editingId===p.id?' editing':'')} key={p.id}>
      <div className="merchant-editor-thumb"><FoodImage src={p.image_url} alt={p.name}/></div>
      <div className="merchant-editor-item-info">
       <small>{p.category_name}</small><strong>{p.name}</strong>
       <span>{money(p.price_kurus)} · <b className={p.available?'merchant-on-sale':'merchant-off-sale'}>{p.available?'Satışta':'Kapalı'}</b></span>
      </div>
      <div className="merchant-editor-item-actions">
       <button type="button" className="merchant-mini-button" disabled={locked} onClick={()=>edit(p)}>Düzenle</button>
       <button type="button" className="merchant-mini-button" disabled={locked} onClick={()=>changeAvailability(p)}>
        {p.available?'Kapat':'Aç'}
       </button>
      </div>
     </article>)}
     {!filtered.length&&<p className="muted">Aramanıza uygun ürün yok. Yeni ürün oluşturabilirsiniz.</p>}
    </div>
   </div>

   <div className="merchant-menu-right">
    <div className="merchant-menu-row-title">
     <h3>{editingId?'Ürünü düzenle':'Yeni ürün oluştur'}</h3>
     {editingId&&<button className="merchant-mini-button" onClick={startNew} type="button" disabled={busy}><Undo2 size={14}/> Yeni ürün</button>}
    </div>
    <form className="merchant-product-form" onSubmit={submitProduct}>
     <label>Ürün adı
      <input value={draft.name} onChange={e=>change('name',e.target.value)}
       minLength={2} maxLength={130} placeholder="Örn. Adana dürüm" required disabled={locked}/></label>
     <label>Kategori
      <select value={draft.categoryId} onChange={e=>change('categoryId',e.target.value)} required disabled={locked||!categories.length}>
       <option value="">Kategori seçin</option>
       {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>
     <label>Fiyat (TL)
      <input value={draft.price} onChange={e=>change('price',e.target.value)} inputMode="decimal"
       placeholder="149,90" maxLength={11} required disabled={locked}/></label>
     <label>Açıklama
      <textarea rows={3} value={draft.description} onChange={e=>change('description',e.target.value)}
       maxLength={600} placeholder="İçerik, gramaj ve ürün bilgisi" disabled={locked}/></label>
     <label>Onaylı ürün fotoğrafı yolu (isteğe bağlı)
      <input value={draft.imageUrl} onChange={e=>change('imageUrl',e.target.value)}
       maxLength={420} placeholder="/photos/adana-durum.webp" disabled={locked}/>
     </label>
     <div className="merchant-menu-image-hint">
      <ImageIcon size={18}/>
      <p>Yalnızca restoranın izinli fotoğrafı kabul edilir: <code>/photos/urun.webp</code> veya yapılandırılmış kendi görsel sunucumuz. Bu ekrandan dosya yükleme henüz etkin değil.</p>
     </div>
     {draft.imageUrl&&<div className="merchant-editor-preview"><FoodImage src={draft.imageUrl} alt="Ürün görseli önizleme"/></div>}
     <button type="submit" className="btn primary" disabled={locked||!categories.length}>
      {editingId?<Save size={17}/>:<Plus size={17}/>} {busy?'Kaydediliyor…':editingId?'Değişiklikleri kaydet':'Ürünü taslak olarak ekle'}
     </button>
     <p className="muted">Yeni ürünler güvenlik için başlangıçta satışa kapalıdır. Düzenlemeler geçmiş siparişin fiyatını değiştirmez. Eşzamanlı düzenleme algılanırsa menüyü yenileyin.</p>
    </form>
   </div>
  </div>
 </section>;
}
