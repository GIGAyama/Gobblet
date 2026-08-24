/*
 * パクパクゴブレット — Service Worker
 *
 * 【重要】activate では自アプリ以外のキャッシュを削除しない。
 *   旧配信元の gigayama.github.io は複数のアプリで同一オリジンを共有していた。
 *   同居する配置に戻したときに他アプリを巻き込まないよう、
 *   caches.keys() を全部消すと、他のアプリがオフラインで起動しなくなる。
 *   CACHE_PREFIX で始まるキャッシュだけを掃除すること。
 *
 * このアプリは記録を保存しないが、方針として Service Worker は
 * localStorage を一切操作しない。
 */
const CACHE_PREFIX = 'gobblet-';
// ⚠️ この行は手で直さない。tools/build-sw.mjs が PRECACHE_URLS の中身から書き換える。
//    手書きだったころは上げるのが人の仕事で、2026-08-21 に12リポジトリで同時に
//    上げ忘れる事故が起きた。上げ忘れると古いシェルのキャッシュが掃除されず、
//    直した画面が端末に届かない。
const APP_VERSION = 'v6ec44bcb'; /* __APP_VERSION__ */
const CACHE_STATIC = CACHE_PREFIX + 'static-' + APP_VERSION;
const CACHE_RUNTIME = CACHE_PREFIX + 'runtime-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/offline.css',
  './js/pwa-install.js',
  './js/rules.js',
  './js/furigana.js',
  './js/app.js',
  './js/offline.js',
  './icon.svg',
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE_STATIC);
  // 1本でも失敗すると addAll は全体が落ちる。1件ずつ入れて、
  // 取りこぼしがあっても残りはキャッシュされるようにする。
  await Promise.all(PRECACHE_URLS.map(url =>
    cache.add(new Request(url, { cache: 'reload' }))
      .catch(err => console.warn('[sw] precache skipped', url, err))));
  // ここでは skipWaiting しない。対局の途中で新版に切り替わると
  // 画面が作り直されてしまうため、切り替えは利用者の操作を待つ。
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_STATIC && key !== CACHE_RUNTIME)
    .map(key => caches.delete(key)));          // ← 自アプリ分だけ削除
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 画面遷移は network-first。更新をすぐ届け、圏外ならキャッシュ→offline.html の順に出す
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put('./index.html', copy));
        }
        return response;
      } catch {
        return (await caches.match('./index.html'))
            || (await caches.match(request))
            || (await caches.match('./offline.html'));
      }
    })());
    return;
  }

  // 静的ファイルは cache-first（校内Wi-Fi が混んでいても即表示される）
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_RUNTIME).then(cache => cache.put(request, copy));
    }
    return response;
  })());
});

// 「さいしんに する」が押されたときだけ、新しい版に切り替える
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
