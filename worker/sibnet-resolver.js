// Sibnet videoid -> doğrudan mp4 linki. Cloudflare Worker olarak deploy edilir (ücretsiz plan yeter):
//   npx wrangler deploy worker/sibnet-resolver.js --name tka-sibnet --compatibility-date 2024-01-01
// Çıkan URL app.js içindeki SIBNET_RESOLVER sabitine yazılır. Video trafiği buradan geçmez,
// sadece link çözülür; tarayıcı mp4'ü doğrudan sibnet CDN'inden çeker.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET', 'content-type': 'application/json' };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, ...extra } });

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!/^\d{1,12}$/.test(id)) return json({ error: 'bad id' }, 400);

    const shell = `https://video.sibnet.ru/shell.php?videoid=${id}`;
    const html = await (await fetch(shell, { headers: { 'user-agent': UA } })).text();
    const m = /src:\s*"(\/v\/[^"]+\.mp4)"/.exec(html);
    if (!m) return json({ error: 'video not found' }, 404);

    // /v/<hash>/<id>.mp4 sadece sibnet referer'ıyla açılıyor; yönlendirmeleri elle takip edip
    // referer gerektirmeyen nihai CDN linkini (cvs*.sibnet.ru/...?st=..&e=..) döndürüyoruz.
    let url = 'https://video.sibnet.ru' + m[1];
    for (let i = 0; i < 6; i++) {
      const r = await fetch(url, { headers: { 'user-agent': UA, referer: shell, range: 'bytes=0-0' }, redirect: 'manual' });
      const loc = r.headers.get('location');
      if (!loc) { if (r.status >= 400) return json({ error: `cdn ${r.status}` }, 502); break; }
      url = new URL(loc, url).href;
    }
    // st/e imzası birkaç saat geçerli; kısa süre cache'lenebilir
    return json({ url }, 200, { 'cache-control': 'public, max-age=1800' });
  }
};
