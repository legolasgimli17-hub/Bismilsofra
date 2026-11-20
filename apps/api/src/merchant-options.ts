/** Safe, server-owned customization rules: no client price is ever trusted at checkout. */
import {invalid,price} from './domain.ts';

export const MAX_OPTION_GROUPS_PER_PRODUCT=8;
export const MAX_CHOICES_PER_GROUP=12;

function label(raw:unknown,kind:'group'|'choice'):string{
 if(typeof raw!=='string')
  return invalid('OPTION_INVALID','Seçenek adı gerekli.');
 const name=raw.trim().replace(/\s+/g,' ');
 const min=kind==='group'?2:1,max=kind==='group'?110:100;
 if(name.length<min||name.length>max||/[<>\x00-\x1f]/.test(name))
  return invalid('OPTION_INVALID','Seçenek adı veya uzunluğu geçersiz.');
 return name;
}
function revision(value:unknown):number{
 if(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>2147483647)
  return invalid('OPTION_REVISION_REQUIRED','Güncelleme için geçerli sürüm numarası gerekli.');
 return value as number;
}
function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))
  return invalid('OPTION_INVALID','Seçenek bilgisi geçersiz.');
 return value as Record<string,unknown>;
}
export const normalizedOptionName=(value:string):string=>value.toLocaleLowerCase('tr-TR');

export function parseNewGroup(value:unknown):{name:string}{
 const b=object(value);
 return {name:label(b.name,'group')};
}
export function parseGroupUpdate(value:unknown):{
 name:string;minSelect:number;maxSelect:number;archived:boolean;revision:number
}{
 const b=object(value);
 if(!Number.isInteger(b.minSelect)||!Number.isInteger(b.maxSelect)||
  Number(b.minSelect)<0||Number(b.maxSelect)<1||Number(b.minSelect)>Number(b.maxSelect)||
  Number(b.maxSelect)>MAX_CHOICES_PER_GROUP||typeof b.archived!=='boolean')
  return invalid('OPTION_RULE_INVALID','Seçim sınırları 0–12 arasında olmalı ve doğru sıralanmalı.');
 return {name:label(b.name,'group'),minSelect:b.minSelect as number,
  maxSelect:b.maxSelect as number,archived:b.archived,
  revision:revision(b.revision)};
}
export function parseNewChoice(value:unknown):{name:string;priceKurus:number}{
 const b=object(value);
 if(!price(b.priceKurus))
  return invalid('OPTION_PRICE_INVALID','Ek malzeme fiyatı tam sayı kuruş olmalı.');
 return {name:label(b.name,'choice'),priceKurus:b.priceKurus as number};
}
export function parseChoiceUpdate(value:unknown):{
 name:string;priceKurus:number;available:boolean;revision:number
}{
 const b=object(value);
 if(typeof b.available!=='boolean'||!price(b.priceKurus))
  return invalid('OPTION_INVALID','Seçenek fiyatı veya satış durumu geçersiz.');
 return {name:label(b.name,'choice'),priceKurus:b.priceKurus as number,
  available:b.available,revision:revision(b.revision)};
}
export function assertEnoughChoices(minSelect:number,availableCount:number,archived:boolean){
 if(!archived&&minSelect>availableCount)
  invalid('OPTION_MIN_REQUIRED','Zorunlu seçim sayısı satıştaki seçenek sayısını aşamaz.',409);
}
