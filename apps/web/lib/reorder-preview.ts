import type {Cart,CartLine,MenuProduct} from './types.ts';

/** Reordering never trusts the historical unit price or an obsolete option.
 * This pure browser preview is advisory; checkout MUST quote and reconfirm on the server.
 */
export type PastOrderLine={
 product_id:string|null;product_name_snapshot:string;quantity:number;unit_kurus:number;line_total_kurus:number;
 options_snapshot:{id:string;name:string;priceKurus:number}[];
};
export type ReorderIssue={index:number;name:string;message:string};
export type ReorderPriceChange={name:string;oldKurus:number;currentKurus:number};
export type ReorderPreview={
 cart:Cart|null;issues:ReorderIssue[];priceChanges:ReorderPriceChange[];
};
export function buildReorderPreview(
 restaurantId:string,restaurantName:string,orderable:boolean,previous:readonly PastOrderLine[],
 products:readonly MenuProduct[]
):ReorderPreview{
 const issues:ReorderIssue[]=[],priceChanges:ReorderPriceChange[]=[];
 const lines:CartLine[]=[];
 const catalog=new Map(products.map(p=>[p.id,p]));
 if(!orderable)issues.push({index:-1,name:restaurantName,message:'Restoran şu anda sipariş almıyor.'});
 if(previous.length<1||previous.length>40)
  issues.push({index:-1,name:'Sipariş',message:'Eski siparişin ürün sayısı güvenli sepet sınırında değil.'});
 let totalQuantity=0;
 const keys=new Map<string,number>();
 for(const [index,item] of previous.entries()){
  const name=item.product_name_snapshot||'Ürün';
  if(!item.product_id||!catalog.has(item.product_id)){
   issues.push({index,name,message:'Ürün artık bu restoranın menüsünde yok.'});continue;
  }
  const product=catalog.get(item.product_id)!;
  if(!product.available){
   issues.push({index,name,message:'Ürün şu anda satışa kapalı.'});continue;
  }
  if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>25){
   issues.push({index,name,message:'Adet sınırı aşıldı.'});continue;
  }
  if(!Array.isArray(item.options_snapshot)||item.options_snapshot.length>24||
   item.options_snapshot.some(o=>!o||typeof o.id!=='string')||
   new Set(item.options_snapshot.map(o=>o.id)).size!==item.options_snapshot.length){
   issues.push({index,name,message:'Eski ürün seçenekleri doğrulanamadı.'});continue;
  }
  const remaining=new Set(item.options_snapshot.map(o=>o.id));
  const optionIds:string[]=[],optionLabels:string[]=[];
  let extraKurus=0,valid=true;
  for(const group of product.optionGroups){
   const selected=group.options.filter(o=>remaining.has(o.id));
   if(selected.length<group.min_select||selected.length>group.max_select||
    selected.some(o=>!o.available)){
    issues.push({index,name,message:'Zorunlu veya mevcut seçenekler değişmiş. Menüden yeniden seç.'});
    valid=false;break;
   }
   for(const option of selected){
    remaining.delete(option.id);optionIds.push(option.id);
    optionLabels.push(option.name);extraKurus+=option.price_kurus;
   }
  }
  if(!valid)continue;
  if(remaining.size){
   issues.push({index,name,message:'Önceki ek malzeme artık bu ürün için satılmıyor.'});continue;
  }
  const unitKurus=product.price_kurus+extraKurus;
  if(!Number.isSafeInteger(unitKurus)||unitKurus<0||unitKurus>100_000_000||
   !Number.isSafeInteger(unitKurus*item.quantity)||unitKurus*item.quantity>100_000_000){
   issues.push({index,name,message:'Fiyat sınırları kontrol edilemedi.'});continue;
  }
  if(unitKurus!==item.unit_kurus)
   priceChanges.push({name:product.name,oldKurus:item.unit_kurus,currentKurus:unitKurus});
  optionIds.sort();
  const key=product.id+'|'+optionIds.join(',');
  const line:CartLine={productId:product.id,name:product.name,imageUrl:product.image_url,
   priceKurus:product.price_kurus,quantity:item.quantity,optionIds,optionLabels,
   optionExtraKurus:extraKurus};
  if(keys.has(key)){
   const existing=lines[keys.get(key)!];
   if(existing.quantity+item.quantity>25){
    issues.push({index,name,message:'Aynı ürünün toplam adedi 25 sınırını aşıyor.'});continue;
   }
   existing.quantity+=item.quantity;
  }else{keys.set(key,lines.length);lines.push(line)}
  totalQuantity+=item.quantity;
 }
 if(totalQuantity>100||lines.length>40)
  issues.push({index:-1,name:'Sepet',message:'Tek sipariş için en fazla 100 adet ve 40 kalem olabilir.'});
 if(lines.reduce((sum,l)=>sum+(l.priceKurus+l.optionExtraKurus)*l.quantity,0)>100_000_000)
  issues.push({index:-1,name:'Sepet',message:'Sepet tutarı güvenlik sınırını aşıyor.'});
 return {cart:issues.length===0?{restaurantId,restaurantName,lines}:null,issues,priceChanges};
}
