const CACHE='shiftmate-2.7.8-pta-forms';
const SHELL=['./','./index.html','./styles.css','./app.js','./shiftData.js','./payCalculator.js','./agreementData.js','./storage.js','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./manifest.json','./leave-form-template.pdf','./shift-change-form-template.png','./vendor/pdf-lib.min.js?v=1.17.1','./formPdfFields.js?v=1','./formPdf.js?v=1','./app.js?v=2.7.8-pta-forms','./agreementData.js?v=8.3','./shiftData.js?v=1.0.16','./payCalculator.js?v=1.0.16','./storage.js?v=8.3','./styles.css?v=2.7.7-offline-table','./apple-touch-icon.png?v=2.7.7-offline-table','./manifest.json?v=2.7.7-offline-table'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate')return caches.match('./index.html');
    return Response.error();
  }));
});
