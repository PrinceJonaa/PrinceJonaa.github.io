// Retire cached BeatCut app files without touching recordings in IndexedDB.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('beatcut-')).map(key => caches.delete(key)));
    await self.registration.unregister();
  })());
});
