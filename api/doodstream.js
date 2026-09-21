// Doodstream (dood.*) embed -> doğrudan mp4 linki (bilinen pass_md5 akışı). Vercel serverless function.
// UYARI: Vercel'e deploy edilip production loglarında doğrulandı — dood.watch da (Sibnet'in Cloudflare
// Workers'ta yaşadığı sorunun aynısı gibi) Vercel'in IP'lerine 403 "Just a moment..." challenge'ı
// döndürüyor. Bu yüzden app.js'de DIRECT_PROVIDERS'a bağlanmadı.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('content-type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const id = String((req.query && req.query.id) || '');
  const host = String((req.query && req.query.host) || '');
  if (!/^[a-z0-9]{6,20}$/i.test(id) || !/^dood\.[a-z]{2,6}$/i.test(host)) return res.status(400).send(JSON.stringify({ error: 'bad id' }));

  try {
    const embed = `https://${host}/e/${id}`;
    const html = await (await fetch(embed, { headers: { 'user-agent': UA } })).text();
    if (/deleted|not found/i.test(html)) return res.status(404).send(JSON.stringify({ error: 'video not found' }));
    const m = /\/pass_md5\/[^"'\s]+/.exec(html);
    if (!m) return res.status(404).send(JSON.stringify({ error: 'video not found' }));

    // pass_md5 linki referer'lı istekte bir taban URL döndürür; sonuna rastgele string + token/expiry ekleyip nihai linki kuruyoruz.
    const passUrl = `https://${host}${m[0]}`;
    const base = await (await fetch(passUrl, { headers: { 'user-agent': UA, referer: embed } })).text();
    if (!/^https?:\/\//.test(base)) return res.status(502).send(JSON.stringify({ error: 'pass_md5 failed' }));

    const rand = Math.random().toString(36).slice(2, 12);
    const token = m[0].split('/').pop();
    const url = `${base}${rand}?token=${token}&expiry=${Date.now()}`;

    // dood linkleri kısa ömürlü; uzun cache'lenmemeli
    res.setHeader('cache-control', 'public, max-age=60, s-maxage=60');
    res.status(200).send(JSON.stringify({ url }));
  } catch (e) {
    res.status(502).send(JSON.stringify({ error: String(e.message || e) }));
  }
};
