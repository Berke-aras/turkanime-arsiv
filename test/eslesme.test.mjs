// js/eslesme.js — arama puanlaması ve arama anahtarı üretimi (§4.3'ün kalan maddesi).
// Bu modül bilerek saf tutuldu; DOM ve veri yüklemesi gerekmiyor.
//
//   npm test
import test from "node:test";
import assert from "node:assert";
import { aramaAnahtari, aramaKelimeleri, matchScore } from "../js/eslesme.js";

const kayit = (baslik, slug) => ({ baslik, slug: slug || baslik.toLowerCase().replace(/\s+/g, "-") });
const skor = (sorgu, a) => matchScore(sorgu.split(" ").filter(Boolean), a);

test("arama anahtarı başlık + slug'ı normalleştiriyor", () => {
  const a = kayit("Şeytan Bahçesi", "seytan-bahcesi");
  assert.equal(aramaAnahtari(a), "seytan bahcesi seytan bahcesi");
  assert.deepEqual(aramaKelimeleri(a), ["seytan", "bahcesi", "seytan", "bahcesi"]);
});

test("anahtar bir kez üretilip kayıtta saklanıyor (tembel)", () => {
  const a = kayit("Beck");
  assert.equal(a.n, undefined, "kayıt kurulurken anahtar üretilmemeli");
  aramaAnahtari(a);
  assert.equal(a.n, "beck beck");
  a.n = "elle degistirildi";           // ikinci çağrı yeniden hesaplamamalı
  assert.equal(aramaAnahtari(a), "elle degistirildi");
});

test("boş sorgu herkese 0 veriyor", () => {
  assert.equal(skor("", kayit("Naruto")), 0);
});

test("tam geçen kelime 0 puan (Levenshtein'e hiç girilmiyor)", () => {
  assert.equal(skor("naruto", kayit("Naruto")), 0);
  assert.equal(skor("one piece", kayit("One Piece")), 0);
  // kelimenin parçası da `includes` ile geçiyor
  assert.equal(skor("naru", kayit("Naruto")), 0);
});

test("yazım hatası eşikteyse puanla geçiyor, eşiği aşarsa eleniyor", () => {
  // eşik = ceil(uzunluk/3): "naruto" için 2
  assert.equal(skor("narutoo", kayit("Naruto")), 1);
  // "narruttoo" -> "naruto": 3 ekleme, eşik ceil(9/3)=3, tam sınırda geçiyor
  assert.equal(skor("narruttoo", kayit("Naruto")), 3);
  assert.equal(skor("zzzzzz", kayit("Naruto")), null);
});

test("çok kelimeli sorguda hepsi uymalı (AND)", () => {
  const a = kayit("Fullmetal Alchemist Brotherhood");
  assert.equal(skor("fullmetal brotherhood", a), 0);
  assert.equal(skor("fullmetal pokemon", a), null);
});

test("Türkçe karakterler ve noktalama aramayı bozmuyor", () => {
  const a = kayit("Kaguya-sama: Aşk Savaştır", "kaguya-sama-ask-savastir");
  assert.equal(skor("ask savastir", a), 0);
  assert.equal(skor("AŞK", a), null, "sorgu tarafı çağıran tarafından norm ediliyor");
  assert.equal(skor("kaguya sama", a), 0);
});

test("uzunluk farkı büyük kelimeler Levenshtein'e hiç sokulmuyor", () => {
  // "a" ile "brotherhood" arasında mesafe hesaplanmadan elenmeli (eşik 1)
  assert.equal(skor("q", kayit("Brotherhood")), null);
});

test("puan toplanıyor: iki hatalı kelime tek hatalıdan uzak", () => {
  const a = kayit("Fullmetal Alchemist");
  const tek = skor("fullmetl alchemist", a);
  const cift = skor("fullmetl alchemst", a);
  assert.ok(tek !== null && cift !== null);
  assert.ok(cift > tek, `${cift} > ${tek} bekleniyordu`);
});
