// Detay görünümü: kapak/bilgi paneli, özet ve bölüm listesi.
import { esc, ic, norm } from '../util.js';
import { app, fadeApp } from '../dom.js';
import { ANIME, loadScript, NSFW_TURLER } from '../data.js';
import { cardHtml, wireCards } from '../cards.js';
import { wireSeritler } from '../serit.js';
import { epListHtml } from './bolum-listesi.js';
import { isFav, favLabel, toggleFav, pushRecent, getEpReverse, setEpReverse, getEpIzgara, setEpIzgara } from '../store.js';
import { posterPlaceholder } from '../cards.js';
import { OLU } from '../links.js';
import { openEpisode, setCurrentEpisodes, syncEpNavButtons, playerModal, directBtnOf } from '../player.js';
import { izlendiMi, izlendiAyarla, burayaKadarIsaretle, izlenenSayisi, izlenenleriTemizle } from '../progress.js';
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

  // §6.7: iki istek birbirini beklemiyor — bilgi paneli ve bölüm listesi paralel yükleniyor,
  // iskelet süresi ikisinin toplamı değil uzun olanı kadar.
  const [info] = await Promise.all([
    fetch(`kaynak/animeler/${slug}/info.json`).then(r => r.ok ? r.json() : null).catch(() => null),
    loadScript(slug).catch(() => {}),
  ]);
  if (token !== getRouteToken()) return; // kullanıcı beklerken başka rotaya geçti, eski yanıtı çizme
  pushRecent(slug); // render kesinleşmeden "son bakılanlar"a yazma
  const episodes = (window.__TKA__ && window.__TKA__[slug]) || [];
  setCurrentEpisodes(episodes, slug);

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

  // §6.5 "Benzer animeler": önce aynı seri (slug ön eki), sonra ortak janr + yakın puan.
  // Veri zaten bellekte, maliyeti sıfır.
  const benzerler = () => {
    if (!meta) return [];
    // "naruto" ile "naruto-shippuuden" aynı seri sayılır; ön ek en az 6 karakter olmalı ki
    // "one" gibi kısa parçalar yüzlerce alakasız anime getirmesin.
    const kok = slug.split('-').slice(0, 2).join('-');
    const ayniSeri = kok.length >= 6
      ? ANIME.filter(a => a.slug !== slug && (a.slug.startsWith(kok + '-') || slug.startsWith(a.slug + '-')))
      : [];
    const turKume = new Set(meta.tur);
    const puanli = ANIME
      .filter(a => a.slug !== slug && a.eps && !ayniSeri.includes(a) && a.tur.some(t => turKume.has(t)))
      .map(a => ({
        a,
        ortak: a.tur.filter(t => turKume.has(t)).length,
        puanFarki: Math.abs((a.puan || 0) - (meta.puan || 0)),
      }))
      .sort((x, y) => (y.ortak - x.ortak) || (x.puanFarki - y.puanFarki) || (y.a.puan - x.a.puan))
      .map(x => x.a);
    return [...ayniSeri, ...puanli].slice(0, 12);
  };
  const benzerListe = benzerler();
  const benzerHtml = benzerListe.length ? `
      <section class="recent-row benzer-row">
        <h2 class="section-title">Benzer animeler</h2>
        <div class="serit-sar">
          <button type="button" class="serit-ok serit-ok-sol" aria-label="Sola kaydır" hidden>${ic('chevron-left')}</button>
          <div class="grid recent-grid">${benzerListe.map(cardHtml).join('')}</div>
          <button type="button" class="serit-ok serit-ok-sag" aria-label="Sağa kaydır" hidden>${ic('chevron-right')}</button>
        </div>
      </section>` : '';

  // Yetişkin içerik uyarısı: türü Ecchi/Hentai/Erotica olan animelerde (bkz. js/data.js NSFW_TURLER)
  const nsfwTurleri = meta ? meta.tur.filter(t => NSFW_TURLER.has(t)) : [];
  const nsfwHtml = nsfwTurleri.length ? `
      <div class="nsfw-uyari" role="note">
        <span class="nsfw-rozet">18+</span>
        <div>
          <strong>Yetişkin içerik</strong>
          <p>Bu başlık <strong>${esc(nsfwTurleri.join(', '))}</strong> türünde; cinsel içerik ya da
          çıplaklık barındırabilir. 18 yaşından küçükseniz devam etmeyin, iş yerinde açmayın.</p>
        </div>
      </div>` : '';

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
      ${nsfwHtml}
      ${ozetHtml}
      ${episodes.length ? `
      <div class="ep-toolbar">
        <h3 class="section-title">Bölümler <span class="meta">(${episodes.length})</span></h3>
        <button type="button" id="ep-izlenen" class="link-btn ep-izlenen-rozet" hidden title="İzlenen bölümleri temizle"><span></span>${ic('x')}</button>
        <button type="button" id="ep-view" class="link-btn" title="${getEpIzgara() ? 'Liste görünümü' : 'Izgara görünümü'}" aria-label="${getEpIzgara() ? 'Liste görünümü' : 'Izgara görünümü'}">${ic(getEpIzgara() ? 'list' : 'grid')}</button>
        <button type="button" id="ep-reverse" class="link-btn${getEpReverse() ? ' active' : ''}" title="Sıralamayı tersine çevir">${ic('sort')}Tersten</button>
      </div>` : ''}
      ${episodes.length > 20 ? `<input id="ep-search" class="ep-search" placeholder="Bölüm ara... (örn. 12 veya final)">` : ''}
      <div id="ep-list"${getEpIzgara() ? ' class="izgara"' : ''}>${epListHtml(episodes, slug) || '<div class="empty">Bölüm verisi bulunamadı.</div>'}</div>
      ${benzerHtml}
    </div>`;
  fadeApp();

  wireCards(app);       // benzer animeler şeridindeki favori düğmeleri
  wireSeritler(app);    // ve ok düğmeleri

  const epListEl = document.getElementById('ep-list');
  // §7.2: tik düğmesi — normal tık tekil, Shift+tık "buraya kadar hepsi".
  epListEl.addEventListener('click', e => {
    const tik = e.target.closest('.ep-izle');
    if (!tik) return;
    e.stopPropagation();
    const i = Number(tik.dataset.i);
    if (e.shiftKey) burayaKadarIsaretle(slug, i);
    else izlendiAyarla(slug, i, !izlendiMi(slug, i));
    izlenenleriCiz();
  }, true);

  // İşaretleri yeniden çizmeden tazeler (bölüm listesi yeniden basılmıyor).
  const izlenenleriCiz = () => {
    epListEl.querySelectorAll('.ep').forEach(el => {
      el.classList.toggle('ep-izlendi', izlendiMi(slug, Number(el.dataset.i)));
    });
    const sayi = izlenenSayisi(slug);
    const rozet = document.getElementById('ep-izlenen');
    if (rozet) {
      rozet.hidden = !sayi;
      rozet.querySelector('span').textContent = `${sayi} / ${episodes.length} izlendi`;
    }
  };

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
    epListEl.innerHTML = epListHtml(episodes, slug);
    izlenenleriCiz();
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
  const izlenenBtn = document.getElementById('ep-izlenen');
  if (izlenenBtn) izlenenBtn.addEventListener('click', () => { izlenenleriTemizle(slug); izlenenleriCiz(); });
  izlenenleriCiz();

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
