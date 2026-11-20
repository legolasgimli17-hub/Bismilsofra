import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReorderPreview,type PastOrderLine} from './reorder-preview.ts';
import type {MenuProduct} from './types.ts';
import {orderBody} from './cart.ts';
const choice={id:'extra',group_id:'g',name:'Kaşar',price_kurus:1500,available:true};
const product:MenuProduct={id:'p',category_id:'c',name:'Döner',description:null,
 price_kurus:10000,image_url:null,available:true,optionGroups:[
 {id:'g',product_id:'p',name:'Ekstralar',min_select:1,max_select:2,options:[choice]}
 ]};
const past:PastOrderLine={product_id:'p',product_name_snapshot:'Döner',quantity:2,unit_kurus:11000,
 options_snapshot:[{id:'extra',name:'Kaşar',priceKurus:1000}]};
const preview=(p:MenuProduct=product,lines:PastOrderLine[]=[past],orderable=true)=>
 buildReorderPreview('r','Restoran',orderable,lines,[p]);
test('valid old order uses TODAY price/label and requires a fresh server quote',()=>{
 const r=preview();
 assert.ok(r.cart);
 assert.deepEqual(r.priceChanges,[{name:'Döner',oldKurus:11000,currentKurus:11500}]);
 assert.equal(r.cart!.lines[0].optionExtraKurus,1500);
 assert.equal(r.cart!.lines[0].quantity,2);
 const body=orderBody(r.cart!,'addr','cash','');
 assert.deepEqual(body.items,[{productId:'p',quantity:2,optionIds:['extra']}]);
 assert.equal(JSON.stringify(body).includes('priceKurus'),false);
});
test('old product removed or unavailable blocks the entire retry',()=>{
 assert.equal(preview({...product,available:false}).cart,null);
 assert.equal(preview(product,[{...past,product_id:'missing'}]).cart,null);
});
test('obsolete or unavailable extras cannot be silently dropped',()=>{
 assert.equal(preview({...product,optionGroups:[{...product.optionGroups[0],options:[]}]}).cart,null);
 assert.equal(preview({...product,optionGroups:[{...product.optionGroups[0],options:[{...choice,available:false}]}]}).cart,null);
 assert.equal(preview(product,[{...past,options_snapshot:[{id:'foreign',name:'Other',priceKurus:0}]}]).cart,null);
});
test('new mandatory selection blocks an empty previous choice',()=>{
 assert.equal(preview(product,[{...past,options_snapshot:[]}]).cart,null);
});
test('restaurant not accepting orders blocks replay',()=>{
 assert.equal(preview(product,[past],false).cart,null);
});
test('duplicate historical lines merge only within 25 units',()=>{
 const r=preview(product,[{...past,quantity:2},{...past,quantity:3}]);
 assert.equal(r.cart?.lines.length,1);
 assert.equal(r.cart?.lines[0].quantity,5);
 assert.equal(preview(product,[{...past,quantity:24},{...past,quantity:2}]).cart,null);
});
test('invalid old snapshot or unsafe pricing never prepares an order',()=>{
 assert.equal(preview(product,[{...past,options_snapshot:[past.options_snapshot[0],past.options_snapshot[0]]}]).cart,null);
 assert.equal(preview(product,[{...past,quantity:26}]).cart,null);
 assert.equal(preview({...product,price_kurus:100_000_000}).cart,null);
});
