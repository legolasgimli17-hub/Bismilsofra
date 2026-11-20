'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {inputToKurus,kurusToInput} from '@/lib/merchant-settings';
import {CheckCircle2,ChevronDown,ChevronUp,Plus,RefreshCcw,Save,SlidersHorizontal} from 'lucide-react';

type Choice={id:string;group_id:string;name:string;price_kurus:number;available:boolean;revision:number};
type OptionGroup={id:string;name:string;min_select:number;max_select:number;archived:boolean;revision:number;options:Choice[]};
type GroupDraft={name:string;minSelect:string;maxSelect:string;archived:boolean;revision:number};
type ChoiceDraft={name:string;price:string;available:boolean;revision:number};
type NewChoice={name:string;price:string};
type Props={restaurantId:string;productId:string;productName:string;token:()=>Promise<string>;canEdit:boolean;disabled?:boolean};

export default function OptionEditor({restaurantId,productId,productName,token,canEdit,disabled=false}:Props){
 const tokenRef=useRef(token);tokenRef.current=token;
 const requestSequence=useRef(0);
 const [groups,setGroups]=useState<OptionGroup[]>([]);
 const [groupDrafts,setGroupDrafts]=useState<Record<string,GroupDraft>>({});
 const [choiceDrafts,setChoiceDrafts]=useState<Record<string,ChoiceDraft>>({});
 const [newChoiceDrafts,setNewChoiceDrafts]=useState<Record<string,NewChoice>>({});
 const [newGroup,setNewGroup]=useState('');
 const [busy,setBusy]=useState('');
 const [loading,setLoading]=useState(true);
 const [open,setOpen]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const locked=disabled||Boolean(busy)||!canEdit;

 const url=`/v1/restaurant/${restaurantId}/products/${productId}/option-groups`;
 const load=useCallback(async(raise=false)=>{
  const id=++requestSequence.current;
  setLoading(true);
  try{
   const response=await api<{groups:OptionGroup[]}>(url,await tokenRef.current());
   if(id!==requestSequence.current)return;
   setGroups(response.groups);
   setGroupDrafts(Object.fromEntries(response.groups.map(g=>[g.id,{
    name:g.name,minSelect:String(g.min_select),maxSelect:String(g.max_select),archived:g.archived,revision:g.revision
   }])));
   setChoiceDrafts(Object.fromEntries(response.groups.flatMap(g=>g.options.map(o=>[o.id,{
    name:o.name,price:kurusToInput(o.price_kurus),available:o.available,revision:o.revision
   }]))));
   setError('');
  }catch(e){
   if(id===requestSequence.current){setError(e instanceof Error?e.message:'Seçenek listesi alınamadı.');if(raise)throw e}
  }finally{if(id===requestSequence.current)setLoading(false)}
 },[url]);
 useEffect(()=>{void load();return()=>{requestSequence.current++}},[load]);

 async function run(label:string,task:()=>Promise<unknown>,after?:()=>void){
  if(locked)return;
  setBusy(label);setError('');setMessage('');
  try{await task();await load(true);after?.();setMessage(label+' kaydedildi.')}
  catch(e){setError(e instanceof Error?e.message:'Değişiklik kaydedilemedi.')}
  finally{setBusy('')}
 }
 function editGroup(id:string,changes:Partial<GroupDraft>){
  setGroupDrafts(old=>({...old,[id]:{...old[id],...changes}}));
 }
 function editChoice(id:string,changes:Partial<ChoiceDraft>){
  setChoiceDrafts(old=>({...old,[id]:{...old[id],...changes}}));
 }
 function editNewChoice(id:string,changes:Partial<NewChoice>){
  setNewChoiceDrafts(old=>({...old,[id]:Object.assign({name:'',price:'0,00'},old[id]||{},changes)}));
 }

 function saveGroup(group:OptionGroup){
  const d=groupDrafts[group.id];
  if(!d)return;
  const minSelect=Number(d.minSelect),maxSelect=Number(d.maxSelect);
  if(!Number.isInteger(minSelect)||!Number.isInteger(maxSelect)||minSelect<0||maxSelect<1||minSelect>maxSelect||maxSelect>12){
   setError('Seçim sınırları geçersiz: 0–12 arası olmalı, en az seçim en çok seçimden büyük olamaz.');return;
  }
  void run(group.name+' seçenek grubu',async()=>api(url+'/'+group.id,await tokenRef.current(),{
   method:'PATCH',body:JSON.stringify({name:d.name,minSelect,maxSelect,archived:d.archived,revision:d.revision})
  }));
 }
 function saveChoice(group:OptionGroup,choice:Choice){
  const d=choiceDrafts[choice.id];if(!d)return;
  const priceKurus=inputToKurus(d.price);
  if(priceKurus===null){setError('Ek seçenek fiyatı geçersiz (örn. 12,50).');return}
  void run(choice.name+' seçeneği',async()=>api(url+'/'+group.id+'/options/'+choice.id,await tokenRef.current(),{
   method:'PATCH',body:JSON.stringify({name:d.name,priceKurus,available:d.available,revision:d.revision})
  }));
 }
 function addChoice(event:React.FormEvent<HTMLFormElement>,group:OptionGroup){
  event.preventDefault();
  const d=newChoiceDrafts[group.id]||{name:'',price:'0,00'};
  const priceKurus=inputToKurus(d.price);
  if(priceKurus===null){setError('Ek seçenek fiyatını kontrol edin.');return}
  void run(group.name+' grubuna yeni seçenek',async()=>api(url+'/'+group.id+'/options',await tokenRef.current(),{
   method:'POST',body:JSON.stringify({name:d.name,priceKurus})
  }),()=>setNewChoiceDrafts(old=>({...old,[group.id]:{name:'',price:'0,00'}})));
 }
 function addGroup(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  void run('Yeni seçenek grubu',async()=>api(url,await tokenRef.current(),{
   method:'POST',body:JSON.stringify({name:newGroup})
  }),()=>setNewGroup(''));
 }
 return <section className="merchant-option-editor" aria-label={productName+' ürün seçenekleri'}>
  <button type="button" className="merchant-option-collapse" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <SlidersHorizontal size={18}/><span><strong>Seçenekler ve ekstra malzemeler</strong><small>{productName} · {groups.length} grup</small></span>
   {open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
  </button>
  {open&&<div className="merchant-option-body">
   <p className="muted">Müşterinin seçebileceği boyut, sos, içecek veya ek malzemeleri buradan yönetin. Fiyat ve zorunlu seçimler siparişte sunucuda kontrol edilir.</p>
   <div className="merchant-option-topline">
    <button type="button" className="merchant-mini-button" disabled={locked||loading} onClick={()=>void load()}>
     <RefreshCcw size={14}/> Yenile
    </button>
    {loading&&<small role="status">Seçenekler yükleniyor…</small>}
   </div>
   {error&&<p className="notice error" role="alert">{error}</p>}
   {message&&<p className="notice" role="status"><CheckCircle2 size={15}/>{message}</p>}
   {groups.map(g=>{
    const d=groupDrafts[g.id];if(!d)return null;
    const active=g.options.filter(o=>o.available).length;
    const c=newChoiceDrafts[g.id]||{name:'',price:'0,00'};
    return <div key={g.id} className={'merchant-option-group'+(d.archived?' archived':'')}>
     <div className="merchant-option-group-head">
      <strong>{g.name}</strong>
      <span>{g.archived?'Grup pasif':active+' satışta seçenek'}</span>
     </div>
     <div className="merchant-option-group-fields">
      <label>Grup adı <input disabled={locked} value={d.name} maxLength={110}
       onChange={e=>editGroup(g.id,{name:e.target.value})}/></label>
      <label>En az seçim <input disabled={locked} type="number" inputMode="numeric" min="0" max="12"
       value={d.minSelect} onChange={e=>editGroup(g.id,{minSelect:e.target.value})}/></label>
      <label>En çok seçim <input disabled={locked} type="number" inputMode="numeric" min="1" max="12"
       value={d.maxSelect} onChange={e=>editGroup(g.id,{maxSelect:e.target.value})}/></label>
     </div>
     <label className="merchant-option-checkbox">
      <input type="checkbox" checked={!d.archived} disabled={locked}
       onChange={e=>editGroup(g.id,{archived:!e.target.checked})}/>
      Bu seçenek grubu müşterilere gösterilsin
     </label>
     <button type="button" className="btn outline" disabled={locked} onClick={()=>saveGroup(g)}>
      <Save size={15}/> Grup kurallarını kaydet
     </button>
     <div className="merchant-option-choices">
      {g.options.map(o=>{
       const entry=choiceDrafts[o.id];if(!entry)return null;
       return <div className="merchant-option-choice" key={o.id}>
        <label>Seçenek adı
         <input disabled={locked} maxLength={100} value={entry.name}
          onChange={e=>editChoice(o.id,{name:e.target.value})}/></label>
        <label>Ek fiyat (TL)
         <input disabled={locked} inputMode="decimal" value={entry.price}
          onChange={e=>editChoice(o.id,{price:e.target.value})}/></label>
        <label className="merchant-option-checkbox">
         <input type="checkbox" disabled={locked} checked={entry.available}
          onChange={e=>editChoice(o.id,{available:e.target.checked})}/> Satışta
        </label>
        <button type="button" className="merchant-mini-button" disabled={locked}
         onClick={()=>saveChoice(g,o)}>Seçeneği kaydet</button>
       </div>;
      })}
     </div>
     <form className="merchant-option-new-choice" onSubmit={e=>addChoice(e,g)}>
      <strong>Yeni seçenek ekle</strong>
      <div className="merchant-option-new-choice-fields">
       <label>Adı <input disabled={locked||g.options.length>=12} required maxLength={100}
        placeholder="Örn. Ekstra kaşar" value={c.name}
        onChange={e=>editNewChoice(g.id,{name:e.target.value})}/></label>
       <label>Ek fiyat (TL) <input disabled={locked||g.options.length>=12} required inputMode="decimal"
        value={c.price} onChange={e=>editNewChoice(g.id,{price:e.target.value})}/></label>
       <button type="submit" disabled={locked||g.options.length>=12} className="btn primary">
        <Plus size={15}/> Ekle
       </button>
      </div>
     </form>
    </div>;
   })}
   {groups.length===0&&!loading&&<div className="muted">Henüz seçenek grubu yok. Örneğin “Ekstra malzemeler” oluşturabilirsiniz.</div>}
   <form onSubmit={addGroup} className="merchant-option-new-group">
    <label>Yeni seçenek grubu
     <input placeholder="Örn. Ekstra malzemeler" required minLength={2} maxLength={110}
      value={newGroup} onChange={e=>setNewGroup(e.target.value)} disabled={locked||groups.length>=8}/>
    </label>
    <button className="btn primary" type="submit" disabled={locked||groups.length>=8}>
     <Plus size={16}/> Grup ekle
    </button>
    <p className="muted">Yeni grup ilk olarak isteğe bağlıdır (0–1 seçim). Önce seçenekleri ekleyip sonra gerekli seçim sayısını artırabilirsiniz. Geçmiş siparişler etkilenmez.</p>
   </form>
  </div>}
 </section>;
}
