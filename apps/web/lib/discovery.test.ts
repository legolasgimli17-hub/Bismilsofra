import test from 'node:test';import assert from 'node:assert/strict';
import {visibleRestaurants,safeFavorites,normalizeSearch,photoUrl,isRestaurantOrderable} from './discovery.ts';
import type {Restaurant} from './types.ts';
const a:Restaurant={id:'a',name:'Örnek Ocakbaşı',slug:'a',cover_url:null,is_open:true,is_busy:false,accepts_orders:true,min_basket_kurus:20000,delivery_fee_kurus:1000};
const b:Restaurant={...a,id:'b',name:'Örnek Burger',is_open:false,delivery_fee_kurus:0,min_basket_kurus:10000};
const c:Restaurant={...a,id:'c',name:'Örnek Çiğköfte',delivery_fee_kurus:null,min_basket_kurus:null};
const basics={search:'',category:'Tümü',onlyOpen:false,favoritesOnly:false,favorites:[],sort:'recommended' as const};
test('normalizes Turkish search, whitespace and length',()=>{assert.equal(normalizeSearch('  ÖRNEK    OCAK  '),'örnek ocak');assert.ok(normalizeSearch('a'.repeat(100)).length<=70)});
test('search accepts Turkish letters',()=>{const r=visibleRestaurants([a,b,c],{...basics,search:'ocaK' },()=> 'Kebap');assert.deepEqual(r.map(x=>x.id),['a']);});
test('only open excludes busy or closed',()=>{const r=visibleRestaurants([a,b,{...c,is_busy:true}],{...basics,onlyOpen:true},()=> 'Kebap');assert.deepEqual(r.map(x=>x.id),['a']);});
test('category filter and favorites combine',()=>{const r=visibleRestaurants([a,b,c],{...basics,category:'Burger',favoritesOnly:true,favorites:['b']},x=>x.id==='b'?'Burger':'Kebap');assert.deepEqual(r.map(x=>x.id),['b']);});
test('sort does not treat unknown delivery fee as free',()=>{const r=visibleRestaurants([c,a,b],{...basics,sort:'delivery'},()=> 'Kebap');assert.deepEqual(r.map(x=>x.id),['b','a','c']);});
test('recommendation shows available restaurants first; not invented ratings',()=>{const r=visibleRestaurants([b,a],basics,()=> 'Kebap');assert.equal(r[0].id,'a');});
test('favorites have capped, deduplicated, validated IDs',()=>{assert.deepEqual(safeFavorites(['demo-1','demo-1',42,'/bad','demo-2']),['demo-1','demo-2']);assert.equal(safeFavorites(Array.from({length:80},(_,i)=>'demo-'+i)).length,50)});
test('photograph sources are allowlisted',()=>{assert.equal(photoUrl('javascript:alert(1)'),null);assert.equal(photoUrl('http://images.unsplash.com/unsafe'),null);assert.equal(photoUrl('https://evil.test/image'),null);assert.ok(photoUrl('https://images.unsplash.com/photo-test'));assert.equal(photoUrl('/photos/burger.webp'),'/photos/burger.webp');});
test('filtering preserves input array ordering/data',()=>{const src=[b,a,c];visibleRestaurants(src,{...basics,sort:'minimum'},()=> 'Kebap');assert.deepEqual(src.map(x=>x.id),['b','a','c']);});

test('server-side closed/after-hours overrides manually open restaurant',()=>{
 const afterHours={...a,is_orderable:false};
 assert.equal(isRestaurantOrderable(afterHours),false);
 const r=visibleRestaurants([afterHours,b],{...basics,onlyOpen:true},()=> 'Kebap');
 assert.deepEqual(r.map(x=>x.id),[]);
});
test('unverified demo visibility uses manual toggles only',()=>{
 assert.equal(isRestaurantOrderable(a),true);
 assert.equal(isRestaurantOrderable(b),false);
 assert.equal(isRestaurantOrderable({...a,is_orderable:true,is_busy:true}),false);
});

test('owned photo CDN is allowed only with exact HTTPS host and no credentials',()=>{
 const host='assets.bismilsofra.example';
 assert.equal(photoUrl('https://assets.bismilsofra.example/food/kebap.webp',host),'https://assets.bismilsofra.example/food/kebap.webp');
 assert.equal(photoUrl('https://assets.bismilsofra.example.evil.com/photo.webp',host),null);
 assert.equal(photoUrl('https://user:secret@assets.bismilsofra.example/photo.webp',host),null);
 assert.equal(photoUrl('http://assets.bismilsofra.example/photo.webp',host),null);
 assert.equal(photoUrl('https://assets.bismilsofra.example/photo.webp','*.example'),null);
 assert.equal(photoUrl('//assets.bismilsofra.example/photo.webp',host),null);
 assert.equal(photoUrl('/photos/restaurant-01.webp'),'/photos/restaurant-01.webp');
 assert.equal(photoUrl('/photos/../secrets.webp'),null);
});

test('live server product matches are retained even if restaurant name does not match',()=>{
 const payload=[{...a,name:'Ocakbaşı'}]; // API matched a product called “lahmacun”, not the restaurant name
 const filter={...basics,search:'lahmacun'};
 assert.deepEqual(visibleRestaurants(payload,filter,()=> 'Tümü',true).map(r=>r.id),['a']);
 assert.deepEqual(visibleRestaurants(payload,filter,()=> 'Tümü',false).map(r=>r.id),[]);
});
test('server-filtered searches still apply open status and favorites',()=>{
 const results=visibleRestaurants([a,b],{...basics,search:'lahmacun',onlyOpen:true,favoritesOnly:true,favorites:['a']},()=> 'Tümü',true);
 assert.deepEqual(results.map(r=>r.id),['a']);
});
