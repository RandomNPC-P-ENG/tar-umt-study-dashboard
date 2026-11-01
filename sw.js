const CACHE_PREFIX = 'tarumt-study-dashboard-';
const VERSION = 'cal5';
const CACHE = CACHE_PREFIX + VERSION;
const FILES = [
  'index.html','style.css','app.js','training-core.js','calisthenics.js',
  'schedule.json','workouts.json','manifest.webmanifest','icon-192.png',
  'icon-512.png','TAR_UMT_202609_Calendar.ics'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await Promise.all(FILES.map(async name=>{
      const url=new URL('./'+name+'?v='+VERSION,self.registration.scope);
      const response=await fetch(new Request(url,{cache:'reload'}));
      if(!response.ok)throw Error('Offline asset unavailable: '+name);
      await cache.put(url,response.clone());
      await cache.put(new URL('./'+name,self.registration.scope),response.clone());
      if(name==='index.html')await cache.put(new URL('./',self.registration.scope),response.clone());
    }));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys
    .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||!url.href.startsWith(self.registration.scope))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request,{ignoreSearch:true})
      .then(cached=>cached||caches.match(new URL('./index.html',self.registration.scope)))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
