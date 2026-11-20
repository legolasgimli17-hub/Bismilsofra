import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProductOption} from './product-option-ui.ts';
import {preserveDirtyDrafts} from './option-editor-state.ts';

test('optional single-select allows clearing and replacing a choice',()=>{
 const first=selectProductOption([],'cheese',true,1);
 assert.deepEqual(first,['cheese']);
 assert.deepEqual(selectProductOption(first,'cheese',false,1),[]);
 assert.deepEqual(selectProductOption(first,'sauce',true,1),['sauce']);
});
test('multiple-selection group never exceeds max and can remove an option',()=>{
 const first=selectProductOption(['a'],'b',true,2);
 assert.deepEqual(first,['a','b']);
 assert.deepEqual(selectProductOption(first,'c',true,2),['a','b']);
 assert.deepEqual(selectProductOption(first,'a',false,2),['b']);
 assert.deepEqual(selectProductOption(['a'],'a',true,2),['a']);
});
test('reject invalid max selection without adding choices',()=>{
 assert.deepEqual(selectProductOption(['a'],'b',true,0),['a']);
 assert.deepEqual(selectProductOption(['a'],'b',true,13),['a']);
});
test('refresh keeps other unsaved group drafts and stale revision for conflict safety',()=>{
 const local={groupA:{name:'Edited local',revision:4},groupB:{name:'Saved',revision:5}};
 const remote={groupA:{name:'Updated remote',revision:6},groupB:{name:'Saved',revision:6}};
 const result=preserveDirtyDrafts(remote,local,new Set(['groupA']));
 assert.deepEqual(result.groupA,local.groupA);
 assert.deepEqual(result.groupB,remote.groupB);
});
test('refresh drops removed rows and follows server for untouched rows',()=>{
 const remote={newRow:{price:200},existing:{price:400}};
 const local={deleted:{price:100},existing:{price:300}};
 assert.deepEqual(preserveDirtyDrafts(remote,local,new Set(['deleted'])),remote);
});
