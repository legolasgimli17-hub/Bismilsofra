import test from 'node:test';import assert from 'node:assert/strict';
import {addCartLine,cartTotal,cartCount,EMPTY_CART,updateLine,orderBody,readStoredCart} from './cart.ts';
const line={productId:'1',name:'Döner',imageUrl:null,priceKurus:10000,quantity:1,optionIds:[],optionLabels:[],optionExtraKurus:2000};
test('adds item and sums price using integer kurus',()=>{const c=addCartLine(EMPTY_CART,'r1','Restoran',line,false);assert.equal(cartTotal(c),12000);assert.equal(cartCount(c),1)});
test('same item combines quantity',()=>{const c=addCartLine(addCartLine(EMPTY_CART,'r1','R',line,false),'r1','R',line,false);assert.equal(c.lines.length,1);assert.equal(c.lines[0].quantity,2)});
test('different restaurant must be explicitly confirmed',()=>{const c=addCartLine(EMPTY_CART,'r1','R',line,false);assert.throws(()=>addCartLine(c,'r2','X',line,false),/OTHER_RESTAURANT/);assert.equal(addCartLine(c,'r2','X',line,true).restaurantId,'r2')});
test('removing last quantity empties basket',()=>{const c=addCartLine(EMPTY_CART,'r1','R',line,false);assert.deepEqual(updateLine(c,0,-1),EMPTY_CART)});
test('order uses server IDs and no browser-derived prices',()=>{const c=addCartLine(EMPTY_CART,'r1','R',line,false);const b=orderBody(c,'a1','pos','');assert.ok(!('priceKurus' in b.items[0]));assert.equal(b.paymentMethod,'pos')});

test('stored live cart restores only structurally safe data',()=>{
 const safe=addCartLine(EMPTY_CART,'11111111-1111-4111-8111-111111111111','Restoran',{
  ...line,productId:'22222222-2222-4222-8222-222222222222',optionExtraKurus:0
 },false);
 assert.deepEqual(readStoredCart(JSON.stringify(safe)),safe);
});
test('malformed or oversized browser storage is rejected without exceptions',()=>{
 assert.deepEqual(readStoredCart('{bad'),EMPTY_CART);
 assert.deepEqual(readStoredCart(JSON.stringify({restaurantId:'r',restaurantName:'X',lines:[line]})),EMPTY_CART);
 assert.deepEqual(readStoredCart(JSON.stringify({restaurantId:'demo-a',restaurantName:'X',lines:[{...line,productId:'demo-food',quantity:1e9}]})),EMPTY_CART);
 assert.deepEqual(readStoredCart('a'.repeat(80_001)),EMPTY_CART);
});
test('old stored cart cannot inject invalid numbers or duplicate option ids',()=>{
 const valid=addCartLine(EMPTY_CART,'demo-a','Restoran',{...line,productId:'demo-p'},false);
 for(const mutation of [
  {...valid,lines:[{...valid.lines[0],priceKurus:-100}]},
  {...valid,lines:[{...valid.lines[0],optionExtraKurus:'10000'}]},
  {...valid,lines:[{...valid.lines[0],optionIds:['demo-o','demo-o'],optionLabels:['X','Y']}]},
  {...valid,lines:Array.from({length:41},()=>valid.lines[0])},
 ])assert.deepEqual(readStoredCart(JSON.stringify(mutation)),EMPTY_CART);
});
test('demo cart with valid identifiers still restores',()=>{
 const valid=addCartLine(EMPTY_CART,'demo-ocak','Örnek Ocakbaşı',{
  ...line,productId:'demo-product-demo-ocak-0',optionExtraKurus:0
 },false);
 assert.deepEqual(readStoredCart(JSON.stringify(valid)),valid);
});
