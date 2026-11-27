/* Network-first, skipping the browser's HTTP cache so a new release shows on the next open.
   Network-first: updates arrive immediately when online, cached copy when offline.
   This file never touches the planner's saved data (that lives in localStorage). */
const CACHE = 'life-planner-v25';
const CORE = ['./', './index.html', './style.css?v=17', './app.js?v=17', './manifest.webmanifest', './icon-180.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: u.pathname.endsWith('updates.json') }).then(r => r || caches.match('./index.html'))));
});
