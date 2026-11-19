/** Server-side menu editor validation. Never trust client price or photo URLs. */
import {invalid,price,uuid} from './domain.ts';

export type ProductDraft={
 categoryId:string;name:string;description:string;
 priceKurus:number;imageUrl:string|null;
};
const LOCAL_PHOTO=/^\/photos\/[a-z0-9][a-z0-9_-]{0,80}\.(?:webp|jpg|jpeg)$/i;
const CDN_PATH=/^\/(?:[a-z0-9_-]+\/){0,5}[a-z0-9_-]+\.(?:webp|jpg|jpeg)$/i;

/** User-submitted images can only be packaged, approved paths or OUR configured CDN. */
export function approvedMenuImage(value:unknown,hostname=process.env.PUBLIC_IMAGE_CDN_HOST):string|null{
 if(value===null||value==='')return null;
 if(typeof value!=='string'||value.length>420)invalid('PHOTO_INVALID','Fotoğraf bağlantısı geçersiz.');
 if(LOCAL_PHOTO.test(value))return value;
 if(!hostname||!(/^[a-z0-9][a-z0-9.-]{1,249}$/i.test(hostname)))
  invalid('PHOTO_NOT_READY','Görsel depolama alanı henüz yapılandırılmadı.');
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||
   url.hostname.toLowerCase()!==hostname.toLowerCase()||
   url.search||url.hash||!CDN_PATH.test(url.pathname))
   invalid('PHOTO_INVALID','Yalnızca onaylı HTTPS fotoğraf alanı kullanılabilir.');
  return url.toString();
 }catch(error){
  if(error instanceof Error&&error.name==='DomainError')throw error;
  invalid('PHOTO_INVALID','Görsel bağlantısı geçersiz.');
 }
}

export function parseCategoryDraft(value:unknown):string{
 if(!value||typeof value!=='object'||Array.isArray(value))invalid('CATEGORY_INVALID','Kategori adı gerekli.');
 const name=(value as Record<string,unknown>).name;
 if(typeof name!=='string')invalid('CATEGORY_INVALID','Kategori adı gerekli.');
 const trimmed=name.trim().replace(/\s+/g,' ');
 if(trimmed.length<2||trimmed.length>90||/[<>\x00-\x1f]/.test(trimmed))
  invalid('CATEGORY_INVALID','Kategori 2–90 karakter içermelidir.');
 return trimmed;
}
export function parseProductDraft(value:unknown,hostname?:string):ProductDraft{
 if(!value||typeof value!=='object'||Array.isArray(value))
  invalid('PRODUCT_INVALID','Ürün bilgileri geçersiz.');
 const body=value as Record<string,unknown>;
 if(!uuid(body.categoryId))invalid('CATEGORY_INVALID','Geçerli restoran kategorisini seçin.');
 if(typeof body.name!=='string'||typeof body.description!=='string'||
  !price(body.priceKurus))invalid('PRODUCT_INVALID','Ürün adı, açıklaması ve fiyatını kontrol edin.');
 const name=body.name.trim().replace(/\s+/g,' ');
 const description=body.description.trim();
 if(name.length<2||name.length>130||description.length>600||
   /[<>\x00-\x1f]/.test(name)||/\x00/.test(description))
  invalid('PRODUCT_INVALID','Ürün adı 2–130, açıklama en fazla 600 karakter olabilir.');
 return {categoryId:body.categoryId as string,name,description,
  priceKurus:body.priceKurus as number,
  imageUrl:approvedMenuImage(body.imageUrl??null,hostname)};
}
