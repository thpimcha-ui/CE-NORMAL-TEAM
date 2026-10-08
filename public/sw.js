'use strict';
// Cache only this public offline page and icons. Never cache account data or API responses.
const CACHE='ce-public-offline-v1';
const PUBLIC_FILES=['/offline.html','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_FILES))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ce-public-offline-')&&k!==CACHE).map(k=>caches.delete(k)))),
 self.clients.claim()
])));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate')event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));
});
