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

// kaynak/b artık yalnız "url" tipi taşıyor: ölü linkler (mask/yol) bölüm başına tek bir
// "olu" sayısına indirgendi (scripts/trim-b.js, §3.2). Ham veride üç tip de duruyor.
const BILINEN_TIPLER = new Set(["url"]);

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
  // §1.1'i yakalayan test: veriye yeni bir tip girerse (ya da kırpılmamış bir dosya eklenirse)
  // app.js'in OLU() eşlemesi güncellenmeden fark edilmez; burada kırmızıya düşer.
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

test("ölü linkler bölüm başına tek sayıya indirgenmiş (§3.2)", { timeout: 600000 }, () => {
  // "olu" alanı bir sayı olmalı ve 0 yazılmamalı (yoksa alan hiç bulunmaz).
  const kotu = [];
  for (const slug of taranacak) {
    const metin = fs.readFileSync(path.join(ROOT, "kaynak/b", `${slug}.js`), "utf8");
    for (const m of metin.matchAll(/"olu":([^,}]*)/g)) {
      const v = Number(m[1]);
      if (!Number.isInteger(v) || v < 1) kotu.push(`${slug}: ${m[1]}`);
    }
  }
  assert.deepEqual(kotu.slice(0, 5), [], `${kotu.length} geçersiz "olu" değeri`);
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

// Tarayıcı, kapaktan AniList kimliği çıkan her anime için kaynak/x/<slug>.json ister (js/xray.js);
// dosya yoksa 404 olur. Kimliği çıkmayanlar için de fazladan dosya olmamalı.
test("kimliği olan her anime için bilgi paneli dosyası var (kaynak/x)", () => {
  const { anilistId } = require("../scripts/xray-ortak.js");
  const dizin = path.join(ROOT, "kaynak", "x");
  const var_ = new Set(fs.existsSync(dizin) ? fs.readdirSync(dizin) : []);
  const beklenen = sluglar.filter(s => anilistId(META[s][3]));
  const eksik = beklenen.filter(s => !var_.has(s + ".json"));
  const fazla = [...var_].filter(d => !beklenen.includes(d.replace(/\.json$/, "")));
  assert.deepEqual(eksik.slice(0, 5), [], `${eksik.length} animenin kaynak/x dosyası yok (npm run build:xray)`);
  assert.deepEqual(fazla.slice(0, 5), [], `${fazla.length} fazladan kaynak/x dosyası`);
});

test("seslendirmen dizini: her kova var ve her ad kendi kovasında (kaynak/sv)", () => {
  const { SV_KOVA, svKova } = require("../scripts/xray-ortak.js");
  const yanlis = [], slugKume = new Set(sluglar);
  for (let i = 0; i < SV_KOVA; i++) {
    const kova = JSON.parse(fs.readFileSync(path.join(ROOT, "kaynak", "sv", i + ".json"), "utf8"));
    for (const [ad, d] of Object.entries(kova)) {
      if (svKova(ad) !== i || !Array.isArray(d.r) || !d.r.length || d.r.some(r => !slugKume.has(r[0]))) yanlis.push(ad);
    }
  }
  assert.deepEqual(yanlis.slice(0, 5), [], `${yanlis.length} seslendirmen kaydı hatalı (npm run build:seslendirmen)`);
});

test("arama dizini (kaynak/ara) ve öneri dizini (kaynak/oneri.json) güncel", () => {
  const dizin = path.join(ROOT, "kaynak", "ara");
  const dosyalar = fs.readdirSync(dizin);
  assert.ok(dosyalar.length >= 30 && dosyalar.every(d => /^[a-z0-9_]\.json$/.test(d)), dosyalar.join(","));
  const bozuk = [];
  for (const d of dosyalar) {
    const p = JSON.parse(fs.readFileSync(path.join(dizin, d), "utf8"));
    for (const [ad, ix] of p.k) if (!ad || !ix.length || ix.some(i => !(i >= 0 && i < INDEX.length))) bozuk.push(`${d}:${ad}`);
  }
  assert.deepEqual(bozuk.slice(0, 5), [], `${bozuk.length} bozuk arama kaydı (npm run build:ara)`);
  // Karakter numaraları INDEX sırasına bağlı: "Levi" Shingeki no Kyojin'i göstermeli.
  const l = JSON.parse(fs.readFileSync(path.join(dizin, "l.json"), "utf8"));
  const levi = l.k.find(([ad]) => ad === "Levi");
  assert.ok(levi && levi[1].some(i => INDEX[i][0] === "shingeki-no-kyojin"), "Levi -> shingeki-no-kyojin (dizin bayat mı?)");
  const o = JSON.parse(fs.readFileSync(path.join(ROOT, "kaynak", "oneri.json"), "utf8"));
  assert.equal(o.n, INDEX.length, "oneri.json farklı bir data.js ile üretilmiş (npm run build:ara)");
  const gecersiz = Object.entries(o.o).filter(([i, l]) => !(i < INDEX.length) || l.some(b => !(b >= 0 && b < INDEX.length)));
  assert.deepEqual(gecersiz.slice(0, 3), []);
});

test("kaynak/x dosyaları beklenen biçimde", () => {
  const dizin = path.join(ROOT, "kaynak", "x");
  const bozuk = [];
  for (const d of fs.readdirSync(dizin)) {
    const x = JSON.parse(fs.readFileSync(path.join(dizin, d), "utf8"));
    const iyi = Number.isInteger(x.id)
      && (x.mal === undefined || Number.isInteger(x.mal))
      && (x.k === undefined || (Array.isArray(x.k) && x.k.every(k => k.length === 5 && "AYF".includes(k[2]))))
      && (x.m === undefined || (Array.isArray(x.m) && x.m.every(m => (m.length === 5 || (m.length === 6 && /^([A-Za-z0-9]{22})?$/.test(m[5])))
        && (m[0] === "OP" || m[0] === "ED"))));
    if (!iyi) bozuk.push(d);
  }
  assert.deepEqual(bozuk.slice(0, 5), [], `${bozuk.length} kaynak/x dosyası biçim dışı`);
});

test("service worker kabuk listesi js/ altındaki her modülü kapsıyor (§1.5)", () => {
  // Eksik kalan bir modül uygulamayı çevrimdışıyken hiç açılmaz hale getiriyor; liste elle
  // tutulduğu için yeni modül eklendiğinde unutulması en olası şey bu.
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const liste = new Set([...sw.matchAll(/'([^']+\.(?:js|woff2|css|png|svg|json))'/g)].map(m => m[1]));
  const diskte = [];
  for (const dizin of ["js", "js/views"]) {
    for (const ad of fs.readdirSync(path.join(ROOT, dizin))) {
      if (ad.endsWith(".js")) diskte.push(`${dizin}/${ad}`);
    }
  }
  const eksik = diskte.filter(f => !liste.has(f));
  assert.deepEqual(eksik, [], `kabuk cache'inde olmayan modül: ${eksik.join(", ")}`);

  // Yazı tipleri de kabukta olmalı (§2.1.5): yoksa çevrimdışında sistem fontuna düşer.
  for (const f of fs.readdirSync(path.join(ROOT, "fonts")).filter(a => a.endsWith(".woff2"))) {
    assert.ok(liste.has(`fonts/${f}`), `fonts/${f} kabuk cache'inde yok`);
  }
});

test("Google Search Console doğrulama dosyası yerinde (§7.6)", () => {
  // Dosya silinirse ya da içeriği bozulursa Google mülkiyet doğrulamasını düşürür ve
  // sitemap gönderimi durur; sessizce kaybolmasın diye test ediliyor.
  const ad = "google65be1d669fd704c0.html";
  const yol = path.join(ROOT, ad);
  assert.ok(fs.existsSync(yol), `${ad} repo kökünde olmalı (GitHub Pages bunu aynen servis ediyor)`);
  assert.equal(fs.readFileSync(yol, "utf8").trim(), `google-site-verification: ${ad}`);
});

test("paylaşım görselleri doğru boyutta (§7.6)", () => {
  // PNG başlığından genişlik/yükseklik: IHDR ilk 8 baytı imza, sonra 4 uzunluk + 4 tip.
  const olc = p => {
    const b = fs.readFileSync(p);
    return { g: b.readUInt32BE(16), y: b.readUInt32BE(20), kb: Math.round(b.length / 1024) };
  };
  const sosyal = olc(path.join(ROOT, "docs/assets/social-preview.png"));
  // GitHub sosyal önizleme: 1280x640 önerilir, 1 MB üstü kabul edilmiyor.
  assert.deepEqual([sosyal.g, sosyal.y], [1280, 640]);
  assert.ok(sosyal.kb < 1024, `social-preview.png ${sosyal.kb} KB — GitHub sınırı 1 MB`);

  // og:image JPEG ve küçük olmalı: WhatsApp'ın önizleme robotu büyük dosyaları atlıyor.
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const ogYol = (/property="og:image" content="[^"]*\/([^"/]+)"/.exec(html) || [])[1];
  assert.equal(ogYol, "og-image.jpg", "og:image dosya adı değişmiş");
  const jpg = fs.readFileSync(path.join(ROOT, ogYol));
  assert.ok(jpg.length / 1024 < 300, `${ogYol} ${Math.round(jpg.length / 1024)} KB — WhatsApp sınırı ~300 KB`);
  // JPEG SOF0/SOF2 çerçevesinden boyut
  let i = 2, boyut = null;
  while (i < jpg.length - 9 && !boyut) {
    if (jpg[i] !== 0xff) { i++; continue; }
    const tip = jpg[i + 1];
    if (tip === 0xc0 || tip === 0xc1 || tip === 0xc2) boyut = { y: jpg.readUInt16BE(i + 5), g: jpg.readUInt16BE(i + 7) };
    else i += 2 + jpg.readUInt16BE(i + 2);
  }
  const oku = n => Number((new RegExp(`property="og:image:${n}" content="(\\d+)"`).exec(html) || [])[1]);
  assert.deepEqual([boyut.g, boyut.y], [oku("width"), oku("height")], "og:image meta etiketleri dosyayla uyuşmuyor");
  assert.match(html, /twitter:image" content="[^"]*og-image\.jpg"/, "twitter:image aynı dosyayı göstermeli");
});
