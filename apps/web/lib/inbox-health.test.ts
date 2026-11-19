import test from 'node:test';import assert from 'node:assert/strict';import {canActOnInbox,inboxLabel,MAX_INBOX_AGE_MS,unseenPendingIds} from './inbox-health.ts';
test('fresh connection allows actions',()=>assert.equal(canActOnInbox('connected',100_000,100_500),true));
test('offline connection blocks stale actions',()=>assert.equal(canActOnInbox('offline',100_000,101_000),false));
test('stale or missing sync blocks actions',()=>{assert.equal(canActOnInbox('connected',100_000,100_000+MAX_INBOX_AGE_MS),false);assert.equal(canActOnInbox('connected',0,100_000),false)});
test('connection notices are explicit',()=>{assert.match(inboxLabel('offline',false),/kesildi/);assert.match(inboxLabel('connected',true),/aktif/);assert.match(inboxLabel('connecting',false),/eşitleniyor/)});

test('new order alerts do not repeat on polling or reconnect',()=>{
 assert.deepEqual(unseenPendingIds(['a'],['a','b','b']),['b']);
 assert.deepEqual(unseenPendingIds(['a','b'],['a','b']),[]);
 assert.deepEqual(unseenPendingIds([],['new']),['new']);
});
