import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMenuImportTsv,MENU_IMPORT_HEADER} from './menu-import-preview.ts';
test('TSV paste supports Turkish prices and optional header',()=>{
 const rows=parseMenuImportTsv(MENU_IMPORT_HEADER+'\nDöner\tTavuk Döner\t\t150,50\nPizza\tMantarlı Pizza\tPeynir\t200.00');
 assert.deepEqual(rows,[{categoryName:'Döner',productName:'Tavuk Döner',description:'',priceKurus:15050},
  {categoryName:'Pizza',productName:'Mantarlı Pizza',description:'Peynir',priceKurus:20000}]);
});
test('invalid columns, duplicates, negative and non-TL prices are rejected before upload',()=>{
 for(const source of [
  '', 'Döner\tTavuk\t150', 'Döner\tTavuk\t\t-10',
  'Döner\tTavuk\t\t1.234,50',
  'Döner\tTavuk\t\t100\ndöner\ttavuk\t\t90',
  'Döner\tTavuk\t\t',
  'Döner\tTavuk\t\t90\n'.repeat(51)
 ])assert.throws(()=>parseMenuImportTsv(source));
});
