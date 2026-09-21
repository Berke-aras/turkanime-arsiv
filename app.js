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
const ic = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// Sibnet'in reklamsız oynatılması için mp4 linkini çözen küçük servis (bkz. api/sibnet.js, Vercel).
// Boş bırakılırsa "Reklamsız" butonu hiç gösterilmez, klasik SIBNET embed'i olduğu gibi kalır.
const SIBNET_RESOLVER = 'https://tka-sibnet.vercel.app/api/sibnet';
const sibnetId = url => { const m = /videoid=(\d+)/.exec(url); return m ? m[1] : null; };

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

// fansub bilgisi çağıran taraftan (fansub grubu zaten seçilmiş) geldiği için buton üstünde tekrar edilmiyor.
function epLinksHtml(links) {
  // çalışmayan (mask) linkler sona, bilinen güvenilir sağlayıcılar öne alınıyor.
  const sorted = [...links].sort((a, b) => {
    if ((a.tip === 'mask') !== (b.tip === 'mask')) return (a.tip === 'mask') - (b.tip === 'mask');
    return playerRank(a.player) - playerRank(b.player);
  });
  // reklamsız sibnet butonları en başa (önerilen); orijinal SIBNET embed butonları aynen kalır
  const direct = SIBNET_RESOLVER ? sorted.filter(l => l.player === 'SIBNET' && l.tip !== 'mask' && sibnetId(l.url)).map((l, i, arr) =>
    `<button type="button" class="link-btn direct" data-embed-url="${esc(l.url)}" data-direct="${sibnetId(l.url)}" title="Sibnet videosunu reklamsız oynat">${ic('zap')}Reklamsız izle${arr.length > 1 ? ' ' + (i + 1) : ''}${i === 0 ? '<span class="meta">önerilen</span>' : ''}</button>`) : [];
  return direct.concat(sorted.map(l => {
    const label = esc(l.player);
    if (l.tip === 'mask') return `<span class="link-btn mask" title="turkanime sunucusu gerekiyor, çalışmıyor">${label}</span>`;
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
    slug: r[0], baslik, eps: r[2], urls: r[3], masks: r[4], top: r[5] || [],
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

function cardHtml(a) {
  return `
    <div class="card${a.eps ? '' : ' card-empty'}" data-slug="${a.slug}" tabindex="0" role="button">
      ${posterPlaceholder(a)}
      ${a.puan ? `<span class="rating-badge">${ic('star','ic-star')}${a.puan}</span>` : ''}
      <button class="fav-btn ${isFav(a.slug) ? 'active' : ''}" data-fav="${a.slug}" title="Favori" aria-label="${favLabel(a.slug)}">${ic('star')}</button>
      <h3>${esc(a.baslik)}</h3>
      <div class="meta">${a.eps ? `${a.eps} bölüm · ${a.urls} link` : 'bölüm verisi yok'}</div>
      <div class="badges">${a.tur.slice(0, 3).map(t => `<span class="badge">${esc(t)}</span>`).join('')}</div>
    </div>`;
}

function wireCards(container) {
  container.querySelectorAll('.card').forEach(c => {
    c.addEventListener('click', () => { location.hash = '#/anime/' + c.dataset.slug; });
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = '#/anime/' + c.dataset.slug; }
    });
  });
  container.querySelectorAll('.fav-btn').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
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
// açık olan detay sayfasının bölümleri; modaldaki önceki/sonraki gezinmesi bunu kullanır.
let currentEpisodes = [];
let currentEpIndex = null;
let playerLoadTimer = null;
function openPlayerModal(url, epIndex = null, directId = null) {
  clearTimeout(playerLoadTimer);
  playerLoadingHint.hidden = true;
  playerLoading.hidden = false;
  stopVideo();
  playerVideo.hidden = !directId;
  playerFrame.hidden = !!directId;
  playerFrame.src = directId ? 'about:blank' : url;
  playerNewTab.href = url;
  if (directId) playDirect(directId, url);
  playerModal.hidden = false;
  currentEpIndex = epIndex;
  const ep = epIndex != null ? currentEpisodes[epIndex] : null;
  playerEpLabel.textContent = ep ? `${epIndex + 1} / ${currentEpisodes.length}` : '';
  playerPrevBtn.disabled = epIndex == null || epIndex <= 0;
  playerNextBtn.disabled = epIndex == null || epIndex >= currentEpisodes.length - 1;
  // bazı sağlayıcılar sandbox içinde hiç yüklenmeyebilir; uzun sürerse "ayrı sayfada aç"ı hatırlat.
  playerLoadTimer = setTimeout(() => { playerLoadingHint.hidden = false; }, 8000);
}
playerFrame.addEventListener('load', () => { if (playerFrame.hidden) return; playerLoading.hidden = true; clearTimeout(playerLoadTimer); });
function stopVideo() { playerVideo.pause(); playerVideo.removeAttribute('src'); playerVideo.load(); }
// resolver'dan mp4 linkini alıp <video> ile oynatır; olmazsa sessizce klasik iframe embed'e düşer.
async function playDirect(id, embedUrl) {
  const token = ++directToken;
  try {
    const r = await fetch(`${SIBNET_RESOLVER}?id=${id}`);
    const data = r.ok ? await r.json() : null;
    if (token !== directToken) return;
    if (!data || !data.url) throw new Error('resolve failed');
    playerVideo.src = data.url;
    playerVideo.play().catch(() => {});
    playerLoading.hidden = true; clearTimeout(playerLoadTimer);
  } catch (e) {
    if (token !== directToken) return;
    playerVideo.hidden = true; playerFrame.hidden = false;
    playerFrame.src = embedUrl;
  }
}
let directToken = 0;
playerVideo.addEventListener('ended', () => { if (currentEpIndex != null && currentEpIndex < currentEpisodes.length - 1) playerNextBtn.click(); });
playerVideo.addEventListener('error', () => { if (playerVideo.hidden || !playerVideo.getAttribute('src')) return; playerVideo.hidden = true; playerFrame.hidden = false; playerFrame.src = playerNewTab.href; });
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
    b.addEventListener('click', () => openPlayerModal(b.dataset.embedUrl, epIndex, b.dataset.direct || null));
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
    const empty = groupLinks.every(l => l.tip === 'mask');
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
  // reklamsız (sibnet) linki olan ilk fansub otomatik seçilir ki önerilen buton hemen görünsün
  const preferred = SIBNET_RESOLVER && [...groups.entries()].find(([, ls]) => ls.some(l => l.player === 'SIBNET' && l.tip !== 'mask' && sibnetId(l.url)));
  if (preferred) linksEl.querySelector(`.fansub-chip[data-fansub="${CSS.escape(preferred[0])}"]`).click();
}
// bölümün önerilen (reklamsız) butonu varsa onu döndürür
const directBtnOf = epEl => epEl.querySelector('.link-btn.direct');
document.getElementById('player-modal-close').addEventListener('click', closePlayerModal);
document.getElementById('player-modal-backdrop').addEventListener('click', closePlayerModal);
playerPrevBtn.addEventListener('click', () => { if (currentEpIndex > 0) jumpToEpisode(currentEpIndex - 1); });
playerNextBtn.addEventListener('click', () => { if (currentEpIndex < currentEpisodes.length - 1) jumpToEpisode(currentEpIndex + 1); });
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
  document.getElementById('f-kategori').addEventListener('change', e => { state.kategori = e.target.value; state.page = 1; renderList(); });
  document.getElementById('f-tur').addEventListener('change', e => { state.tur = e.target.value; state.page = 1; renderList(); });
  document.getElementById('f-sort').addEventListener('change', e => { state.sort = e.target.value; state.page = 1; renderList(); });
  document.getElementById('f-fav').addEventListener('change', e => { state.favOnly = e.target.checked; state.page = 1; renderList(); });
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
        <div class="featured" data-slug="${featured.slug}" tabindex="0" role="button"${featured.poster ? ` style="--hero:url('${esc(featured.poster)}')"` : ''}>
          ${posterPlaceholder(featured).replace('class="poster', 'class="featured-poster poster')}
          <div class="featured-info">
            <span class="badge tag-main">${ic('sparkles')}Günün Animesi</span>
            <h2>${esc(featured.baslik)}</h2>
            <div class="meta">${featured.eps} bölüm · ${ic('star','ic-star')} ${featured.puan}</div>
            <span class="featured-cta">${ic('play')}İzlemeye başla</span>
          </div>
        </div>`;
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
  const featuredEl = app.querySelector('.featured');
  if (featuredEl) {
    const go = () => { location.hash = '#/anime/' + featuredEl.dataset.slug; };
    featuredEl.addEventListener('click', go);
    featuredEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }
  // tam yeniden çizim yerine yeni kartları ekle; kaydırma konumu korunur
  app.querySelector('.pager').addEventListener('click', e => {
    if (e.target.closest('#load-more') == null) return;
    const from = state.page * PAGE_SIZE;
    state.page++;
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

  const firstPlayable = episodes.findIndex(ep => ep.links.some(l => l.tip !== 'mask'));
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
    const empty = ep.links.every(l => l.tip === 'mask');
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
  document.title = 'Gizlilik & Yasal · TürkAnime Arşivi';
  app.innerHTML = `
    <a class="back" href="#/">${ic('arrow-left')}Back to list · Listeye dön</a>
    <div class="legal">
      <div class="legal-lang">EN</div>
      <h2>Privacy &amp; Legal Information</h2>

      <h3>Privacy</h3>
      <p>This site is fully static: there are no user accounts, forms, or server-side data storage (the only exception is the ad-free Sibnet helper described below). Your favorites and "recently viewed" list are kept only in your own browser's storage (localStorage), are never sent anywhere, and are deleted when you clear your browser data. The site itself does not use cookies.</p>
      <p>To see how many people visit the site, and which page/link they arrived from, it uses <a href="https://www.goatcounter.com/" target="_blank" rel="noopener noreferrer">GoatCounter</a>, a cookie-free visitor counter. It collects the page viewed, the referring site/link, browser/OS type, and a rough country derived from your IP address; it does not permanently store the IP address and does not build a profile that singles you out from other visitors. Results are shown only as aggregate/statistical counts (daily, weekly, monthly, all-time). See <a href="https://www.goatcounter.com/privacy" target="_blank" rel="noopener noreferrer">GoatCounter's privacy policy</a> for details. Under Turkish law (KVKK, Law No. 6698 on the Protection of Personal Data), this means no data tied to an identified or identifiable person is processed.</p>
      <p>Anime cover images are loaded from <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>, and episode players are embedded from their respective video-hosting sites; these third-party services are subject to their own privacy policies and cookies, which are outside this site's control.</p>
      <p>For the "Watch ad-free" option on Sibnet episodes, the site calls a small helper function hosted on <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a> (<code>tka-sibnet.vercel.app</code>). This function receives only the Sibnet video ID, resolves the direct video address and returns it; it keeps no database, sets no cookies, and does not store the request. As with any web request, your IP address is technically visible to Vercel's infrastructure for the duration of the request and may appear in its short-lived operational logs, subject to <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel's privacy policy</a>. The video itself is then streamed directly from Sibnet's servers to your browser, exactly as with the classic embedded player.</p>

      <h3>Copyright</h3>
      <p>This site hosts no video files of its own. It is only a directory/archive collecting links, found in the archive of the now-closed turkanime.tv, to public third-party video services (GDrive, various embed providers, etc.). All copyrights to the video content and translations belong to their respective rights holders (production studio, distributor, fansub groups).</p>

      <h3>Takedown Requests</h3>
      <p>If you are a rights holder and want something removed, please
        <a href="https://github.com/Berke-aras/turkanime-arsiv/issues/new" target="_blank" rel="noopener noreferrer">open an issue on GitHub</a>
        with the relevant anime/episode/link details; the request will be reviewed and removed as soon as possible.</p>

      <hr class="legal-sep">

      <div class="legal-lang">TR</div>
      <h2>Gizlilik &amp; Yasal Bilgilendirme</h2>

      <h3>KVKK / Gizlilik</h3>
      <p>Bu site statik çalışır: herhangi bir kullanıcı hesabı, form ya da sunucu tarafı veri kaydı yoktur (tek istisna aşağıda anlatılan reklamsız Sibnet yardımcısıdır). Favori animeler ve "son bakılanlar" listesi yalnızca kendi cihazındaki tarayıcı belleğinde (localStorage) tutulur, hiçbir yere gönderilmez; tarayıcı verilerini temizlediğinde silinir. Site kendi adına çerez kullanmaz.</p>
      <p>Kaç kişinin siteyi, hangi sayfadan/bağlantıdan girip hangi bölümlere baktığını görebilmek için <a href="https://www.goatcounter.com/" target="_blank" rel="noopener noreferrer">GoatCounter</a> adlı, çerez kullanmayan bir ziyaretçi sayacı kullanılır. Bu sayaç görüntülenen sayfa, yönlendiren site/bağlantı, tarayıcı-işletim sistemi türü ve IP adresinden türetilen kabaca ülke bilgisini toplar; IP adresini kalıcı saklamaz ve seni diğer ziyaretçilerden ayırt edip profil çıkaracak bir kimlik kullanmaz. Sonuçlar yalnızca toplu/istatistiksel sayılar (günlük, haftalık, aylık, tüm zamanlar) olarak görüntülenir. Ayrıntı için <a href="https://www.goatcounter.com/privacy" target="_blank" rel="noopener noreferrer">GoatCounter'ın gizlilik politikası</a>na bakabilirsin. Bu nedenlerle 6698 sayılı KVKK kapsamında kimliği belirli veya belirlenebilir bir kişiyle ilişkilendirilen veri işlenmemektedir.</p>
      <p>Anime kapak görselleri <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>'ten, bölüm oynatıcıları ise ilgili video barındırma sitelerinden (embed) yüklenir; bu üçüncü taraf servisler kendi gizlilik politikalarına ve çerezlerine tabidir, bu sitenin sorumluluğunda değildir.</p>
      <p>Sibnet bölümlerindeki "Reklamsız izle" seçeneği için site, <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a> üzerinde barındırılan küçük bir yardımcı fonksiyona (<code>tka-sibnet.vercel.app</code>) istek atar. Bu fonksiyon yalnızca Sibnet video numarasını alır, videonun doğrudan adresini çözüp geri döndürür; veritabanı tutmaz, çerez kullanmaz, isteği kaydetmez. Her web isteğinde olduğu gibi IP adresin istek süresince Vercel altyapısı tarafından teknik olarak görülür ve <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel'in gizlilik politikası</a> kapsamında kısa süreli işletim kayıtlarında yer alabilir. Videonun kendisi ise klasik gömülü oynatıcıda olduğu gibi doğrudan Sibnet sunucularından tarayıcına akar.</p>

      <h3>Telif Hakkı</h3>
      <p>Bu site hiçbir video dosyasını kendi sunucusunda barındırmaz. Yalnızca, artık kapanmış olan turkanime.tv'nin arşivinde bulunan ve halka açık üçüncü taraf video servislerine (GDrive, çeşitli embed sağlayıcıları vb.) ait bağlantıları bir araya getiren bir dizin/arşivdir. Tüm video içeriklerinin ve çevirilerin telif hakları ilgili hak sahiplerine (yapımcı stüdyo, dağıtımcı, fansub grupları) aittir.</p>

      <h3>Kaldırma Talebi</h3>
      <p>Bir içeriğin veya bağlantının hak sahibiysen ve kaldırılmasını istiyorsan, lütfen
        <a href="https://github.com/Berke-aras/turkanime-arsiv/issues/new" target="_blank" rel="noopener noreferrer">GitHub üzerinden bir issue açarak</a>
        ilgili anime/bölüm/link bilgisini ilet; talep incelenip en kısa sürede kaldırılır.</p>
    </div>`;
  fadeApp();
}

let routeToken = 0;
function route() {
  const token = ++routeToken;
  if (!playerModal.hidden) closePlayerModal(); // geri tuşuyla sayfa değişince modal açık kalmasın
  const hash = location.hash || '#/';
  if (hash === '#/yasal') { renderLegal(); return; }
  const m = hash.match(/^#\/anime\/(.+)$/);
  if (m) renderDetail(decodeURIComponent(m[1]), token);
  else renderList();
}

let t;
searchEl.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => {
    if (location.hash.startsWith('#/anime/')) return;
    state.query = searchEl.value;
    state.page = 1;
    renderList();
  }, 150);
});
document.getElementById('random-btn').addEventListener('click', pickRandomAnime);
window.addEventListener('hashchange', route);

const topBtn = document.getElementById('top-btn');
window.addEventListener('scroll', () => { topBtn.classList.toggle('show', window.scrollY > 500); }, { passive: true });
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
route();
