import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedMenuImage,parseProductDraft,parseCategoryDraft} from '../src/merchant-menu.ts';
import {DomainError} from '../src/domain.ts';
const cid='33333333-3333-4333-8333-333333333333';
const good={categoryId:cid,name:' Adana  Dürüm ',description:'Acılı veya acısız',priceKurus:19000,imageUrl:'/photos/adana.webp'};
const fails=(code:string)=>(error:unknown)=>error instanceof DomainError&&error.code===code;
test('new product uses integer kuruş and normalizes name',()=>{
 assert.deepEqual(parseProductDraft(good),{categoryId:cid,name:'Adana Dürüm',description:'Acılı veya acısız',priceKurus:19000,imageUrl:'/photos/adana.webp'});
});
test('invalid foreign category ID, excessive product description and fractional price rejected',()=>{
 assert.throws(()=>parseProductDraft({...good,categoryId:'demo-category'}),fails('CATEGORY_INVALID'));
 assert.throws(()=>parseProductDraft({...good,description:'x'.repeat(601)}),fails('PRODUCT_INVALID'));
 assert.throws(()=>parseProductDraft({...good,priceKurus:123.4}),fails('PRODUCT_INVALID'));
 assert.throws(()=>parseProductDraft({...good,name:'<script>alert(1)</script>'}),fails('PRODUCT_INVALID'));
});
test('category names normalized and invalid HTML rejected',()=>{
 assert.equal(parseCategoryDraft({name:'  Izgara   Çeşitleri '}),'Izgara Çeşitleri');
 assert.throws(()=>parseCategoryDraft({name:'a'}),fails('CATEGORY_INVALID'));
 assert.throws(()=>parseCategoryDraft({name:'<script>'}),fails('CATEGORY_INVALID'));
});
test('restaurant food photo must be local approved asset or owned CDN',()=>{
 assert.equal(approvedMenuImage('/photos/kebap-01.webp'),'/photos/kebap-01.webp');
 assert.equal(approvedMenuImage(null),null);
 assert.equal(approvedMenuImage(''),null);
 assert.equal(approvedMenuImage('https://img.bismilsofra.example/products/food.webp','img.bismilsofra.example'),'https://img.bismilsofra.example/products/food.webp');
 for(const url of ['javascript:alert(1)','https://images.unsplash.com/photo-123','http://img.bismilsofra.example/food.webp',
  'https://img.bismilsofra.example.evil.com/food.webp','https://img.bismilsofra.example/food.svg','https://img.bismilsofra.example/food.webp?token=x',
  '/photos/../secrets.webp']){
  assert.throws(()=>approvedMenuImage(url,'img.bismilsofra.example'),fails('PHOTO_INVALID'),url);
 }
 assert.throws(()=>approvedMenuImage('https://img.bismilsofra.example/food.webp'),fails('PHOTO_NOT_READY'));
});
