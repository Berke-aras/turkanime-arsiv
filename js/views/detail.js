// Detay görünümü: kapak/bilgi paneli, özet ve bölüm listesi.
import { esc, ic, norm } from '../util.js';
import { app, fadeApp } from '../dom.js';
import { ANIME, loadScript } from '../data.js';
import { isFav, favLabel, toggleFav, pushRecent, getEpReverse, setEpReverse, getEpIzgara, setEpIzgara } from '../store.js';
import { posterPlaceholder } from '../cards.js';
import { OLU } from '../links.js';
import { openEpisode, setCurrentEpisodes, syncEpNavButtons, playerModal, directBtnOf } from '../player.js';
import { getRouteToken } from '../router.js';

async function renderDetail(slug, token) {
  const meta = ANIME.find(a => a.slug === slug);
  // Arşivde olmayan bir slug (eski/bozuk paylaşılan link) iskeletten sonra boş bir detay sayfası
  // açıp kaynak/animeler/<slug>/info.json ve kaynak/b/<slug>.js için 404 isteği atıyordu.
  if (!meta) {
    document.title = 'Bulunamadı · TürkAnime Arşivi';
    app.innerHTML = `
      <a class="back" href="#/">${ic('arrow-left')}Listeye dön</a>
      <div class="empty">Bu anime arşivde bulunamadı.<div class="meta">Aradığın: ${esc(slug)}</div></div>`;
    fadeApp();
    return;
  }
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
  if (token !== getRouteToken()) return; // kullanıcı beklerken başka rotaya geçti, eski yanıtı çizme

  await loadScript(slug).catch(() => {});
  if (token !== getRouteToken()) return;
  pushRecent(slug); // render kesinleşmeden "son bakılanlar"a yazma
  const episodes = (window.__TKA__ && window.__TKA__[slug]) || [];
  setCurrentEpisodes(episodes);

  // özette gelen <br /> gibi ham HTML etiketlerini gerçek satır sonuna çevir
  const escBr = s => esc(s).replace(/&lt;br\s*\/?&gt;/gi, '\n').replace(/\n/g, '<br>');

  const firstPlayable = episodes.findIndex(ep => ep.links.some(l => !OLU(l.tip)));
  // "07 Ekim 2004, Perşembe" gibi uzun tarihlerden yalnız yılı al; başlangıç ve bitiş aynıysa tek yıl yaz.
  const yilAl = t => { const m = /(\d{4})/.exec(t || ''); return m ? m[1] : ''; };
  const basYil = info ? yilAl(info['Başlama Tarihi']) : '';
  const bitYil = info ? yilAl(info['Bitiş Tarihi']) : '';
  const yayinAraligi = basYil && bitYil && bitYil !== basYil ? `${basYil}–${bitYil}` : (basYil || bitYil);
  const heroInfoHtml = info ? `
      <div class="info-tags">
        ${info['Kategori'] ? `<span class="tag tag-main">${esc(info['Kategori'])}</span>` : ''}
        ${(info['Anime Türü'] || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>
      <div class="info-stats">
        <span>${ic('tv')}${esc(info['Bölüm Sayısı'] || '?')} bölüm</span>
        ${yayinAraligi ? `<span>${ic('calendar')}${esc(yayinAraligi)}</span>` : ''}
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
  // Aynı DOM iki görünümü de besliyor (§6.4): liste modunda tam başlık, ızgara modunda yalnız
  // bölüm numarası görünür; hangisinin görüneceğine CSS karar veriyor. Açılan bölüm ızgarada
  // tüm satırı kaplar (grid-column:1/-1), böylece link listesi yine tam genişlikte çıkar.
  const epItemHtml = i => {
    const ep = episodes[i];
    const empty = !ep.links.length;
    const kisa = ep.no != null ? String(ep.no) : '•';
    return `
    <div class="ep${empty ? ' ep-empty' : ''}" data-i="${i}">
      <div class="ep-head">
        <span class="ep-arrow">${ic('chevron-right')}</span>
        <span class="ep-kisa" aria-hidden="true">${esc(kisa)}</span>
        <span class="ep-ad">${esc(ep.ad)}</span>
        <span class="meta">${empty ? 'çalışan link yok' : `${ep.links.length} link`}</span>
      </div>
      <div class="ep-links"></div>
    </div>`;
  };
  // uzun serilerde (100+) bölümler 50'lik katlanır gruplara bölünüyor; sadece ilk grup açık gelir
  const EP_GROUP = 50;
  const epListHtml = () => {
    let order = episodes.map((_, i) => i);
    if (getEpReverse()) order.reverse();
    const kutular = g => `<div class="ep-kutular">${g.map(epItemHtml).join('')}</div>`;
    if (order.length <= 100) return kutular(order);
    const groups = [];
    for (let k = 0; k < order.length; k += EP_GROUP) groups.push(order.slice(k, k + EP_GROUP));
    return groups.map((g, gi) => `
      <details class="ep-group"${gi === 0 ? ' open' : ''}>
        <summary>${g[0] + 1}–${g[g.length - 1] + 1}<span class="meta">${g.length} bölüm</span></summary>
        ${kutular(g)}
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
          ${info && info['Japonca'] ? `<p class="detail-japonca" lang="ja">${esc(info['Japonca'])}</p>` : ''}
          ${heroInfoHtml}
          ${firstPlayable >= 0 ? `<button type="button" id="detail-start" class="start-btn">${ic('play')}İzlemeye başla</button>` : ''}
        </div>
      </div>
      ${ozetHtml}
      ${episodes.length ? `
      <div class="ep-toolbar">
        <h3 class="section-title">Bölümler <span class="meta">(${episodes.length})</span></h3>
        <button type="button" id="ep-view" class="link-btn" title="${getEpIzgara() ? 'Liste görünümü' : 'Izgara görünümü'}" aria-label="${getEpIzgara() ? 'Liste görünümü' : 'Izgara görünümü'}">${ic(getEpIzgara() ? 'list' : 'grid')}</button>
        <button type="button" id="ep-reverse" class="link-btn${getEpReverse() ? ' active' : ''}" title="Sıralamayı tersine çevir">${ic('sort')}Tersten</button>
      </div>` : ''}
      ${episodes.length > 20 ? `<input id="ep-search" class="ep-search" placeholder="Bölüm ara... (örn. 12 veya final)">` : ''}
      <div id="ep-list"${getEpIzgara() ? ' class="izgara"' : ''}>${epListHtml() || '<div class="empty">Bölüm verisi bulunamadı.</div>'}</div>
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
    setEpReverse(!getEpReverse());
    revBtn.classList.toggle('active', getEpReverse());
    if (!playerModal.hidden) syncEpNavButtons(); // modal açıkken yön değişirse butonlar tazelensin
    epListEl.innerHTML = epListHtml();
    const epSearchEl = document.getElementById('ep-search');
    if (epSearchEl && epSearchEl.value) epSearchEl.dispatchEvent(new Event('input'));
  });
  const viewBtn = document.getElementById('ep-view');
  if (viewBtn) viewBtn.addEventListener('click', () => {
    setEpIzgara(!getEpIzgara());
    epListEl.classList.toggle('izgara', getEpIzgara());
    viewBtn.innerHTML = ic(getEpIzgara() ? 'list' : 'grid');
    viewBtn.title = viewBtn.ariaLabel = getEpIzgara() ? 'Liste görünümü' : 'Izgara görünümü';
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


export { renderDetail };
