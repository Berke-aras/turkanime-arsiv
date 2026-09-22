"use strict";
// Veri katmanının tutarlılığını doğrular: kaynak/data.js, meta.js, kaynak/b/<slug>.js ve
// kaynak/animeler/<slug>/info.json birbirini tutuyor mu.
//
//   node --test test/
//
// Bu testler DOM ya da ağ gerektirmez. Tarayıcı davranışı için ayrıca: node scripts/smoke-test.js

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const loadGlobal = (dosya, ad) => {
  const sandbox = { window: {} };
  new vm.Script(fs.readFileSync(path.join(ROOT, dosya), "utf8")).runInNewContext(sandbox);
  return sandbox.window[ad];
};

const INDEX = loadGlobal("kaynak/data.js", "INDEX");
const META = loadGlobal("meta.js", "META");
const META_TURLER = loadGlobal("meta.js", "META_TURLER");
const META_STUDYOLAR = loadGlobal("meta.js", "META_STUDYOLAR");
const sluglar = INDEX.map(r => r[0]);

// Tam tarama 205 MB okuyor; ortamda yavaşsa TKA_TEST_ORNEK=200 gibi bir örneklemle çalıştırılabilir.
const ORNEK = Number(process.env.TKA_TEST_ORNEK) || 0;
const taranacak = ORNEK ? sluglar.filter((_, i) => i % Math.ceil(sluglar.length / ORNEK) === 0) : sluglar;

// Veride bilinen üç link tipi var; 'url' dışındakiler ölü sayılır (app.js OLU()).
const BILINEN_TIPLER = new Set(["url", "mask", "yol"]);

test("data.js kayıtları [slug, baslik, eps, urls] biçiminde", () => {
  assert.ok(INDEX.length > 6000, `beklenenden az kayıt: ${INDEX.length}`);
  const bozuk = INDEX.filter(r => r.length !== 4 || typeof r[0] !== "string" || !r[0]);
  assert.deepEqual(bozuk.slice(0, 5), [], `${bozuk.length} kayıt biçim dışı`);
});

test("slug'lar benzersiz", () => {
  const tekrar = sluglar.filter((s, i) => sluglar.indexOf(s) !== i);
  assert.deepEqual(tekrar.slice(0, 5), [], `${tekrar.length} tekrar eden slug`);
});

test("meta.js anahtarları INDEX ile birebir örtüşüyor", () => {
  const metaAnahtar = new Set(Object.keys(META));
  const indexKume = new Set(sluglar);
  const metadaYok = sluglar.filter(s => !metaAnahtar.has(s));
  const indexteYok = [...metaAnahtar].filter(s => !indexKume.has(s));
  assert.deepEqual(metadaYok.slice(0, 5), [], `${metadaYok.length} slug meta.js'te yok`);
  assert.deepEqual(indexteYok.slice(0, 5), [], `${indexteYok.length} meta.js anahtarı INDEX'te yok`);
});

test("meta.js kayıtları [kategori, [türIx], puan, poster, yıl, studyoIx] biçiminde", () => {
  const bozuk = Object.entries(META).filter(([, m]) =>
    !Array.isArray(m) || m.length !== 6 || typeof m[0] !== "string" || !Array.isArray(m[1])
    || typeof m[2] !== "number" || typeof m[4] !== "number" || typeof m[5] !== "number");
  assert.deepEqual(bozuk.slice(0, 5).map(([s]) => s), [], `${bozuk.length} meta kaydı biçim dışı`);
});

test("meta.js tür/stüdyo indeksleri sözlük sınırları içinde", () => {
  assert.ok(META_TURLER.length > 10 && META_STUDYOLAR.length > 100,
    `sözlükler beklenenden küçük: ${META_TURLER.length} tür, ${META_STUDYOLAR.length} stüdyo`);
  const kotu = Object.entries(META).filter(([, m]) =>
    m[1].some(i => !Number.isInteger(i) || i < 0 || i >= META_TURLER.length)
    || !Number.isInteger(m[5]) || m[5] < -1 || m[5] >= META_STUDYOLAR.length);
  assert.deepEqual(kotu.slice(0, 5).map(([s]) => s), [], `${kotu.length} kayıtta sınır dışı indeks`);
});

test("meta.js sözlüklerinde boş/tekrar eden girdi yok", () => {
  for (const [ad, d] of [["tür", META_TURLER], ["stüdyo", META_STUDYOLAR]]) {
    assert.equal(d.filter(x => !x || typeof x !== "string").length, 0, `${ad} sözlüğünde boş girdi`);
    assert.equal(new Set(d).size, d.length, `${ad} sözlüğünde tekrar var`);
  }
});

test("yıl bilgisi animelerin ezici çoğunluğunda var ve makul aralıkta", () => {
  const yillar = Object.values(META).map(m => m[4]).filter(Boolean);
  const oran = yillar.length / Object.keys(META).length;
  assert.ok(oran > 0.95, `yıl kapsamı düşük: %${(oran * 100).toFixed(1)}`);
  const sacma = yillar.filter(y => y < 1900 || y > 2100);
  assert.deepEqual(sacma.slice(0, 5), [], `${sacma.length} anime makul olmayan yılda`);
});

test("poster alanı ortak önek çıkarılmış hâlde saklanıyor", () => {
  // §2.1.2: tam URL yerine yalnız dosya adı; js/data.js ve scripts/poster-onek.js öneki ekliyor.
  const uzun = Object.entries(META).filter(([, m]) => m[3] && /^https?:\/\/s4\.anilist\.co/i.test(m[3]));
  assert.deepEqual(uzun.slice(0, 3).map(([s]) => s), [], `${uzun.length} poster hâlâ tam URL`);
  assert.ok(Object.values(META).filter(m => m[3]).length > 5000, "poster sayısı beklenenden az");
});

test("her slug için info.json var", () => {
  const eksik = sluglar.filter(s => !fs.existsSync(path.join(ROOT, "kaynak/animeler", s, "info.json")));
  assert.deepEqual(eksik.slice(0, 5), [], `${eksik.length} slug'ın info.json'ı yok`);
});

test("her slug için bölüm dosyası var", () => {
  const eksik = sluglar.filter(s => !fs.existsSync(path.join(ROOT, "kaynak/b", `${s}.js`)));
  assert.deepEqual(eksik.slice(0, 5), [], `${eksik.length} slug'ın kaynak/b dosyası yok`);
});

test("bölüm dosyalarında bilinmeyen link tipi yok", { timeout: 600000 }, () => {
  // §1.1'i yakalayan test: veriye yeni bir tip (ör. 'yol') girerse app.js'in OLU() eşlemesi
  // güncellenmeden fark edilmez; burada kırmızıya düşer.
  const bulunan = new Map();
  for (const slug of taranacak) {
    const metin = fs.readFileSync(path.join(ROOT, "kaynak/b", `${slug}.js`), "utf8");
    for (const m of metin.matchAll(/"tip":"([^"]*)"/g)) {
      if (!BILINEN_TIPLER.has(m[1])) bulunan.set(m[1], (bulunan.get(m[1]) || 0) + 1);
    }
  }
  assert.deepEqual([...bulunan.entries()], [], "bilinmeyen tip(ler) bulundu");
});

test("bölüm dosyaları kendi slug'ları altına yazıyor", { timeout: 600000 }, () => {
  const yanlis = [];
  for (const slug of taranacak.slice(0, 400)) {
    const bas = fs.readFileSync(path.join(ROOT, "kaynak/b", `${slug}.js`), "utf8").slice(0, 400);
    if (!bas.includes(`window.__TKA__[${JSON.stringify(slug)}]`)) yanlis.push(slug);
  }
  assert.deepEqual(yanlis.slice(0, 5), [], `${yanlis.length} dosya beklenen anahtarı kullanmıyor`);
});

test("'url' tipindeki linkler mutlak adres taşıyor", { timeout: 600000 }, () => {
  // 'yol' tipi göreli adres taşıyor (ajax/videosec&...); 'url' tipinde göreli adres olursa
  // iframe kendi sayfamızda 404 açar.
  const kotu = [];
  for (const slug of taranacak.slice(0, 400)) {
    const metin = fs.readFileSync(path.join(ROOT, "kaynak/b", `${slug}.js`), "utf8");
    for (const m of metin.matchAll(/"tip":"url","url":"([^"]*)"/g)) {
      if (!/^https?:\/\//i.test(m[1])) kotu.push(`${slug}: ${m[1].slice(0, 40)}`);
    }
  }
  assert.deepEqual(kotu.slice(0, 5), [], `${kotu.length} 'url' tipi link göreli`);
});
