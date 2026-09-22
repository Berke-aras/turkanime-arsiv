// §4.4 ok.ru resolver'ının ayrıştırıcısı. Ağ gerekmiyor: embedCoz saf bir fonksiyon,
// girdi olarak test/fixtures altındaki sadeleştirilmiş embed sayfalarını alıyor.
//
//   npm test
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { embedCoz, htmlCoz } = require("../api/okru.js");
const KOK = path.dirname(fileURLToPath(import.meta.url));
const oku = ad => fs.readFileSync(path.join(KOK, "fixtures", ad), "utf8");

test("embed sayfasından en iyi mp4 çıkıyor", () => {
  const v = embedCoz(oku("okru-embed.html"));
  assert.equal(v.kalite, "full");
  assert.match(v.url, /^https:\/\/vd000\.okcdn\.example\/\?/);
  assert.equal(v.baslik, "Örnek Anime - 10 [1080p]");
  assert.equal(v.sure, 1509);
  assert.match(v.hls, /\.m3u8/);
});

test("silinmiş videoda null dönüyor (sayfa 200 dönse bile)", () => {
  assert.equal(embedCoz(oku("okru-embed-silinmis.html")), null);
});

test("bozuk girdiler çökertmiyor", () => {
  assert.equal(embedCoz(""), null);
  assert.equal(embedCoz('<div data-options="{bozuk json}"></div>'), null);
  assert.equal(embedCoz('<div data-options="{&quot;flashvars&quot;:{}}"></div>'), null);
});

test("kalite sırası: full yoksa hd, o da yoksa listenin sonuncusu", () => {
  const kur = adlar => {
    const meta = { videos: adlar.map((name, i) => ({ name, url: "https://v/" + i })) };
    const opts = { flashvars: { metadata: JSON.stringify(meta) } };
    return `<div data-options="${JSON.stringify(opts).replace(/"/g, "&quot;")}"></div>`;
  };
  assert.equal(embedCoz(kur(["mobile", "hd", "full"])).kalite, "full");
  assert.equal(embedCoz(kur(["mobile", "sd", "hd"])).kalite, "hd");
  // bilinmeyen kalite adları: en yüksek olduğu varsayılan son girdi
  assert.equal(embedCoz(kur(["ultra", "quad"])).kalite, "quad");
});

test("disallowed işaretli akışlar atlanıyor", () => {
  const meta = { videos: [
    { name: "sd", url: "https://v/sd" },
    { name: "full", url: "https://v/full", disallowed: true },
  ] };
  const opts = { flashvars: { metadata: JSON.stringify(meta) } };
  const v = embedCoz(`<div data-options="${JSON.stringify(opts).replace(/"/g, "&quot;")}"></div>`);
  assert.equal(v.kalite, "sd");
});

test("metadata düz nesne olarak geldiğinde de okunuyor", () => {
  const opts = { flashvars: { metadata: { videos: [{ name: "sd", url: "https://v/sd" }] } } };
  const v = embedCoz(`<div data-options="${JSON.stringify(opts).replace(/"/g, "&quot;")}"></div>`);
  assert.equal(v.url, "https://v/sd");
});

test("htmlCoz sayfanın kullandığı kaçışları çözüyor", () => {
  assert.equal(htmlCoz("&quot;a&quot; &amp; &lt;b&gt; &#39;c&#39;"), `"a" & <b> 'c'`);
  assert.equal(htmlCoz("dokunma"), "dokunma");
});

// --- js/links.js tarafı: embed URL'inden id çıkarma ---
const { OKRU, OKRU_ETKIN, DIRECT_PROVIDERS } = await import("../js/links.js");

test("ok.ru embed adreslerinden id çıkıyor", () => {
  assert.equal(OKRU.params("https://odnoklassniki.ru/videoembed/2369652132464"), "id=2369652132464");
  assert.equal(OKRU.params("https://ok.ru/videoembed/1000439745133"), "id=1000439745133");
  assert.equal(OKRU.params("https://odnoklassniki.ru/videoembed/1000439745133?fromTime=16"), "id=1000439745133");
  // veride 6 tane bozuk kayıt var: videoembed/ sonrası başka bir adres geliyor
  assert.equal(OKRU.params("https://odnoklassniki.ru/videoembed///odnoklassniki.ru/dk?cmd=X&st.vv_movieId=123456789"), null);
  assert.equal(OKRU.params("https://ok.ru/video/1000439745133"), null);
});

test("uç yayına girene kadar ok.ru için reklamsız buton kapalı", () => {
  assert.equal(OKRU_ETKIN, false);
  assert.equal(DIRECT_PROVIDERS.ODNOKLASSNIKI, undefined);
  assert.equal(DIRECT_PROVIDERS["OK.RU"], undefined);
});
