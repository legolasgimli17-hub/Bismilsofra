/* Cache only known static shell assets; NEVER cache API, user, order or auth requests. */
const CACHE='bismil-sofra-static-v08';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!['/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'].includes(u.pathname))return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)))});
