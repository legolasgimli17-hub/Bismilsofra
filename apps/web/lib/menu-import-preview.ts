/** Paste four spreadsheet columns without interpreting formulas or guessing prices.
 * Actual money and all rows are revalidated on the server.
 */
import {inputToKurus} from './merchant-settings.ts';
export type PreviewRow={categoryName:string;productName:string;description:string;priceKurus:number};
export const MENU_IMPORT_HEADER='Kategori\tÜrün\tAçıklama\tFiyat (TL)';
const normalize=(raw:string)=>raw.trim().replace(/\s+/g,' ');
export function parseMenuImportTsv(input:string):PreviewRow[]{
 if(input.length>14_000)throw Error('Tablo çok uzun. En fazla 50 ürün girin.');
 const entries=input.replace(/\r\n?/g,'\n').split('\n').filter(x=>x.trim());
 if(entries[0]?.trim()===MENU_IMPORT_HEADER)entries.shift();
 if(entries.length===0||entries.length>50)throw Error('Bir seferde 1–50 ürün aktarabilirsiniz.');
 const seen=new Set<string>();
 return entries.map((line,index)=>{
  const cells=line.split('\t');
  if(cells.length!==4)throw Error(`${index+1}. satırda 4 sütun bulunmalı: kategori, ürün, açıklama ve fiyat.`);
  const [rawCategory,rawProduct,rawDescription,rawPrice]=cells;
  const categoryName=normalize(rawCategory),productName=normalize(rawProduct),
   description=rawDescription.trim(),priceKurus=inputToKurus(rawPrice);
  if(categoryName.length<2||categoryName.length>90||/[<>\x00-\x1f]/.test(categoryName))
   throw Error(`${index+1}. satırda kategori adı geçersiz.`);
  if(productName.length<2||productName.length>130||/[<>\x00-\x1f]/.test(productName))
   throw Error(`${index+1}. satırda ürün adı geçersiz.`);
  if(description.length>600||/\x00/.test(description))
   throw Error(`${index+1}. satırdaki açıklama çok uzun veya geçersiz.`);
  if(priceKurus===null)throw Error(`${index+1}. satırda geçerli bir TL fiyatı gerekli (ör. 150,00).`);
  const ident=(categoryName+'\u0000'+productName).toLocaleLowerCase('tr-TR');
  if(seen.has(ident))throw Error(`${index+1}. satır aynı ürün ve kategoriyi ikinci kez içeriyor.`);
  seen.add(ident);
  return {categoryName,productName,description,priceKurus};
 });
}
