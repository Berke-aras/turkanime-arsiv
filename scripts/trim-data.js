#!/usr/bin/env node
// kaynak/data.js'i yalnız runtime'da kullanılan alanlarla yeniden yazar.
//
// Kayıt biçimi:  [slug, baslik, bolumSayisi, linkSayisi]
// Atılan alanlar: 5. `masks` (ölü link sayısı) ve 6. `top` (sağlayıcı adları dizisi). İkisi de
// app.js'te okunuyordu ama hiçbir yerde kullanılmıyordu; birlikte gzip'li açılış yükünün
// ~42 KB'ını tutuyorlardı (bkz. GELISTIRME-PLANI.md §2.1.1).
//
// Idempotent: zaten kırpılmış bir dosyada hiçbir şey değiştirmez. Veri tazelendikten sonra
// (6 alanlı data.js yeniden üretilirse) tekrar çalıştır:  node scripts/trim-data.js

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const KEEP = 4; // slug, baslik, eps, urls
const file = path.join(__dirname, "..", "kaynak", "data.js");
const kaynak = fs.readFileSync(file, "utf8");

const sandbox = { window: {} };
new vm.Script(kaynak).runInNewContext(sandbox);
const INDEX = sandbox.window.INDEX;
if (!Array.isArray(INDEX) || !INDEX.length) { console.error("kaynak/data.js içinde INDEX bulunamadı."); process.exit(1); }

const fazla = INDEX.filter(r => r.length > KEEP).length;
if (!fazla) { console.log(`${INDEX.length} kayıt zaten ${KEEP} alanlı, değişiklik yok.`); process.exit(0); }

const trimmed = INDEX.map(r => r.slice(0, KEEP));
const govde = "[" + trimmed.map(r => JSON.stringify(r)).join(",") + "]";
const cikti = `"use strict";\nwindow.INDEX = /*INDEX_START*/${govde}/*INDEX_END*/;\n`;

const onceki = Buffer.byteLength(kaynak);
fs.writeFileSync(file, cikti);
const sonraki = Buffer.byteLength(cikti);
const kb = b => (b / 1024).toFixed(0) + " KB";
console.log(`${INDEX.length} kayıt, ${fazla} tanesi kırpıldı.`);
console.log(`kaynak/data.js: ${kb(onceki)} -> ${kb(sonraki)} (ham)`);
