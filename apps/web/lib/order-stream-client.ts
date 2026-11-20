/** Browser SSE over fetch(), never EventSource: it cannot send Bearer headers.
 * Neither access tokens nor customer IDs are put in a stream URL.
 */
const BASE=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,'')||'';
export type RealtimeSignal='ready'|'changed';

export class SseSignalDecoder{
 private buffer='';
 private event='';
 private data=false;
 feed(chunk:string):RealtimeSignal[]{
  this.buffer+=chunk;
  if(this.buffer.length>16_384)throw Error('SSE event too large');
  const emitted:RealtimeSignal[]=[];
  for(let at=this.buffer.indexOf('\n');at!==-1;at=this.buffer.indexOf('\n')){
   const raw=this.buffer.slice(0,at);
   this.buffer=this.buffer.slice(at+1);
   const line=raw.endsWith('\r')?raw.slice(0,-1):raw;
   if(!line){
    if(this.data&&(this.event==='ready'||this.event==='changed'))
     emitted.push(this.event);
    this.event='';this.data=false;
   }else if(line.startsWith('event:')){
    this.event=line.slice(6).trim();
   }else if(line.startsWith('data:')){
    this.data=true;
   }
  }
  return emitted;
 }
}
export async function receiveOrderSignals(
 path:string,token:string,signal:AbortSignal,emit:(signal:RealtimeSignal)=>void
):Promise<void>{
 if(!BASE)throw Error('API has not been configured');
 if(!/^\/v1\/(?:restaurant\/[a-f0-9-]{36}\/events|me\/orders\/[a-f0-9-]{36}\/events)$/i.test(path))
  throw Error('Invalid SSE route');
 const response=await fetch(BASE+path,{
  method:'GET',headers:{Authorization:'Bearer '+token,Accept:'text/event-stream'},
  credentials:'omit',signal,cache:'no-store'
 });
 if(!response.ok||!response.body||!response.headers.get('Content-Type')?.includes('text/event-stream'))
  throw Error('Realtime stream is not available');
 const reader=response.body.getReader();
 const decoder=new SseSignalDecoder();
 const text=new TextDecoder();
 try{
  while(!signal.aborted){
   const result=await reader.read();
   if(result.done)return;
   const messages=decoder.feed(text.decode(result.value,{stream:true}));
   for(const message of messages)if(!signal.aborted)emit(message);
  }
 }finally{
  void reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
}
