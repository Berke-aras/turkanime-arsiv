#!/usr/bin/env node
"use strict";
// kaynak/animeler/<slug>/*.json  ->  kaynak/b/<slug>.js
//
// Bu dönüşümün scripti repoda yoktu: kaynak/b dosyaları elle üretilmiş hâlde duruyordu ve
// kaynak/animeler'deki ham veriye dokunmak "tek yönlü kapı" idi (bkz. GELISTIRME-PLANI.md §3.1).
// Bu script o kapıyı çift yönlü yapıyor — kaynak/b her an ham veriden yeniden üretilebilir.
//
//   node scripts/build-b.js                (varsayılan) hiçbir şey yazmaz, karşılaştırır ve rapor verir
//   node scripts/build-b.js --yaz          yalnız EKSİK dosyaları yazar, mevcutlara dokunmaz
//   node scripts/build-b.js --zorla        farklı olanları da üzerine yazar — VERİ KAYBETTİRİR, aşağıyı oku
//   node scripts/build-b.js --slug beck    tek anime
//
// DİKKAT — kaynak/b tam olarak yeniden üretilemez:
// Bu script 6107 dosyanın 5998'ini (%98.2) baytı baytına üretiyor. Kalan 109'da fark, ham veride
// OLMAYAN bilgiden kaynaklanıyor: kaynak/b bazı bölümlerde ham karşılığı boş olan kayıtlar
// (yer tutucu link) ve 157 adet "durum" alanı taşıyor. Yani kaynak/animeler, kaynak/b'nin
// üst kümesi DEĞİL; kaynak/b kaynağın kendisi sayılmalı, türetilmiş bir çıktı değil.
// Bu yüzden varsayılan davranış sadece rapor; üzerine yazmak açık bayrak istiyor.
//
// Girdi biçimi:
//   bolumler.json          [[bolumSlug, bolumAdi], ...]  (yayın sırası)
//   <bolumSlug>.json       [{player, path, fansub, mask?, url?}, ...]
//
// Bölüm numarası (no): bölüm slug'ındaki SON "-<sayı>-bolum" eşleşmesi, yoksa null.
// "Son" olması önemli: "drifters-specials-1-bolum-drifters-13-bolum" -> 13,
// "toriko-51-bolum-one-piece-542-bolum" -> 542. Film/özel bölümlerde eşleşme yok -> null.
// Kural 71.573 bölümün tamamında doğrulandı.
//
// Link tipi kuralı (sırayla):
//   url alanı varsa   -> {tip:"url",  url}       mutlak adres, oynatılabilir
//   mask alanı varsa  -> {tip:"mask", url:mask}  turkanime sunucusu gerektiren maskeli link (ölü)
//   ikisi de yoksa    -> {tip:"yol",  url:path}  turkanime'nin ajax yolu, göreli (ölü)
//
// Link sırası: "url" tipindekiler öne, ölüler (mask/yol) arkaya; iki grup da ham sırasını korur.
// Bu kural mevcut kaynak/b dosyalarından geri çıkarıldı.

const fs = require("fs");
const path = require("path");
const { bolumleriKirp } = require("./trim-b");

const ROOT = path.join(__dirname, "..");
const HAM = path.join(ROOT, "kaynak", "animeler");
const CIKTI = path.join(ROOT, "kaynak", "b");

const argv = process.argv.slice(2);
const yaz = argv.includes("--yaz");
const zorla = argv.includes("--zorla");
const tekSlug = argv.includes("--slug") ? argv[argv.indexOf("--slug") + 1] : null;

// Ham veride bazı adresler "https:https://href.li/?https://vk.com/..." biçiminde, yani bir
// href.li yönlendirici sarmalayıcısıyla gelmiş. Sarmalayıcı atılıyor; ayrıca bazı adresler
// sonunda \r taşıyor (kazıma sırasında CRLF'den kalma), o da kırpılıyor.
const urlTemizle = u => u.replace(/^.*?href\.li\/\?/, "").trim();

function linkCevir(h) {
  if (h.url) return { player: h.player, fansub: h.fansub, tip: "url", url: urlTemizle(h.url) };
  if (h.mask) return { player: h.player, fansub: h.fansub, tip: "mask", url: h.mask };
  return { player: h.player, fansub: h.fansub, tip: "yol", url: h.path };
}

function bolumNo(bolumSlug) {
  const m = [...bolumSlug.matchAll(/-(\d+)-bolum/g)];
  return m.length ? Number(m[m.length - 1][1]) : null;
}

// İkili kararlı bölümleme: oynatılabilir ("url") linkler öne, ölü olanlar (mask/yol) arkaya;
// her iki grup ham dosyadaki sırasını korur. (Array.prototype.sort ES2019'dan beri kararlı.)
const linkleriSirala = links => links.slice().sort((a, b) => (a.tip !== "url") - (b.tip !== "url"));

// Mevcut kaynak/b dosyasındaki "durum" alanlarını okur. Bu alan ham veride YOK: yarım kalmış bir
// ölü-link taramasından kalma, repo genelinde yalnız 157 link taşıyor (calisiyor/olu/supheli) ve
// uygulama hiçbir yerde okumuyor. Yine de yeniden üretimde kaybolmasın diye taşınıyor.
function mevcutDurumlar(slug) {
  const dosya = path.join(CIKTI, `${slug}.js`);
  if (!fs.existsSync(dosya)) return null;
  const sandbox = { window: { __TKA__: {} } };
  try { new (require("vm").Script)(fs.readFileSync(dosya, "utf8")).runInNewContext(sandbox); }
  catch (e) { return null; }
  const bolumler = sandbox.window.__TKA__[slug];
  if (!Array.isArray(bolumler)) return null;
  const harita = new Map();
  for (const b of bolumler) {
    for (const l of b.links || []) {
      if (l.durum) harita.set(`${b.slug}|${l.player}|${l.fansub}|${l.tip}|${l.url}`, l.durum);
    }
  }
  return harita.size ? harita : null;
}

function bolumleriUret(slug) {
  const dizin = path.join(HAM, slug);
  const bolumler = JSON.parse(fs.readFileSync(path.join(dizin, "bolumler.json"), "utf8"));
  const durumlar = mevcutDurumlar(slug);
  const uretilen = bolumler.map(([bolumSlug, ad]) => {
    let ham = [];
    try { ham = JSON.parse(fs.readFileSync(path.join(dizin, `${bolumSlug}.json`), "utf8")); }
    catch (e) { /* bölüm dosyası yoksa link listesi boş kalır */ }
    const links = linkleriSirala(ham.map(linkCevir));
    if (durumlar) {
      for (const l of links) {
        const d = durumlar.get(`${bolumSlug}|${l.player}|${l.fansub}|${l.tip}|${l.url}`);
        if (d) l.durum = d;
      }
    }
    return { no: bolumNo(bolumSlug), ad, slug: bolumSlug, links };
  });

  // Hiç linki olmayan bölümler çıktıya girmiyor (ham veride boş .json olarak duruyorlar),
  // kalanlar bölüm numarasına, eşitlikte slug'a göre sıralanıyor. bolumler.json sitedeki
  // sırayı taşıyor ve özel bölümlerde ters olabiliyor; çıktı her zaman artan sırada.
  const sirali = uretilen
    .filter(b => b.links.length)
    .sort((a, b) => (a.no ?? Infinity) - (b.no ?? Infinity) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  // Son adım: ölü linkler tek sayıya iniyor (§3.2). kaynak/b'deki biçim bu; iki script aynı
  // çıktıyı üretsin diye kırpma işlevi scripts/trim-b.js'ten çağrılıyor.
  return bolumleriKirp(sirali);
}

const dosyaIcerigi = (slug, bolumler) =>
  `window.__TKA__=window.__TKA__||{};window.__TKA__[${JSON.stringify(slug)}]=${JSON.stringify(bolumler)};`;

const sluglar = tekSlug ? [tekSlug]
  : fs.readdirSync(HAM).filter(s => fs.statSync(path.join(HAM, s)).isDirectory()).sort();

// Farkı sınıflandır: bölüm sayısı mı, sırası mı, yoksa yalnız link içeriği mi ayrışıyor.
function farkSinifi(mevcutMetin, slug, uretilen) {
  const sandbox = { window: { __TKA__: {} } };
  try { new (require("vm").Script)(mevcutMetin).runInNewContext(sandbox); }
  catch (e) { return "okunamadi"; }
  const m = sandbox.window.__TKA__[slug];
  if (!Array.isArray(m)) return "okunamadi";
  if (m.length !== uretilen.length) return "bolumSayisi";
  if (m.map(b => b.slug).join(",") !== uretilen.map(b => b.slug).join(",")) return "bolumSirasi";
  return "linkIcerigi";
}

let ayni = 0, yeni = 0, hata = 0;
const siniflar = { bolumSayisi: 0, bolumSirasi: 0, linkIcerigi: 0, okunamadi: 0 };
const farklilar = [];

for (const slug of sluglar) {
  let uretilen, icerik;
  try { uretilen = bolumleriUret(slug); icerik = dosyaIcerigi(slug, uretilen); }
  catch (e) { hata++; farklilar.push(`${slug}: ${e.message}`); continue; }

  const hedef = path.join(CIKTI, `${slug}.js`);
  const mevcut = fs.existsSync(hedef) ? fs.readFileSync(hedef, "utf8") : null;

  if (mevcut === null) { yeni++; if (yaz || zorla) fs.writeFileSync(hedef, icerik); continue; }
  if (mevcut === icerik) { ayni++; continue; }

  siniflar[farkSinifi(mevcut, slug, uretilen)]++;
  if (farklilar.length < 10) farklilar.push(slug);
  if (zorla) fs.writeFileSync(hedef, icerik);
}

const farkli = Object.values(siniflar).reduce((a, b) => a + b, 0);
const yuzde = (ayni / sluglar.length * 100).toFixed(1);
console.log(`${sluglar.length} anime | birebir aynı: ${ayni} (%${yuzde}) | farklı: ${farkli} | eksik: ${yeni} | hata: ${hata}`);
if (farkli) {
  console.log(`  farkın türü -> bölüm sayısı: ${siniflar.bolumSayisi}, bölüm sırası: ${siniflar.bolumSirasi}, `
    + `link içeriği: ${siniflar.linkIcerigi}, okunamadı: ${siniflar.okunamadi}`);
  console.log("  ilk farklılar:", farklilar.join(", "));
  console.log("  Bu farklar ham veride olmayan bilgiden geliyor (yer tutucu kayıtlar, \"durum\" alanı);");
  console.log("  kaynak/b'yi kaynak say, türetilmiş çıktı sayma. Ayrıntı: dosyanın başındaki not.");
}
if (zorla) console.log("--zorla verildi: farklı dosyalar ÜZERİNE YAZILDI.");
else if (yaz) console.log(`--yaz verildi: yalnız eksik ${yeni} dosya yazıldı, mevcutlara dokunulmadı.`);
else console.log("Hiçbir dosya yazılmadı (rapor modu). Eksikleri yazmak için --yaz.");
process.exit(hata ? 1 : 0);
