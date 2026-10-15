const CACHE='shiftmate-2.7.9-leave-loading';
const SHELL=['./','./index.html','./styles.css','./app.js','./shiftData.js','./payCalculator.js','./annualLeaveLoading.js','./annualLeaveLoading.js?v=2.7.9-leave-loading','./app.js?v=2.7.9-leave-loading','./shiftData.js?v=2.7.9-leave-loading','./payCalculator.js?v=2.7.9-leave-loading','./agreementData.js','./storage.js','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./manifest.json','./leave-form-template.png','./styles.css?v=2.7.9-leave-loading','./apple-touch-icon.png?v=2.7.9-leave-loading','./manifest.json?v=2.7.9-leave-loading','./agreementData.js?v=8.3','./storage.js?v=8.3'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
