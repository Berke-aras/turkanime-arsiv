"use strict";
// meta.js'teki poster alanı, AniList kapak URL'lerinin tamamının paylaştığı öneki taşımıyor:
// 5204 posterin %100'ü aynı önekle başladığı için önek sabite alındı, meta'da yalnız dosya adı
// duruyor (ham boyutta ~320 KB tasarruf, bkz. GELISTIRME-PLANI.md §2.1.2).
//
// Tarayıcı tarafındaki eşi: js/data.js içindeki POSTER_ONEK. İkisi birlikte değişmeli.
const POSTER_ONEK = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/";

// Tam URL -> saklanan kısa ad. Önek tutmuyorsa (başka bir CDN) URL olduğu gibi kalır.
const posterKisalt = url => !url ? null : (url.startsWith(POSTER_ONEK) ? url.slice(POSTER_ONEK.length) : url);
// Saklanan değer -> tam URL. Zaten mutlaksa dokunmaz; bu sayede script tekrar çalıştırılabilir.
const posterAc = v => !v ? null : (/^https?:\/\//i.test(v) ? v : POSTER_ONEK + v);

module.exports = { POSTER_ONEK, posterKisalt, posterAc };
