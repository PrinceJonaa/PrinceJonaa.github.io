const VERSION='23648c48589f98d9';
const PRECACHE=["/rhythmcut/","/rhythmcut/index.html","/rhythmcut/site.webmanifest","/rhythmcut/app-icon.svg","/rhythmcut/app-icon-192.png","/rhythmcut/app-icon-512.png","/rhythmcut/assets/audioAnalysis.worker-DN6xwFpd.js","/rhythmcut/assets/export.worker-DAmEV4UC.js","/rhythmcut/assets/index-AokvTsHH.js","/rhythmcut/assets/index-D9YMkyH4.css","/rhythmcut/assets/index-uZMLA32x.js","/rhythmcut/assets/musicSemantic.worker-Cjp4V8TR.js","/rhythmcut/assets/nativeExport-BttAwiry.js","/rhythmcut/assets/performanceDetector-gWq7K3hW.js","/rhythmcut/assets/planner.worker-CyV-caPV.js","/rhythmcut/assets/preparedFrames.worker-UsqqPSU-.js","/rhythmcut/assets/previewPreparation.worker-BRI5yC_X.js","/rhythmcut/assets/sceneAnalysis.worker-DbafMJL2.js","/rhythmcut/assets/subjectDetector-B13PC82O.js","/rhythmcut/assets/takeAnalysis.worker-uHDH8DTk.js","/rhythmcut/assets/transformers.web-BuKSjAse.js","/rhythmcut/assets/vision_bundle-x3Cmh837.js","/rhythmcut/assets/worker-0l8QF2aX.js","/rhythmcut/assets/__vite-browser-external-9wXp6ZBx.js"];
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
