"use strict";

const TR_MAP = {'ı':'i','İ':'i','I':'i','ş':'s','Ş':'s','ğ':'g','Ğ':'g','ü':'u','Ü':'u','ö':'o','Ö':'o','ç':'c','Ç':'c'};
function norm(s){
  let t = '';
  for (const ch of String(s)) t += TR_MAP[ch] || ch;
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const IS_TR = (navigator.languages || [navigator.language || 'tr']).some(l => /^tr\b/i.test(l));
const ic = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// Reklamlı/redirect'li sağlayıcıları reklamsız oynatmak için linki çözen küçük servisler.
// Her sağlayıcı embed URL'inden resolver'a atılacak querystring'i (id, gerekiyorsa host) çıkarır;
// çıkaramazsa (regex tutmazsa) o link için "Reklamsız izle" butonu hiç gösterilmez, klasik embed kalır.
// Sibnet Vercel'de (bkz. api/sibnet.js), Uqload Cloudflare Workers'ta (bkz. cf/uqload) çalışıyor —
// uqload.com'u Vercel'in IP'leri engelliyordu, Cloudflare Workers'ınkiler engellenmiyor.
// Sendvid ve Doodstream için de resolver yazılmıştı ama production'da (Vercel'de de Cloudflare
// Workers'ta da) hedef sitenin anti-bot/routing korumaları yüzünden hiç çalışmadı; deploy edilen
// ölü kod bırakmamak için api/sendvid.js ve api/doodstream.js silindi (git geçmişinde duruyorlar).
const DIRECT_PROVIDERS = {
  SIBNET: { resolver: 'https://tka-sibnet.vercel.app/api/sibnet', params: url => { const m = /videoid=(\d+)/.exec(url); return m && `id=${m[1]}`; } },
  UQLOAD: { resolver: 'https://tka-uqload.turkanime-arsiv.workers.dev', params: url => { const m = /uqload\.[a-z]+\/embed-([a-z0-9]+)\.html/i.exec(url); return m && `id=${m[1]}`; } },
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
function epLinksHtml(links) {
  // çalışmayan (mask) linkler sona, bilinen güvenilir sağlayıcılar öne alınıyor.
  const sorted = [...links].sort((a, b) => {
    if (OLU(a.tip) !== OLU(b.tip)) return OLU(a.tip) - OLU(b.tip);
    return playerRank(a.player) - playerRank(b.player);
  });
  // reklamsız butonları en başa (önerilen); orijinal embed butonları aynen kalır
  const direct = sorted.filter(l => !OLU(l.tip) && directParams(l)).map((l, i, arr) =>
    `<button type="button" class="link-btn direct" data-embed-url="${esc(l.url)}" data-direct-player="${l.player}" data-direct-params="${esc(directParams(l))}" title="${esc(l.player)} videosunu reklamsız oynat">${ic('zap')}Reklamsız izle${arr.length > 1 ? ' ' + (i + 1) : ''}${i === 0 ? '<span class="meta">önerilen</span>' : ''}</button>`);
  return direct.concat(sorted.map(l => {
    const label = esc(l.player);
    if (OLU(l.tip)) return `<span class="link-btn mask" title="turkanime sunucusu gerekiyor, çalışmıyor">${label}</span>`;
    if (NO_EMBED_PLAYERS.has(l.player)) return `<a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${label}${ic('external')}</a>`;
    return `<button type="button" class="link-btn" data-embed-url="${esc(l.url)}">${label}</button>`;
  })).join('');
}

const META = window.META || {};
const ANIME = (window.INDEX || []).map(r => {
  const baslik = r[1] || r[0]; // kaynak veride bazı başlıklar null, slug'a düş
  const n = norm(baslik + ' ' + r[0]);
  const m = META[r[0]] || ['', [], 0, null];
  return {
    slug: r[0], baslik, eps: r[2], urls: r[3],
    kategori: m[0], tur: m[1], puan: m[2], poster: m[3] || null,
    n, tok: n.split(' ').filter(Boolean)
  };
}).sort((a, b) => a.baslik.localeCompare(b.baslik, 'tr'));

const KATEGORILER = [...new Set(ANIME.map(a => a.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
const TURLER = [...new Set(ANIME.flatMap(a => a.tur))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'tr'));
const TOPLAM_BOLUM = ANIME.reduce((s, a) => s + (a.eps || 0), 0);
const TOPLAM_LINK = ANIME.reduce((s, a) => s + (a.urls || 0), 0);
function statsStripHtml() {
  const stat = (num, label) => `<div class="stat"><span class="stat-num">${num.toLocaleString('tr-TR')}</span><span class="stat-label">${label}</span></div>`;
  return `<div class="stats-strip">${stat(ANIME.length, 'anime')}${stat(TOPLAM_BOLUM, 'bölüm')}${stat(TOPLAM_LINK, 'izleme linki')}${stat(TURLER.length, 'tür')}</div>`;
}

// Gün boyunca aynı kalsın diye tarihi tohum olarak kullanan basit seçim (puanı 7 üstü animelerden).
const SFW_EXCLUDED_TUR = new Set(['Ecchi', 'Hentai']);
function animeOfDay() {
  const pool = ANIME.filter(a => a.puan > 7 && !a.tur.some(t => SFW_EXCLUDED_TUR.has(t)));
  if (!pool.length) return null;
  const seed = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
function pickRandomAnime() {
  const filtered = filterAndSort();
  const pool = filtered.length ? filtered : ANIME; // filtre sonucu boşsa yine de bir yere götür
  if (!pool.length) return;
  location.hash = '#/anime/' + pool[Math.floor(Math.random() * pool.length)].slug;
}

// Levenshtein mesafesi: yazım hatalarına toleranslı arama için.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

// Her sorgu kelimesi anime'nin bir kelimesine ~%35 hata payıyla uymalı (AND).
function matchScore(queryTokens, a) {
  if (!queryTokens.length) return 0;
  let score = 0;
  for (const qt of queryTokens) {
    if (a.n.includes(qt)) continue;
    const threshold = Math.max(1, Math.ceil(qt.length / 3));
    let best = Infinity;
    for (const tok of a.tok) {
      if (Math.abs(tok.length - qt.length) > threshold) continue;
      const d = levenshtein(qt, tok);
      if (d < best) best = d;
      if (best === 0) break;
    }
    if (best > threshold) return null;
    score += best;
  }
  return score;
}

// ---- localStorage: favoriler / son bakılanlar ----
function readLS(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function writeLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* localStorage yoksa sessiz geç */ } }

const favs = new Set(readLS('ta_favs', []));
const isFav = slug => favs.has(slug);
const favLabel = slug => isFav(slug) ? 'Favorilerden çıkar' : 'Favorilere ekle';
function toggleFav(slug) { favs.has(slug) ? favs.delete(slug) : favs.add(slug); writeLS('ta_favs', [...favs]); }

let recent = readLS('ta_recent', []);
let epReverse = readLS('ta_eprev', false);
function pushRecent(slug) { recent = [slug, ...recent.filter(s => s !== slug)].slice(0, 16); writeLS('ta_recent', recent); }

// Poster URL'leri build-time'da (scripts/build-posters.js) meta.js içine gömülüyor;
// runtime'da AniList'e istek atılmıyor, rate-limit'e takılma riski yok.
function initials(title) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function hue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function posterPlaceholder(a) {
  if (a.poster) return `<div class="poster loaded"><img src="${esc(a.poster)}" loading="lazy" alt="" onload="this.classList.add('img-loaded')" onerror="this.classList.add('img-loaded')"></div>`;
  return `<div class="poster" style="background:hsl(${hue(a.baslik)},45%,20%)"><span class="poster-init">${esc(initials(a.baslik))}</span></div>`;
}

// Kart gerçek bir <a>: orta tık/Ctrl+tık yeni sekmede açar, tarayıcı bağlantı önizlemesi gösterir,
// ekran okuyucu bağlantı olarak duyurur. Favori butonu iç içe etkileşimli öğe olmasın diye
// <a>'nın dışında, sarmalayıcıda duruyor ve üstüne konumlanıyor (bkz. style.css .card-wrap).
function cardHtml(a) {
  return `
    <div class="card-wrap">
      <a class="card${a.eps ? '' : ' card-empty'}" href="#/anime/${encodeURIComponent(a.slug)}">
        ${posterPlaceholder(a)}
        ${a.puan ? `<span class="rating-badge">${ic('star','ic-star')}${a.puan}</span>` : ''}
        <h3>${esc(a.baslik)}</h3>
        <div class="meta">${a.eps ? `${a.eps} bölüm · ${a.urls} link` : 'bölüm verisi yok'}</div>
        <div class="badges">${a.tur.slice(0, 3).map(t => `<span class="badge">${esc(t)}</span>`).join('')}</div>
      </a>
      <button class="fav-btn ${isFav(a.slug) ? 'active' : ''}" data-fav="${a.slug}" title="Favori" aria-label="${favLabel(a.slug)}">${ic('star')}</button>
    </div>`;
}

// Kart gezinmesini tarayıcı hallediyor; burada yalnız favori butonları bağlanıyor.
function wireCards(container) {
  container.querySelectorAll('.fav-btn').forEach(b => {
    b.addEventListener('click', e => {
      e.preventDefault();
      toggleFav(b.dataset.fav);
      b.classList.toggle('active');
      b.setAttribute('aria-label', favLabel(b.dataset.fav));
    });
  });
}

const app = document.getElementById('app');
// içerik her değiştiğinde animasyonu baştan tetiklemek için class'ı kaldırıp reflow ile yeniden ekliyoruz.
function fadeApp() { app.classList.remove('fade-in'); void app.offsetWidth; app.classList.add('fade-in'); }
const searchEl = document.getElementById('search');

// ---- Bölüm oynatıcı modalı (embed edilebilen linkler burada açılır) ----
const playerModal = document.getElementById('player-modal');
const playerFrame = document.getElementById('player-modal-frame');
const playerVideo = document.getElementById('player-modal-video');
const playerNewTab = document.getElementById('player-modal-newtab');
const playerPrevBtn = document.getElementById('player-modal-prev');
const playerNextBtn = document.getElementById('player-modal-next');
const playerEpLabel = document.getElementById('player-modal-eplabel');
const playerLoading = document.getElementById('player-modal-loading');
const playerLoadingHint = document.getElementById('player-modal-loading-hint');
// reklamsız <video> oynatımına özel custom kontrol çubuğu; iframe embed'de içeriği kontrol edemediğimiz için orada gizli.
const playerControls = document.getElementById('player-modal-controls');
const playerProgress = document.getElementById('player-modal-progress');
const playerPlayToggle = document.getElementById('player-modal-playtoggle');
const playerMuteBtn = document.getElementById('player-modal-mute');
const playerVolume = document.getElementById('player-modal-volume');
const playerTime = document.getElementById('player-modal-time');
const playerSpeedBtn = document.getElementById('player-modal-speed');
const playerFullscreenBtn = document.getElementById('player-modal-fullscreen');
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
let playerSpeed = 1;
function applySpeed() { playerVideo.playbackRate = playerSpeed; playerSpeedBtn.textContent = playerSpeed + 'x'; }
playerSpeedBtn.addEventListener('click', () => {
  playerSpeed = SPEEDS[(SPEEDS.indexOf(playerSpeed) + 1) % SPEEDS.length];
  applySpeed();
});
const fmtTime = s => !isFinite(s) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const setIcon = (btn, id) => btn.querySelector('use').setAttribute('href', '#' + id);
playerPlayToggle.addEventListener('click', () => { playerVideo.paused ? playerVideo.play() : playerVideo.pause(); });
playerVideo.addEventListener('click', () => { playerVideo.paused ? playerVideo.play() : playerVideo.pause(); });
playerVideo.addEventListener('play', () => setIcon(playerPlayToggle, 'i-pause'));
playerVideo.addEventListener('pause', () => setIcon(playerPlayToggle, 'i-play'));
playerVideo.addEventListener('timeupdate', () => {
  if (playerVideo.duration) playerProgress.value = (playerVideo.currentTime / playerVideo.duration) * 100;
  playerTime.textContent = `${fmtTime(playerVideo.currentTime)} / ${fmtTime(playerVideo.duration)}`;
});
playerProgress.addEventListener('input', () => { if (playerVideo.duration) playerVideo.currentTime = (playerProgress.value / 100) * playerVideo.duration; });
playerMuteBtn.addEventListener('click', () => { playerVideo.muted = !playerVideo.muted; });
playerVideo.addEventListener('volumechange', () => {
  setIcon(playerMuteBtn, playerVideo.muted || playerVideo.volume === 0 ? 'i-volume-mute' : 'i-volume');
  playerVolume.value = playerVideo.muted ? 0 : playerVideo.volume;
});
playerVolume.addEventListener('input', () => { playerVideo.muted = false; playerVideo.volume = playerVolume.value; });
playerFullscreenBtn.addEventListener('click', () => { playerVideo.requestFullscreen?.(); });
// açık olan detay sayfasının bölümleri; modaldaki önceki/sonraki gezinmesi bunu kullanır.
let currentEpisodes = [];
let currentEpIndex = null;
let playerLoadTimer = null;
function openPlayerModal(url, epIndex = null, direct = null) {
  clearTimeout(playerLoadTimer);
  playerLoadingHint.hidden = true;
  playerLoading.hidden = false;
  stopVideo();
  playerVideo.hidden = !direct;
  playerFrame.hidden = !!direct;
  playerControls.hidden = !direct;
  playerFrame.src = direct ? 'about:blank' : url;
  playerNewTab.href = url;
  if (direct) playDirect(direct, url);
  playerModal.hidden = false;
  currentEpIndex = epIndex;
  const ep = epIndex != null ? currentEpisodes[epIndex] : null;
  playerEpLabel.textContent = ep ? `${epIndex + 1} / ${currentEpisodes.length}` : '';
  syncEpNavButtons();
  // bazı sağlayıcılar sandbox içinde hiç yüklenmeyebilir; uzun sürerse "ayrı sayfada aç"ı hatırlat.
  playerLoadTimer = setTimeout(() => { playerLoadingHint.hidden = false; }, 8000);
}
playerFrame.addEventListener('load', () => { if (playerFrame.hidden) return; playerLoading.hidden = true; clearTimeout(playerLoadTimer); });
let hlsInstance = null;
function stopVideo() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  playerVideo.pause(); playerVideo.removeAttribute('src'); playerVideo.load();
}
// tarayıcı HLS'i native oynatamıyorsa (Safari dışında) hls.js'i ilk ihtiyaç anında CDN'den yükler.
function ensureHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
    s.onload = () => resolve(window.Hls);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
// Sibnet yoğun anlarda geçici olarak 403 verip resolver'ın 503 dönmesine yol açıyor (bkz. api/sibnet.js).
// Bu kalıcı bir hata değil, o yüzden reklamlı embed'e düşmeden önce kısa aralıklarla tekrar deniyoruz.
// 404/502 gibi kalıcı hatalarda beklemeden vazgeçiyoruz.
const RESOLVE_RETRY = [900, 2000];
async function resolveDirect(provider, params, stillWanted) {
  for (let i = 0; i <= RESOLVE_RETRY.length; i++) {
    if (i) {
      await new Promise(r => setTimeout(r, RESOLVE_RETRY[i - 1]));
      if (!stillWanted()) return null;
    }
    const r = await fetch(`${provider.resolver}?${params}`);
    if (!stillWanted()) return null;
    if (r.ok) return r.json();
    if (r.status !== 503) return null;
  }
  return null;
}
// mp4 yolunda <video>'nun kendi 'error' olayı embed'e düşürüyor, ama hls.js kendi hatalarını oraya
// taşımıyor: manifest yüklendikten sonra gelen fatal hata (süresi dolmuş token, ölü segment,
// desteklenmeyen codec) yakalanmazsa oynatıcı boş ekranda asılı kalıyordu. hls.js'in önerdiği
// kurtarmayı her hata türü için bir kez deniyoruz; o da tutmazsa reklamlı embed'e düşüyoruz.
function wireHlsRecovery(Hls, hls, player, embedUrl, stillWanted) {
  const denendi = { net: false, media: false };
  let manifestGeldi = false;
  let vazgecTimer = null;
  const vazgec = () => {
    clearTimeout(vazgecTimer);
    if (!stillWanted()) return;
    hls.destroy();
    if (hlsInstance === hls) hlsInstance = null;
    fallbackToEmbed(player, embedUrl);
  };
  // Kurtarma çağrısı sessizce hiçbir şey yapmayabiliyor (ör. manifest hiç yüklenmediyse startLoad'ın
  // yeniden deneyeceği bir seviye yok), o zaman ikinci bir hata da gelmiyor ve oynatıcı asılı kalıyor.
  // Bu yüzden kurtarmadan sonra oynatma gerçekten ilerliyor mu diye bakıp ilerlemiyorsa vazgeçiyoruz.
  const kurtarmayiIzle = () => {
    clearTimeout(vazgecTimer);
    const t = playerVideo.currentTime;
    vazgecTimer = setTimeout(() => {
      if (!stillWanted()) return;
      if (playerVideo.currentTime > t + 0.1 && !playerVideo.paused) return; // toparlandı
      vazgec();
    }, 6000);
  };
  hls.on(Hls.Events.MANIFEST_PARSED, () => { manifestGeldi = true; });
  hls.on(Hls.Events.ERROR, (_e, d) => {
    if (!d || !d.fatal || !stillWanted()) return;
    // Manifest hiç gelmediyse (404, ayrıştırma hatası, desteklenmeyen codec) kurtarılacak bir şey yok.
    if (manifestGeldi && d.type === Hls.ErrorTypes.NETWORK_ERROR && !denendi.net) {
      denendi.net = true; hls.startLoad(); kurtarmayiIzle(); return;
    }
    if (manifestGeldi && d.type === Hls.ErrorTypes.MEDIA_ERROR && !denendi.media) {
      denendi.media = true; hls.recoverMediaError(); kurtarmayiIzle(); return;
    }
    vazgec();
  });
}
// resolver'dan mp4/m3u8 linkini alıp <video> ile oynatır; olmazsa sessizce klasik iframe embed'e düşer.
let currentDirectPlayer = null;
async function playDirect(direct, embedUrl) {
  const token = ++directToken;
  currentDirectPlayer = direct.player;
  try {
    const provider = DIRECT_PROVIDERS[direct.player];
    const data = await resolveDirect(provider, direct.params, () => token === directToken);
    if (token !== directToken) return;
    if (!data || !data.url) throw new Error('resolve failed');
    if (data.hls && !playerVideo.canPlayType('application/vnd.apple.mpegurl')) {
      const Hls = await ensureHls();
      if (token !== directToken) return;
      if (!Hls || !Hls.isSupported()) throw new Error('hls unsupported');
      hlsInstance = new Hls();
      wireHlsRecovery(Hls, hlsInstance, direct.player, embedUrl, () => token === directToken);
      hlsInstance.loadSource(data.url);
      hlsInstance.attachMedia(playerVideo);
    } else {
      playerVideo.src = data.url;
    }
    applySpeed();
    playerVideo.play().catch(() => {});
    playerLoading.hidden = true; clearTimeout(playerLoadTimer);
  } catch (e) {
    if (token !== directToken) return;
    fallbackToEmbed(direct.player, embedUrl);
  }
}
// bazı sağlayıcılar (NO_EMBED_PLAYERS) iframe'de hiç açılmaz; onlar için boş bir iframe'e düşüp
// sessizce başarısız olmak yerine direkt "ayrı sayfada aç" ipucunu göster.
function fallbackToEmbed(player, embedUrl) {
  playerVideo.hidden = true; playerControls.hidden = true;
  if (NO_EMBED_PLAYERS.has(player)) {
    playerFrame.hidden = true;
    playerLoadingHint.hidden = false;
    clearTimeout(playerLoadTimer);
  } else {
    playerFrame.hidden = false;
    playerFrame.src = embedUrl;
  }
}
let directToken = 0;
playerVideo.addEventListener('ended', () => { if (!playerNextBtn.disabled) playerNextBtn.click(); });
playerVideo.addEventListener('error', () => { if (playerVideo.hidden || !playerVideo.getAttribute('src')) return; fallbackToEmbed(currentDirectPlayer, playerNewTab.href); });
function closePlayerModal() {
  playerModal.hidden = true;
  directToken++;
  stopVideo();
  playerFrame.src = 'about:blank';
  clearTimeout(playerLoadTimer);
}
// modalı kapatıp ilgili bölümü listede açar; hangi linke tıklanacağına kullanıcı kendi karar versin diye
// otomatik bir link seçip oynatmıyoruz.
function jumpToEpisode(i) {
  const epEl = app.querySelector(`.ep[data-i="${i}"]`);
  if (!epEl) return;
  const g = epEl.closest('.ep-group'); if (g) g.open = true;
  openEpisode(epEl);
  epEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const d = directBtnOf(epEl);
  if (d) { d.click(); return; } // reklamsız link varsa modal kapanmadan sonraki bölüme geçer
  closePlayerModal();
}
function wireEmbedButtons(container, epIndex) {
  container.querySelectorAll('[data-embed-url]').forEach(b => {
    const direct = b.dataset.directPlayer ? { player: b.dataset.directPlayer, params: b.dataset.directParams } : null;
    b.addEventListener('click', () => openPlayerModal(b.dataset.embedUrl, epIndex, direct));
  });
}
// bölümü açar; birden fazla fansub varsa önce fansub seçtirir, playerlar seçimden sonra gösterilir
// (renderDetail'deki ep-head handler'ıyla paylaşılır).
function openEpisode(epEl) {
  epEl.classList.add('open');
  const linksEl = epEl.querySelector('.ep-links');
  if (linksEl.dataset.filled) return;
  linksEl.dataset.filled = '1';
  const i = Number(epEl.dataset.i);
  const links = currentEpisodes[i].links;

  const groups = new Map();
  links.forEach(l => {
    const name = l.fansub || 'Bilinmeyen';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(l);
  });

  if (groups.size <= 1) {
    linksEl.innerHTML = `<div class="fansub-players">${epLinksHtml(links)}</div>`;
    wireEmbedButtons(linksEl, i);
    return;
  }

  const chipsHtml = [...groups.entries()].map(([name, groupLinks]) => {
    const empty = groupLinks.every(l => OLU(l.tip));
    return `<button type="button" class="fansub-chip${empty ? ' fansub-chip-empty' : ''}" data-fansub="${esc(name)}">${esc(name)}<span class="meta">${groupLinks.length}</span></button>`;
  }).join('');
  linksEl.innerHTML = `<div class="fansub-chips">${chipsHtml}</div><div class="fansub-players"></div>`;
  const playersEl = linksEl.querySelector('.fansub-players');
  linksEl.querySelectorAll('.fansub-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      linksEl.querySelectorAll('.fansub-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      playersEl.innerHTML = epLinksHtml(groups.get(chip.dataset.fansub));
      wireEmbedButtons(playersEl, i);
    });
  });
  // reklamsız linki olan ilk fansub otomatik seçilir ki önerilen buton hemen görünsün
  const preferred = [...groups.entries()].find(([, ls]) => ls.some(l => !OLU(l.tip) && directParams(l)));
  if (preferred) linksEl.querySelector(`.fansub-chip[data-fansub="${CSS.escape(preferred[0])}"]`).click();
}
// ileri/geri butonlarının durumunu ve "hangi bölüme gider" başlığını tazeler
function syncEpNavButtons() {
  for (const [btn, dir, ad] of [[playerPrevBtn, -1, 'Önceki'], [playerNextBtn, 1, 'Sonraki']]) {
    const i = neighborEp(dir);
    btn.disabled = !hasEp(i);
    btn.title = btn.disabled ? `${ad} bölüm yok` : `${ad}: ${currentEpisodes[i].ad}`;
  }
}
// bölümün önerilen (reklamsız) butonu varsa onu döndürür
const directBtnOf = epEl => epEl.querySelector('.link-btn.direct');
document.getElementById('player-modal-close').addEventListener('click', closePlayerModal);
document.getElementById('player-modal-backdrop').addEventListener('click', closePlayerModal);
// "Önceki"/"Sonraki" ekrandaki sırayı izler: liste tersten gösteriliyorsa (epReverse) "Sonraki"
// veri dizisinde bir geriye gider, böylece buton yönü listede gördüğün yönle aynı olur.
const epStep = () => (epReverse ? -1 : 1);
const neighborEp = dir => currentEpIndex == null ? -1 : currentEpIndex + dir * epStep();
const hasEp = i => i >= 0 && i < currentEpisodes.length;
playerPrevBtn.addEventListener('click', () => { const i = neighborEp(-1); if (hasEp(i)) jumpToEpisode(i); });
playerNextBtn.addEventListener('click', () => { const i = neighborEp(1); if (hasEp(i)) jumpToEpisode(i); });
window.addEventListener('keydown', e => {
  if (playerModal.hidden) return;
  if (e.key === 'Escape') closePlayerModal();
  else if (e.key === 'ArrowLeft') playerPrevBtn.click();
  else if (e.key === 'ArrowRight') playerNextBtn.click();
});
// slug -> <script> elemanı, ekleniş sırasıyla (Map sırayı korur). Sınırsız büyümesin diye
// en eski girişler LOADED_CAP aşılınca hem DOM'dan hem window.__TKA__'dan atılıyor.
const loadedScripts = new Map();
const LOADED_CAP = 40;
const PAGE_SIZE = 60;
const state = { query: '', page: 1, kategori: '', tur: '', sort: 'isim', favOnly: false };

// Liste görünümünün tamamı hash'te taşınır: #/?q=naruto&kategori=TV&tur=Aksiyon&sort=puan&fav=1&sayfa=3
// Böylece filtrelenmiş bir görünüm paylaşılabilir, yenilemede ve geri tuşunda kaybolmaz.
const isListHash = h => !h || h === '#' || h === '#/' || h.startsWith('#/?');
function listHash() {
  const p = new URLSearchParams();
  if (state.query) p.set('q', state.query);
  if (state.kategori) p.set('kategori', state.kategori);
  if (state.tur) p.set('tur', state.tur);
  if (state.sort !== 'isim') p.set('sort', state.sort);
  if (state.favOnly) p.set('fav', '1');
  if (state.page > 1) p.set('sayfa', String(state.page));
  const qs = p.toString();
  return qs ? `#/?${qs}` : '#/';
}
function parseListHash(hash) {
  const qs = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '');
  state.query = qs.get('q') || '';
  state.kategori = qs.get('kategori') || '';
  state.tur = qs.get('tur') || '';
  state.sort = ['isim', 'puan', 'eps'].includes(qs.get('sort')) ? qs.get('sort') : 'isim';
  state.favOnly = qs.get('fav') === '1';
  state.page = Math.max(1, Number(qs.get('sayfa')) || 1);
  if (searchEl.value !== state.query) searchEl.value = state.query;
}
// filtre değişiminde her tuş vuruşu için yeni geçmiş girdisi açma; sadece adresi tazele
function syncListHash() {
  const h = listHash();
  if (location.hash !== h) history.replaceState(history.state, '', h);
}
// Listeden detaya geçerken kaydırma konumunu sakla, geri dönünce aynı yere koy.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
// html'de scroll-behavior:smooth var; rota geçişlerinde sayfanın animasyonla kayması yerine
// anında yerine oturması gerekiyor (eski ve yeni sayfa arasında görünür bir kayma olmasın).
function jumpTo(y) {
  const el = document.documentElement;
  const onceki = el.style.scrollBehavior;
  el.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  el.style.scrollBehavior = onceki;
}
const SCROLL_KEY = 'ta_list_scroll';
function writeListScroll(hash) {
  try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ h: hash, y: window.scrollY })); } catch (e) { /* kota/gizli mod */ }
}
// Kaydırma sırasında kısıtlı yazım: sayfa yenilenirse konum kaybolmasın diye.
let scrollSaveTimer = 0;
function saveListScroll() {
  if (!isListHash(location.hash) || scrollSaveTimer) return;
  scrollSaveTimer = setTimeout(() => {
    scrollSaveTimer = 0;
    if (isListHash(location.hash)) writeListScroll(location.hash);
  }, 120);
}
function restoreListScroll() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || 'null'); } catch (e) { /* yok say */ }
  const y = saved && saved.h === location.hash ? saved.y : 0;
  requestAnimationFrame(() => jumpTo(y));
}

function loadScript(slug) {
  if (loadedScripts.has(slug)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `kaynak/b/${slug}.js`;
    s.onload = () => {
      loadedScripts.set(slug, s);
      if (loadedScripts.size > LOADED_CAP) {
        const oldest = loadedScripts.keys().next().value;
        loadedScripts.get(oldest).remove();
        loadedScripts.delete(oldest);
        if (window.__TKA__) delete window.__TKA__[oldest];
      }
      resolve();
    };
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

function filterAndSort() {
  const qTokens = norm(state.query).split(' ').filter(Boolean);
  let list = ANIME;
  if (state.favOnly) list = list.filter(a => isFav(a.slug));
  if (state.kategori) list = list.filter(a => a.kategori === state.kategori);
  if (state.tur) list = list.filter(a => a.tur.includes(state.tur));

  const scored = qTokens.length
    ? list.map(a => ({ a, score: matchScore(qTokens, a) })).filter(x => x.score !== null)
    : list.map(a => ({ a, score: 0 }));

  scored.sort((x, y) => {
    if (qTokens.length && x.score !== y.score) return x.score - y.score;
    if (state.sort === 'puan') return (y.a.puan - x.a.puan) || x.a.baslik.localeCompare(y.a.baslik, 'tr');
    if (state.sort === 'eps') return (y.a.eps - x.a.eps) || x.a.baslik.localeCompare(y.a.baslik, 'tr');
    return x.a.baslik.localeCompare(y.a.baslik, 'tr');
  });
  return scored.map(x => x.a);
}

function filterBarHtml(count) {
  return `
    <div class="filterbar">
      <span class="filter-count">${count.toLocaleString('tr-TR')} / ${ANIME.length.toLocaleString('tr-TR')} anime</span>
      <select id="f-kategori" title="Tür (TV/Film/OVA)">
        <option value="">Tüm kategoriler</option>
        ${KATEGORILER.map(k => `<option value="${esc(k)}" ${state.kategori === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
      </select>
      <select id="f-tur" title="Janr">
        <option value="">Tüm janrlar</option>
        ${TURLER.map(t => `<option value="${esc(t)}" ${state.tur === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
      <select id="f-sort" title="Sırala">
        <option value="isim" ${state.sort === 'isim' ? 'selected' : ''}>İsme göre</option>
        <option value="puan" ${state.sort === 'puan' ? 'selected' : ''}>Puana göre</option>
        <option value="eps" ${state.sort === 'eps' ? 'selected' : ''}>Bölüm sayısına göre</option>
      </select>
      <label class="fav-toggle"><input type="checkbox" id="f-fav" ${state.favOnly ? 'checked' : ''}> ${ic('star')}Favoriler</label>
    </div>`;
}

function wireFilterBar() {
  const apply = fn => e => { fn(e); state.page = 1; syncListHash(); renderList(); };
  document.getElementById('f-kategori').addEventListener('change', apply(e => { state.kategori = e.target.value; }));
  document.getElementById('f-tur').addEventListener('change', apply(e => { state.tur = e.target.value; }));
  document.getElementById('f-sort').addEventListener('change', apply(e => { state.sort = e.target.value; }));
  document.getElementById('f-fav').addEventListener('change', apply(e => { state.favOnly = e.target.checked; }));
}

function renderList() {
  const items = filterAndSort();
  document.title = 'TürkAnime Arşiv Görüntüleyici';
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const pageItems = items.slice(0, state.page * PAGE_SIZE);

  const showHome = !state.query && !state.kategori && !state.tur && !state.favOnly;

  const statsHtml = showHome ? statsStripHtml() : '';

  let featuredHtml = '';
  if (showHome) {
    const featured = animeOfDay();
    if (featured) {
      featuredHtml = `
        <a class="featured" href="#/anime/${encodeURIComponent(featured.slug)}"${featured.poster ? ` style="--hero:url('${esc(featured.poster)}')"` : ''}>
          ${posterPlaceholder(featured).replace('class="poster', 'class="featured-poster poster')}
          <div class="featured-info">
            <span class="badge tag-main">${ic('sparkles')}Günün Animesi</span>
            <h2>${esc(featured.baslik)}</h2>
            <div class="meta">${featured.eps} bölüm · ${ic('star','ic-star')} ${featured.puan}</div>
            <span class="featured-cta">${ic('play')}İzlemeye başla</span>
          </div>
        </a>`;
    }
  }

  const showRecent = showHome && recent.length;
  let recentHtml = '';
  if (showRecent) {
    const recentItems = recent.map(s => ANIME.find(a => a.slug === s)).filter(Boolean).slice(0, 6);
    if (recentItems.length) {
      recentHtml = `<div class="recent-row"><h2 class="section-title">Son bakılanlar</h2><div class="grid recent-grid">${recentItems.map(cardHtml).join('')}</div></div>`;
    }
  }

  const bar = filterBarHtml(items.length);

  if (!items.length) {
    const q = norm(state.query);
    const suggestions = q ? ANIME
      .map(a => ({ a, d: Math.min(levenshtein(q, a.n.slice(0, q.length + 2)), ...a.tok.map(t => levenshtein(q, t))) }))
      .filter(x => x.d <= Math.ceil(q.length / 2))
      .sort((x, y) => x.d - y.d).slice(0, 4) : [];
    const suggestHtml = suggestions.length
      ? `<div class="suggest">Bunu mu demek istedin?${suggestions.map(x => `<a class="link-btn" href="#/anime/${x.a.slug}">${esc(x.a.baslik)}</a>`).join('')}</div>` : '';
    app.innerHTML = `${bar}<div class="empty">Sonuç bulunamadı.${suggestHtml}</div>`;
    fadeApp();
    wireFilterBar();
    return;
  }

  const loadMoreHtml = () => state.page < totalPages
    ? `<button id="load-more">Daha fazla yükle <span class="meta">(${(items.length - state.page * PAGE_SIZE).toLocaleString('tr-TR')} kaldı)</span></button>` : '';
  const pager = `<div class="pager">${loadMoreHtml()}</div>`;

  const archiveTitleHtml = showRecent ? '<h2 class="section-title archive-title">Tüm Arşiv</h2>' : '';

  app.innerHTML = `${statsHtml}${featuredHtml}${recentHtml}${archiveTitleHtml}${bar}<div class="grid">${pageItems.map(cardHtml).join('')}</div>${pager}`;
  fadeApp();
  wireFilterBar();
  wireCards(app);
  // tam yeniden çizim yerine yeni kartları ekle; kaydırma konumu korunur
  app.querySelector('.pager').addEventListener('click', e => {
    if (e.target.closest('#load-more') == null) return;
    const from = state.page * PAGE_SIZE;
    state.page++;
    syncListHash();
    const tpl = document.createElement('template');
    tpl.innerHTML = items.slice(from, state.page * PAGE_SIZE).map(cardHtml).join('');
    wireCards(tpl.content);
    app.querySelector('.grid:not(.recent-grid)').append(tpl.content);
    e.currentTarget.innerHTML = loadMoreHtml();
  });
}

async function renderDetail(slug, token) {
  const meta = ANIME.find(a => a.slug === slug);
  app.innerHTML = `
    <div class="skel-detail">
      <div class="skel skel-poster"></div>
      <div class="skel-lines"><div class="skel skel-line w60"></div><div class="skel skel-line w30"></div></div>
    </div>
    <div class="skel-eps">${Array.from({ length: 6 }, () => '<div class="skel skel-ep"></div>').join('')}</div>`;

  let info = null;
  try {
    const r = await fetch(`kaynak/animeler/${slug}/info.json`);
    if (r.ok) info = await r.json();
  } catch (e) { /* bilgi paneli olmadan devam */ }
  if (token !== routeToken) return; // kullanıcı beklerken başka rotaya geçti, eski yanıtı çizme

  await loadScript(slug).catch(() => {});
  if (token !== routeToken) return;
  pushRecent(slug); // render kesinleşmeden "son bakılanlar"a yazma
  const episodes = (window.__TKA__ && window.__TKA__[slug]) || [];
  currentEpisodes = episodes;

  // özette gelen <br /> gibi ham HTML etiketlerini gerçek satır sonuna çevir
  const escBr = s => esc(s).replace(/&lt;br\s*\/?&gt;/gi, '\n').replace(/\n/g, '<br>');

  const firstPlayable = episodes.findIndex(ep => ep.links.some(l => !OLU(l.tip)));
  const heroInfoHtml = info ? `
      <div class="info-tags">
        ${info['Kategori'] ? `<span class="tag tag-main">${esc(info['Kategori'])}</span>` : ''}
        ${(info['Anime Türü'] || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>
      <div class="info-stats">
        <span>${ic('tv')}${esc(info['Bölüm Sayısı'] || '?')} bölüm</span>
        <span>${ic('clapper')}${esc(info['Stüdyo'] || '?')}</span>
        <span>${ic('star','ic-star')}${info['Puanı'] ?? '?'}</span>
      </div>` : `<div class="info-stats"><span>${ic('tv')}${episodes.length} bölüm arşivlendi</span></div>`;
  const ozet = info && info['Özet'] ? escBr(info['Özet']) : '';
  const ozetLong = ozet.length > 320;
  const ozetHtml = ozet ? `
    <div class="info">
      <p class="info-ozet${ozetLong ? ' clamped' : ''}">${ozet}</p>
      ${ozetLong ? '<button type="button" class="ozet-more">Devamını göster</button>' : ''}
    </div>` : '';

  // link butonları binlerce olabildiğinden (ör. One Piece: 1166 bölüm/~27000 link),
  // baştan basmak yerine bölüm ilk açıldığında dolduruluyor (bkz. aşağıdaki ep-head handler'ı).
  const epItemHtml = i => {
    const ep = episodes[i];
    const empty = ep.links.every(l => OLU(l.tip));
    return `
    <div class="ep${empty ? ' ep-empty' : ''}" data-i="${i}">
      <div class="ep-head"><span class="ep-arrow">${ic('chevron-right')}</span>${esc(ep.ad)}<span class="meta">${empty ? 'çalışan link yok' : `${ep.links.length} link`}</span></div>
      <div class="ep-links"></div>
    </div>`;
  };
  // uzun serilerde (100+) bölümler 50'lik katlanır gruplara bölünüyor; sadece ilk grup açık gelir
  const EP_GROUP = 50;
  const epListHtml = () => {
    let order = episodes.map((_, i) => i);
    if (epReverse) order.reverse();
    if (order.length <= 100) return order.map(epItemHtml).join('');
    const groups = [];
    for (let k = 0; k < order.length; k += EP_GROUP) groups.push(order.slice(k, k + EP_GROUP));
    return groups.map((g, gi) => `
      <details class="ep-group"${gi === 0 ? ' open' : ''}>
        <summary>${g[0] + 1}–${g[g.length - 1] + 1}<span class="meta">${g.length} bölüm</span></summary>
        ${g.map(epItemHtml).join('')}
      </details>`).join('');
  };

  const titleObj = { slug, baslik: meta ? meta.baslik : slug, poster: meta ? meta.poster : null };
  document.title = `${titleObj.baslik} · TürkAnime Arşivi`;

  app.innerHTML = `
    <a class="back" href="#/">${ic('arrow-left')}Listeye dön</a>
    <div class="detail">
      <div class="detail-head" ${titleObj.poster ? `style="--hero:url('${esc(titleObj.poster)}')"` : ''}>
        ${posterPlaceholder(titleObj).replace('class="poster', 'class="detail-poster poster')}
        <div class="detail-info">
          <h2>${esc(titleObj.baslik)} <button id="detail-fav" class="fav-btn-lg ${isFav(slug) ? 'active' : ''}" title="Favori" aria-label="${favLabel(slug)}">${ic('star')}</button></h2>
          ${heroInfoHtml}
          ${firstPlayable >= 0 ? `<button type="button" id="detail-start" class="start-btn">${ic('play')}İzlemeye başla</button>` : ''}
        </div>
      </div>
      ${ozetHtml}
      ${episodes.length ? `
      <div class="ep-toolbar">
        <h3 class="section-title">Bölümler <span class="meta">(${episodes.length})</span></h3>
        <button type="button" id="ep-reverse" class="link-btn${epReverse ? ' active' : ''}" title="Sıralamayı tersine çevir">${ic('sort')}Tersten</button>
      </div>` : ''}
      ${episodes.length > 20 ? `<input id="ep-search" class="ep-search" placeholder="Bölüm ara... (örn. 12 veya final)">` : ''}
      <div id="ep-list">${epListHtml() || '<div class="empty">Bölüm verisi bulunamadı.</div>'}</div>
    </div>`;
  fadeApp();

  const epListEl = document.getElementById('ep-list');
  epListEl.addEventListener('click', e => {
    const h = e.target.closest('.ep-head');
    if (!h) return;
    const epEl = h.parentElement;
    if (epEl.classList.contains('open')) { epEl.classList.remove('open'); return; }
    openEpisode(epEl);
  });
  const goToEp = i => {
    const epEl = epListEl.querySelector(`.ep[data-i="${i}"]`);
    if (!epEl) return;
    const g = epEl.closest('.ep-group'); if (g) g.open = true;
    openEpisode(epEl);
    epEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const d = directBtnOf(epEl); if (d) d.click();
  };
  const startBtn = document.getElementById('detail-start');
  if (startBtn) startBtn.addEventListener('click', () => goToEp(firstPlayable));
  const revBtn = document.getElementById('ep-reverse');
  if (revBtn) revBtn.addEventListener('click', () => {
    epReverse = !epReverse; writeLS('ta_eprev', epReverse);
    revBtn.classList.toggle('active', epReverse);
    if (!playerModal.hidden) syncEpNavButtons(); // modal açıkken yön değişirse butonlar tazelensin
    epListEl.innerHTML = epListHtml();
    const epSearchEl = document.getElementById('ep-search');
    if (epSearchEl && epSearchEl.value) epSearchEl.dispatchEvent(new Event('input'));
  });
  const moreBtn = app.querySelector('.ozet-more');
  if (moreBtn) moreBtn.addEventListener('click', () => {
    const p = app.querySelector('.info-ozet');
    p.classList.toggle('clamped');
    moreBtn.textContent = p.classList.contains('clamped') ? 'Devamını göster' : 'Daha az göster';
  });

  document.getElementById('detail-fav').addEventListener('click', () => {
    toggleFav(slug);
    const b = document.getElementById('detail-fav');
    b.classList.toggle('active');
    b.setAttribute('aria-label', favLabel(slug));
  });

  const epSearchEl = document.getElementById('ep-search');
  if (epSearchEl) {
    epSearchEl.addEventListener('input', () => {
      const q = norm(epSearchEl.value);
      app.querySelectorAll('.ep').forEach(el => {
        const txt = norm(el.querySelector('.ep-head').textContent);
        el.style.display = !q || txt.includes(q) ? '' : 'none';
      });
      // eşleşme içeren grupları aç, hiç eşleşmeyenleri gizle
      app.querySelectorAll('.ep-group').forEach(g => {
        const hit = [...g.querySelectorAll('.ep')].some(el => el.style.display !== 'none');
        g.style.display = hit ? '' : 'none';
        if (q && hit) g.open = true;
      });
    });
  }
}

function renderLegal() {
  document.title = IS_TR ? 'Gizlilik & Yasal · TürkAnime Arşivi' : 'Privacy & Legal · TürkAnime Arşivi';
  const en = `
      <div class="legal-lang">EN</div>
      <h2>Privacy &amp; Legal Information</h2>

      <h3>Privacy</h3>
      <p>This site is fully static: there are no user accounts, forms, or server-side data storage (the only exception is the ad-free playback helper described below). Your favorites and "recently viewed" list are kept only in your own browser's storage (localStorage), are never sent anywhere, and are deleted when you clear your browser data. The site itself does not use cookies. It is hosted on <a href="https://pages.github.com/" target="_blank" rel="noopener noreferrer">GitHub Pages</a>; as with any web request, your IP address is technically visible to GitHub's infrastructure for the duration of the request, subject to the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub Privacy Statement</a>.</p>
      <p>To see how many people visit the site, and which page/link they arrived from, it uses <a href="https://www.goatcounter.com/" target="_blank" rel="noopener noreferrer">GoatCounter</a>, a cookie-free visitor counter. It collects the page viewed, the referring site/link, browser/OS type, and a rough country derived from your IP address; it does not permanently store the IP address and does not build a profile that singles you out from other visitors. Results are shown only as aggregate/statistical counts (daily, weekly, monthly, all-time). See <a href="https://www.goatcounter.com/privacy" target="_blank" rel="noopener noreferrer">GoatCounter's privacy policy</a> for details. Under Turkish law (KVKK, Law No. 6698 on the Protection of Personal Data), this means no data tied to an identified or identifiable person is processed.</p>
      <p>Anime cover images are loaded from <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>, and episode players are embedded from their respective video-hosting sites; these third-party services are subject to their own privacy policies and cookies, which are outside this site's control.</p>
      <p>For the "Watch ad-free" option on Sibnet and Uqload episodes, the site calls a small helper function hosted on <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a> (for Sibnet, <code>tka-sibnet.vercel.app</code>) or <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer">Cloudflare</a> Workers (for Uqload, <code>tka-uqload.turkanime-arsiv.workers.dev</code>). This function receives only the provider's video ID, resolves the direct video address and returns it; it keeps no database, sets no cookies, and does not store the request. As with any web request, your IP address is technically visible to that provider's infrastructure for the duration of the request and may appear in its short-lived operational logs, subject to <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel's</a> or <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare's</a> privacy policy. The video itself is then streamed directly from that provider's own servers to your browser, exactly as with the classic embedded player. For Uqload, which delivers video as HLS (a segmented streaming format), the browser also loads a small open-source player library (hls.js) from a public CDN (jsDelivr) to play it.</p>

      <h3>Copyright</h3>
      <p>This site hosts no video files of its own. It is only a directory/archive collecting links, found in the archive of the now-closed turkanime.tv, to public third-party video services (GDrive, various embed providers, etc.). All copyrights to the video content and translations belong to their respective rights holders (production studio, distributor, fansub groups).</p>

      <h3>Takedown Requests</h3>
      <p>If you are a rights holder and want something removed, please
        <a href="https://github.com/Berke-aras/turkanime-arsiv/issues/new" target="_blank" rel="noopener noreferrer">open an issue on GitHub</a>
        with the relevant anime/episode/link details; the request will be reviewed and removed as soon as possible.</p>`;
  const tr = `
      <div class="legal-lang">TR</div>
      <h2>Gizlilik &amp; Yasal Bilgilendirme</h2>

      <h3>KVKK / Gizlilik</h3>
      <p>Bu site statik çalışır: herhangi bir kullanıcı hesabı, form ya da sunucu tarafı veri kaydı yoktur (tek istisna aşağıda anlatılan reklamsız oynatma yardımcısıdır). Favori animeler ve "son bakılanlar" listesi yalnızca kendi cihazındaki tarayıcı belleğinde (localStorage) tutulur, hiçbir yere gönderilmez; tarayıcı verilerini temizlediğinde silinir. Site kendi adına çerez kullanmaz. Site <a href="https://pages.github.com/" target="_blank" rel="noopener noreferrer">GitHub Pages</a> üzerinde barındırılır; her web isteğinde olduğu gibi IP adresin istek süresince GitHub altyapısı tarafından teknik olarak görülür, bu <a href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub Gizlilik Bildirimi</a> kapsamındadır.</p>
      <p>Kaç kişinin siteyi, hangi sayfadan/bağlantıdan girip hangi bölümlere baktığını görebilmek için <a href="https://www.goatcounter.com/" target="_blank" rel="noopener noreferrer">GoatCounter</a> adlı, çerez kullanmayan bir ziyaretçi sayacı kullanılır. Bu sayaç görüntülenen sayfa, yönlendiren site/bağlantı, tarayıcı-işletim sistemi türü ve IP adresinden türetilen kabaca ülke bilgisini toplar; IP adresini kalıcı saklamaz ve seni diğer ziyaretçilerden ayırt edip profil çıkaracak bir kimlik kullanmaz. Sonuçlar yalnızca toplu/istatistiksel sayılar (günlük, haftalık, aylık, tüm zamanlar) olarak görüntülenir. Ayrıntı için <a href="https://www.goatcounter.com/privacy" target="_blank" rel="noopener noreferrer">GoatCounter'ın gizlilik politikası</a>na bakabilirsin. Bu nedenlerle 6698 sayılı KVKK kapsamında kimliği belirli veya belirlenebilir bir kişiyle ilişkilendirilen veri işlenmemektedir.</p>
      <p>Anime kapak görselleri <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>'ten, bölüm oynatıcıları ise ilgili video barındırma sitelerinden (embed) yüklenir; bu üçüncü taraf servisler kendi gizlilik politikalarına ve çerezlerine tabidir, bu sitenin sorumluluğunda değildir.</p>
      <p>Sibnet ve Uqload bölümlerindeki "Reklamsız izle" seçeneği için site, <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a> üzerinde (Sibnet için, <code>tka-sibnet.vercel.app</code>) ya da <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer">Cloudflare</a> Workers üzerinde (Uqload için, <code>tka-uqload.turkanime-arsiv.workers.dev</code>) barındırılan küçük bir yardımcı fonksiyona istek atar. Bu fonksiyon yalnızca ilgili sağlayıcının video numarasını alır, videonun doğrudan adresini çözüp geri döndürür; veritabanı tutmaz, çerez kullanmaz, isteği kaydetmez. Her web isteğinde olduğu gibi IP adresin istek süresince ilgili altyapı tarafından teknik olarak görülür ve <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel'in</a> ya da <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare'in</a> gizlilik politikası kapsamında kısa süreli işletim kayıtlarında yer alabilir. Videonun kendisi ise klasik gömülü oynatıcıda olduğu gibi doğrudan ilgili sağlayıcının sunucularından tarayıcına akar. HLS formatıyla video veren Uqload için tarayıcı ayrıca halka açık bir CDN'den (jsDelivr) küçük bir açık kaynak oynatıcı kütüphanesi (hls.js) yükler.</p>

      <h3>Telif Hakkı</h3>
      <p>Bu site hiçbir video dosyasını kendi sunucusunda barındırmaz. Yalnızca, artık kapanmış olan turkanime.tv'nin arşivinde bulunan ve halka açık üçüncü taraf video servislerine (GDrive, çeşitli embed sağlayıcıları vb.) ait bağlantıları bir araya getiren bir dizin/arşivdir. Tüm video içeriklerinin ve çevirilerin telif hakları ilgili hak sahiplerine (yapımcı stüdyo, dağıtımcı, fansub grupları) aittir.</p>

      <h3>Kaldırma Talebi</h3>
      <p>Bir içeriğin veya bağlantının hak sahibiysen ve kaldırılmasını istiyorsan, lütfen
        <a href="https://github.com/Berke-aras/turkanime-arsiv/issues/new" target="_blank" rel="noopener noreferrer">GitHub üzerinden bir issue açarak</a>
        ilgili anime/bölüm/link bilgisini ilet; talep incelenip en kısa sürede kaldırılır.</p>`;
  // tarayıcı dili Türkçe değilse İngilizce bölüm üstte gelir
  app.innerHTML = `
    <a class="back" href="#/">${ic('arrow-left')}${IS_TR ? 'Listeye dön' : 'Back to list'}</a>
    <div class="legal">
      ${IS_TR ? tr : en}

      <hr class="legal-sep">
      ${IS_TR ? en : tr}
    </div>`;
  fadeApp();
}

let routeToken = 0;
function route() {
  const token = ++routeToken;
  if (!playerModal.hidden) closePlayerModal(); // geri tuşuyla sayfa değişince modal açık kalmasın
  const hash = location.hash || '#/';
  if (hash === '#/yasal') { renderLegal(); jumpTo(0); return; }
  const m = hash.match(/^#\/anime\/(.+)$/);
  if (m) { renderDetail(decodeURIComponent(m[1]), token); jumpTo(0); return; }
  parseListHash(hash);
  renderList();
  restoreListScroll(); // listeye geri dönüldüyse eski kaydırma konumu, değilse başa
}

let t;
searchEl.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => {
    state.query = searchEl.value;
    state.page = 1;
    // detay ya da yasal sayfasındayken yazılırsa listeye dön; hash değişimi route() -> renderList() tetikler
    if (!isListHash(location.hash)) location.hash = listHash();
    else { syncListHash(); renderList(); }
  }, 150);
});
document.getElementById('random-btn').addEventListener('click', pickRandomAnime);
if (!IS_TR) {
  const nav = document.getElementById('legal-link');
  nav.querySelector('span').textContent = 'Privacy & Legal';
  nav.title = nav.ariaLabel = 'Privacy & Legal';
  document.getElementById('footer-legal').textContent = 'Privacy & Legal Notice';
}
// route()'tan ÖNCE kayıt: bu noktada sayfa hâlâ listenin konumunda duruyor.
window.addEventListener('hashchange', e => {
  const eski = e.oldURL ? e.oldURL.slice(e.oldURL.indexOf('#')) : '';
  if (isListHash(eski) && eski !== location.hash) {
    clearTimeout(scrollSaveTimer); scrollSaveTimer = 0;
    writeListScroll(eski || '#/');
  }
});
window.addEventListener('hashchange', route);

const topBtn = document.getElementById('top-btn');
window.addEventListener('scroll', () => {
  topBtn.classList.toggle('show', window.scrollY > 500);
  saveListScroll();
}, { passive: true });
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
route();
