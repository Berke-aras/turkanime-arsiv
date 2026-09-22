// Liste görünümü: istatistik şeridi, Günün Animesi, son bakılanlar, filtre çubuğu ve kart ızgarası.
import { esc, ic, levenshtein, norm } from '../util.js';
import { app, fadeApp } from '../dom.js';
import { ANIME, KATEGORILER, TURLER, ONYILLAR, aramaAnahtari, aramaKelimeleri, statsStripHtml, animeOfDay } from '../data.js';
import { listHash } from '../state.js';
import { devamListesi } from '../progress.js';
import { wireSeritler } from '../serit.js';
import { getRecent } from '../store.js';
import { cardHtml, wireCards, posterPlaceholder } from '../cards.js';
import { filterAndSort, pickRandomAnime } from '../search.js';
import { PAGE_SIZE, state, syncListHash } from '../state.js';

function filterBarHtml(count) {
  return `
    <div class="filterbar">
      <span class="filter-count" aria-live="polite">${count.toLocaleString('tr-TR')} / ${ANIME.length.toLocaleString('tr-TR')} anime</span>
      <select id="f-kategori" title="Tür (TV/Film/OVA)">
        <option value="">Tüm kategoriler</option>
        ${KATEGORILER.map(k => `<option value="${esc(k)}" ${state.kategori === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
      </select>
      <select id="f-tur" title="Janr">
        <option value="">Tüm janrlar</option>
        ${TURLER.map(t => `<option value="${esc(t)}" ${state.tur === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
      <select id="f-onyil" title="Yayın yılı">
        <option value="">Tüm yıllar</option>
        ${ONYILLAR.map(d => `<option value="${d}" ${state.onyil === d ? 'selected' : ''}>${d}'ler</option>`).join('')}
      </select>
      <select id="f-sort" title="Sırala">
        <option value="isim" ${state.sort === 'isim' ? 'selected' : ''}>İsme göre</option>
        <option value="puan" ${state.sort === 'puan' ? 'selected' : ''}>Puana göre</option>
        <option value="yeni" ${state.sort === 'yeni' ? 'selected' : ''}>Yeniden eskiye</option>
        <option value="eski" ${state.sort === 'eski' ? 'selected' : ''}>Eskiden yeniye</option>
        <option value="eps" ${state.sort === 'eps' ? 'selected' : ''}>Bölüm sayısına göre</option>
      </select>
      <label class="fav-toggle"><input type="checkbox" id="f-fav" ${state.favOnly ? 'checked' : ''}> ${ic('star')}Favoriler</label>
    </div>`;
}

function wireFilterBar() {
  const apply = fn => e => { fn(e); state.page = 1; syncListHash(); renderList(); };
  document.getElementById('f-kategori').addEventListener('change', apply(e => { state.kategori = e.target.value; }));
  document.getElementById('f-tur').addEventListener('change', apply(e => { state.tur = e.target.value; }));
  document.getElementById('f-onyil').addEventListener('change', apply(e => { state.onyil = Number(e.target.value) || 0; }));
  document.getElementById('f-sort').addEventListener('change', apply(e => { state.sort = e.target.value; }));
  document.getElementById('f-fav').addEventListener('change', apply(e => { state.favOnly = e.target.checked; }));
}

// Yatay kaydırmalı kart şeridi. Ana sayfadaki keşif bölümlerinin tamamı bunu kullanıyor.
function seritHtml(baslik, items, altBaslik = '') {
  if (!items.length) return '';
  // Masaüstünde şerit yatay kaydırmalı ama dokunmatik yok ve kaydırma çubuğu gizli: ok
  // düğmeleri olmadan kaydırılamıyordu. Düğmeler yalnız taşma varsa görünür (bkz. wireSeritler).
  return `<section class="recent-row">
      <h2 class="section-title">${esc(baslik)}${altBaslik ? `<span class="meta">${esc(altBaslik)}</span>` : ''}</h2>
      <div class="serit-sar">
        <button type="button" class="serit-ok serit-ok-sol" aria-label="Sola kaydır" hidden>${ic('chevron-left')}</button>
        <div class="grid recent-grid">${items.map(cardHtml).join('')}</div>
        <button type="button" class="serit-ok serit-ok-sag" aria-label="Sağa kaydır" hidden>${ic('chevron-right')}</button>
      </div>
    </section>`;
}


// Puanı 8+ olanların en tepesinden, gün içinde değişmeyen 12'lik bir seçki.
// Havuz puana göre sıralanıp ilk EN_IYI_HAVUZ tanesine iniliyor, sonra günün tohumuyla
// aralıklı örnekleme yapılıyor: hem gerçekten yüksek puanlılar çıkıyor hem şerit her gün
// değişiyor hem de ardışık seçim yüzünden aynı serinin sezonları yan yana gelmiyor.
const EN_IYI_ESIK = 8;
const EN_IYI_HAVUZ = 120;
const EN_IYI_SAYI = 12;
function enIyiler() {
  const havuz = ANIME.filter(a => a.puan >= EN_IYI_ESIK && !a.nsfw)
    .sort((x, y) => y.puan - x.puan)
    .slice(0, EN_IYI_HAVUZ);
  if (havuz.length <= EN_IYI_SAYI) return havuz;
  const tohum = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < tohum.length; i++) h = (h * 31 + tohum.charCodeAt(i)) >>> 0;
  const adim = Math.max(1, Math.floor(havuz.length / EN_IYI_SAYI));
  const bas = h % havuz.length;
  const secilen = [];
  for (let i = 0; secilen.length < EN_IYI_SAYI && i < havuz.length; i++) {
    const a = havuz[(bas + i * adim) % havuz.length];
    if (!secilen.includes(a)) secilen.push(a);
  }
  return secilen.sort((x, y) => y.puan - x.puan);
}

// En kalabalık 8 janr, sayılarıyla birlikte; tıklanınca o janrın filtresi uygulanmış listeye gider.
function janrSeridiHtml() {
  const sayac = new Map();
  for (const a of ANIME) for (const t of a.tur) sayac.set(t, (sayac.get(t) || 0) + 1);
  const ilk = [...sayac.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  if (!ilk.length) return '';
  return `<section class="janr-row">
      <h2 class="section-title">Janra göre keşfet</h2>
      <div class="janr-chips">${ilk.map(([t, n]) =>
    `<a class="link-btn janr-chip" href="${esc(janrHash(t))}">${esc(t)}<span class="meta">${n.toLocaleString('tr-TR')}</span></a>`).join('')}</div>
    </section>`;
}
// Janr çipinin hedefi: yalnız o janr seçili, diğer filtreler temiz bir liste.
function janrHash(tur) {
  const yedek = { ...state };
  Object.assign(state, { query: '', kategori: '', tur, onyil: 0, sort: 'isim', favOnly: false, page: 1 });
  const h = listHash();
  Object.assign(state, yedek);
  return h;
}

function renderList() {
  const items = filterAndSort();
  document.title = 'TürkAnime Arşiv Görüntüleyici';
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const pageItems = items.slice(0, state.page * PAGE_SIZE);

  const showHome = !state.query && !state.kategori && !state.tur && !state.onyil && !state.favOnly;

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
        </a>
        <button type="button" id="featured-random" class="link-btn featured-random" title="Arşivden rastgele bir anime aç">${ic('dice')}Rastgele bir anime</button>`;
    }
  }

  const showRecent = showHome && getRecent().length;
  let recentHtml = '';
  if (showRecent) {
    // saklanan 16 kaydın tamamı gösteriliyor; şerit zaten yatay kaydırmalı, maliyeti yok.
    const recentItems = getRecent().map(s => ANIME.find(a => a.slug === s)).filter(Boolean);
    if (recentItems.length) {
      recentHtml = seritHtml('Son bakılanlar', recentItems);
    }
  }

  // "Devam et" (§6.2.3 + §7.1): izlemeye başlanmış animeler en üstte.
  let devamHtml = '';
  if (showHome) {
    const devam = devamListesi().map(s => ANIME.find(a => a.slug === s)).filter(Boolean).slice(0, 16);
    if (devam.length) devamHtml = seritHtml('İzlemeye devam et', devam);
  }

  // Keşif şeritleri: 6107 anime tek düze alfabetik bir duvar hâlinde akmasın (§6.2).
  const enIyilerHtml = showHome ? seritHtml('En yüksek puanlı', enIyiler(), 'Puanı 8 ve üzeri') : '';
  const janrHtml = showHome ? janrSeridiHtml() : '';

  const bar = filterBarHtml(items.length);

  if (!items.length) {
    const q = norm(state.query);
    const suggestions = q ? ANIME
      .map(a => ({ a, d: Math.min(levenshtein(q, aramaAnahtari(a).slice(0, q.length + 2)), ...aramaKelimeleri(a).map(t => levenshtein(q, t))) }))
      .filter(x => x.d <= Math.ceil(q.length / 2))
      .sort((x, y) => x.d - y.d).slice(0, 4) : [];
    const suggestHtml = suggestions.length
      ? `<div class="suggest">Bunu mu demek istedin?${suggestions.map(x => `<a class="link-btn" href="#/anime/${x.a.slug}">${esc(x.a.baslik)}</a>`).join('')}</div>` : '';
    // Boş sonucun en sık sebebi arama değil, açık kalmış bir filtre.
    const filtreVar = state.kategori || state.tur || state.onyil || state.favOnly;
    const temizleHtml = filtreVar
      ? `<div class="suggest"><button type="button" id="filtre-temizle" class="link-btn">${ic('x')}Filtreleri temizle</button></div>` : '';
    app.innerHTML = `${bar}<div class="empty">Sonuç bulunamadı.${suggestHtml}${temizleHtml}</div>`;
    fadeApp();
    wireFilterBar();
    const temizleBtn = document.getElementById('filtre-temizle');
    if (temizleBtn) temizleBtn.addEventListener('click', () => {
      Object.assign(state, { kategori: '', tur: '', onyil: 0, favOnly: false, page: 1 });
      syncListHash();
      renderList();
    });
    return;
  }

  const loadMoreHtml = () => state.page < totalPages
    ? `<button id="load-more">Daha fazla yükle <span class="meta">(${(items.length - state.page * PAGE_SIZE).toLocaleString('tr-TR')} kaldı)</span></button>` : '';
  const pager = `<div class="pager">${loadMoreHtml()}</div>`;

  const archiveTitleHtml = showHome ? '<h2 class="section-title archive-title">Tüm Arşiv</h2>' : '';

  app.innerHTML = `${statsHtml}${featuredHtml}${devamHtml}${recentHtml}${enIyilerHtml}${janrHtml}${archiveTitleHtml}${bar}<div class="grid">${pageItems.map(cardHtml).join('')}</div>${pager}`;
  fadeApp();
  wireFilterBar();
  wireCards(app);
  wireSeritler(app);
  const rastgeleBtn = document.getElementById('featured-random');
  if (rastgeleBtn) rastgeleBtn.addEventListener('click', pickRandomAnime);
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
