import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMenuSearch,menuCategories,visibleMenuProducts,type MenuDiscoverable} from './menu-discovery.ts';
const menu:MenuDiscoverable[]=[
 {name:'İskender Kebap',description:'Yoğurt ve tereyağı',available:true,category_id:'a',category_name:'Kebap'},
 {name:'Adana Dürüm',description:'Acılı',available:false,category_id:'a',category_name:'Kebap'},
 {name:'Çiğköfte Dürüm',description:'Nar ekşisi',available:true,category_id:'b',category_name:'Çiğköfte'},
 {name:'Su',description:null,available:true,category_id:null,category_name:null},
];
const base={query:'',category:'Tümü',onlyAvailable:false};
test('Turkish search matches dotted I and trims whitespace',()=>{
 assert.equal(normalizeMenuSearch('  İSKENDER   KEBAP '),'iskender kebap');
 assert.deepEqual(visibleMenuProducts(menu,{...base,query:'İSKENDER'}).map(p=>p.name),['İskender Kebap']);
});
test('search includes descriptions and category labels',()=>{
 assert.deepEqual(visibleMenuProducts(menu,{...base,query:'nar ekşisi'}).map(p=>p.name),['Çiğköfte Dürüm']);
 assert.equal(visibleMenuProducts(menu,{...base,query:'kebap'}).length,2);
});
test('category filters and availability compose without changing source',()=>{
 assert.deepEqual(visibleMenuProducts(menu,{query:'',category:'Kebap',onlyAvailable:true}).map(p=>p.name),['İskender Kebap']);
 assert.equal(menu.length,4);
});
test('missing category names have readable fallback',()=>{
 assert.deepEqual(menuCategories(menu),[{name:'Kebap',count:2},{name:'Çiğköfte',count:1},{name:'Diğer',count:1}]);
 assert.equal(visibleMenuProducts(menu,{...base,category:'Diğer'}).length,1);
});
test('no results and empty menu are harmless',()=>{
 assert.deepEqual(visibleMenuProducts(menu,{...base,query:'bulunmayan'}),[]);
 assert.deepEqual(menuCategories([]),[]);
 assert.deepEqual(visibleMenuProducts([],{...base}),[]);
});
