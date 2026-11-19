import type {Restaurant} from './types.ts';

export type SortMode='recommended'|'delivery'|'minimum'|'name';
export type DiscoveryFilter={search:string;category:string;onlyOpen:boolean;favoritesOnly:boolean;favorites:string[];sort:SortMode};
const tr=(s:string)=>s.toLocaleLowerCase('tr-TR').normalize('NFKC');
export function normalizeSearch(value:string){return tr(value.trim()).replace(/\s+/g,' ').slice(0,70)}
/** Only the server can know hours/closures. Demo fixtures may omit the field. */
export function isRestaurantOrderable(r:Restaurant):boolean{
 return r.is_open && !r.is_busy && r.accepts_orders && r.is_orderable !== false;
}
export function visibleRestaurants<T extends Restaurant>(restaurants:readonly T[],filter:DiscoveryFilter,categoryOf:(r:T)=>string):T[]{
 const q=normalizeSearch(filter.search);const favoriteSet=new Set(filter.favorites);
 return restaurants.filter(r=>{
  if(filter.onlyOpen&&!(isRestaurantOrderable(r)))return false;
  if(filter.favoritesOnly&&!favoriteSet.has(r.id))return false;
  if(filter.category!=='Tümü'&&categoryOf(r)!==filter.category)return false;
  return !q||normalizeSearch(r.name).includes(q)||normalizeSearch(categoryOf(r)).includes(q);
 }).sort((a,b)=>{
  const openA=Number(isRestaurantOrderable(a)),openB=Number(isRestaurantOrderable(b));
  if(filter.sort==='recommended'){if(openB!==openA)return openB-openA;return a.name.localeCompare(b.name,'tr-TR')}
  if(filter.sort==='delivery')return (a.delivery_fee_kurus??Number.POSITIVE_INFINITY)-(b.delivery_fee_kurus??Number.POSITIVE_INFINITY)||a.name.localeCompare(b.name,'tr-TR');
  if(filter.sort==='minimum')return (a.min_basket_kurus??Number.POSITIVE_INFINITY)-(b.min_basket_kurus??Number.POSITIVE_INFINITY)||a.name.localeCompare(b.name,'tr-TR');
  return a.name.localeCompare(b.name,'tr-TR');
 });
}
export function safeFavorites(value:unknown):string[]{
 if(!Array.isArray(value))return [];
 return [...new Set(value.filter((v):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v)))].slice(0,50);
}
export function photoUrl(value:string|null|undefined):string|null{
 if(!value)return null;
 try{const url=new URL(value, 'https://bismilsofra.example');if(url.protocol==='https:'&&(url.hostname==='images.unsplash.com'||url.hostname==='images.pexels.com'))return url.toString();if(value.startsWith('/photos/')&&/^\/photos\/[a-z0-9_-]+\.(jpg|jpeg|webp)$/i.test(value))return value;return null}catch{return null}
}
