// Service Worker — 항상 최신 버전 유지
const CACHE = 'kakeibo-v1';

self.addEventListener('install', e => {
  self.skipWaiting(); // 즉시 활성화
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k))) // 이전 캐시 전부 삭제
    ).then(() => self.clients.claim())
  );
});

// 네트워크 우선 — 항상 최신 파일을 가져옴
self.addEventListener('fetch', e => {
  // API 요청은 캐시 안 함
  if(e.request.url.includes('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 성공하면 캐시에 저장
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request)) // 오프라인이면 캐시 사용
  );
});
