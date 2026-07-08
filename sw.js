// かごメモ Service Worker — アプリ本体をキャッシュしてオフラインでも開けるようにする。
// Supabase(認証/DB/Realtime)は常にネットワークを使う（キャッシュしない）。
const CACHE = "kagomemo-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Supabase（認証・DB・Realtime）はキャッシュせず素通し
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;

  // 同一オリジン（アプリ本体）：キャッシュ優先。無ければ取得してキャッシュ、失敗時は index.html
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => caches.match("./index.html"))
      )
    );
    return;
  }

  // CDN（esm.sh 等）：stale-while-revalidate
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
