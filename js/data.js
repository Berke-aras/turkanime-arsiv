// Katalog verisi: kaynak/data.js ve meta.js global olarak yükleniyor (index.html'de klasik
// <script>), burada tek bir ANIME dizisine katlanıp türetilmiş listeler hesaplanıyor.
import { norm } from './util.js';

const META = window.META || {};
const ANIME = (window.INDEX || []).map(r => {
  const baslik = r[1] || r[0]; // kaynak veride bazı başlıklar null, slug'a düş
  const n = norm(baslik + ' ' + r[0]);
  const m = META[r[0]] || ['', [], 0, null];
  return {
    slug: r[0], baslik, eps: r[2], urls: r[3],
    kategori: m[0], tur: m[1], puan: m[2], poster: m[3] || null,
    n, tok: n.split(' ').filter(Boolean)
  };
}).sort((a, b) => a.baslik.localeCompare(b.baslik, 'tr'));

const KATEGORILER = [...new Set(ANIME.map(a => a.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
const TURLER = [...new Set(ANIME.flatMap(a => a.tur))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'tr'));
const TOPLAM_BOLUM = ANIME.reduce((s, a) => s + (a.eps || 0), 0);
const TOPLAM_LINK = ANIME.reduce((s, a) => s + (a.urls || 0), 0);
function statsStripHtml() {
  const stat = (num, label) => `<div class="stat"><span class="stat-num">${num.toLocaleString('tr-TR')}</span><span class="stat-label">${label}</span></div>`;
  return `<div class="stats-strip">${stat(ANIME.length, 'anime')}${stat(TOPLAM_BOLUM, 'bölüm')}${stat(TOPLAM_LINK, 'izleme linki')}${stat(TURLER.length, 'tür')}</div>`;
}

// Gün boyunca aynı kalsın diye tarihi tohum olarak kullanan basit seçim (puanı 7 üstü animelerden).
const SFW_EXCLUDED_TUR = new Set(['Ecchi', 'Hentai']);
function animeOfDay() {
  const pool = ANIME.filter(a => a.puan > 7 && !a.tur.some(t => SFW_EXCLUDED_TUR.has(t)));
  if (!pool.length) return null;
  const seed = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}


// slug -> <script> elemanı, ekleniş sırasıyla (Map sırayı korur). Sınırsız büyümesin diye
// en eski girişler LOADED_CAP aşılınca hem DOM'dan hem window.__TKA__'dan atılıyor.
const loadedScripts = new Map();
const LOADED_CAP = 40;

function loadScript(slug) {
  if (loadedScripts.has(slug)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `kaynak/b/${slug}.js`;
    s.onload = () => {
      loadedScripts.set(slug, s);
      if (loadedScripts.size > LOADED_CAP) {
        const oldest = loadedScripts.keys().next().value;
        loadedScripts.get(oldest).remove();
        loadedScripts.delete(oldest);
        if (window.__TKA__) delete window.__TKA__[oldest];
      }
      resolve();
    };
    s.onerror = reject;
    document.body.appendChild(s);
  });
}


export { META, ANIME, KATEGORILER, TURLER, TOPLAM_BOLUM, TOPLAM_LINK, statsStripHtml, animeOfDay, loadScript };
