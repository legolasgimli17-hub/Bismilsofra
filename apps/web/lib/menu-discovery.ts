export type MenuDiscoverable = {
 name:string;
 description:string|null;
 available:boolean;
 category_id:string|null;
 category_name?:string|null;
};
export type MenuFilter = {query:string;category:string;onlyAvailable:boolean};
const categoryLabel=(product:MenuDiscoverable)=>product.category_name?.trim()||'Diğer';
export function normalizeMenuSearch(value:string):string{
 return value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('tr-TR').slice(0,100);
}
export function menuCategories<T extends MenuDiscoverable>(products:readonly T[]):{name:string;count:number}[]{
 const counts=new Map<string,number>();
 for(const p of products){const name=categoryLabel(p);counts.set(name,(counts.get(name)||0)+1)}
 return [...counts].map(([name,count])=>({name,count}));
}
export function visibleMenuProducts<T extends MenuDiscoverable>(products:readonly T[],filter:MenuFilter):T[]{
 const query=normalizeMenuSearch(filter.query);
 return products.filter(p=>{
  if(filter.onlyAvailable&&!p.available)return false;
  if(filter.category!=='Tümü'&&categoryLabel(p)!==filter.category)return false;
  if(!query)return true;
  return normalizeMenuSearch([p.name,p.description||'',categoryLabel(p)].join(' ')).includes(query);
 });
}
