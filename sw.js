// İki ayrı cache:
//  - SHELL_CACHE: uygulama kabuğu + katalog verisi. Sabit boyutlu, sürüm atlayınca tamamen yenilenir.
//  - DATA_CACHE:  kaynak/b/<slug>.js ve info.json gibi talep üzerine gelen bölüm verisi. Tek bir
//    kaynak/b dosyası 3.4 MB'a kadar çıkabiliyor (one-piece), sınırsız biriktirilirse cihazda
//    yüzlerce MB'a ulaşıp kota hatasıyla SW'yi sessizce düşürüyordu. Bu yüzden LRU ile sınırlı.
const SHELL_CACHE = 'tka-shell-v25';
const DATA_CACHE = 'tka-data-v1';
const KEEP = new Set([SHELL_CACHE, DATA_CACHE]);
const DATA_CAP = 40;

// Katalog dosyaları da kabukta: bunlar olmadan çevrimdışı ilk açılış boş liste gösteriyordu.
const SHELL = ['./', 'index.html', 'style.css', 'kaynak/data.js', 'meta.js',
  'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png',
  // Yazı tipleri (§2.1.5): çevrimdışıyken de sistem fontuna düşmesin.
  'fonts/inter-latin.woff2', 'fonts/inter-latin-ext.woff2',
  // ES modülleri (bkz. js/main.js). Biri eksik kalırsa uygulama çevrimdışı açılmaz, o yüzden
  // hepsi kabuk cache'inde. Listenin eksiksizliğini test/veri-butunlugu.test.js doğruluyor.
  'js/main.js', 'js/arama-oneri.js', 'js/cards.js', 'js/cozum.js', 'js/sana-ozel.js', 'js/data.js', 'js/dom.js', 'js/eslesme.js', 'js/links.js',
  'js/player-dom.js', 'js/player-video.js', 'js/player.js', 'js/progress.js', 'js/router.js', 'js/search.js',
  'js/serit.js', 'js/state.js', 'js/store.js', 'js/theme.js', 'js/util.js', 'js/xray.js', 'js/xray-veri.js', 'js/xray-yukle.js', 'js/yedek.js',
  'js/views/bolum-listesi.js', 'js/views/detail.js', 'js/views/legal.js', 'js/views/list.js', 'js/views/seslendirmen.js',
  'js/views/yas-kapisi.js'];

const isData = url => /\/kaynak\/b\/[^/]+\.js$/.test(url.pathname) || /\/kaynak\/(x|sv|ara)\/[^/]+\.json$/.test(url.pathname) || /\/kaynak\/oneri\.json$/.test(url.pathname) || /\/kaynak\/animeler\/[^/]+\/info\.json$/.test(url.pathname);

self.addEventListener('install', e => {
  // addAll tek bir dosyada bile patlarsa kurulum tümden başarısız olur; tek tek ekleyip
  // eksik/404 bir dosyanın service worker'ı engellemesini önlüyoruz.
  e.waitUntil(caches.open(SHELL_CACHE)
    .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => !KEEP.has(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// En eski girişleri atarak veri cache'ini DATA_CAP ile sınırlar (cache.keys() ekleme sırasını korur).
async function trimData(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - DATA_CAP; i++) await cache.delete(keys[i]);
}

// Gezinme: network-first. Kabuk dosyaları için SWR kullanıldığında yeni sürüm hep "bir ziyaret
// sonra" geliyordu; böylece index.html değişikliği ilk yenilemede görünür, çevrimdışıyken cache'e düşer.
async function navigateStrategy(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put('index.html', res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req)) || (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
  }
}

// Bölüm verisi: stale-while-revalidate + LRU.
async function dataStrategy(req) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then(async res => {
    if (res.ok) { await cache.put(req, res.clone()); await trimData(cache); }
    return res;
  }).catch(() => cached);
  return cached || network;
}

// Kabuk: cache-first (sürüm değişince install zaten hepsini tazeliyor).
async function shellStrategy(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(navigateStrategy(req)); return; }
  e.respondWith(isData(url) ? dataStrategy(req) : shellStrategy(req));
});
