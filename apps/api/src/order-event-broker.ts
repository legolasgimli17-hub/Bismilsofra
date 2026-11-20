/** Shared PostgreSQL LISTEN channel per API replica.
 * Internal NOTIFY includes only tenant/user UUID; SSE never forwards IDs.
 * NOTIFY is lossy across disconnects: clients MUST reconcile snapshots.
 */
import {Client,type Notification} from 'pg';
import {uuid} from './domain.ts';
export type OrderSignal={restaurantId:string;customerId:string};
type Subscriber={kind:'restaurant'|'customer';id:string;memberId:string;changed:()=>void};
export const MAX_OPEN_STREAMS=300;
export const MAX_STREAMS_PER_MEMBER=3;
export const SIGNAL_CHANNEL='bismil_order_events';

export function parseOrderSignal(value:string):OrderSignal|null{
 try{
  const item:unknown=JSON.parse(value);
  if(!item||typeof item!=='object'||Array.isArray(item))return null;
  const payload=item as Record<string,unknown>;
  if(!uuid(payload.restaurantId)||!uuid(payload.customerId))return null;
  return {restaurantId:payload.restaurantId,customerId:payload.customerId};
 }catch{return null}
}
export class OrderEventBroker{
 private client:Client|null=null;
 private connecting=false;
 private stopped=true;
 private retry:NodeJS.Timeout|null=null;
 private readonly subscribers=new Set<Subscriber>();
 private connected=false;
 private readonly connectionString:string;
 constructor(connectionString:string){this.connectionString=connectionString}
 get ready(){return this.connected}
 get subscribersCount(){return this.subscribers.size}
 canSubscribe(kind:Subscriber['kind'],id:string,memberId:string):boolean{
  if(!uuid(id)||!uuid(memberId)||this.subscribers.size>=MAX_OPEN_STREAMS)return false;
  let sameMember=0;
  for(const s of this.subscribers)
   if(s.kind===kind&&s.id===id&&s.memberId===memberId)sameMember++;
  return sameMember<MAX_STREAMS_PER_MEMBER;
 }
 subscribe(kind:Subscriber['kind'],id:string,changed:()=>void,memberId=id):()=>void{
  if(!this.canSubscribe(kind,id,memberId))throw Error('realtime subscriber capacity exceeded');
  const entry:Subscriber={kind,id,memberId,changed};
  this.subscribers.add(entry);
  return ()=>{this.subscribers.delete(entry)};
 }
 /** Exposed for unit verification; notifications must never contain PII. */
 dispatch(signal:OrderSignal){
  for(const s of this.subscribers)
   if((s.kind==='restaurant'?signal.restaurantId:signal.customerId)===s.id)
    try{s.changed()}catch{/* subscriber error cannot interrupt the shared listener */}
 }
 async start(){
  if(!this.stopped)return;
  this.stopped=false;
  await this.connect();
 }
 private scheduleReconnect(){
  if(this.stopped||this.retry)return;
  this.retry=setTimeout(()=>{
   this.retry=null;
   void this.connect();
  },2000);
  this.retry.unref();
 }
 private disconnect(client:Client){
  if(this.client!==client)return;
  this.connected=false;
  this.client=null;
  void client.end().catch(()=>{});
  this.scheduleReconnect();
 }
 private async connect(){
  if(this.stopped||this.connecting)return;
  this.connecting=true;
  const client=new Client({connectionString:this.connectionString,connectionTimeoutMillis:5000,keepAlive:true});
  this.client=client;
  client.on('error',()=>this.disconnect(client));
  client.on('end',()=>this.disconnect(client));
  client.on('notification',(message:Notification)=>{
   if(message.channel!==SIGNAL_CHANNEL||!message.payload)return;
   const signal=parseOrderSignal(message.payload);
   if(signal)this.dispatch(signal);
  });
  try{
   await client.connect();
   if(this.stopped){await client.end();return}
   await client.query('LISTEN '+SIGNAL_CHANNEL);
   this.connected=true;
  }catch{this.disconnect(client)}
  finally{this.connecting=false}
 }
 async stop(){
  this.stopped=true;this.connected=false;
  if(this.retry){clearTimeout(this.retry);this.retry=null}
  const client=this.client;this.client=null;
  if(client)await client.end().catch(()=>{});
  this.subscribers.clear();
 }
}
