"use strict";
// kaynak/animeler/*/info.json dosyalarından liste görünümünün ihtiyaç duyduğu alanları tek dosyada
// topluyor. Çalıştırma: node scripts/build-meta.js
//
// Kayıt biçimi:  [kategori, [türIx...], puan, poster, yıl, studyoIx]
//   poster    build-posters.js tarafından doldurulur; bu script mevcut değeri korur.
//             Ortak önek çıkarılmış hâlde saklanır (bkz. scripts/poster-onek.js).
//   yıl       "Başlama Tarihi" içindeki ilk 4 haneli sayı (6107 animenin 6092'sinde var); yoksa 0.
//   türIx     window.META_TURLER dizisine indeks (52 farklı tür).
//   studyoIx  window.META_STUDYOLAR dizisine indeks (791 farklı stüdyo); yoksa -1.
//
// Tür ve stüdyo adları kayıt başına tekrarlanmak yerine dizinleniyor: 6107 kayıtta ham boyut
// 923 KB -> 506 KB'a iniyor (JS ayrıştırma süresi ham bayta bağlı). Çözme js/data.js'te tek map.
const fs = require("fs");
const path = require("path");
const { posterKisalt } = require("./poster-onek");

const root = path.join(__dirname, "..", "kaynak", "animeler");
const slugs = fs.readdirSync(root).filter(s => fs.statSync(path.join(root, s)).isDirectory());

// mevcut meta.js'teki poster alanını koru, build-posters.js'in işini silme
const metaPath = path.join(__dirname, "..", "meta.js");
let oldMeta = {};
try {
  const sandbox = { window: {} };
  new (require("vm").Script)(fs.readFileSync(metaPath, "utf8")).runInNewContext(sandbox);
  oldMeta = sandbox.window.META || {};
} catch (e) { /* ilk çalıştırma, meta.js henüz yok */ }

// Önce ham kayıtlar okunuyor, sonra tür/stüdyo sözlükleri kurulup indekse çevriliyor.
const ham = {};
let ok = 0, fail = 0, yilli = 0, studyolu = 0;
for (const slug of slugs) {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(root, slug, "info.json"), "utf8"));
    const yilEslesme = /(\d{4})/.exec(info["Başlama Tarihi"] || "");
    const yil = yilEslesme ? Number(yilEslesme[1]) : 0;
    const studyo = (info["Stüdyo"] || "").trim();
    ham[slug] = {
      kategori: info["Kategori"] || "",
      turler: info["Anime Türü"] || [],
      puan: typeof info["Puanı"] === "number" ? info["Puanı"] : 0,
      poster: posterKisalt((oldMeta[slug] && oldMeta[slug][3]) || null),
      yil,
      studyo: studyo === "?" ? "" : studyo
    };
    if (yil) yilli++;
    if (ham[slug].studyo) studyolu++;
    ok++;
  } catch (e) { fail++; }
}

// Sözlükler alfabetik: çıktı deterministik olsun, git diff'i gürültülü olmasın.
const sirala = (a, b) => a.localeCompare(b, "tr");
const TURLER = [...new Set(Object.values(ham).flatMap(h => h.turler))].filter(Boolean).sort(sirala);
const STUDYOLAR = [...new Set(Object.values(ham).map(h => h.studyo))].filter(Boolean).sort(sirala);
const turIx = new Map(TURLER.map((t, i) => [t, i]));
const studyoIx = new Map(STUDYOLAR.map((s, i) => [s, i]));

const meta = {};
for (const [slug, h] of Object.entries(ham)) {
  meta[slug] = [h.kategori, h.turler.filter(Boolean).map(t => turIx.get(t)), h.puan, h.poster, h.yil,
    h.studyo ? studyoIx.get(h.studyo) : -1];
}

const out = `"use strict";\n`
  + `window.META_TURLER = ${JSON.stringify(TURLER)};\n`
  + `window.META_STUDYOLAR = ${JSON.stringify(STUDYOLAR)};\n`
  + `window.META = ${JSON.stringify(meta)};\n`;
fs.writeFileSync(metaPath, out);
console.log(`meta.js yazıldı: ${ok} anime, ${fail} hata, ${(out.length / 1024).toFixed(0)} KB`);
console.log(`  yıl: ${yilli}, stüdyo: ${studyolu} | sözlük: ${TURLER.length} tür, ${STUDYOLAR.length} stüdyo`);
