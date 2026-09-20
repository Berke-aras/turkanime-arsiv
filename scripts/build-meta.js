"use strict";
// kaynak/animeler/*/info.json dosyalarından kategori/tür/puanı tek dosyada topluyor.
// Tek seferlik build scripti: node scripts/build-meta.js
const fs = require("fs");
const path = require("path");

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

const meta = {};
let ok = 0, fail = 0;
for (const slug of slugs) {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(root, slug, "info.json"), "utf8"));
    meta[slug] = [
      info["Kategori"] || "",
      info["Anime Türü"] || [],
      typeof info["Puanı"] === "number" ? info["Puanı"] : 0,
      (oldMeta[slug] && oldMeta[slug][3]) || null
    ];
    ok++;
  } catch (e) { fail++; }
}

const out = `"use strict";\nwindow.META = ${JSON.stringify(meta)};\n`;
fs.writeFileSync(metaPath, out);
console.log(`meta.js yazıldı: ${ok} anime, ${fail} hata, ${(out.length / 1024).toFixed(0)} KB`);
