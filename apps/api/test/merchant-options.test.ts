import test from 'node:test';
import assert from 'node:assert/strict';
import {DomainError} from '../src/domain.ts';
import {parseNewGroup,parseGroupUpdate,parseNewChoice,parseChoiceUpdate,assertEnoughChoices,normalizedOptionName,
 MAX_OPTION_GROUPS_PER_PRODUCT,MAX_CHOICES_PER_GROUP} from '../src/merchant-options.ts';

const code=(wanted:string)=>(error:unknown)=>error instanceof DomainError&&error.code===wanted;
test('new group and choice input normalizes whitespace and Turkish letters',()=>{
 assert.deepEqual(parseNewGroup({name:'  Acı   Seviyesi '}),{name:'Acı Seviyesi'});
 assert.deepEqual(parseNewChoice({name:' Ekstra   Kaşar ',priceKurus:1750}),{name:'Ekstra Kaşar',priceKurus:1750});
 assert.equal(normalizedOptionName('İÇECEK'),'içecek');
});
test('group update bounds, archive, optimistic version',()=>{
 assert.deepEqual(parseGroupUpdate({name:'İçecek',minSelect:1,maxSelect:1,archived:false,revision:2}),{
  name:'İçecek',minSelect:1,maxSelect:1,archived:false,revision:2});
 assert.deepEqual(parseGroupUpdate({name:'Sos',minSelect:0,maxSelect:3,archived:true,revision:1}).archived,true);
});
test('group rules reject invalid counts and invalid archive flag',()=>{
 for(const rule of [{minSelect:3,maxSelect:1},{minSelect:-1,maxSelect:1},
  {minSelect:0,maxSelect:13},{minSelect:0,maxSelect:0},{minSelect:1.5,maxSelect:3},
  {minSelect:1,maxSelect:1,archived:'false'}]){
  assert.throws(()=>parseGroupUpdate({name:'Soslar',minSelect:0,maxSelect:1,archived:false,revision:1,...rule}),code('OPTION_RULE_INVALID'));
 }
});
test('choice price must be bounded integer kuruş',()=>{
 for(const n of [-1,12.5,100000001,'1500',null])
  assert.throws(()=>parseNewChoice({name:'Kola',priceKurus:n}),code('OPTION_PRICE_INVALID'));
 assert.equal(parseNewChoice({name:'Su',priceKurus:0}).priceKurus,0);
});
test('choice updates require available boolean and revision',()=>{
 assert.deepEqual(parseChoiceUpdate({name:'Kola',priceKurus:2500,available:false,revision:3}),{
  name:'Kola',priceKurus:2500,available:false,revision:3});
 assert.throws(()=>parseChoiceUpdate({name:'Kola',priceKurus:0,available:1,revision:2}),code('OPTION_INVALID'));
 assert.throws(()=>parseChoiceUpdate({name:'Kola',priceKurus:0,available:true,revision:0}),code('OPTION_REVISION_REQUIRED'));
});
test('reject invalid names and HTML-like input',()=>{
 assert.throws(()=>parseNewGroup({name:'A'}),code('OPTION_INVALID'));
 assert.throws(()=>parseNewChoice({name:'<script>',priceKurus:0}),code('OPTION_INVALID'));
 assert.throws(()=>parseNewGroup([]),code('OPTION_INVALID'));
});
test('active required groups cannot have fewer available options than minimum',()=>{
 assert.doesNotThrow(()=>assertEnoughChoices(1,2,false));
 assert.doesNotThrow(()=>assertEnoughChoices(1,0,true));
 assert.throws(()=>assertEnoughChoices(2,1,false),code('OPTION_MIN_REQUIRED'));
});
test('option limits are bounded to the small Bismil merchant pilot scale',()=>{
 assert.equal(MAX_OPTION_GROUPS_PER_PRODUCT,8);
 assert.equal(MAX_CHOICES_PER_GROUP,12);
});
