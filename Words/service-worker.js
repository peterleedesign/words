const CACHE_NAME = 'bible-path-v4';
const CORE_FILES = ['./', './index.html', './manifest.webmanifest'];
const ICON_FILES = ['./icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CORE_FILES);
      // 아이콘이 하나 빠져 있어도 설치 자체는 실패하지 않도록 개별 처리
      await Promise.allSettled(ICON_FILES.map(file => cache.add(file)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // 페이지 이동: 네트워크 우선, 정상 응답(200번대)일 때만 캐시 갱신, 오프라인이면 캐시된 화면
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 그 외 파일(아이콘 등): 캐시를 먼저 보여주고 뒤에서 최신으로 갱신
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return (await network) || Response.error();
    })
  );
});
