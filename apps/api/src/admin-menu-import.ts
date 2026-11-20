/** Admin pilot menu import. Entire batch commits atomically. Each product
 * stays unavailable until its real owner reviews price, options and photo.
 */
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {invalid,price} from './domain.ts';
import {parseCategoryDraft} from './merchant-menu.ts';
import {transaction} from './order-service.ts';

export type ImportRow={categoryName:string;productName:string;description:string;priceKurus:number};
export type MenuImportInput={importKey:string;rows:ImportRow[];sha256:string};
const normalizedKey=(s:string)=>s.toLocaleLowerCase('tr-TR');
export function parseMenuImport(body:unknown):MenuImportInput{
 if(!body||typeof body!=='object'||Array.isArray(body))
  invalid('MENU_IMPORT_INVALID','Menü aktarımı geçersiz.');
 const b=body as Record<string,unknown>;
 if(typeof b.importKey!=='string'||!/^[A-Za-z0-9_.:-]{16,70}$/.test(b.importKey))
  invalid('MENU_IMPORT_INVALID','Menü aktarım işlem anahtarı geçersiz.');
 if(!Array.isArray(b.rows)||b.rows.length===0||b.rows.length>50)
  invalid('MENU_IMPORT_LIMIT','Tek işlemde 1–50 ürün bulunmalı.');
 const seen=new Set<string>();
 const rows:ImportRow[]=(b.rows as unknown[]).map((value:unknown)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))
   invalid('MENU_IMPORT_INVALID','Ürün satırı geçersiz.');
  const row=value as Record<string,unknown>;
  const categoryName=parseCategoryDraft({name:row.categoryName});
  if(typeof row.productName!=='string'||typeof row.description!=='string'||!price(row.priceKurus))
   invalid('MENU_IMPORT_INVALID','Ürün adı, açıklaması veya kuruş cinsinden fiyat hatalı.');
  const productName=(row.productName as string).trim().replace(/\s+/g,' ');
  const description=(row.description as string).trim();
  if(productName.length<2||productName.length>130||description.length>600||
   /[<>\x00-\x1f]/.test(productName)||/\x00/.test(description))
   invalid('MENU_IMPORT_INVALID','Ürün adı veya açıklaması geçersiz.');
  const duplicate=normalizedKey(categoryName)+'\u0000'+normalizedKey(productName);
  if(seen.has(duplicate))invalid('MENU_IMPORT_DUPLICATE','Aynı kategoride aynı isimli ürün iki kez var.',409);
  seen.add(duplicate);
  return {categoryName,productName,description,priceKurus:row.priceKurus as number};
 });
 const sha256=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 return {importKey:b.importKey as string,rows,sha256};
}
export async function importDraftMenu(pool:Pool,actorId:string,restaurantId:string,body:unknown){
 const input=parseMenuImport(body);
 return transaction(pool,async db=>{
  // All imports and manual creates lock this restaurant. Never import into a
  // live business or allow a retry to create a second menu.
  const rest=await db.query('SELECT id,active FROM restaurants WHERE id=$1 FOR UPDATE',[restaurantId]);
  if(!rest.rowCount)invalid('NOT_FOUND','Restoran bulunamadı.',404);
  if(rest.rows[0].active)invalid('MENU_IMPORT_ACTIVE','Toplu menü aktarımı yalnız kapalı restoran taslağında yapılabilir.',409);
  const replay=await db.query(`SELECT id,payload_sha256,products_created,categories_created
   FROM admin_menu_imports WHERE restaurant_id=$1 AND import_key=$2`,
   [restaurantId,input.importKey]);
  if(replay.rowCount){
   if(replay.rows[0].payload_sha256!==input.sha256)
    invalid('MENU_IMPORT_CONFLICT','Bu işlem anahtarı farklı bir menü için kullanılmış.',409);
   return {importId:replay.rows[0].id,productsCreated:replay.rows[0].products_created,
    categoriesCreated:replay.rows[0].categories_created,replayed:true,productsAvailable:false};
  }
  const existingCats=await db.query('SELECT id,name FROM categories WHERE restaurant_id=$1',[restaurantId]);
  const categories=new Map<string,string>();
  for(const c of existingCats.rows)categories.set(normalizedKey(c.name),c.id);
  const need=new Map<string,string>();
  for(const row of input.rows){
   const key=normalizedKey(row.categoryName);
   if(!categories.has(key))need.set(key,row.categoryName);
  }
  if(categories.size+need.size>40)
   invalid('CATEGORY_LIMIT','Restoranda en fazla 40 kategori bulunabilir.',409);
  const count=await db.query('SELECT count(*)::int AS n FROM products WHERE restaurant_id=$1',[restaurantId]);
  if(count.rows[0].n+input.rows.length>500)
   invalid('PRODUCT_LIMIT','Restoranda en fazla 500 ürün bulunabilir.',409);
  const existing=await db.query(`SELECT p.name,c.name AS category_name
   FROM products p JOIN categories c ON c.id=p.category_id AND c.restaurant_id=p.restaurant_id
   WHERE p.restaurant_id=$1`,[restaurantId]);
  const taken=new Set(existing.rows.map(r=>normalizedKey(r.category_name)+'\u0000'+normalizedKey(r.name)));
  if(input.rows.some(row=>taken.has(normalizedKey(row.categoryName)+'\u0000'+normalizedKey(row.productName))))
   invalid('PRODUCT_EXISTS','Aktarılan ürünlerden biri bu restoranda zaten kayıtlı.',409);
  for(const [key,name] of need){
   const created=await db.query(`INSERT INTO categories(restaurant_id,name)
    VALUES($1,$2) RETURNING id`,[restaurantId,name]);
   categories.set(key,created.rows[0].id);
  }
  for(const row of input.rows){
   await db.query(`INSERT INTO products
    (restaurant_id,category_id,name,description,price_kurus,image_url,available)
    VALUES($1,$2,$3,$4,$5,NULL,false)`,
    [restaurantId,categories.get(normalizedKey(row.categoryName)),row.productName,
     row.description,row.priceKurus]);
  }
  const imported=await db.query(`INSERT INTO admin_menu_imports
   (restaurant_id,actor_user_id,import_key,payload_sha256,products_created,categories_created)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
   [restaurantId,actorId,input.importKey,input.sha256,input.rows.length,need.size]);
  await db.query(`INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details)
   VALUES($1,'admin_menu_import','restaurant',$2,$3::jsonb)`,
   [actorId,restaurantId,JSON.stringify({importId:imported.rows[0].id,productsCreated:input.rows.length,
    categoriesCreated:need.size,allUnavailable:true})]);
  return {importId:imported.rows[0].id,productsCreated:input.rows.length,
   categoriesCreated:need.size,replayed:false,productsAvailable:false};
 });
}
