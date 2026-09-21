// Uqload embed id -> doğrudan m3u8 (HLS) linki. Cloudflare Workers olarak çalışır (bkz. cf/uqload).
// uqload.com'un Cloudflare koruması Vercel'in IP'lerine 403 "Just a moment..." veriyordu ama
// Cloudflare Workers'ın kendi IP'lerinden erişim var — bu yüzden diğer resolver'lar gibi Vercel'de
// değil, burada. Kaynak JWPlayer p,a,c,k,e,d ile paketlenmiş; içindeki m3u8 linkini görmek için
// sunucu tarafında elle unpack ediyoruz (eval kullanmadan, üçüncü taraf sayfa içeriğini kod olarak
// çalıştırmamak için).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Dean Edwards P.A.C.K.E.R. çözücüsü.
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

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'content-type': 'application/json' };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extra } });

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^[a-z0-9]{6,20}$/i.test(id)) return json({ error: 'bad id' }, 400);

    try {
      const embed = `https://uqload.com/embed-${id}.html`;
      const html = await (await fetch(embed, { headers: { 'user-agent': UA } })).text();
      if (/no longer available|expired/i.test(html)) return json({ error: 'video not found' }, 404);

      const unpacked = unpack(html);
      const m = unpacked && /"(https?:\/\/[^"]+\.m3u8[^"]*)"/.exec(unpacked);
      if (!m) return json({ error: 'video not found' }, 404);

      // linkteki e= parametresi ~4 saatlik geçerlilik süresi; kısa süre cache'lenebilir
      return json({ url: m[1], hls: true }, 200, { 'cache-control': 'public, max-age=1800, s-maxage=1800' });
    } catch (e) {
      return json({ error: String(e.message || e) }, 502);
    }
  },
};
