// §7.3 yedek birleştirme mantığı için birim testleri. DOM/localStorage gerekmiyor:
// birlestir() saf bir fonksiyon.
//
//   npm test
import test from "node:test";
import assert from "node:assert";
import { birlestir, yedekOlustur, yedekGecerliMi } from "../js/yedek.js";

test("favoriler birleşiyor, silinmiyor", () => {
  const { veri, ozet } = birlestir({ ta_favs: ["a", "b"] }, { ta_favs: ["b", "c"] });
  assert.deepEqual([...veri.ta_favs].sort(), ["a", "b", "c"]);
  assert.equal(ozet.favori, 1);
});

test("geçmişte gelen sıra önde, tekrar yok, 16 ile sınırlı", () => {
  const gelen = Array.from({ length: 20 }, (_, i) => "g" + i);
  const { veri } = birlestir({ ta_recent: ["m1", "g3"] }, { ta_recent: gelen });
  assert.equal(veri.ta_recent.length, 16);
  assert.equal(veri.ta_recent[0], "g0");
  assert.equal(new Set(veri.ta_recent).size, 16);
});

test("ilerleme: konum yeni kayıttan, izlendi işaretleri birleşiyor", () => {
  const mevcut = { ta_progress: { beck: { ep: 2, t: 100, d: 1400, u: 10, izlendi: [0, 1] } } };
  const gelen = { ta_progress: { beck: { ep: 5, t: 30, d: 1400, u: 99, izlendi: [3] } } };
  const { veri, ozet } = birlestir(mevcut, gelen);
  assert.equal(veri.ta_progress.beck.ep, 5);
  assert.equal(veri.ta_progress.beck.t, 30);
  assert.equal(veri.ta_progress.beck.u, 99);
  assert.deepEqual(veri.ta_progress.beck.izlendi, [0, 1, 3]);
  assert.equal(ozet.ilerleme, 1);
});

test("ilerleme: eski yedek cihazdaki yeni konumu ezmiyor", () => {
  const mevcut = { ta_progress: { beck: { ep: 9, t: 500, d: 1400, u: 500, izlendi: [9] } } };
  const gelen = { ta_progress: { beck: { ep: 1, t: 5, d: 1400, u: 100, izlendi: [0] } } };
  const { veri } = birlestir(mevcut, gelen);
  assert.equal(veri.ta_progress.beck.ep, 9);
  assert.deepEqual(veri.ta_progress.beck.izlendi, [0, 9]);
});

test("tercihler yedekten geliyor, yoksa cihazdaki kalıyor", () => {
  const { veri } = birlestir({ ta_tema: "acik", ta_hiz: 1.5 }, { ta_tema: "koyu" });
  assert.equal(veri.ta_tema, "koyu");
  assert.equal(veri.ta_hiz, 1.5);
});

test("bozuk/eksik girdiler çökertmiyor", () => {
  const { veri, ozet } = birlestir(null, { ta_favs: "dizi değil", ta_progress: { x: null } });
  assert.deepEqual(veri.ta_favs, []);
  assert.deepEqual(veri.ta_recent, []);
  assert.deepEqual(veri.ta_progress, {});
  assert.equal(ozet.favori, 0);
});

test("yedek zarfı doğrulanıyor", () => {
  const y = yedekOlustur({ ta_favs: ["a"] });
  assert.equal(yedekGecerliMi(y), true);
  assert.equal(yedekGecerliMi({ uygulama: "baska", veri: {} }), false);
  assert.equal(yedekGecerliMi({ uygulama: "turkanime-arsiv" }), false);
  assert.equal(yedekGecerliMi(null), false);
  assert.ok(typeof y.tarih === "string" && y.tarih.includes("T"));
});
