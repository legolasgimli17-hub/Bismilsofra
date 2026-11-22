/* Never cache API, customer pages, orders, tokens, authentication or dynamic HTML.
 * Cache only the approved static assets and one impersonal offline fallback.
 */
const CACHE='bismil-sofra-static-v09';
const OFFLINE='/offline.html';
const STATIC=['/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest',OFFLINE];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys()
  .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  // Network-first. Never cache a user's restaurant, order or account HTML.
  // A failed navigation receives a static, non-personalized offline page.
  event.respondWith(fetch(request).catch(async()=>{
   const offline=await caches.match(OFFLINE);
   return offline||Response.error();
  }));
  return;
 }
 if(STATIC.includes(url.pathname))
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
});
