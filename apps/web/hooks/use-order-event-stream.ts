'use client';
import {useEffect,useRef,useState} from 'react';
import {receiveOrderSignals} from '@/lib/order-stream-client';
export type RealtimeMode='connecting'|'live'|'fallback';

/** Short-lived Bearer SSE sessions. Re-authenticate on each reconnect.
 * Polling stays active independently to reconcile missed NOTIFY events.
 */
export function useOrderEventStream(
 path:string|null,token:()=>Promise<string>,onChanged:()=>void
):RealtimeMode{
 const callback=useRef(onChanged);
 const [mode,setMode]=useState<RealtimeMode>('connecting');
 useEffect(()=>{callback.current=onChanged},[onChanged]);
 useEffect(()=>{
  if(!path){setMode('fallback');return}
  let active=true;
  let controller:AbortController|null=null;
  let retry:ReturnType<typeof setTimeout>|null=null;
  let failures=0;
  const schedule=()=>{
   if(!active||retry||document.visibilityState!=='visible'||!navigator.onLine)return;
   const delay=Math.min(12_000,2000*2**Math.min(3,failures++));
   retry=setTimeout(()=>{retry=null;connect()},delay);
  };
  const connect=()=>{
   if(!active||controller||document.visibilityState!=='visible'||!navigator.onLine)return;
   const next=new AbortController();controller=next;
   setMode('connecting');
   let ready=false;
   const handshake=setTimeout(()=>{if(!ready)next.abort()},12_000);
   void (async()=>{
    try{
     const bearer=await token();
     if(next.signal.aborted)return;
     await receiveOrderSignals(path,bearer,next.signal,signal=>{
      if(!active||next.signal.aborted)return;
      if(signal==='ready'){
       ready=true;failures=0;clearTimeout(handshake);setMode('live');
      }
      // The first snapshot on every new stream closes the gap from
      // disconnected periods and cross-server notifications.
      callback.current();
     });
    }catch{/* HTTP snapshot polling remains source of truth */}
    finally{
     clearTimeout(handshake);
     if(controller===next)controller=null;
     if(active){setMode('fallback');schedule()}
    }
   })();
  };
  const visibility=()=>{
   if(document.visibilityState!=='visible'||!navigator.onLine){
    controller?.abort();setMode('fallback');
   }else{
    if(retry){clearTimeout(retry);retry=null}
    if(!controller)connect();
   }
  };
  visibility();
  window.addEventListener('online',visibility);
  window.addEventListener('offline',visibility);
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   active=false;
   controller?.abort();
   if(retry)clearTimeout(retry);
   window.removeEventListener('online',visibility);
   window.removeEventListener('offline',visibility);
   document.removeEventListener('visibilitychange',visibility);
  };
 },[path,token]);
 return mode;
}
