// Ana sayfa özellikleri için birim testleri: anında arama önerileri (js/eslesme.js), "Sana özel"
// (js/sana-ozel.js), "İzlemeye devam et" kartının bölüm seçimi (js/progress.js devamBilgisi).
//
//   npm test
import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

// progress.js modül yüklenirken localStorage'dan okuyor: önce bir eşi ve örnek kayıtlar.
const depo = new Map([["ta_progress", JSON.stringify({
  "yarim": { ep: 2, t: 305, d: 1400, u: 3, izlendi: [0, 1] },       // 3. bölümün 5:05'inde
  "bitmis": { ep: 4, t: 1390, d: 1400, u: 2, izlendi: [0, 1, 2, 3] }, // 5. bölüm bitmiş -> 6.
  "isaretli": { ep: 1, t: 0, d: 0, u: 1, izlendi: [0, 1] },          // 2. bölüm izlendi işaretli -> 3.
  "sonuncu": { ep: 11, t: 1390, d: 1400, u: 0, izlendi: [11] },
})]]);
globalThis.localStorage = { getItem: k => depo.has(k) ? depo.get(k) : null, setItem: (k, v) => depo.set(k, String(v)), removeItem: k => depo.delete(k) };

const { animeOnerileri, kisiDerecesi, karakterOnerileri, seslendirmenOnerileri } = await import("../js/eslesme.js");
const { sanaOzel } = await import("../js/sana-ozel.js");
const { devamBilgisi } = await import("../js/progress.js");
const { araHarf } = await import("../js/xray-veri.js");
const require = createRequire(import.meta.url);
const ortak = require("../scripts/xray-ortak.js");

const A = (slug, baslik, tur = [], puan = 7, extra = {}) => ({ slug, baslik, tur, puan, eps: 12, nsfw: false, yil: 2010, ...extra });
const LISTE = [
  A("naruto", "Naruto", ["Aksiyon", "Shounen"], 7.9),
  A("naruto-shippuuden", "Naruto: Shippuuden", ["Aksiyon", "Shounen"], 8.2),
  A("boruto-naruto-next-generations", "Boruto: Naruto Next Generations", ["Aksiyon"], 6),
  A("shingeki-no-kyojin", "Shingeki no Kyojin", ["Aksiyon", "Dram"], 8.5),
  A("shingeki-no-kyojin-season-2", "Shingeki no Kyojin Season 2", ["Aksiyon", "Dram"], 8.4),
  A("planetarian", "Planetarian", ["Bilim Kurgu", "Dram"], 7.5),
  A("k-on", "K-On!", ["Komedi", "Müzik"], 7.8),
  A("nana", "Nana", ["Dram", "Müzik"], 8.5),
  A("beck", "Beck", ["Müzik", "Komedi", "Dram"], 7.3),
  A("ecchi-bir-sey", "Ecchi Bir Şey", ["Müzik", "Ecchi"], 9, { nsfw: true }),
];

test("animeOnerileri: başlığı sorguyla başlayan önce, eşitlikte kısa başlık (ana seri); yazım hatası toleranslı", () => {
  assert.deepEqual(animeOnerileri("naruto", LISTE).map(a => a.slug), ["naruto", "naruto-shippuuden", "boruto-naruto-next-generations"]);
  assert.deepEqual(animeOnerileri("shingeki", LISTE, 1).map(a => a.slug), ["shingeki-no-kyojin"]);
  assert.equal(animeOnerileri("narutp", LISTE)[0].slug.startsWith("naruto"), true, "yazım hatası");
  assert.deepEqual(animeOnerileri("", LISTE), []);
});

test("kisiDerecesi: kelime başı eşleşmesi, tam ad önce", () => {
  assert.equal(kisiDerecesi("Levi", ["levi"]), 0);
  assert.equal(kisiDerecesi("Levi Ackerman", ["lev"]), 1);
  assert.equal(kisiDerecesi("Levi Ackerman", ["ackerman"]), 2);
  assert.equal(kisiDerecesi("Levi Ackerman", ["ackerman", "le"]), 2);
  assert.equal(kisiDerecesi("Kalevi", ["levi"]), -1, "kelime ortası eşleşmiyor");
});

test("karakterOnerileri: adaş karakterler seriye göre ayrılıyor, en kalabalık seri öne, temsilci ana seri", () => {
  const ixListe = ["planetarian", "shingeki-no-kyojin-season-2", "shingeki-no-kyojin", "naruto"];
  const slugBul = i => LISTE.find(a => a.slug === ixListe[i]);
  const parca = { k: [["Levi", [0, 1, 2]], ["Levius", [3]], ["Mikasa", [2]]] };
  const o = karakterOnerileri(parca, ["levi"], slugBul);
  assert.deepEqual(o.map(x => [x.ad, x.a.slug, x.fazla]), [
    ["Levi", "shingeki-no-kyojin", 1], ["Levi", "planetarian", 0], ["Levius", "naruto", 0],
  ]);
  assert.deepEqual(seslendirmenOnerileri({ s: ["Kenji Nojima", "Kenjirou Tsuda", "Aoi Yuuki"] }, ["kenji"]), ["Kenji Nojima", "Kenjirou Tsuda"]);
});

test("araHarf: tarayıcı ve derleme betiği aynı parçayı seçiyor", () => {
  for (const k of ["levi", "Ackerman", "Şahin", "İzumi", "7-ghost", "ōkami", "", "'quote"]) assert.equal(araHarf(k), ortak.araHarf(k), k);
  assert.equal(araHarf("Şahin"), "s");
  assert.equal(araHarf("'quote"), "_");
});

test("sanaOzel: tohumların türlerinden öneriyor; tohumu, aynı seriyi ve yetişkin başlıkları dışlıyor", () => {
  const o = sanaOzel(LISTE, [{ slug: "beck", w: 2 }]);
  const sluglar = o.map(a => a.slug);
  assert.ok(!sluglar.includes("beck"));
  assert.ok(!sluglar.includes("ecchi-bir-sey"), "yetişkin başlık önerilmiyor");
  assert.deepEqual(sluglar.slice(0, 2).sort(), ["k-on", "nana"], "en çok ortak tür önde");
  // aynı seriden tek temsilci
  const s = sanaOzel(LISTE, [{ slug: "naruto", w: 1 }]).map(a => a.slug);
  assert.equal(s.filter(x => x.startsWith("shingeki")).length, 1);
  assert.ok(!s.includes("naruto-shippuuden"), "tohumun serisi öneri değil");
});

test("sanaOzel: ortak seslendirmen verisi sıralamayı değiştiriyor", () => {
  const turla = sanaOzel(LISTE, [{ slug: "beck", w: 2 }]).map(a => a.slug);
  const sesle = sanaOzel(LISTE, [{ slug: "beck", w: 2 }], new Map([["beck", ["planetarian"]]])).map(a => a.slug);
  assert.ok(sesle.indexOf("planetarian") < turla.indexOf("planetarian"));
  assert.deepEqual(sanaOzel(LISTE, []), []);
});

test("devamBilgisi: yarım kalan bölüm saniyesiyle, biten bölümde sıradaki", () => {
  assert.deepEqual(devamBilgisi("yarim", 12), { i: 2, etiket: "Devam: 3. bölüm · 5:05" });
  assert.deepEqual(devamBilgisi("bitmis", 12), { i: 5, etiket: "Sıradaki: 6. bölüm" });
  assert.deepEqual(devamBilgisi("isaretli", 12), { i: 2, etiket: "Sıradaki: 3. bölüm" });
  assert.equal(devamBilgisi("sonuncu", 12), null, "son bölüm de bittiyse devam yok");
  assert.equal(devamBilgisi("yok", 12), null);
});
