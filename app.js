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

// Gün boyunca aynı kalsın diye tarihi tohum olarak kullanan basit seçim (puanı 7 üstü animelerden).
function animeOfDay() {
  const pool = ANIME.filter(a => a.puan > 7);
  if (!pool.length) return null;
  const seed = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
function pickRandomAnime() {
  if (!ANIME.length) return;
  location.hash = '#/anime/' + ANIME[Math.floor(Math.random() * ANIME.length)].slug;
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
function toggleFav(slug) { favs.has(slug) ? favs.delete(slug) : favs.add(slug); writeLS('ta_favs', [...favs]); }

let recent = readLS('ta_recent', []);
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
    <div class="card" data-slug="${a.slug}" tabindex="0" role="button">
      ${posterPlaceholder(a)}
      <button class="fav-btn ${isFav(a.slug) ? 'active' : ''}" data-fav="${a.slug}" title="Favori">${isFav(a.slug) ? '★' : '☆'}</button>
      <h3>${esc(a.baslik)}</h3>
      <div class="meta">${a.eps} bölüm · ${a.urls} link${a.puan ? ` · ⭐${a.puan}` : ''}</div>
      <div class="badges">${a.top.map(p => `<span class="badge">${esc(p)}</span>`).join('')}</div>
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
      b.textContent = isFav(b.dataset.fav) ? '★' : '☆';
    });
  });
}

const app = document.getElementById('app');
const searchEl = document.getElementById('search');
const countEl = document.getElementById('count');
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

function filterBarHtml() {
  return `
    <div class="filterbar">
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
      <label class="fav-toggle"><input type="checkbox" id="f-fav" ${state.favOnly ? 'checked' : ''}> ★ Favoriler</label>
    </div>`;
}

function wireFilterBar() {
  document.getElementById('f-kategori').addEventListener('change', e => { state.kategori = e.target.value; state.page = 1; renderList(); });
  document.getElementById('f-tur').addEventListener('change', e => { state.tur = e.target.value; state.page = 1; renderList(); });
  document.getElementById('f-sort').addEventListener('change', e => { state.sort = e.target.value; renderList(); });
  document.getElementById('f-fav').addEventListener('change', e => { state.favOnly = e.target.checked; state.page = 1; renderList(); });
}

function renderList() {
  const items = filterAndSort();
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const pageItems = items.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  countEl.textContent = `${items.length} / ${ANIME.length} anime`;

  const showHome = !state.query && !state.kategori && !state.tur && !state.favOnly && state.page === 1;

  let featuredHtml = '';
  if (showHome) {
    const featured = animeOfDay();
    if (featured) {
      featuredHtml = `
        <div class="featured" data-slug="${featured.slug}" tabindex="0" role="button">
          ${posterPlaceholder(featured).replace('class="poster', 'class="featured-poster poster')}
          <div class="featured-info">
            <span class="badge tag-main">🌟 Günün Animesi</span>
            <h2>${esc(featured.baslik)}</h2>
            <div class="meta">${featured.eps} bölüm · ⭐${featured.puan}</div>
          </div>
        </div>`;
    }
  }

  const showRecent = showHome && recent.length;
  let recentHtml = '';
  if (showRecent) {
    const recentItems = recent.map(s => ANIME.find(a => a.slug === s)).filter(Boolean).slice(0, 12);
    if (recentItems.length) {
      recentHtml = `<div class="recent-row"><h2 class="section-title">Son bakılanlar</h2><div class="grid">${recentItems.map(cardHtml).join('')}</div></div>`;
    }
  }

  const bar = filterBarHtml();

  if (!items.length) {
    app.innerHTML = `${bar}<div class="empty">Sonuç bulunamadı.</div>`;
    wireFilterBar();
    return;
  }

  const pager = `
    <div class="pager">
      <button id="prev" ${state.page <= 1 ? 'disabled' : ''}>&larr; Önceki</button>
      <span>Sayfa ${state.page} / ${totalPages}</span>
      <button id="next" ${state.page >= totalPages ? 'disabled' : ''}>Sonraki &rarr;</button>
    </div>`;

  app.innerHTML = `${featuredHtml}${bar}${recentHtml}<div class="grid">${pageItems.map(cardHtml).join('')}</div>${pager}`;
  wireFilterBar();
  wireCards(app);
  const featuredEl = app.querySelector('.featured');
  if (featuredEl) {
    const go = () => { location.hash = '#/anime/' + featuredEl.dataset.slug; };
    featuredEl.addEventListener('click', go);
    featuredEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }
  document.getElementById('prev').addEventListener('click', () => { state.page--; renderList(); window.scrollTo(0, 0); });
  document.getElementById('next').addEventListener('click', () => { state.page++; renderList(); window.scrollTo(0, 0); });
}

async function renderDetail(slug) {
  const meta = ANIME.find(a => a.slug === slug);
  app.innerHTML = `
    <div class="skel-detail">
      <div class="skel skel-poster"></div>
      <div class="skel-lines"><div class="skel skel-line w60"></div><div class="skel skel-line w30"></div></div>
    </div>
    <div class="skel-eps">${Array.from({ length: 6 }, () => '<div class="skel skel-ep"></div>').join('')}</div>`;
  pushRecent(slug);

  let info = null;
  try {
    const r = await fetch(`kaynak/animeler/${slug}/info.json`);
    if (r.ok) info = await r.json();
  } catch (e) { /* bilgi paneli olmadan devam */ }

  await loadScript(slug).catch(() => {});
  const episodes = (window.__TKA__ && window.__TKA__[slug]) || [];

  // özette gelen <br /> gibi ham HTML etiketlerini gerçek satır sonuna çevir
  const escBr = s => esc(s).replace(/&lt;br\s*\/?&gt;/gi, '\n').replace(/\n/g, '<br>');

  const infoHtml = info ? `
    <div class="info">
      <div class="info-tags">
        ${info['Kategori'] ? `<span class="tag tag-main">${esc(info['Kategori'])}</span>` : ''}
        ${(info['Anime Türü'] || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>
      <div class="info-stats">
        <span>📺 ${esc(info['Bölüm Sayısı'] || '?')} bölüm</span>
        <span>🎬 ${esc(info['Stüdyo'] || '?')}</span>
        <span>⭐ ${info['Puanı'] ?? '?'}</span>
      </div>
      ${info['Özet'] ? `<p class="info-ozet">${escBr(info['Özet'])}</p>` : ''}
    </div>` : '';

  const epHtml = episodes.map((ep, i) => `
    <div class="ep" data-i="${i}">
      <div class="ep-head"><span class="ep-arrow">▸</span>${esc(ep.ad)}<span class="meta">${ep.links.length} link</span></div>
      <div class="ep-links">${ep.links.map(l => l.tip === 'mask'
        ? `<span class="link-btn mask" title="turkanime sunucusu gerekiyor, çalışmıyor">${esc(l.player)} <span class="fs">${esc(l.fansub || '')}</span></span>`
        : `<a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.player)} <span class="fs">${esc(l.fansub || '')}</span></a>`
      ).join('')}
      </div>
    </div>`).join('');

  const titleObj = { slug, baslik: meta ? meta.baslik : slug, poster: meta ? meta.poster : null };

  app.innerHTML = `
    <a class="back" href="#/">&larr; Listeye dön</a>
    <div class="detail">
      <div class="detail-head">
        ${posterPlaceholder(titleObj).replace('class="poster', 'class="detail-poster poster')}
        <div>
          <h2>${esc(titleObj.baslik)} <button id="detail-fav" class="fav-btn-lg ${isFav(slug) ? 'active' : ''}" title="Favori">${isFav(slug) ? '★' : '☆'}</button></h2>
          <div class="sub">${episodes.length} bölüm arşivlendi</div>
        </div>
      </div>
      ${infoHtml}
      ${episodes.length > 20 ? `<input id="ep-search" class="ep-search" placeholder="Bölüm ara... (örn. 12 veya final)">` : ''}
      ${epHtml || '<div class="empty">Bölüm verisi bulunamadı.</div>'}
    </div>`;

  app.querySelectorAll('.ep-head').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });

  document.getElementById('detail-fav').addEventListener('click', () => {
    toggleFav(slug);
    const b = document.getElementById('detail-fav');
    b.classList.toggle('active');
    b.textContent = isFav(slug) ? '★' : '☆';
  });

  const epSearchEl = document.getElementById('ep-search');
  if (epSearchEl) {
    epSearchEl.addEventListener('input', () => {
      const q = norm(epSearchEl.value);
      app.querySelectorAll('.ep').forEach(el => {
        const txt = norm(el.querySelector('.ep-head').textContent);
        el.style.display = !q || txt.includes(q) ? '' : 'none';
      });
    });
  }
}

function route() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/anime\/(.+)$/);
  if (m) renderDetail(decodeURIComponent(m[1]));
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
route();
