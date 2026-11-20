/** Authenticated SSE: short-lived, no cookie/token in query parameters.
 * Re-checks server-side identity and staff membership before broadcasting.
 * Events are just invalidation signals; browser must fetch authorized snapshots.
 */
import type {FastifyRequest,FastifyReply} from 'fastify';
import type {Pool} from 'pg';
import type {OrderEventBroker} from './order-event-broker.ts';
import {invalid} from './domain.ts';

export type StreamKind='restaurant'|'customer';
export const STREAM_TTL_MS=45_000;
export const STREAM_HEARTBEAT_MS=15_000;

export async function openOrderStream(
 req:FastifyRequest,reply:FastifyReply,broker:OrderEventBroker,pool:Pool,
 kind:StreamKind,subjectId:string,memberId:string,
 allowedOrigin:string
){
 if(!broker.ready)invalid('REALTIME_UNAVAILABLE','Canlı akışa bağlanılamadı; sayfa yenileme devrede olmalı.',503);
 if(!broker.canSubscribe(kind,subjectId,memberId))
  invalid('STREAM_LIMIT','Çok fazla açık canlı bağlantı var. HTTP yenileme kullanılmalı.',503);
 // Nothing (including even an empty SSE stream) can be emitted before the
 // caller has verified the signed JWT and owner-scoped order/staff membership.
 reply.hijack();
 const res=reply.raw;
 res.setHeader('Content-Type','text/event-stream; charset=utf-8');
 res.setHeader('Cache-Control','no-store, no-transform');
 res.setHeader('X-Accel-Buffering','no');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 if(req.headers.origin===allowedOrigin)
  res.setHeader('Access-Control-Allow-Origin',allowedOrigin);
 res.statusCode=200;
 res.flushHeaders();
 let ended=false;
 let timer:NodeJS.Timeout|null=null;
 let ttl:NodeJS.Timeout|null=null;
 let dispose:()=>void=()=>{};
 const close=()=>{
  if(ended)return;ended=true;
  if(timer)clearInterval(timer);
  if(ttl)clearTimeout(ttl);
  dispose();
  res.off('close',close);
 };
 res.on('close',close);
 const send=(line:string)=>{
  if(ended||res.destroyed)return;
  if(res.writableLength>8192){close();res.end();return}
  // A slow mobile device cannot hold unbounded unread event buffers.
  if(!res.write(line)){close();res.end()}
 };
 let checking=false;
 let again=false;
 const changed=()=>{
  if(ended)return;
  if(checking){again=true;return}
  checking=true;
  void (async()=>{
   try{
    do{
     again=false;
     const access=kind==='restaurant'
      ?await pool.query(`SELECT 1 FROM restaurant_staff s JOIN users u
         ON u.id=s.user_id AND u.enabled=true
         WHERE s.restaurant_id=$1 AND s.user_id=$2
          AND (s.role IN ('owner','manager') OR s.can_view_orders=true)`,[subjectId,memberId])
      :await pool.query('SELECT 1 FROM users WHERE id=$1 AND enabled=true',[memberId]);
     if(!access.rowCount){close();res.end();return}
     send('event: changed\ndata: {}\n\n');
    }while(again&&!ended);
   }catch{close();res.end()}
   finally{checking=false}
  })();
 };
 dispose=broker.subscribe(kind,subjectId,changed,memberId);
 timer=setInterval(()=>{send(': heartbeat\n\n')},STREAM_HEARTBEAT_MS);
 ttl=setTimeout(()=>{close();res.end()},STREAM_TTL_MS);
 timer.unref();ttl.unref();
 send('retry: 2000\nevent: ready\ndata: {}\n\n');
}
