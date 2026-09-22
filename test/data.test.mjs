// js/data.js — katalog kurulumu ve "Günün Animesi" seçimi (§4.3'ün kalan maddesi).
//
// data.js globalleri `globalThis` üzerinden okuduğu için test veriyi global'e koyup modülü
// import edebiliyor. Her senaryo kendi verisiyle çalışsın diye import adresine sorgu
// eklenip modül önbelleği atlatılıyor.
//
//   npm test
import test from "node:test";
import assert from "node:assert";

const TURLER = ["Aksiyon", "Dram", "Ecchi", "Komedi"];
const STUDYOLAR = ["Madhouse", "Bones"];

// [kategori, [türIx...], puan, posterAdı, yıl, studyoIx]
function kur(ekle = {}) {
  globalThis.META_TURLER = TURLER;
  globalThis.META_STUDYOLAR = STUDYOLAR;
  globalThis.INDEX = ekle.INDEX || [
    ["beck", "Beck", 26, 120],
    ["zamanin-otesi", "Zamanın Ötesi", 12, 40],
    ["ecchi-seri", "Ecchi Seri", 13, 30],
    ["kapaksiz", null, 0, 0],
  ];
  globalThis.META = ekle.META || {
    beck: ["TV", [0, 1], 8.4, "b1-abc.jpg", 2004, 0],
    "zamanin-otesi": ["Film", [3], 7.9, "https://ornek.test/tam.jpg", 1998, 1],
    "ecchi-seri": ["TV", [2, 3], 9.1, "e1.jpg", 2015, -1],
  };
}
let sayac = 0;
const yukle = async () => import(`../js/data.js?t=${++sayac}`);

test("INDEX + META tek bir ANIME dizisine katlanıyor", async () => {
  kur();
  const { ANIME } = await yukle();
  assert.equal(ANIME.length, 4);
  const beck = ANIME.find(a => a.slug === "beck");
  assert.deepEqual(
    { baslik: beck.baslik, eps: beck.eps, urls: beck.urls, kategori: beck.kategori, puan: beck.puan, yil: beck.yil },
    { baslik: "Beck", eps: 26, urls: 120, kategori: "TV", puan: 8.4, yil: 2004 });
  assert.deepEqual(beck.tur, ["Aksiyon", "Dram"], "tür indeksleri sözlükten çözülmeli");
  assert.equal(beck.studyo, "Madhouse");
});

test("başlığı olmayan kayıt slug'a düşüyor, metası olmayan boş metayı alıyor", async () => {
  kur();
  const { ANIME } = await yukle();
  const bos = ANIME.find(a => a.slug === "kapaksiz");
  assert.equal(bos.baslik, "kapaksiz");
  assert.deepEqual({ tur: bos.tur, puan: bos.puan, yil: bos.yil, poster: bos.poster, studyo: bos.studyo },
    { tur: [], puan: 0, yil: 0, poster: null, studyo: "" });
});

test("poster öneki yalnız göreli adreslere ekleniyor", async () => {
  kur();
  const { ANIME } = await yukle();
  const ONEK = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/";
  assert.equal(ANIME.find(a => a.slug === "beck").poster, ONEK + "b1-abc.jpg");
  assert.equal(ANIME.find(a => a.slug === "zamanin-otesi").poster, "https://ornek.test/tam.jpg");
});

test("NSFW bayrağı tür listesinden geliyor", async () => {
  kur();
  const { ANIME } = await yukle();
  assert.equal(ANIME.find(a => a.slug === "ecchi-seri").nsfw, true);
  assert.equal(ANIME.find(a => a.slug === "beck").nsfw, false);
});

test("liste Türkçe alfabetik sıralı, türetilmiş listeler doğru", async () => {
  kur();
  const { ANIME, KATEGORILER, TURLER: T, ONYILLAR, TOPLAM_BOLUM, TOPLAM_LINK } = await yukle();
  assert.deepEqual(ANIME.map(a => a.baslik), ["Beck", "Ecchi Seri", "kapaksiz", "Zamanın Ötesi"]);
  assert.deepEqual(KATEGORILER, ["Film", "TV"]);
  assert.deepEqual(T, ["Aksiyon", "Dram", "Ecchi", "Komedi"]);
  assert.deepEqual(ONYILLAR, [2010, 2000, 1990], "yeniden eskiye, boş onyıl yok");
  assert.equal(TOPLAM_BOLUM, 26 + 12 + 13 + 0);
  assert.equal(TOPLAM_LINK, 120 + 40 + 30 + 0);
});

test("Günün Animesi: puanı 7 üstü ve NSFW olmayanlardan seçiliyor", async () => {
  kur();
  const { animeOfDay } = await yukle();
  const secim = animeOfDay();
  assert.ok(secim, "havuz boş değil");
  assert.ok(secim.puan > 7 && !secim.nsfw, `${secim.slug} havuza girmemeliydi`);
  // Ecchi Seri'nin puanı en yüksek (9.1) ama NSFW olduğu için asla seçilmemeli
  assert.notEqual(secim.slug, "ecchi-seri");
});

test("Günün Animesi aynı gün içinde değişmiyor", async () => {
  kur();
  const { animeOfDay } = await yukle();
  assert.equal(animeOfDay().slug, animeOfDay().slug);
});

test("uygun aday yoksa null dönüyor", async () => {
  kur({
    INDEX: [["dusuk", "Düşük Puan", 5, 5]],
    META: { dusuk: ["TV", [0], 6.2, null, 2001, 0] },
  });
  const { animeOfDay } = await yukle();
  assert.equal(animeOfDay(), null);
});

test("veri hiç yüklenmemişse modül çökmüyor", async () => {
  delete globalThis.INDEX; delete globalThis.META;
  delete globalThis.META_TURLER; delete globalThis.META_STUDYOLAR;
  const { ANIME, KATEGORILER, TOPLAM_BOLUM, animeOfDay } = await yukle();
  assert.deepEqual(ANIME, []);
  assert.deepEqual(KATEGORILER, []);
  assert.equal(TOPLAM_BOLUM, 0);
  assert.equal(animeOfDay(), null);
});
