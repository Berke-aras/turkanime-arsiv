#!/usr/bin/env node
"use strict";
// kaynak/b/<slug>.js içindeki ÖLÜ linkleri tek bir sayıya indirir (GELISTIRME-PLANI.md §3.2).
//
//   node scripts/trim-b.js            (varsayılan) hiçbir şey yazmaz, ne kazanılacağını raporlar
//   node scripts/trim-b.js --yaz      kaynak/b'yi yerinde yeniden yazar
//   node scripts/trim-b.js --slug beck
//
// Ölü link = tip'i "url" olmayan her link ("mask" ve "yol"). turkanime.tv kapalı olduğu için
// hiçbiri asla çalışmayacak; ekranı 15 tane üstü çizili butonla doldurmak yerine bölüm başına
//   "olu": <sayı>
// alanı bırakılıyor, arayüz tek satırda "N arşiv linki artık çalışmıyor" diyor.
//
// GERİ ALINABİLİR: atılan linkler kaynak/animeler'deki ham veride duruyor; kaynak/b
// scripts/build-b.js ile yeniden üretilebilir (bkz. §3.1).
//
// Idempotent: zaten kırpılmış dosyada hiçbir şey değişmez.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CIKTI = path.join(__dirname, "..", "kaynak", "b");
const argv = process.argv.slice(2);
const yaz = argv.includes("--yaz");
const tekSlug = argv.includes("--slug") ? argv[argv.indexOf("--slug") + 1] : null;

// Bölüm listesini kırpar. build-b.js de aynı işlevi çağırıyor ki iki script aynı çıktıyı üretsin.
function bolumleriKirp(bolumler) {
  return bolumler.map(b => {
    const canli = b.links.filter(l => l.tip === "url");
    const oluSayisi = b.links.length - canli.length;
    const yeni = { no: b.no, ad: b.ad, slug: b.slug, links: canli };
    if (oluSayisi) yeni.olu = oluSayisi;
    return yeni;
  });
}

const dosyaIcerigi = (slug, bolumler) =>
  `window.__TKA__=window.__TKA__||{};window.__TKA__[${JSON.stringify(slug)}]=${JSON.stringify(bolumler)};`;

function bolumleriOku(slug, metin) {
  const sandbox = { window: { __TKA__: {} } };
  new vm.Script(metin).runInNewContext(sandbox);
  const b = sandbox.window.__TKA__[slug];
  if (!Array.isArray(b)) throw new Error("bölüm dizisi okunamadı");
  return b;
}

if (require.main === module) {
  const dosyalar = tekSlug ? [`${tekSlug}.js`] : fs.readdirSync(CIKTI).filter(f => f.endsWith(".js")).sort();
  let oncekiBayt = 0, sonrakiBayt = 0, oluToplam = 0, canliToplam = 0, degisen = 0, hata = 0;

  for (const dosya of dosyalar) {
    const slug = dosya.replace(/\.js$/, "");
    const yol = path.join(CIKTI, dosya);
    let metin, bolumler;
    try { metin = fs.readFileSync(yol, "utf8"); bolumler = bolumleriOku(slug, metin); }
    catch (e) { hata++; continue; }

    for (const b of bolumler) {
      const c = b.links.filter(l => l.tip === "url").length;
      canliToplam += c;
      oluToplam += b.links.length - c;
    }

    const yeniMetin = dosyaIcerigi(slug, bolumleriKirp(bolumler));
    oncekiBayt += Buffer.byteLength(metin);
    sonrakiBayt += Buffer.byteLength(yeniMetin);
    if (yeniMetin !== metin) { degisen++; if (yaz) fs.writeFileSync(yol, yeniMetin); }
  }

  const mb = b => (b / 1024 / 1024).toFixed(1) + " MB";
  const oran = oncekiBayt ? ((1 - sonrakiBayt / oncekiBayt) * 100).toFixed(1) : "0";
  console.log(`${dosyalar.length} dosya | değişecek: ${degisen} | hata: ${hata}`);
  console.log(`kaynak/b: ${mb(oncekiBayt)} -> ${mb(sonrakiBayt)} (%${oran} küçülme)`);
  console.log(`link: ${canliToplam.toLocaleString("tr")} canlı, ${oluToplam.toLocaleString("tr")} ölü`);
  console.log(yaz ? "--yaz verildi: dosyalar yerinde güncellendi." : "Hiçbir dosya yazılmadı (rapor modu). Yazmak için --yaz.");
  process.exit(hata ? 1 : 0);
}

module.exports = { bolumleriKirp, dosyaIcerigi };
