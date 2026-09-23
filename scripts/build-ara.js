"use strict";
// Ana sayfa için iki küçük dizin üretir (ikisi de kaynak/x/*.json'daki karakter listelerinden):
//
//  1. kaynak/ara/<harf>.json — anında arama önerilerinde karakter ve seslendirmen adları.
//     "Levi" yazınca Shingeki no Kyojin gelsin diye. Tek dosya ~1 MB olurdu; bu yüzden adın her kelimesinin
//     ilk harfine göre parçalanıyor, tarayıcı yalnız yazılan harfin parçasını indiriyor (bkz. js/oneri.js).
//     Biçim: { k: [[karakter, [animeIx...]], ...], s: [seslendirmen, ...] }   (animeIx: kaynak/data.js INDEX sırası)
//
//  2. kaynak/oneri.json — "Sana özel" şeridi için her animeye ortak seslendirmenden 8 öneri.
//     Biçim: { n: INDEX uzunluğu, o: { "<animeIx>": [animeIx...] } }
//
//   node scripts/build-ara.js      (build-xray.js / build-xray-ek.js'ten sonra; data.js değişince de)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { araHarf } = require("./xray-ortak");

const root = path.join(__dirname, "..");
const sb = { window: {} };
new vm.Script(fs.readFileSync(path.join(root, "kaynak", "data.js"), "utf8")).runInNewContext(sb);
const INDEX = sb.window.INDEX;
const ix = new Map(INDEX.map((r, i) => [r[0], i]));

const veri = new Map(); // animeIx -> k listesi
for (const r of INDEX) {
  const f = path.join(root, "kaynak", "x", r[0] + ".json");
  if (!fs.existsSync(f)) continue;
  const x = JSON.parse(fs.readFileSync(f, "utf8"));
  if (x.k && x.k.length) veri.set(ix.get(r[0]), x.k);
}

// --- 1. arama parçaları ---
const karakter = new Map(), seslendirmen = new Set();
for (const [i, k] of veri) {
  for (const [ad, , , va] of k) {
    if (ad) { if (!karakter.has(ad)) karakter.set(ad, new Set()); karakter.get(ad).add(i); }
    if (va) seslendirmen.add(va);
  }
}
const parcalar = new Map();
const parca = h => { if (!parcalar.has(h)) parcalar.set(h, { k: [], s: [] }); return parcalar.get(h); };
const harfler = ad => new Set(ad.split(/\s+/).map(araHarf).filter(Boolean));
for (const [ad, animeler] of [...karakter].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const h of harfler(ad)) parca(h).k.push([ad, [...animeler]]);
}
for (const ad of [...seslendirmen].sort()) for (const h of harfler(ad)) parca(h).s.push(ad);

const araDizin = path.join(root, "kaynak", "ara");
fs.rmSync(araDizin, { recursive: true, force: true });
fs.mkdirSync(araDizin, { recursive: true });
let toplam = 0, enBuyuk = 0;
for (const [h, p] of parcalar) {
  const m = JSON.stringify(p);
  toplam += m.length; enBuyuk = Math.max(enBuyuk, m.length);
  fs.writeFileSync(path.join(araDizin, h + ".json"), m);
}
console.log(`Arama: ${karakter.size} karakter, ${seslendirmen.size} seslendirmen, ${parcalar.size} parça, `
  + `toplam ${(toplam / 1024).toFixed(0)} KB, en büyük parça ${(enBuyuk / 1024).toFixed(0)} KB.`);

// --- 2. ortak seslendirmen önerileri ---
// Aynı seriden (slug kökü aynı) animeler öneri sayılmıyor: "Naruto" izleyene "Naruto Shippuuden"i
// detay sayfasındaki "Benzer animeler" zaten gösteriyor; burada yeni bir seri bulmak istiyoruz.
// Seri anahtarı: slug'ın ilk kelimesi; kısaysa (one-piece, k-on) ilk iki kelimesi. Eşi: js/sana-ozel.js kok.
const kok = slug => { const p = slug.split("-"); return p[0].length >= 5 ? p[0] : p.slice(0, 2).join("-"); };
const ayniSeri = (a, b) => kok(a) === kok(b) || `-${b}-`.includes(`-${kok(a)}-`) || `-${a}-`.includes(`-${kok(b)}-`);
const vaAnimeler = new Map(); // seslendirmen -> [{ i, ana }]
for (const [i, k] of veri) {
  for (const [, , rol, va] of k.slice(0, 10)) {
    if (!va) continue;
    if (!vaAnimeler.has(va)) vaAnimeler.set(va, []);
    vaAnimeler.get(va).push({ i, ana: rol === "A" });
  }
}
const oneri = {};
for (const [i, k] of veri) {
  const puan = new Map();
  for (const [, , rol, va] of k.slice(0, 10)) {
    const liste = va && vaAnimeler.get(va);
    // Çok üretken seslendirmenler (yüzlerce rol) ayırt edici değil; ağırlıkları düşük.
    if (!liste || liste.length < 2) continue;
    const agirlik = 1 / Math.log2(1 + liste.length);
    for (const b of liste) {
      if (b.i === i || ayniSeri(INDEX[i][0], INDEX[b.i][0])) continue;
      puan.set(b.i, (puan.get(b.i) || 0) + agirlik * (rol === "A" && b.ana ? 2 : 1));
    }
  }
  const en = [...puan].sort((a, b) => b[1] - a[1]).slice(0, 8).filter(([, p]) => p >= 0.5).map(([b]) => b);
  if (en.length) oneri[i] = en;
}
const oneriMetin = JSON.stringify({ n: INDEX.length, o: oneri });
fs.writeFileSync(path.join(root, "kaynak", "oneri.json"), oneriMetin);
console.log(`Öneri: ${Object.keys(oneri).length} animeye ortak seslendirmenden öneri, ${(oneriMetin.length / 1024).toFixed(0)} KB.`);
