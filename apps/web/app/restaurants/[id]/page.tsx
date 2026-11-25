'use client';
import {Suspense,useCallback,useEffect,useMemo,useState} from 'react';import {useParams,useSearchParams,useRouter} from 'next/navigation';import Link from 'next/link';import {ArrowLeft,Plus,Minus,ShoppingBag,Check,Truck,Search,X,SlidersHorizontal} from 'lucide-react';
import {api,ApiError} from '@/lib/api';import {money,type MenuProduct,type Restaurant} from '@/lib/types';import {DEMO_RESTAURANTS,DEMO_ZONES,demoMenu} from '@/lib/demo';import FoodImage from '@/components/food-image';import {useCart} from '@/components/providers';import {cartTotal,cartCount} from '@/lib/cart';import {isRestaurantOrderable,restaurantOrderStatus} from '@/lib/discovery';import {menuCategories,visibleMenuProducts} from '@/lib/menu-discovery';import {selectProductOption,permitsCartReplacement,type AddWarning} from '@/lib/product-option-ui';
export default function MenuPage(){return <Suspense fallback={<section className="container main-section empty">Menü açılıyor…</section>}><MenuRoute/></Suspense>}
type Delivery={neighborhood:string;available:boolean;min_basket_kurus:number|null;delivery_fee_kurus:number|null};
function MenuRoute(){
 const {id}=useParams<{id:string}>();
 const params=useSearchParams();
 const isDemo=params.get('demo')==='1';
 const rawZone=params.get('zoneId');
 const zoneId=rawZone&&(isDemo?DEMO_ZONES.some(zone=>zone.id===rawZone):/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(rawZone))?rawZone:null;
 return <MenuPageInner key={id+':'+isDemo+':'+zoneId} id={id} isDemo={isDemo} zoneId={zoneId}/>;
}
function MenuPageInner({id,isDemo,zoneId}:{id:string;isDemo:boolean;zoneId:string|null}){const router=useRouter();const [restaurant,setRestaurant]=useState<Restaurant|null>(null),[products,setProducts]=useState<MenuProduct[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState<MenuProduct|null>(null),[selections,setSelections]=useState<Record<string,string[]>>({}),[quantity,setQuantity]=useState(1),[warning,setWarning]=useState<AddWarning>(null);const {cart,add}=useCart();
 const [delivery,setDelivery]=useState<Delivery|null>(null);
 const canOrderHere=!zoneId||delivery?.available===true;
 const [attempt,setAttempt]=useState(0);
 const [menuMissing,setMenuMissing]=useState(false);
 const [menuQuery,setMenuQuery]=useState(''),[menuCategory,setMenuCategory]=useState('Tümü'),[onlyAvailable,setOnlyAvailable]=useState(false),[lastAdded,setLastAdded]=useState('');
 const discoverableProducts=useMemo(()=>products.map(p=>({...p,category_name:p.category_name||(isDemo?DEMO_RESTAURANTS.find(r=>r.id===id)?.category:'Diğer')})),[products,isDemo,id]);
 const categories=useMemo(()=>menuCategories(discoverableProducts),[discoverableProducts]);
 const filteredProducts=useMemo(()=>visibleMenuProducts(discoverableProducts,{query:menuQuery,category:menuCategory,onlyAvailable}),[discoverableProducts,menuQuery,menuCategory,onlyAvailable]);
 useEffect(()=>{
  if(isDemo){
   const fixture=DEMO_RESTAURANTS.find(x=>x.id===id)||null;
   const neighborhood=DEMO_ZONES.find(zone=>zone.id===zoneId)?.name;
   if(neighborhood&&fixture){
    const available=fixture.zones.some(zone=>zone===zoneId);
    setDelivery({neighborhood,available,min_basket_kurus:available?fixture.min_basket_kurus:null,
     delivery_fee_kurus:available?fixture.delivery_fee_kurus:null});
   }
   setRestaurant(fixture);setProducts(demoMenu(id));setMenuMissing(!fixture);setLoading(false);
   return;
  }
  const controller=new AbortController();
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
  api<{restaurant:Restaurant;products:MenuProduct[];delivery:Delivery|null}>(`/v1/restaurants/${id}/menu${zoneId?'?zoneId='+encodeURIComponent(zoneId):''}`,undefined,{signal})
   .then(result=>{if(!controller.signal.aborted){setRestaurant(result.restaurant);setProducts(result.products);setDelivery(result.delivery)}})
   .catch(e=>{
    if(controller.signal.aborted)return;
    setMenuMissing(e instanceof ApiError&&e.status===404);
    setError(e instanceof ApiError&&e.code==='NETWORK'?'Menüye bağlanılamadı. Bağlantınızı kontrol edin.':
     e instanceof Error?e.message:'Menü yüklenemedi.');
   })
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[id,isDemo,zoneId,attempt]);
 const open=(p:MenuProduct)=>{setSelected(p);setSelections({});setQuantity(1);setWarning(null)};
 const total=useMemo(()=>selected?(selected.price_kurus+selected.optionGroups.reduce((s,g)=>s+g.options.filter(o=>(selections[g.id]||[]).includes(o.id)).reduce((v,o)=>v+o.price_kurus,0),0))*quantity:0,[selected,selections,quantity]);
 const onAdd=useCallback((replace=false)=>{if(!selected||!restaurant||!isRestaurantOrderable(restaurant)||!canOrderHere)return;const ids:string[]=[],labels:string[]=[];let extra=0;for(const group of selected.optionGroups){const picked=selections[group.id]||[];if(picked.length<group.min_select||picked.length>group.max_select){setWarning('options');return;}for(const o of group.options.filter(o=>picked.includes(o.id))){ids.push(o.id);labels.push(o.name);extra+=o.price_kurus}}
 try{add(restaurant.id,restaurant.name,{productId:selected.id,name:selected.name,imageUrl:selected.image_url,priceKurus:selected.price_kurus,quantity,optionIds:ids,optionLabels:labels,optionExtraKurus:extra},replace);setLastAdded(`${quantity} × ${selected.name} sepete eklendi.`);setSelected(null);setWarning(null)}catch(e){if(e instanceof Error&&e.message==='OTHER_RESTAURANT')setWarning('restaurant');else setError('Sepet güncellenemedi.')}
 },[selected,restaurant,selections,quantity,add,canOrderHere]);
 if(loading)return <section className="container main-section empty">Menü yükleniyor…</section>;
 if(!restaurant)return <section className="container main-section empty"><h2>{menuMissing?'Restoran bulunamadı':'Menü yüklenemedi'}</h2>{error&&<p role="alert">{error}</p>}
 {!menuMissing&&<button type="button" className="btn outline" onClick={()=>{setLoading(true);setError('');setAttempt(n=>n+1)}}>Tekrar dene</button>}<Link href="/">Ana sayfaya dön</Link></section>;
 return <><div className="container breadcrumb"><Link href="/"><ArrowLeft size={17}/> Restoranlar</Link></div><section className="container restaurant-detail"><FoodImage src={restaurant.cover_url} alt={restaurant.name}/><div className="restaurant-detail-info"><div className="eyebrow">{isDemo?'ÖRNEK RESTORAN':'BİSMİL SOFRA'}</div><h1>{restaurant.name}</h1><div className="detail-chips"><span><Truck size={16}/> Restoranın kuryesi</span>{delivery?.available&&<><span>{delivery.neighborhood}</span><span>Minimum sepet {money(delivery.min_basket_kurus)}</span><span>Teslimat {delivery.delivery_fee_kurus===0?'ücretsiz':money(delivery.delivery_fee_kurus)}</span></>}<span>{restaurantOrderStatus(restaurant)}</span></div></div></section>{!canOrderHere&&<section className="container notice" aria-label="Teslimat durumu"><p>{delivery?`Bu restoran ${delivery.neighborhood} mahallesine teslimat yapmıyor.`:'Seçili mahalle artık geçerli değil.'} <Link href="/">Mahalle değiştir</Link></p></section>}{!zoneId&&<section className="container notice" aria-label="Teslimat bilgisi"><Link href="/">Teslimat ücreti ve minimum sepet için mahalleni seç</Link></section>}{isDemo&&<div className="container demo-alert">Bu restoran ve menüsü örnektir. Gerçek sipariş gönderilemez.</div>}
 <section className="container main-section"><div className="section-heading"><div><span className="overline">MENÜ</span><h2>Canın ne çekiyor?</h2><p>Yemekleri ara, kategorileri keşfet, seçeneklerini belirle.</p></div><span className="menu-total-count">{products.length} ürün</span></div>
 {lastAdded&&<div className="menu-added-banner" role="status" aria-live="polite"><Check size={18}/><span>{lastAdded}</span><Link href="/checkout">Sepete göz at <ShoppingBag size={15}/></Link></div>}
 {products.length>0&&<div className="menu-discovery-panel">
  <div className="menu-discovery-toolbar"><label className="menu-search-field"><Search size={20}/><input type="search" aria-label="Menüde yemek ara" placeholder="Menüde yemek veya malzeme ara…" value={menuQuery} maxLength={100} onChange={e=>setMenuQuery(e.target.value)}/>{menuQuery&&<button type="button" onClick={()=>setMenuQuery('')} aria-label="Menü aramasını temizle"><X size={17}/></button>}</label>
  <label className="menu-available-check"><input type="checkbox" checked={onlyAvailable} onChange={e=>setOnlyAvailable(e.target.checked)}/> Sadece satıştakiler</label></div>
  <div className="menu-category-tabs" role="group" aria-label="Menü kategorileri"><button type="button" className={menuCategory==='Tümü'?'active':''} aria-pressed={menuCategory==='Tümü'} onClick={()=>setMenuCategory('Tümü')}>Tümü <span>{products.length}</span></button>{categories.map(c=><button type="button" key={c.name} className={menuCategory===c.name?'active':''} aria-pressed={menuCategory===c.name} onClick={()=>setMenuCategory(c.name)}>{c.name} <span>{c.count}</span></button>)}</div>
 </div>}
 {products.length===0?<div className="empty">Bu restoranda henüz ürün eklenmemiş.</div>:<><p className="menu-match-count" role="status">{filteredProducts.length} ürün gösteriliyor</p>{filteredProducts.length===0?<div className="menu-no-results"><SlidersHorizontal size={28}/><h3>Aradığın yemek bulunamadı</h3><p>Farklı bir arama yapabilir veya kategori filtrelerini sıfırlayabilirsin.</p><button type="button" className="btn outline" onClick={()=>{setMenuQuery('');setMenuCategory('Tümü');setOnlyAvailable(false)}}>Filtreleri temizle</button></div>:<div className="product-list">{filteredProducts.map(p=><div className={`product-card ${!p.available?'menu-unavailable-product':''}`} key={p.id}><div className="product-copy"><span className="menu-product-category">{p.category_name||'Diğer'}</span><h3>{p.name}</h3>{p.description&&<p>{p.description}</p>}{!p.available&&<span className="menu-unavailable-label">Şu anda satışta değil</span>}<strong>{money(p.price_kurus)}</strong></div><div className="product-visual"><FoodImage src={p.image_url} alt={`${p.name} fotoğrafı`}/><button className="add-button" disabled={!p.available||!isRestaurantOrderable(restaurant)||!canOrderHere} onClick={()=>open(p)} aria-label={`${p.name} ekle`}><Plus size={23}/></button></div></div>)}</div>}</>}
 {cartCount(cart)>0&&<div className="sticky-cart"><div className="container sticky-inner"><div><strong>{cartCount(cart)} ürün · {cart.restaurantName}</strong><span>{money(cartTotal(cart))} + teslimat</span></div><button onClick={()=>router.push('/checkout')} className="btn primary"><ShoppingBag size={19}/> Sepete git</button></div></div>}
 </section>{selected&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><div role="dialog" aria-modal="true" aria-labelledby="product-title" className="product-dialog"><button className="close-dialog" onClick={()=>setSelected(null)} aria-label="Kapat">×</button><FoodImage src={selected.image_url} alt={selected.name}/><div className="dialog-body"><h2 id="product-title">{selected.name}</h2><p>{selected.description}</p>{selected.optionGroups.map(g=>{const picks=selections[g.id]||[];return <fieldset key={g.id} className="option-group"><legend>{g.name} · {g.min_select>0?'Zorunlu':'İsteğe bağlı'} ({g.min_select}–{g.max_select})</legend>{g.min_select===0&&g.max_select===1&&<label><input type="radio" name={g.id} checked={picks.length===0}
 onChange={()=>setSelections(prev=>({...prev,[g.id]:[]}))}/>Seçim istemiyorum <span>Ücretsiz</span></label>}
{g.options.map(o=><label key={o.id}><input type={g.max_select===1?'radio':'checkbox'} name={g.id}
 disabled={!o.available||(g.max_select>1&&picks.length>=g.max_select&&!picks.includes(o.id))}
 checked={picks.includes(o.id)}
 onChange={e=>{const checked=e.currentTarget.checked;setSelections(prev=>({
  ...prev,[g.id]:selectProductOption(prev[g.id]||[],o.id,checked,g.max_select)
 }))}}/>{o.name} <span>{o.price_kurus?'+'+money(o.price_kurus):'Ücretsiz'}</span></label>)}</fieldset>})}
 {warning&&<div className="notice error" role="alert">{warning==='restaurant'?'Sepetinde farklı restorandan ürünler var. Devam edersen eski sepetin temizlenecek.':'Zorunlu seçenekleri tamamla.'}</div>}<div className="dialog-actions"><div className="stepper"><button onClick={()=>setQuantity(Math.max(1,quantity-1))} aria-label="Azalt"><Minus size={18}/></button><b>{quantity}</b><button onClick={()=>setQuantity(Math.min(25,quantity+1))} aria-label="Artır"><Plus size={18}/></button></div><button className="btn primary" onClick={()=>onAdd(permitsCartReplacement(warning))}>Sepete ekle · {money(total)}</button></div></div></div></div>}</>}
