import test from 'node:test';import assert from 'node:assert/strict';
import {addCartLine,cartTotal,cartCount,EMPTY_CART,updateLine,orderBody} from './cart.ts';
const line={productId:'1',name:'Döner',imageUrl:null,priceKurus:10000,quantity:1,optionIds:[],optionLabels:[],optionExtraKurus:2000};
test('adds item and sums price using integer kurus',()=>{const c=addCartLine(EMPTY_CART,'r1','Restoran',line,false);assert.equal(cartTotal(c),12000);assert.equal(cartCount(c),1)});
test('same item combines quantity',()=>{const c=addCartLine(addCartLine(EMPTY_CART,'r1','R',line,false),'r1','R',line,false);assert.equal(c.lines.length,1);assert.equal(c.lines[0].quantity,2)});
test('different restaurant must be explicitly confirmed',()=>{const c=addCartLine(EMPTY_CART,'r1','R',line,false);assert.throws(()=>addCartLine(c,'r2','X',line,false),/OTHER_RESTAURANT/);assert.equal(addCartLine(c,'r2','X',line,true).restaurantId,'r2')});
test('removing last quantity empties basket',()=>{const c=addCartLine(EMPTY_CART,'r1','R',line,false);assert.deepEqual(updateLine(c,0,-1),EMPTY_CART)});
test('order uses server IDs and no browser-derived prices',()=>{const c=addCartLine(EMPTY_CART,'r1','R',line,false);const b=orderBody(c,'a1','pos','');assert.ok(!('priceKurus' in b.items[0]));assert.equal(b.paymentMethod,'pos')});
