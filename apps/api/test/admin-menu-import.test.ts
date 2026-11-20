import test from 'node:test';
import assert from 'node:assert/strict';
import {DomainError} from '../src/domain.ts';
import {parseMenuImport} from '../src/admin-menu-import.ts';
const row={categoryName:'Döner',productName:'Tavuk Döner',description:'',priceKurus:23000};
const key='pilot-import-123456789';
const fails=(body:unknown,code?:string)=>assert.throws(()=>parseMenuImport(body),(e:unknown)=>
 e instanceof DomainError&&e.statusCode>=400&&(!code||e.code===code));
test('normalize Turkish categories and exact integer kuruş deterministically',()=>{
 const first=parseMenuImport({importKey:key,rows:[{...row,categoryName:'  Döner ',productName:' Tavuk  Döner '}]});
 assert.deepEqual(first.rows,[row]);
 assert.match(first.sha256,/^[0-9a-f]{64}$/);
 assert.equal(parseMenuImport({importKey:'another-valid-key-123',rows:[row]}).sha256,first.sha256);
});
test('strict row counts, identity, duplicate and price validation',()=>{
 fails({importKey:'bad',rows:[row]});
 fails({importKey:key,rows:[]},'MENU_IMPORT_LIMIT');
 fails({importKey:key,rows:Array(51).fill(row)},'MENU_IMPORT_LIMIT');
 fails({importKey:key,rows:[row,{...row,categoryName:'döner',productName:'tavuk döner'}]},'MENU_IMPORT_DUPLICATE');
 fails({importKey:key,rows:[{...row,priceKurus:230.5}]});
 fails({importKey:key,rows:[{...row,priceKurus:-1}]});
 fails({importKey:key,rows:[{...row,productName:'<script>'}]});
 fails({importKey:key,rows:[{...row,description:'x'.repeat(601)}]});
 fails(null);
});
