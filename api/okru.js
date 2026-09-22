// ok.ru / odnoklassniki.ru videoid -> doğrudan mp4 linki. Vercel serverless function
// (proje: tka-sibnet, uç: /api/okru). Arşivdeki en yaygın sağlayıcı: ~140.000 link.
//
// Nasıl çalışıyor: embed sayfasında oynatıcının tüm verisi `data-options` özniteliğinde,
// HTML-escape'lenmiş bir JSON olarak duruyor. İçindeki `flashvars.metadata` (kendisi de bir
// JSON dizesi olabiliyor) `videos: [{name, url}]` listesini ve `hlsManifestUrl`'i taşıyor.
// Sayfa JavaScript çalıştırmadan okunabiliyor, o yüzden tarayıcıya gerek yok.
//
// Neden mp4, neden HLS değil: m3u8 de çalışıyor ama okcdn yanıtlarında
// `access-control-allow-origin` YOK — hls.js tarayıcıdan çekemez (CORS). mp4 ise
// `<video src>` ile oynuyor: media elemanı CORS istemiyor, Range destekli (ölçüldü:
// `Accept-Ranges: bytes`, 206 dönüyor), yani sarma da çalışıyor.
//
// DİKKAT (doğrulanmadı): dönen linkte `srcIp=<isteği yapanın IP'si>` parametresi var. Bu
// imzaya dahilse link yalnız fonksiyonun IP'sinden açılır ve tarayıcıda 403 alınır. Burada
// test edilemedi (fonksiyon ve test tarayıcısı aynı çıkış IP'sinde). Canlıya alındıktan sonra
// başka bir ağdan tek bir bölüm denenmeli; çalışmazsa `js/links.js`'teki ODNOKLASSNIKI
// kaydı geri alınır, klasik embed yerinde duruyor.
const { kokenReddet } = require('./_koken.js');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Kalite tercihi: 1080p'ye kadar en iyisi. 'ultra'/'quad' (4K/1440p) anime arşivinde
// neredeyse yok ve boşuna bant genişliği; listede yoksa en son (en yüksek) girdiye düşülüyor.
const KALITE_SIRASI = ['full', 'hd', 'sd', 'low', 'lowest', 'mobile'];

// Saf ayrıştırıcı: HTML metninden oynatıcı verisini çıkarır. test/okru.test.mjs bunu
// doğrudan çağırıyor (ağ gerekmeden).
function embedCoz(html) {
  const m = /data-options="([^"]*)"/.exec(html);
  if (!m) return null;
  let secenekler;
  try { secenekler = JSON.parse(htmlCoz(m[1])); } catch (e) { return null; }
  let meta = secenekler && secenekler.flashvars && secenekler.flashvars.metadata;
  if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch (e) { return null; } }
  if (!meta || typeof meta !== 'object') return null;

  const videolar = (Array.isArray(meta.videos) ? meta.videos : [])
    .filter(v => v && typeof v.url === 'string' && v.url && !v.disallowed);
  const secili = KALITE_SIRASI.map(ad => videolar.find(v => v.name === ad)).find(Boolean)
    || videolar[videolar.length - 1];
  const film = meta.movie || {};
  return {
    url: secili ? secili.url : null,
    kalite: secili ? secili.name : null,
    hls: typeof meta.hlsManifestUrl === 'string' ? meta.hlsManifestUrl : null,
    baslik: typeof film.title === 'string' ? film.title : null,
    sure: Number(film.duration) || 0,
  };
}

// Sayfa küçük bir HTML kaçış kümesi kullanıyor (&quot; &amp; &lt; &gt; &#39;).
function htmlCoz(s) {
  return String(s).replace(/&(quot|amp|lt|gt|#39|apos);/g, (_, k) =>
    ({ quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'", apos: "'" }[k]));
}

const BLOCKED = s => s === 403 || s === 429 || s >= 500;
const BACKOFF = [600, 1500];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchRetry(url, init, deadline) {
  let lastStatus = 0;
  for (let i = 0; i <= BACKOFF.length; i++) {
    if (i) {
      const wait = BACKOFF[i - 1] + Math.floor(Math.random() * 150);
      if (Date.now() + wait > deadline) break;
      await sleep(wait);
    }
    const r = await fetch(url, init);
    if (!BLOCKED(r.status)) return r;
    lastStatus = r.status;
    if (Date.now() > deadline) break;
  }
  const e = new Error('ok.ru blocked'); e.blocked = true; e.status = lastStatus;
  throw e;
}

module.exports = async (req, res) => {
  if (kokenReddet(req, res)) return;
  const id = String((req.query && req.query.id) || '');
  const fail = (code, body, extra) => {
    res.setHeader('cache-control', 'no-store');
    if (extra) for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
    return res.status(code).send(JSON.stringify(body));
  };
  if (!/^\d{6,20}$/.test(id)) return fail(400, { error: 'bad id' });

  const deadline = Date.now() + 15000;
  try {
    const embed = `https://ok.ru/videoembed/${id}`;
    const r = await fetchRetry(embed, { headers: { 'user-agent': UA } }, deadline);
    const html = await r.text();
    const veri = embedCoz(html);
    // Silinmiş videoda sayfa 200 dönüyor ama oynatıcı verisi boş geliyor (ölçüm: rastgele
    // 25 arşiv linkinin 12'sinde veri var, 13'ü silinmiş).
    if (!veri || !veri.url) return fail(404, { error: 'video not found' });

    // Linkteki expires damgası saatler geçerli; kısa süre cache'lenebilir.
    res.setHeader('cache-control', 'public, max-age=1800, s-maxage=1800');
    res.status(200).send(JSON.stringify({ url: veri.url, kalite: veri.kalite }));
  } catch (e) {
    if (e && e.blocked) return fail(503, { error: 'ok.ru busy', status: e.status }, { 'retry-after': '2' });
    return fail(502, { error: String((e && e.message) || e) });
  }
};

// test/okru.test.mjs için; çalışma zamanında kullanılmıyor.
module.exports.embedCoz = embedCoz;
module.exports.htmlCoz = htmlCoz;
