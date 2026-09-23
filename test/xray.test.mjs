// js/xray-veri.js (oynatıcı bilgi paneli) saf yardımcıları için birim testleri.
//
//   npm test
import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import { spotifyLink, anilistId, gorselAc, KARAKTER_ONEK, bolumdeMi, bolumTemasi, atlamaAraliklari, aralikBul } from "../js/xray-veri.js";

const require = createRequire(import.meta.url);
const ortak = require("../scripts/xray-ortak.js");

test("anilistId: kapak dosya adının bütün biçimlerinden kimlik çıkıyor", () => {
  assert.equal(anilistId("bx116589-KawXHB6sApFt.jpg"), 116589);
  assert.equal(anilistId("b5525-x.png"), 5525);
  assert.equal(anilistId("nx21-tXMN3Y20PIL9.jpg"), 21);
  assert.equal(anilistId("n9253-abc.jpg"), 9253);
  assert.equal(anilistId("5525.jpg"), 5525);
  assert.equal(anilistId("306-o0cw2vphUh6b.jpg"), 306);
});

test("anilistId: kimlik taşımayan değerlerde null", () => {
  assert.equal(anilistId(null), null);
  assert.equal(anilistId(""), null);
  assert.equal(anilistId("default.jpg"), null);
  assert.equal(anilistId("https://baska.cdn/123.jpg"), null);
});

test("anilistId: derleme betiğindeki eşiyle aynı sonucu veriyor", () => {
  for (const ad of ["bx116589-KawXHB6sApFt.jpg", "5525.jpg", "nx21-a.jpg", "default.jpg", "", null, "https://x/1.jpg"]) {
    assert.equal(anilistId(ad), ortak.anilistId(ad), String(ad));
  }
});

test("gorselAc / gorselKisalt birbirinin tersi", () => {
  const url = KARAKTER_ONEK + "b9003-lzIbaEXjTjNi.jpg";
  assert.equal(gorselAc(ortak.gorselKisalt(url, ortak.KARAKTER_ONEK), KARAKTER_ONEK), url);
  assert.equal(ortak.gorselKisalt("https://s4.anilist.co/file/anilistcdn/character/medium/default.jpg", ortak.KARAKTER_ONEK), "");
  assert.equal(gorselAc("", KARAKTER_ONEK), "");
  assert.equal(gorselAc("https://baska/x.jpg", KARAKTER_ONEK), "https://baska/x.jpg");
});

test("bolumdeMi: AnimeThemes bölüm aralıkları", () => {
  assert.ok(bolumdeMi("1-11", 1));
  assert.ok(bolumdeMi("1-11", 11));
  assert.ok(!bolumdeMi("1-11", 12));
  const karisik = "2-3, 5, 7, 9-11";
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(n => bolumdeMi(karisik, n)), [2, 3, 5, 7, 9, 10, 11]);
  assert.ok(bolumdeMi("25-", 300), "açık uçlu aralık");
  assert.ok(!bolumdeMi("25-", 24));
  assert.ok(!bolumdeMi("OVA", 1));
  assert.ok(!bolumdeMi(null, 1));
  assert.ok(!bolumdeMi("1-12", 0), "bölüm numarası bilinmiyorsa eşleşme yok");
});

test("bolumTemasi: bölüme göre doğru opening/ending", () => {
  const m = [
    ["OP", 1, "Birinci", "A", "1-12"],
    ["OP", 2, "İkinci", "B", "13-24"],
    ["ED", 1, "Avid", "C", "2-3, 5, 7, 9-11"],
    ["ED", 2, "Hands Up", "D", "4, 6, 8, 10"],
  ];
  assert.equal(bolumTemasi(m, "OP", 3)[2], "Birinci");
  assert.equal(bolumTemasi(m, "OP", 13)[2], "İkinci");
  assert.equal(bolumTemasi(m, "OP", 30), null);
  assert.equal(bolumTemasi(m, "ED", 5)[2], "Avid");
  assert.equal(bolumTemasi(m, "ED", 4)[2], "Hands Up");
  assert.equal(bolumTemasi(m, "ED", 10), null, "aynı bölüme iki ending düşüyorsa belirsiz");
});

test("bolumTemasi: bölüm bilgisi olmayan tek şarkı her bölüme, birden çoksa hiçbirine", () => {
  assert.equal(bolumTemasi([["OP", 0, "Aka no Kakera", "", null]], "OP", 7)[2], "Aka no Kakera");
  assert.equal(bolumTemasi([["OP", 1, "X", "", null], ["OP", 2, "Y", "", null]], "OP", 7), null);
  assert.equal(bolumTemasi(undefined, "OP", 1), null);
});

test("atlamaAraliklari: AniSkip cevabından yalnız geçerli op/ed aralıkları", () => {
  const json = { found: true, results: [
    { interval: { startTime: 54.7, endTime: 145.1 }, skipType: "op" },
    { interval: { startTime: 1338.2, endTime: 1428.2 }, skipType: "ed" },
    { interval: { startTime: 10, endTime: 20 }, skipType: "recap" },
    { interval: { startTime: 50, endTime: 40 }, skipType: "op" },
  ] };
  assert.deepEqual(atlamaAraliklari(json), [
    { tip: "op", bas: 54.7, son: 145.1 },
    { tip: "ed", bas: 1338.2, son: 1428.2 },
  ]);
  assert.deepEqual(atlamaAraliklari({ found: false, results: [] }), []);
  assert.deepEqual(atlamaAraliklari(null), []);
});

test("aralikBul: videonun o anki saniyesine göre aralık", () => {
  const a = [{ tip: "op", bas: 50, son: 140 }, { tip: "ed", bas: 1300, son: 1390 }];
  assert.equal(aralikBul(a, 49.9), null);
  assert.equal(aralikBul(a, 50).tip, "op");
  assert.equal(aralikBul(a, 139.9).tip, "op");
  assert.equal(aralikBul(a, 140), null, "bitiş anı aralığa dahil değil");
  assert.equal(aralikBul(a, 1350).tip, "ed");
});

test("malTemalari: MyAnimeList sayfasındaki opening/ending blokları", () => {
  const td = (i, ad, sanatci, bolum) => `<td width="84%">${i ? `<span class="theme-song-index">${i}:</span>&nbsp;` : ""}`
    + `<a href="javascript:x()"><span class="theme-song-title">&quot;${ad}&quot;</span></a>`
    + `<span class="theme-song-artist"> by ${sanatci}</span>${bolum ? `&nbsp;<span class="theme-song-episode">(${bolum})</span>` : ""}</td>`;
  const html = `<h2>Opening Theme</h2><div class="theme-songs js-theme-songs opnening"><table><tr><td width="8%"></td>`
    + td(0, "Tank!", "The Seatbelts", "eps 1-25") + `</tr></table></div>`
    + `<h2>Ending Theme</h2><div class="theme-songs js-theme-songs ending"><table><tr>`
    + td(1, "The Real Folk Blues", "The Seatbelts feat. Mai Yamane", "eps 1-12, 14-25")
    + td(2, "Space Lion", "The Seatbelts", "ep 13")
    + td(3, "Aka no Kakera (緋色のカケラ)", "Suzuki Yuki &amp; Co", "")
    + `<td width="8%"><div class="oped-preview-button oped-preview-button-gray"></div></td>`
    + `<td width="84%"><span class="theme-song-index">4:</span>&nbsp;"Aggressive Girl (アグレッシブガール)"<span class="theme-song-artist"> by OTMGirls</span>&nbsp;<span class="theme-song-episode">(eps 7)</span><input type="hidden" value="" /></td>`
    + `</tr></table></div><h2>Reviews</h2><span class="theme-song-title">"Başka bölüm"</span>`;
  assert.deepEqual(ortak.malTemalari(html), [
    ["OP", 0, "Tank!", "The Seatbelts", "1-25", ""],
    ["ED", 1, "The Real Folk Blues", "The Seatbelts feat. Mai Yamane", "1-12, 14-25", ""],
    ["ED", 2, "Space Lion", "The Seatbelts", "13", ""],
    ["ED", 3, "Aka no Kakera (緋色のカケラ)", "Suzuki Yuki & Co", null, ""],
    ["ED", 4, "Aggressive Girl (アグレッシブガール)", "OTMGirls", "7", ""], // linksiz şarkı: başlık <span>'sız
  ]);
  assert.deepEqual(ortak.malTemalari("<html>şarkı yok</html>"), []);
  // MAL'dan gelen bölüm aralığı tarayıcıdaki eşleştiriciyle uyumlu
  assert.ok(bolumdeMi("1-12, 14-25", 14) && !bolumdeMi("1-12, 14-25", 13));
});

test("spotifyLink: parça kimliği varsa parçaya, yoksa Spotify aramasına", () => {
  assert.deepEqual(spotifyLink(["OP", 0, "Tank!", "The Seatbelts", "1-25", "2VqRxxZFbC0uZaTJcZY36c"]),
    { url: "https://open.spotify.com/track/2VqRxxZFbC0uZaTJcZY36c", parca: true });
  // parantez içi Japonca yazım aramadan atılıyor
  assert.deepEqual(spotifyLink(["OP", 1, "Aka no Kakera (緋色のカケラ)", "Suzuki Yuki", null, ""]),
    { url: "https://open.spotify.com/search/" + encodeURIComponent("Aka no Kakera Suzuki Yuki"), parca: false });
  assert.equal(spotifyLink(["ED", 0, "Hitomi no Kotae", "", null]).url, "https://open.spotify.com/search/Hitomi%20no%20Kotae");
  assert.equal(spotifyLink(["ED", 0, "X", "Y", null, "kısa<script>"]).parca, false, "geçersiz kimlik linke girmiyor");
});

test("malTemalari: Spotify parça kimliği 6. alana okunuyor; sarkiAnahtar ad farklarını yok sayıyor", () => {
  const html = `<div class="theme-songs js-theme-songs opnening"><table><tr><td width="84%"><span class="theme-song-title">"Tank!"</span>`
    + `<span class="theme-song-artist"> by The Seatbelts</span><input type="hidden" id="spotify_url_25957" value="https://open.spotify.com/track/2VqRxxZFbC0uZaTJcZY36c" /></td></tr></table></div>`;
  assert.equal(ortak.malTemalari(html)[0][5], "2VqRxxZFbC0uZaTJcZY36c");
  assert.equal(ortak.sarkiAnahtar("Aka no Kakera (緋色のカケラ)"), ortak.sarkiAnahtar("aka no kakera"));
  assert.notEqual(ortak.sarkiAnahtar("Avid"), ortak.sarkiAnahtar("Hands Up to the Sky"));
});
