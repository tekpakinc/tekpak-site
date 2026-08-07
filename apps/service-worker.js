const CACHE='tekpak-app-store-v2';
const SHELL=[
  './','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png',
  '../tekpaklogo.png','../assets/apps/hot-flash-logo.png','../assets/apps/provya-logo.png',
  '../assets/apps/quiet-focus-logo.png','../assets/apps/rc-reserve-logo.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));
});
