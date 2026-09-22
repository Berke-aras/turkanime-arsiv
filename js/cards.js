// Anime kartı ve poster yer tutucusu. Kart gerçek bir <a>; favori butonu iç içe etkileşimli öğe
// olmasın diye <a>'nın dışında, .card-wrap sarmalayıcısında duruyor (bkz. GELISTIRME-PLANI §5.1).
import { esc, ic, initials, hue } from './util.js';
import { isFav, favLabel, toggleFav } from './store.js';

// Kapağı olmayan 92 anime için yer tutucu (§6.3). İki harf yerine başlığın kendisi okunuyor;
// diagonal gradyan arka arkaya gelen yer tutucuların "bozuk" görünmesini engelliyor.
function posterPlaceholder(a) {
  if (a.poster) return `<div class="poster loaded"><img src="${esc(a.poster)}" loading="lazy" alt="" onload="this.classList.add('img-loaded')" onerror="this.classList.add('img-loaded')"></div>`;
  const h = hue(a.baslik);
  const zemin = `linear-gradient(150deg,hsl(${h},45%,24%),hsl(${(h + 30) % 360},40%,14%))`;
  // .poster yüksekliğini padding-bottom ile kuruyor (height:0), o yüzden içerik mutlak
  // konumlu bir sarmalayıcıya alınıyor; yoksa kutunun dışına taşıyor.
  return `<div class="poster poster-bos" style="background:${zemin}">
      <span class="poster-bos-ic">
        <span class="poster-init">${esc(initials(a.baslik))}</span>
        <span class="poster-ad">${esc(a.baslik)}</span>
        <span class="poster-not">kapak yok</span>
      </span>
    </div>`;
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
        <div class="meta">${a.yil ? `${a.yil} · ` : ''}${a.eps ? `${a.eps} bölüm · ${a.urls} link` : 'bölüm verisi yok'}</div>
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


export { posterPlaceholder, cardHtml, wireCards };
