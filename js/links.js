// Bölüm linkleri: hangi sağlayıcı reklamsız çözülebiliyor, hangisi ölü, butonlar nasıl basılıyor.
import { esc, ic } from './util.js';

// Reklamlı/redirect'li sağlayıcıları reklamsız oynatmak için linki çözen küçük servisler.
// Her sağlayıcı embed URL'inden resolver'a atılacak querystring'i (id, gerekiyorsa host) çıkarır;
// çıkaramazsa (regex tutmazsa) o link için "Reklamsız izle" butonu hiç gösterilmez, klasik embed kalır.
// Sibnet Vercel'de ve Netlify'da (aynı kod: api/sibnet.js, Netlify sarmalayıcısı cozucu-netlify/),
// Uqload Cloudflare Workers'ta (bkz. cf/uqload) çalışıyor —
// uqload.com'u Vercel'in IP'leri engelliyordu, Cloudflare Workers'ınkiler engellenmiyor.
// Sendvid ve Doodstream için de resolver yazılmıştı ama production'da (Vercel'de de Cloudflare
// Workers'ta da) hedef sitenin anti-bot/routing korumaları yüzünden hiç çalışmadı; deploy edilen
// ölü kod bırakmamak için api/sendvid.js ve api/doodstream.js silindi (git geçmişinde duruyorlar).
//
// ok.ru/odnoklassniki (arşivin en yaygın sağlayıcısı, ~140.000 link) için resolver yazıldı
// (api/okru.js, ayrıştırıcısının testi test/okru.test.mjs), deploy edildi ve başka bir ağdan
// doğrulandı: ÇALIŞMIYOR. Dönen mp4 linkindeki `srcIp` gerçekten imzaya dahil, link yalnız
// fonksiyonun kendi IP'sinden açılıyor, gerçek kullanıcı tarayıcısı hiç oynatamıyor. Bu mevcut
// mimarinin (Vercel serverless resolver) çözemediği bir kısıt — OKRU_ETKIN kalıcı olarak false
// kalacak (bkz. GELISTIRME-PLANI.md §4.4.2). Yeniden denemeden önce farklı bir yaklaşım gerekir.
const OKRU_ETKIN = false;
const OKRU = {
  resolver: 'https://tka-sibnet.vercel.app/api/okru',
  params: url => { const m = /\/videoembed\/(\d{6,20})(?:[?&#]|$)/.exec(url); return m && `id=${m[1]}`; },
};

// resolver bir dizi olabilir: js/cozum.js yükü video numarasına göre dağıtıyor, biri yoğunsa ötekine geçiyor.
// Sibnet hız sınırını kaynak IP'ye göre koyduğu için iki ayrı IP havuzu yoğun saatlerde fark ediyor.
// İki çözücü iki ayrı IP havuzunda: Sibnet'in engelleri geçici ve IP'ye özel. 2026-09-23'te ikisi de
// sırayla engellendi (biri engelliyken öteki çalışıyordu); Cloudflare'deki gibi kalıcı bir yasak değil.
const SIBNET_COZUCULER = ['https://tka-sibnet.vercel.app/api/sibnet', 'https://tka-sibnet.netlify.app/api/sibnet'];
const DIRECT_PROVIDERS = {
  SIBNET: { resolver: SIBNET_COZUCULER, params: url => { const m = /videoid=(\d+)/.exec(url); return m && `id=${m[1]}`; } },
  UQLOAD: { resolver: 'https://tka-uqload.turkanime-arsiv.workers.dev', params: url => { const m = /uqload\.[a-z]+\/embed-([a-z0-9]+)\.html/i.exec(url); return m && `id=${m[1]}`; } },
  // veride iki ad da geçiyor: ODNOKLASSNIKI (137k link) ve OK.RU (3.2k link)
  ...(OKRU_ETKIN ? { ODNOKLASSNIKI: OKRU, 'OK.RU': OKRU } : {}),
};
const directParams = l => { const p = DIRECT_PROVIDERS[l.player]; return p && p.params(l.url); };

// X-Frame-Options: SAMEORIGIN döndürdüğü doğrulanan sağlayıcılar (iframe'de açılamaz, yeni sekmede açılır).
const NO_EMBED_PLAYERS = new Set(['DOODSTREAM', 'YADISK', 'MEDIACM', 'STREAMRUBY', 'PIXELDRAIN']);
// Bilinen büyük/kurumsal platformlar (Google, Mail.ru, VK/OK.ru, Dailymotion): genelde daha az
// popup/yönlendirme reklamı çıkarıyorlar, bu yüzden buton sırasında öne alınıyorlar. Bu ölçülmüş
// bir veri değil, genel bilinirliğe dayalı bir tahmin — kesin garanti değildir.
const PREFERRED_PLAYERS = ['GDRIVE', 'MAIL', 'OK.RU', 'ODNOKLASSNIKI', 'DAILYMOTION', 'VK'];
function playerRank(player) {
  const i = PREFERRED_PLAYERS.indexOf(player);
  return i === -1 ? PREFERRED_PLAYERS.length : i;
}

// Veride üç link tipi var: 'url' (mutlak, çalışabilir), 'mask' (turkanime sunucusu gerektiren maskeli
// link) ve 'yol' (turkanime'nin kendi ajax yolu, ör. "ajax/videosec&b=..."). Site kapalı olduğu için
// 'url' dışındaki her tip ölüdür; 'yol' mutlak olmadığından iframe'e basılırsa kendi sayfamızda 404 açar.
const OLU = tip => tip !== 'url';

// fansub bilgisi çağıran taraftan (fansub grubu zaten seçilmiş) geldiği için buton üstünde tekrar edilmiyor.
// çalışmayan (mask) linkler sona, bilinen güvenilir sağlayıcılar öne alınıyor.
const siralaLinkler = links => [...links].sort((a, b) => {
  if (OLU(a.tip) !== OLU(b.tip)) return OLU(a.tip) - OLU(b.tip);
  return playerRank(a.player) - playerRank(b.player);
});

// Bölüm açılınca otomatik seçilen reklamsız link (bkz. player.js openEpisode): reklamsız linki olan ilk
// fansub grubunun, sıralamadaki ilk reklamsız linki. Sonraki bölümü önceden çözmek için kullanılıyor.
function onerilenDirectLink(links) {
  const gruplar = new Map();
  for (const l of links || []) {
    const ad = l.fansub || 'Bilinmeyen';
    if (!gruplar.has(ad)) gruplar.set(ad, []);
    gruplar.get(ad).push(l);
  }
  const reklamsiz = l => !OLU(l.tip) && directParams(l);
  const grup = [...gruplar.values()].find(ls => ls.some(reklamsiz));
  return grup ? siralaLinkler(grup).find(reklamsiz) : null;
}

function epLinksHtml(links) {
  const sorted = siralaLinkler(links);
  // reklamsız butonları en başa (önerilen); orijinal embed butonları aynen kalır
  const direct = sorted.filter(l => !OLU(l.tip) && directParams(l)).map((l, i, arr) =>
    `<button type="button" class="link-btn direct" data-embed-url="${esc(l.url)}" data-fansub="${esc(l.fansub || '')}" data-direct-player="${l.player}" data-direct-params="${esc(directParams(l))}" title="${esc(l.player)} videosunu reklamsız oynat">${ic('zap')}Reklamsız izle${arr.length > 1 ? ' ' + (i + 1) : ''}${i === 0 ? '<span class="meta">önerilen</span>' : ''}</button>`);
  return direct.concat(sorted.map(l => {
    const label = esc(l.player);
    if (OLU(l.tip)) return `<span class="link-btn mask" title="turkanime sunucusu gerekiyor, çalışmıyor">${label}</span>`;
    if (NO_EMBED_PLAYERS.has(l.player)) return `<a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${label}${ic('external')}</a>`;
    return `<button type="button" class="link-btn" data-embed-url="${esc(l.url)}" data-fansub="${esc(l.fansub || '')}">${label}</button>`;
  })).join('');
}


export { siralaLinkler, onerilenDirectLink, DIRECT_PROVIDERS, OKRU, OKRU_ETKIN, directParams, NO_EMBED_PLAYERS, PREFERRED_PLAYERS, playerRank, OLU, epLinksHtml };
