// Katalog verisi: kaynak/data.js ve meta.js global olarak yükleniyor (index.html'de klasik
// <script>), burada tek bir ANIME dizisine katlanıp türetilmiş listeler hesaplanıyor.
//
// Globaller `window` yerine `globalThis` üzerinden okunuyor: tarayıcıda ikisi aynı şey, ama
// böylece modül Node'da da import edilebiliyor ve test veriyi global'e koyup gerçek ANIME
// kurulumunu doğrulayabiliyor (test/data.test.mjs).
// (Arama anahtarı üretimi ve puanlama js/eslesme.js'te — burası yalnız veriyi kuruyor.)

// meta.js kayıt biçimi: [kategori, [türIx...], puan, posterAdı, yıl, studyoIx]
// Tür ve stüdyo adları kayıt başına tekrarlanmıyor, sözlüklerden indeksle geliyor
// (bkz. scripts/build-meta.js). Poster de ortak öneksiz saklanıyor.
const META = globalThis.META || {};
const META_TURLER = globalThis.META_TURLER || [];
const META_STUDYOLAR = globalThis.META_STUDYOLAR || [];
// Tarayıcı tarafındaki eş: scripts/poster-onek.js. İkisi birlikte değişmeli.
const POSTER_KOK = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/';
const POSTER_ONEK = POSTER_KOK + 'medium/';

// AniList kapağı üç ölçüde veriyor (ölçüldü, 8 kapak ortalaması):
//   small  100x142   17 KB   ·  medium 230x326  57 KB  ·  large 460x652  231 KB
// Kartın ekrandaki genişliği 177 css px, şeritlerde 126 px olduğu için varsayılan medium;
// şeritler `small`e düşüyor (bkz. js/views/list.js SERIT_BOYUT).
function posterUrl(a, boyut = 'medium') {
  const ad = a && a.posterAd;
  if (!ad) return null;
  return /^https?:\/\//i.test(ad) ? ad : POSTER_KOK + boyut + '/' + ad;
}

// Yetişkin içerik türleri. Bu türlerden birini taşıyan anime kartında "18+" rozeti,
// detay sayfasında da uyarı paneli çıkar; ana sayfadaki keşif şeritlerine ve Günün
// Animesi'ne hiç girmez. ("Erotica" veride ayrı bir tür olarak duruyor.)
const NSFW_TURLER = new Set(['Ecchi', 'Hentai', 'Erotica']);

// Türkçe sıralamada tek bir karşılaştırıcı: String#localeCompare her çağrıda
// karşılaştırıcıyı yeniden kuruyor, 6107 kayıtta ölçülebilir fark yapıyor (§2.2).
const TR_SIRA = new Intl.Collator('tr');

const BOS_META = ['', [], 0, null, 0, -1];
const ANIME = (globalThis.INDEX || []).map(r => {
  const baslik = r[1] || r[0]; // kaynak veride bazı başlıklar null, slug'a düş
  const m = META[r[0]] || BOS_META;
  const tur = m[1].map(i => META_TURLER[i]).filter(Boolean);
  return {
    slug: r[0], baslik, eps: r[2], urls: r[3],
    kategori: m[0],
    // indeksten çözülen adlar sözlükteki tek dize örneğini paylaşır (bellek ve karşılaştırma ucuz)
    tur,
    nsfw: tur.some(t => NSFW_TURLER.has(t)),
    puan: m[2],
    poster: m[3] ? (/^https?:\/\//i.test(m[3]) ? m[3] : POSTER_ONEK + m[3]) : null,
    posterAd: m[3] || null,   // başka bir ölçü istenebilsin diye ham dosya adı (bkz. posterUrl)
    yil: m[4] || 0,
    studyo: m[5] >= 0 ? (META_STUDYOLAR[m[5]] || '') : ''
  };
}).sort((a, b) => TR_SIRA.compare(a.baslik, b.baslik));

const KATEGORILER = [...new Set(ANIME.map(a => a.kategori).filter(Boolean))].sort(TR_SIRA.compare);
const TURLER = [...META_TURLER].sort(TR_SIRA.compare);

// Onyıl filtresi: veride en eski 1910'lar, en yeni 2020'ler. Boş onyıl gösterilmiyor.
const ONYILLAR = [...new Set(ANIME.map(a => a.yil).filter(Boolean).map(y => Math.floor(y / 10) * 10))]
  .sort((a, b) => b - a);
const TOPLAM_BOLUM = ANIME.reduce((s, a) => s + (a.eps || 0), 0);
const TOPLAM_LINK = ANIME.reduce((s, a) => s + (a.urls || 0), 0);
function statsStripHtml() {
  const stat = (num, label) => `<div class="stat"><span class="stat-num">${num.toLocaleString('tr-TR')}</span><span class="stat-label">${label}</span></div>`;
  return `<div class="stats-strip">${stat(ANIME.length, 'anime')}${stat(TOPLAM_BOLUM, 'bölüm')}${stat(TOPLAM_LINK, 'izleme linki')}${stat(TURLER.length, 'tür')}</div>`;
}

// Gün boyunca aynı kalsın diye tarihi tohum olarak kullanan basit seçim (puanı 7 üstü animelerden).
function animeOfDay() {
  const pool = ANIME.filter(a => a.puan > 7 && !a.nsfw);
  if (!pool.length) return null;
  const seed = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}


// slug -> <script> elemanı, ekleniş sırasıyla (Map sırayı korur). Sınırsız büyümesin diye
// en eski girişler LOADED_CAP aşılınca hem DOM'dan hem globalThis.__TKA__'dan atılıyor.
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
        if (globalThis.__TKA__) delete globalThis.__TKA__[oldest];
      }
      resolve();
    };
    s.onerror = reject;
    document.body.appendChild(s);
  });
}


export { META, ANIME, KATEGORILER, TURLER, ONYILLAR, NSFW_TURLER, TOPLAM_BOLUM, TOPLAM_LINK,
  TR_SIRA, posterUrl, statsStripHtml, animeOfDay, loadScript };
