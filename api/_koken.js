// Köken (Origin/Referer) kısıtlaması — Vercel function'larının ortak parçası (§4.4.1).
// Dosya adı "_" ile başladığı için Vercel bunu bir uç nokta olarak yayınlamıyor.
// Cloudflare Worker'daki eşi: cf/uqload/worker.js içindeki kokenDogrula — ikisi birlikte
// değişmeli, test/koken.test.mjs ikisini de aynı senaryolardan geçiriyor.
//
// NE KADAR KORUR: CORS yalnız tarayıcıyı bağlar, `curl` bağlamaz — ama burada Origin/Referer
// SUNUCUDA da doğrulanıyor, yani başka bir siteden gelen tarayıcı isteği ve başlıksız betik
// isteği 403 alıyor. Başlığı elle uyduran birini durdurmaz; bu kimlik doğrulama değil,
// kötüye kullanımı zorlaştıran bir sürtünme katmanıdır. Gerçek koruma için önüne oran
// sınırlayıcı (Vercel Firewall / Cloudflare) koymak gerekir.
//
// Ayar: TKA_ALLOWED_ORIGINS (virgülle ayrılmış tam köken listesi),
//       TKA_ALLOW_LOCALHOST=1 (yerel geliştirme kökenleri).
const VARSAYILAN_KOKENLER = ['https://berke-aras.github.io'];
const izinliKokenler = () => (process.env.TKA_ALLOWED_ORIGINS || '')
  .split(',').map(x => x.trim()).filter(Boolean).concat(VARSAYILAN_KOKENLER);
const YEREL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function kokenDogrula(req) {
  const origin = req.headers.origin
    || (req.headers.referer ? (() => { try { return new URL(req.headers.referer).origin; } catch (e) { return ''; } })() : '');
  if (!origin) return { ok: false, origin: '' };         // başlıksız istek (curl, betik)
  if (izinliKokenler().includes(origin)) return { ok: true, origin };
  if (process.env.TKA_ALLOW_LOCALHOST === '1' && YEREL.test(origin)) return { ok: true, origin };
  return { ok: false, origin };
}

// Ortak yanıt başlıkları + izinsiz kökende isteği hiç yapmadan 403. `true` dönerse
// çağıran fonksiyon kendi işine devam etmemeli.
function kokenReddet(req, res) {
  const koken = kokenDogrula(req);
  // Yalnız izinli kökene CORS başlığı veriliyor; 'vary: origin' olmadan CDN yanlış köken
  // için cache'lenmiş bir başlık servis edebilir.
  if (koken.ok) res.setHeader('access-control-allow-origin', koken.origin);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('content-type', 'application/json');
  if (req.method === 'OPTIONS') { res.status(koken.ok ? 204 : 403).end(); return true; }
  if (!koken.ok) {
    res.setHeader('cache-control', 'no-store');
    res.status(403).send(JSON.stringify({ error: 'origin not allowed' }));
    return true;
  }
  return false;
}

module.exports = { kokenDogrula, kokenReddet };
