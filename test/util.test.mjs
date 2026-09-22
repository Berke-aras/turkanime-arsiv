// js/util.js saf yardımcıları için birim testleri. DOM gerekmiyor: modül tepe seviyesinde
// yalnız navigator'a bakıyor (IS_TR) ve Node 22'de o global mevcut.
//
//   npm test
import test from "node:test";
import assert from "node:assert";
import { norm, esc, levenshtein, initials, hue } from "../js/util.js";

test("norm: Türkçe karakterleri ASCII'ye indiriyor", () => {
  assert.equal(norm("Şİmşek"), "simsek");
  assert.equal(norm("ÇAĞRI"), "cagri");
  assert.equal(norm("Ilık Öğün Üzüm"), "ilik ogun uzum");
  // 'ı' ve 'I' ikisi de 'i' olmalı: Türkçe'nin noktasız i'si aramada ayrım yaratmasın
  assert.equal(norm("Işık"), norm("isik"));
});

test("norm: noktalama ve fazla boşluk tek boşluğa iniyor", () => {
  assert.equal(norm("Fate/stay night: Unlimited Blade Works"), "fate stay night unlimited blade works");
  assert.equal(norm("  .hack//Sign  "), "hack sign");
  assert.equal(norm("K-On!!"), "k on");
});

test("norm: sayı ve harf dışı her şey ayraç", () => {
  assert.equal(norm("86 -Eighty Six-"), "86 eighty six");
  assert.equal(norm(""), "");
  assert.equal(norm(null), "null"); // String(null); çağıranlar zaten dolu değer veriyor
});

test("esc: HTML'de anlamlı beş karakteri kaçırıyor", () => {
  assert.equal(esc('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(esc("Tom & Jerry's"), "Tom &amp; Jerry&#39;s");
  assert.equal(esc("düz metin"), "düz metin");
});

test("esc: zaten kaçırılmış metni tekrar kaçırıyor (çift kaçış beklenen davranış)", () => {
  assert.equal(esc("&amp;"), "&amp;amp;");
});

test("levenshtein: bilinen mesafeler", () => {
  assert.equal(levenshtein("naruto", "naruto"), 0);
  assert.equal(levenshtein("naruto", "narutoo"), 1);   // ekleme
  assert.equal(levenshtein("naruto", "narut"), 1);     // silme
  assert.equal(levenshtein("naruto", "naruta"), 1);    // değiştirme
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("", "abc"), 3);
  assert.equal(levenshtein("abc", ""), 3);
  assert.equal(levenshtein("", ""), 0);
});

test("levenshtein: simetrik", () => {
  for (const [a, b] of [["bleach", "belach"], ["one piece", "onepiece"], ["gintama", "gintoki"]]) {
    assert.equal(levenshtein(a, b), levenshtein(b, a), `${a} / ${b}`);
  }
});

test("initials: en fazla iki kelimenin baş harfi", () => {
  assert.equal(initials("One Piece"), "OP");
  assert.equal(initials("Naruto"), "N");
  assert.equal(initials("Fullmetal Alchemist Brotherhood"), "FA");
  assert.equal(initials("  boşluklu   başlık  "), "BB");
});

test("hue: kararlı ve 0-359 aralığında", () => {
  assert.equal(hue("Naruto"), hue("Naruto"));
  assert.notEqual(hue("Naruto"), hue("Bleach"));
  for (const s of ["", "a", "One Piece", "çok uzun bir anime başlığı olabilir"]) {
    const h = hue(s);
    assert.ok(Number.isInteger(h) && h >= 0 && h < 360, `${s} -> ${h}`);
  }
});
