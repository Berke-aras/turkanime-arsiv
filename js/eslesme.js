// Arama eşleştirmesinin saf çekirdeği: arama anahtarı üretimi ve bir animenin sorguya
// ne kadar uyduğunu söyleyen puanlama. DOM'a, localStorage'a ve uygulama durumuna
// dokunmaz — bu yüzden Node'da doğrudan birim testi yazılabiliyor (test/eslesme.test.mjs).
import { norm, levenshtein } from './util.js';

// Arama anahtarı yalnız arama yapılırken gerekiyor; açılışta 6107 kez norm() + split()
// çalıştırmak ilk boyamanın önünde duruyordu (§2.2 ölçümü: 17.3 ms). Bu yüzden ilk
// kullanımda üretilip kaydın üstünde saklanıyor.
// `n`  : norm edilmiş "başlık + slug" (ucuz `includes` eleme için)
// `tok`: aynı dizenin kelimeleri (yalnız bulanık/Levenshtein taramasında gerekiyor)
function aramaAnahtari(a) {
  if (a.n === undefined) a.n = norm(a.baslik + ' ' + a.slug);
  return a.n;
}
function aramaKelimeleri(a) {
  if (a.tok === undefined) a.tok = aramaAnahtari(a).split(' ').filter(Boolean);
  return a.tok;
}

// Her sorgu kelimesi anime'nin bir kelimesine ~%35 hata payıyla uymalı (AND).
// Dönen değer: 0 = tam isabet, büyüdükçe uzak; `null` = hiç uymuyor (elenir).
function matchScore(queryTokens, a) {
  if (!queryTokens.length) return 0;
  let score = 0;
  for (const qt of queryTokens) {
    if (aramaAnahtari(a).includes(qt)) continue;
    const threshold = Math.max(1, Math.ceil(qt.length / 3));
    let best = Infinity;
    for (const tok of aramaKelimeleri(a)) {
      if (Math.abs(tok.length - qt.length) > threshold) continue;
      const d = levenshtein(qt, tok);
      if (d < best) best = d;
      if (best === 0) break;
    }
    if (best > threshold) return null;
    score += best;
  }
  return score;
}

// --- anında arama önerileri (js/arama-oneri.js) ---
const ANIME_SAYI = 6, KARAKTER_SAYI = 3, SESLENDIRMEN_SAYI = 2;

// Başlıkla eşleşen animeler: başlık sorguyla başlıyorsa önce, sonra bir kelimesi sorguyla başlayanlar,
// sonra içinde geçenler. Eşitlikte kısa başlık (genelde ana seri: "Shingeki no Kyojin" önce, "... Final
// Season Part 2" sonra), o da eşitse puanı yüksek olan. Hiç tam eşleşme yoksa yazım hatasına toleranslı tarama.
function animeOnerileri(sorgu, liste, n = ANIME_SAYI) {
  const q = norm(sorgu);
  const kelimeler = q.split(' ').filter(Boolean);
  if (!kelimeler.length) return [];
  const sirali = [];
  for (const a of liste) {
    const anahtar = aramaAnahtari(a);
    if (!kelimeler.every(k => anahtar.includes(k))) continue;
    const baslik = norm(a.baslik);
    const derece = baslik.startsWith(q) ? 0 : (' ' + baslik).includes(' ' + kelimeler[0]) ? 1 : 2;
    sirali.push({ a, derece });
  }
  if (sirali.length) {
    return sirali.sort((x, y) => x.derece - y.derece || x.a.baslik.length - y.a.baslik.length || (y.a.puan || 0) - (x.a.puan || 0))
      .slice(0, n).map(x => x.a);
  }
  return liste.map(a => ({ a, p: matchScore(kelimeler, a) })).filter(x => x.p !== null)
    .sort((x, y) => x.p - y.p || (y.a.puan || 0) - (x.a.puan || 0)).slice(0, n).map(x => x.a);
}

// Kişi adı sorguya uyuyor mu: sorgunun her kelimesi adın bir kelimesinin başı olmalı ("lev" -> "Levi",
// "ackerman lev" -> "Levi Ackerman"). Derece: 0 tam ad, 1 ilk kelimeyle başlıyor, 2 diğer.
function kisiDerecesi(ad, kelimeler) {
  const adKelime = norm(ad).split(' ').filter(Boolean);
  if (!kelimeler.every(k => adKelime.some(a => a.startsWith(k)))) return -1;
  if (adKelime.join(' ') === kelimeler.join(' ')) return 0;
  return adKelime[0].startsWith(kelimeler[0]) ? 1 : 2;
}

// Seri anahtarı: slug'ın ilk kelimesi; kısaysa (one-piece, k-on) ilk iki kelimesi. Eşleri: js/sana-ozel.js,
// scripts/build-ara.js. "shingeki-no-kyojin" ile "shingeki-kyojin-chuugakkou" aynı seri sayılıyor.
const seriAnahtari = slug => { const p = slug.split('-'); return p[0].length >= 5 ? p[0] : p.slice(0, 2).join('-'); };

// Aynı adlı karakterin animeleri seriye (slug kökü) göre gruplanıyor; en kalabalık seri öne çıkıyor ve
// temsilcisi o serinin en kısa slug'lı kaydı (genellikle ana seri). Farklı serilerdeki adaşlar ayrı satır.
function karakterOnerileri(parca, kelimeler, slugBul, n = KARAKTER_SAYI) {
  const adaylar = [];
  for (const [ad, animeler] of parca.k || []) {
    const d = kisiDerecesi(ad, kelimeler);
    if (d < 0) continue;
    const seriler = new Map();
    for (const ix of animeler) {
      const a = slugBul(ix);
      if (!a) continue;
      const kok = seriAnahtari(a.slug);
      if (!seriler.has(kok)) seriler.set(kok, []);
      seriler.get(kok).push(a);
    }
    for (const grup of seriler.values()) {
      const temsilci = [...grup].sort((x, y) => x.slug.length - y.slug.length)[0];
      adaylar.push({ ad, a: temsilci, fazla: grup.length - 1, d, agirlik: grup.length });
    }
  }
  return adaylar.sort((x, y) => x.d - y.d || y.agirlik - x.agirlik || (y.a.puan || 0) - (x.a.puan || 0)).slice(0, n);
}
function seslendirmenOnerileri(parca, kelimeler, n = SESLENDIRMEN_SAYI) {
  return (parca.s || []).map(ad => ({ ad, d: kisiDerecesi(ad, kelimeler) })).filter(x => x.d >= 0)
    .sort((x, y) => x.d - y.d || x.ad.length - y.ad.length).slice(0, n).map(x => x.ad);
}

export { aramaAnahtari, aramaKelimeleri, matchScore, animeOnerileri, kisiDerecesi, karakterOnerileri, seslendirmenOnerileri };
