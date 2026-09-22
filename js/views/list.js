// Liste görünümü: istatistik şeridi, Günün Animesi, son bakılanlar, filtre çubuğu ve kart ızgarası.
import { esc, ic, levenshtein, norm } from '../util.js';
import { app, fadeApp } from '../dom.js';
import { ANIME, KATEGORILER, TURLER, statsStripHtml, animeOfDay } from '../data.js';
import { getRecent } from '../store.js';
import { cardHtml, wireCards, posterPlaceholder } from '../cards.js';
import { filterAndSort } from '../search.js';
import { PAGE_SIZE, state, syncListHash } from '../state.js';

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

  const showRecent = showHome && getRecent().length;
  let recentHtml = '';
  if (showRecent) {
    const recentItems = getRecent().map(s => ANIME.find(a => a.slug === s)).filter(Boolean).slice(0, 6);
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


export { renderList, filterBarHtml, wireFilterBar };
