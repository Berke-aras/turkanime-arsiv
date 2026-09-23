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

// ---- köken kısıtlaması (GELISTIRME-PLANI.md §4.4.1) ----
// Eskiden 'access-control-allow-origin: *' idi; başka bir site bu resolver'ı kendi oynatıcısına
// bağlayabiliyordu. Aynı mantığın Vercel eşi: api/sibnet.js — ikisi birlikte değişmeli.
//
// NE KADAR KORUR: Origin/Referer sunucuda da doğrulanıyor, yani başka siteden gelen tarayıcı
// isteği ve başlıksız betik isteği 403 alıyor. Başlığı elle uyduran birini durdurmaz; bu bir
// kimlik doğrulama değil, sürtünme katmanıdır. Oran sınırı için Cloudflare'in kendi
// Rate Limiting kuralları kullanılmalı (Workers önünde, ücretsiz planda da var).
//
// Ayar: ALLOWED_ORIGINS gizli değişkeni (virgülle ayrılmış), ALLOW_LOCALHOST=1 yerel geliştirme.
const VARSAYILAN_KOKENLER = ['https://berke-aras.github.io'];
const YEREL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function kokenDogrula(request, env) {
  const ref = request.headers.get('referer');
  let origin = request.headers.get('origin') || '';
  if (!origin && ref) { try { origin = new URL(ref).origin; } catch (e) { origin = ''; } }
  if (!origin) return { ok: false, origin: '' };          // başlıksız istek (curl, betik)
  const izinli = String((env && env.ALLOWED_ORIGINS) || '')
    .split(',').map(x => x.trim()).filter(Boolean).concat(VARSAYILAN_KOKENLER);
  if (izinli.includes(origin)) return { ok: true, origin };
  if (env && env.ALLOW_LOCALHOST === '1' && YEREL.test(origin)) return { ok: true, origin };
  return { ok: false, origin };
}

// 'vary: origin' olmadan CDN yanlış köken için cache'lenmiş bir başlık servis edebilir.
const basliklar = koken => ({
  'content-type': 'application/json',
  'access-control-allow-methods': 'GET, OPTIONS',
  vary: 'origin',
  ...(koken.ok ? { 'access-control-allow-origin': koken.origin } : {}),
});
// json() kökeni parametreden alıyor: modül seviyesinde tutulsaydı aynı isolate'teki eşzamanlı
// istekler birbirinin kökenini ezebilirdi.
const json = (koken, body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...basliklar(koken), ...extra } });

// Uqload'ın cevabını sınıflandırır. Eskiden durum koduna hiç bakılmıyordu: Cloudflare'in "Just a moment..."
// bot sayfası (403) ya da geçici bir 5xx da "oynatıcı bulunamadı" sayılıp 404 "video not found"
// dönüyordu. İstemci 404'ü kalıcı sayıp hemen reklamlı embed'e düştüğü için, aslında yerinde duran
// videolar da "yok" görünüyordu. test/uqload.test.mjs bu ayrımı sınıyor.
export function sayfaSinifla(status, html) {
  const engel = status === 403 || status === 429 || status >= 500
    || /<title>\s*Just a moment|challenge-platform|cf-chl-/i.test(html);
  if (engel) return { kod: 503, hata: 'uqload busy' };
  if (status === 404 || /no longer available|expired|file (was|has been) deleted|file not found/i.test(html)) {
    return { kod: 404, hata: 'video not found' };
  }
  const unpacked = unpack(html);
  const m = unpacked && /"(https?:\/\/[^"]+\.m3u8[^"]*)"/.exec(unpacked);
  if (!m) return { kod: 502, hata: 'player not recognised' };
  return { m3u8: m[1] };
}

export default {
  async fetch(request, env) {
    const koken = kokenDogrula(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: koken.ok ? 204 : 403, headers: basliklar(koken) });
    }
    if (!koken.ok) return json(koken, { error: 'origin not allowed' }, 403, { 'cache-control': 'no-store' });
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^[a-z0-9]{6,20}$/i.test(id)) return json(koken, { error: 'bad id' }, 400);

    try {
      const embed = `https://uqload.com/embed-${id}.html`;
      const r = await fetch(embed, { headers: { 'user-agent': UA } });
      const html = await r.text();
      const sonuc = sayfaSinifla(r.status, html);
      if (sonuc.hata) {
        // 503 geçici (engel/yoğunluk): istemci tekrar deniyor. 404 kalıcı. 502: sayfa açıldı ama tanınmadı.
        return json(koken, { error: sonuc.hata, status: r.status }, sonuc.kod,
          sonuc.kod === 503 ? { 'cache-control': 'no-store', 'retry-after': '2' } : { 'cache-control': 'no-store' });
      }
      // linkteki e= parametresi ~4 saatlik geçerlilik süresi; kısa süre cache'lenebilir
      return json(koken, { url: sonuc.m3u8, hls: true }, 200, { 'cache-control': 'public, max-age=1800, s-maxage=1800' });
    } catch (e) {
      return json(koken, { error: String(e.message || e) }, 502);
    }
  },
};
