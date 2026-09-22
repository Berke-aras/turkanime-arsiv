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

test("meta.js kayıtları [kategori, türler, puan, poster] biçiminde", () => {
  const bozuk = Object.entries(META).filter(([, m]) =>
    !Array.isArray(m) || m.length !== 4 || typeof m[0] !== "string" || !Array.isArray(m[1]) || typeof m[2] !== "number");
  assert.deepEqual(bozuk.slice(0, 5).map(([s]) => s), [], `${bozuk.length} meta kaydı biçim dışı`);
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
