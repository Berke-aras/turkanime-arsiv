// Uqload embed id -> doğrudan m3u8 (HLS) linki. Vercel serverless function olarak çalışır.
// uqload.com embed'i uqload.vc'ye redirect ediyor; kaynak JWPlayer p,a,c,k,e,d ile paketlenmiş,
// içindeki m3u8 linkini görmek için sunucu tarafında elle unpack ediyoruz (eval kullanmadan,
// üçüncü taraf sayfa içeriğini kod olarak çalıştırmamak için).
// UYARI: çıkarma mantığı doğrulandı (gerçek sayfa HTML'i üzerinde test edildi, çalışıyor) ama
// Vercel'e deploy edildiğinde uqload.com Cloudflare "Just a moment..." challenge'ı ile 403
// döndürüyor — Vercel'in IP aralıkları bu sitede engelli. Bu yüzden app.js'de DIRECT_PROVIDERS'a
// bağlanmadı. Farklı bir egress (ör. residential proxy) ile denenirse tekrar aktif edilebilir.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Dean Edwards P.A.C.K.E.R. çözücüsü; argümanları eval etmeden regex ile ayıklayıp burada çözüyoruz.
function unpack(html) {
  const call = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\((.*)\)\)\s*<\/script>/s.exec(html);
  if (!call) return null;
  const rest = call[1];
  const pm = /^'((?:\\.|[^'\\])*)'/.exec(rest);
  if (!pm) return null;
  const after = rest.slice(pm[0].length);
  const nums = /^,\s*(\d+)\s*,\s*(\d+)\s*,\s*/.exec(after);
  if (!nums) return null;
  const radix = Number(nums[1]);
  let count = Number(nums[2]);
  const km = /^'((?:\\.|[^'\\])*)'/.exec(after.slice(nums[0].length));
  if (!km) return null;
  const unesc = s => s.replace(/\\(.)/g, '$1');
  let p = unesc(pm[1]);
  const k = unesc(km[1]).split('|');
  while (count--) {
    if (k[count]) p = p.replace(new RegExp('\\b' + count.toString(radix) + '\\b', 'g'), k[count]);
  }
  return p;
}

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('content-type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const id = String((req.query && req.query.id) || '');
  if (!/^[a-z0-9]{6,20}$/i.test(id)) return res.status(400).send(JSON.stringify({ error: 'bad id' }));

  try {
    const embed = `https://uqload.com/embed-${id}.html`;
    const html = await (await fetch(embed, { headers: { 'user-agent': UA } })).text();
    if (/no longer available|expired/i.test(html)) return res.status(404).send(JSON.stringify({ error: 'video not found' }));

    const unpacked = unpack(html);
    const m = unpacked && /"(https?:\/\/[^"]+\.m3u8[^"]*)"/.exec(unpacked);
    if (!m) return res.status(404).send(JSON.stringify({ error: 'video not found' }));

    // linkteki e= parametresi ~4 saatlik geçerlilik süresi; kısa süre cache'lenebilir
    res.setHeader('cache-control', 'public, max-age=1800, s-maxage=1800');
    res.status(200).send(JSON.stringify({ url: m[1], hls: true }));
  } catch (e) {
    res.status(502).send(JSON.stringify({ error: String(e.message || e) }));
  }
};
