import test from 'node:test';
import assert from 'node:assert/strict';
import {SseSignalDecoder} from './order-stream-client.ts';
test('SSE decoder handles split packets and heartbeat comments',()=>{
 const p=new SseSignalDecoder();
 assert.deepEqual(p.feed('retry: 2000\nevent: ready\nda'),[]);
 assert.deepEqual(p.feed('ta: {}\n\n: heartbeat\n\n'),['ready']);
 assert.deepEqual(p.feed('event: changed\ndata: {}\n\n'),['changed']);
});
test('SSE parser does not act on comments, empty or unidentified events',()=>{
 const p=new SseSignalDecoder();
 assert.deepEqual(p.feed(': heartbeat\n\nevent: fake\ndata: {}\n\n'),[]);
 assert.deepEqual(p.feed('event: changed\n\n'),[]);
 assert.deepEqual(p.feed('event: changed\r\ndata: {}\r\n\r\n'),['changed']);
});
test('multiple events in one response and bounded decoder memory',()=>{
 const p=new SseSignalDecoder();
 assert.deepEqual(p.feed('event: changed\ndata: {}\n\nevent: changed\ndata: {}\n\n'),['changed','changed']);
 assert.throws(()=>p.feed('x'.repeat(20_000)),/too large/);
});
