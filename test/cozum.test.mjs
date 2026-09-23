// js/cozum.js (reklamsız link çözme: önbellek, tekrar deneme, birleştirme), cf/uqload sayfa sınıflandırması
// ve önerilen reklamsız link seçimi için birim testleri.
//
//   npm test
import test from "node:test";
import assert from "node:assert";

// readLS/writeLS localStorage kullanıyor; Node'da bellekte bir eşi yeterli.
const depo = new Map();
globalThis.localStorage = { getItem: k => depo.has(k) ? depo.get(k) : null, setItem: (k, v) => depo.set(k, String(v)), removeItem: k => depo.delete(k) };

const { cozumle, linkBitisi, onbellekOku, onbellegeYaz } = await import("../js/cozum.js");
const { sayfaSinifla } = await import("../cf/uqload/worker.js");
const { onerilenDirectLink } = await import("../js/links.js");

const saglayici = { resolver: "https://cozucu.test/api" };
const cevap = (status, govde = {}) => ({ ok: status < 300, status, json: async () => govde });
const sahteFetch = sira => { const cagri = []; const fn = async url => { cagri.push(url); const s = sira.shift(); if (s instanceof Error) throw s; return s; }; fn.cagri = cagri; return fn; };
const SIMDI_SN = Math.floor(Date.now() / 1000);

test("linkBitisi: e= parametresinden bitiş zamanı", () => {
  assert.equal(linkBitisi(`https://dv1.sibnet.ru/a.mp4?st=x&e=${SIMDI_SN}`), SIMDI_SN * 1000);
  assert.equal(linkBitisi("https://x.test/a.mp4"), 0);
  assert.equal(linkBitisi("bozuk"), 0);
});

test("cozumle: 503 iki kez, sonra başarı — tekrar dener ve her denemeyi bildirir", async () => {
  depo.clear();
  const f = sahteFetch([cevap(503), cevap(503), cevap(200, { url: `https://dv1.test/v.mp4?e=${SIMDI_SN + 7200}` })]);
  const bildirimler = [];
  const s = await cozumle(saglayici, "SIBNET", "id=1", { tekrar: [1, 1, 1], fetchFn: f, bildir: (i, n) => bildirimler.push(`${i}/${n}`) });
  assert.equal(s.veri.url.startsWith("https://dv1.test/"), true);
  assert.equal(s.onbellekten, false);
  assert.deepEqual(bildirimler, ["1/3", "2/3"]);
  assert.equal(f.cagri.length, 3);
});

test("cozumle: 404 kalıcı — tekrar denemeden vazgeçer", async () => {
  depo.clear();
  const f = sahteFetch([cevap(404, { error: "video not found" })]);
  const s = await cozumle(saglayici, "SIBNET", "id=2", { tekrar: [1, 1, 1], fetchFn: f });
  assert.deepEqual(s, { hata: 404 });
  assert.equal(f.cagri.length, 1);
});

test("cozumle: hep 503 ise son durumu döndürür; ağ hatası da geçici sayılır", async () => {
  depo.clear();
  const f = sahteFetch([new Error("ağ"), cevap(503), cevap(503), cevap(503)]);
  const s = await cozumle(saglayici, "UQLOAD", "id=abc", { tekrar: [1, 1, 1], fetchFn: f });
  assert.deepEqual(s, { hata: 503 });
  assert.equal(f.cagri.length, 4);
});

test("cozumle: başarılı link önbellekten geliyor, süresi yaklaşan kullanılmıyor", async () => {
  depo.clear();
  const f = sahteFetch([cevap(200, { url: `https://dv1.test/v.mp4?e=${SIMDI_SN + 7200}` })]);
  await cozumle(saglayici, "SIBNET", "id=3", { fetchFn: f });
  const ikinci = await cozumle(saglayici, "SIBNET", "id=3", { fetchFn: sahteFetch([]) });
  assert.equal(ikinci.onbellekten, true);
  // bitmesine 5 dk kalan link (10 dk payın altında) kullanılmıyor
  onbellegeYaz("SIBNET:id=4", { url: `https://dv1.test/v.mp4?e=${SIMDI_SN + 300}` });
  assert.equal(onbellekOku("SIBNET:id=4"), null);
});

test("cozumle: aynı link için eşzamanlı istekler tek istekte birleşiyor", async () => {
  depo.clear();
  let coz;
  const f = Object.assign(async () => new Promise(r => { coz = r; }), {});
  let sayac = 0;
  const say = async url => { sayac++; return f(url); };
  const a = cozumle(saglayici, "SIBNET", "id=5", { fetchFn: say });
  const b = cozumle(saglayici, "SIBNET", "id=5", { fetchFn: say });
  await new Promise(r => setTimeout(r, 5));
  coz(cevap(200, { url: "https://dv1.test/x.mp4" }));
  const [x, y] = await Promise.all([a, b]);
  assert.equal(sayac, 1);
  assert.equal(x.veri.url, y.veri.url);
});

test("uqload sayfaSinifla: Cloudflare engeli 'yok' sayılmıyor, geçici (503)", () => {
  assert.equal(sayfaSinifla(403, "<title>Just a moment...</title>").kod, 503);
  assert.equal(sayfaSinifla(200, '<script src="/cdn-cgi/challenge-platform/x"></script>').kod, 503);
  assert.equal(sayfaSinifla(502, "").kod, 503);
  assert.equal(sayfaSinifla(200, "<h2>File was deleted</h2>").kod, 404);
  assert.equal(sayfaSinifla(404, "").kod, 404);
  assert.equal(sayfaSinifla(200, "<html>tanınmayan sayfa</html>").kod, 502);
});

test("onerilenDirectLink: reklamsız linki olan ilk fansub grubunun ilk reklamsız linki", () => {
  const links = [
    { player: "MAIL", fansub: "A", tip: "url", url: "https://my.mail.ru/x" },
    { player: "GDRIVE", fansub: "B", tip: "url", url: "https://drive.google.com/x" },
    { player: "SIBNET", fansub: "B", tip: "url", url: "https://video.sibnet.ru/shell.php?videoid=111" },
    { player: "SIBNET", fansub: "C", tip: "url", url: "https://video.sibnet.ru/shell.php?videoid=222" },
  ];
  assert.equal(onerilenDirectLink(links).url.endsWith("111"), true);
  assert.equal(onerilenDirectLink([{ player: "MAIL", tip: "url", url: "x" }]), null);
  assert.equal(onerilenDirectLink(undefined), null);
});

test("cozumle: başarısız önceden çözme, asıl isteğin tekrar denemesini engellemiyor", async () => {
  depo.clear();
  const f = sahteFetch([cevap(503), cevap(503), cevap(200, { url: "https://dv1.test/y.mp4" })]);
  const once = cozumle(saglayici, "SIBNET", "id=6", { tekrar: [], fetchFn: f });            // üstüne gelince, tek deneme
  const asil = cozumle(saglayici, "SIBNET", "id=6", { tekrar: [1, 1], fetchFn: f });         // tıklama
  assert.deepEqual(await once, { hata: 503 });
  const s = await asil;
  assert.equal(s.veri && s.veri.url, "https://dv1.test/y.mp4");
  assert.equal(f.cagri.length, 3);
});

test("cozumle: önceden çözme kalıcı hatayla (404) bittiyse asıl istek tekrar sormuyor", async () => {
  depo.clear();
  const f = sahteFetch([cevap(404)]);
  const once = cozumle(saglayici, "SIBNET", "id=7", { tekrar: [], fetchFn: f });
  const asil = cozumle(saglayici, "SIBNET", "id=7", { tekrar: [1, 1], fetchFn: f });
  assert.deepEqual(await once, { hata: 404 });
  assert.deepEqual(await asil, { hata: 404 });
  assert.equal(f.cagri.length, 1);
});

// --- birden çok çözücü ---
const { cozucuSirasi, yogunluk } = await import("../js/cozum.js");
const ikili = { resolver: ["https://a.test/api", "https://b.test/api"] };

test("cozucuSirasi: başlangıç video numarasına göre sabit, iki çözücüye de dağılıyor", () => {
  yogunluk.clear();
  const ilk = new Set();
  for (let i = 0; i < 20; i++) {
    const s = cozucuSirasi(ikili, `id=${1000 + i}`);
    assert.equal(s.length, 2);
    assert.deepEqual(s, cozucuSirasi(ikili, `id=${1000 + i}`));
    ilk.add(s[0]);
  }
  assert.equal(ilk.size, 2);
  assert.deepEqual(cozucuSirasi(saglayici, "id=1"), ["https://cozucu.test/api"]);
});

test("cozumle: çözücü yoğunsa beklemeden ötekine geçiyor ve yoğunu bir süre sona atıyor", async () => {
  depo.clear(); yogunluk.clear();
  const [birinci, ikinci] = cozucuSirasi(ikili, "id=900");
  let baska = 901;                                            // yine `birinci` ile başlayacak başka bir video
  while (cozucuSirasi(ikili, `id=${baska}`)[0] !== birinci) baska++;
  const f = sahteFetch([cevap(503), cevap(200, { url: "https://dv1.test/z.mp4" })]);
  const bildirimler = [];
  const s = await cozumle(ikili, "SIBNET", "id=900", { tekrar: [1, 1], fetchFn: f, bildir: i => bildirimler.push(i) });
  assert.equal(s.veri.url, "https://dv1.test/z.mp4");
  assert.deepEqual(f.cagri, [`${birinci}?id=900`, `${ikinci}?id=900`]);
  assert.deepEqual(bildirimler, []);                          // bekleme turu yok
  // aynı çözücüyle başlayacak başka bir video artık önce ötekine gidiyor
  assert.equal(cozucuSirasi(ikili, `id=${baska}`)[0], ikinci);
});

test("cozumle: ikisi de yoğunsa tur sonunda bekleyip yeniden deniyor; 404 hemen bitiriyor", async () => {
  depo.clear(); yogunluk.clear();
  const f = sahteFetch([cevap(503), new Error("ağ"), cevap(503), cevap(200, { url: "https://dv1.test/q.mp4" })]);
  const bildirimler = [];
  const s = await cozumle(ikili, "SIBNET", "id=950", { tekrar: [1, 1], fetchFn: f, bildir: i => bildirimler.push(i) });
  assert.equal(s.veri.url, "https://dv1.test/q.mp4");
  assert.equal(f.cagri.length, 4);
  assert.deepEqual(bildirimler, [1]);

  depo.clear(); yogunluk.clear();
  const g = sahteFetch([cevap(404)]);
  assert.deepEqual(await cozumle(ikili, "SIBNET", "id=951", { tekrar: [1, 1], fetchFn: g }), { hata: 404 });
  assert.equal(g.cagri.length, 1);
});

test("cozumle: bir çözücü bozuk (502) ise öteki deneniyor; hepsi 502 ise tekrar turu yok", async () => {
  depo.clear(); yogunluk.clear();
  const f = sahteFetch([cevap(502), cevap(200, { url: "https://dv1.test/w.mp4" })]);
  assert.equal((await cozumle(ikili, "SIBNET", "id=960", { tekrar: [1], fetchFn: f })).veri.url, "https://dv1.test/w.mp4");
  depo.clear(); yogunluk.clear();
  const g = sahteFetch([cevap(502), cevap(502)]);
  assert.deepEqual(await cozumle(ikili, "SIBNET", "id=961", { tekrar: [1, 1], fetchFn: g }), { hata: 502 });
  assert.equal(g.cagri.length, 2);
});
