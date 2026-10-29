const VERSION='3ce0e9d55100fb5b';
const PRECACHE=["/rhythmcut/","/rhythmcut/index.html","/rhythmcut/site.webmanifest","/rhythmcut/app-icon.svg","/rhythmcut/app-icon-192.png","/rhythmcut/app-icon-512.png","/rhythmcut/assets/audioAnalysis.worker-CFJQlkH7.js","/rhythmcut/assets/export.worker-zWCjFYHt.js","/rhythmcut/assets/index-Bc6koWIF.js","/rhythmcut/assets/index-DY-Pm-uc.css","/rhythmcut/assets/musicSemantic.worker-5_NXJxbX.js","/rhythmcut/assets/nativeExport-DcuoyPFN.js","/rhythmcut/assets/performanceDetector-DLOqejua.js","/rhythmcut/assets/planner.worker-Ce_A9MmZ.js","/rhythmcut/assets/preparedFrames.worker-ADyzrB0P.js","/rhythmcut/assets/previewPreparation.worker-DX1F0o6x.js","/rhythmcut/assets/sceneAnalysis.worker-CSt9zLR7.js","/rhythmcut/assets/subjectDetector-D4xSyVB-.js","/rhythmcut/assets/takeAnalysis.worker-CiFo_xjQ.js","/rhythmcut/assets/transformers.web-CknZZvPz.js","/rhythmcut/assets/transformers.web-CvJF76ZM.js","/rhythmcut/assets/vision_bundle-DbR16JA8.js","/rhythmcut/assets/worker-BOtfBjWk.js"];
const CACHE='rhythmcut-shell-'+VERSION;
const isolated=response=>{
  if(!response||response.type==='opaque'||response.status===0)return response;
  const headers=new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy','same-origin');headers.set('Cross-Origin-Embedder-Policy','require-corp');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE))));
self.addEventListener('message',event=>{if(event.data?.kind==='activate-update')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('rhythmcut-shell-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/rhythmcut/')||url.pathname.includes('/api/'))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const navigation=request.mode==='navigate';
    const immutable=/\/assets\/|\/vision\/|\/rust\/|\/onnx\//.test(url.pathname);
    if(immutable){const cached=await cache.match(request);if(cached)return isolated(cached);}
    try {
      const response=await fetch(request);
      if(response.ok&&(navigation||immutable||PRECACHE.includes(url.pathname)))await cache.put(navigation?'/rhythmcut/':request,response.clone());
      return isolated(response);
    }catch(error){
      const cached=await cache.match(navigation?'/rhythmcut/':request);
      if(cached)return isolated(cached);throw error;
    }
  })());
});
