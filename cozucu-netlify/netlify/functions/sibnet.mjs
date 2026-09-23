// Sibnet çözücüsünün Netlify kopyası (site: tka-sibnet.netlify.app). Asıl mantık api/sibnet.js'te,
// burada yalnız Netlify'ın Request/Response biçimi Vercel'in (req, res) biçimine çevriliyor.
// Neden ikinci bir sunucu: Sibnet hız sınırını kaynak IP'ye göre uyguluyor; tek çözücüde yoğun
// saatlerde bütün ziyaretçiler aynı IP havuzundan gidip 403 yiyordu. Netlify (AWS Lambda) ayrı bir
// IP havuzu; istemci (js/cozum.js) yükü çözücülere dağıtıyor, biri yoğunsa ötekine geçiyor.
import sibnet from '../../../api/sibnet.js';

export default async req => {
  const u = new URL(req.url);
  const basliklar = {};
  for (const [k, v] of req.headers) basliklar[k.toLowerCase()] = v;
  const vreq = { method: req.method, headers: basliklar, query: Object.fromEntries(u.searchParams) };
  let durum = 200, govde = null;
  const cikis = new Headers();
  const vres = {
    setHeader(k, v) { cikis.set(k, String(v)); return vres; },
    status(s) { durum = s; return vres; },
    send(b) { govde = b; return vres; },
    end(b) { if (b !== undefined) govde = b; return vres; },
  };
  await sibnet(vreq, vres);
  // Netlify CDN'i function yanıtlarını ancak bu başlıkla saklıyor; süre Vercel'deki s-maxage ile aynı.
  const cc = cikis.get('cache-control') || '';
  const sm = /s-maxage=(\d+)/.exec(cc);
  if (durum === 200 && sm) cikis.set('netlify-cdn-cache-control', `public, s-maxage=${sm[1]}, durable`);
  return new Response(durum === 204 ? null : govde, { status: durum, headers: cikis });
};

export const config = { path: '/api/sibnet' };
