// Sibnet videoid -> doğrudan mp4 linki. Vercel serverless function olarak çalışır (proje: tka-sibnet).
// Cloudflare Workers denendi ama sibnet CF IP'lerine 403 veriyor; Vercel (AWS) IP'lerinden erişim var.
// Video trafiği buradan geçmez; sadece link çözülür, tarayıcı mp4'ü doğrudan sibnet CDN'inden çeker.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('content-type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const id = String((req.query && req.query.id) || '');
  if (!/^\d{1,12}$/.test(id)) return res.status(400).send(JSON.stringify({ error: 'bad id' }));

  try {
    const shell = `https://video.sibnet.ru/shell.php?videoid=${id}`;
    const html = await (await fetch(shell, { headers: { 'user-agent': UA } })).text();
    const m = /src:\s*"(\/v\/[^"]+\.mp4)"/.exec(html);
    if (!m) return res.status(404).send(JSON.stringify({ error: 'video not found' }));

    // /v/<hash>/<id>.mp4 sadece sibnet referer'ıyla açılıyor; yönlendirmeleri elle takip edip
    // referer gerektirmeyen nihai CDN linkini (cvs*.sibnet.ru/...?st=..&e=..) döndürüyoruz.
    let url = 'https://video.sibnet.ru' + m[1];
    for (let i = 0; i < 6; i++) {
      const r = await fetch(url, { headers: { 'user-agent': UA, referer: shell, range: 'bytes=0-0' }, redirect: 'manual' });
      const loc = r.headers.get('location');
      if (!loc) { if (r.status >= 400) return res.status(502).send(JSON.stringify({ error: `cdn ${r.status}` })); break; }
      url = new URL(loc, url).href;
    }
    // st/e imzası birkaç saat geçerli; kısa süre cache'lenebilir
    res.setHeader('cache-control', 'public, max-age=1800, s-maxage=1800');
    res.status(200).send(JSON.stringify({ url }));
  } catch (e) {
    res.status(502).send(JSON.stringify({ error: String(e.message || e) }));
  }
};
