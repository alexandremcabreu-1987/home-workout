/* Home Workout 4.2 — atualização controlada, mesmo endereço do PWA. */
const CACHE='home-workout-shell-v4.2-final-1';
const SHELL=['./','./index.html','./planos.html','./v42.js','./arquivo-planos.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{await Promise.allSettled(SHELL.map(async path=>{let r=await fetch(path,{cache:'no-store'});if(r.ok)await cache.put(path,r)}))}))});
self.addEventListener('activate',event=>event.waitUntil((async()=>{let keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('home-workout-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 const url=new URL(request.url);if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 const isAppAsset=request.mode==='navigate'||/\.(?:html|js|webmanifest|png)$/.test(url.pathname)||url.pathname.endsWith('/');
 if(!isAppAsset)return;
 event.respondWith((async()=>{
  try{let response=await fetch(request,{cache:'no-store'});
   if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone())}
   return response;
  }catch(error){let cache=await caches.open(CACHE);let cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;
   if(request.mode==='navigate'){let fallback=await cache.match('./index.html');if(fallback)return fallback}
   throw error;
  }
 })());
});
