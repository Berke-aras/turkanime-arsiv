// Anime kartı ve poster yer tutucusu. Kart gerçek bir <a>; favori butonu iç içe etkileşimli öğe
// olmasın diye <a>'nın dışında, .card-wrap sarmalayıcısında duruyor (bkz. GELISTIRME-PLANI §5.1).
import { esc, ic, initials, hue } from './util.js';
import { isFav, favLabel, toggleFav } from './store.js';
import { posterUrl } from './data.js';
import { ilerlemeOrani } from './progress.js';

// Kapağı olmayan 92 anime için yer tutucu (§6.3). İki harf yerine başlığın kendisi okunuyor;
// diagonal gradyan arka arkaya gelen yer tutucuların "bozuk" görünmesini engelliyor.
// oran > 0 ise posterin alt kenarına ince bir izleme ilerlemesi çubuğu çizilir (§7.1).
function ilerlemeCubugu(oran) {
  return oran ? `<span class="ilerleme" title="İzlemeye devam et"><i style="width:${Math.round(oran * 100)}%"></i></span>` : '';
}
// §2.5 A5: şerit kartları 126x189 (masaüstü) / 112x168 (telefon) css px basılıyor, yani
// 230 px'lik `medium` gereğinden büyük. Yüksek yoğunluklu ekranda `small` (100 px) gözle
// görülür biçimde yumuşadığı için orada medium kalıyor — karar cihaza göre bir kez veriliyor.
const SERIT_BOYUT = (typeof devicePixelRatio === 'number' && devicePixelRatio >= 1.5) ? 'medium' : 'small';

// secenekler:
//   oncelik → ekranın üstündeki kapak. `loading="lazy"` tarayıcının kapağı istemesini
//     geciktiriyor; ilk ekranda görünenlerde bunu istemiyoruz (§2.5 A2/A3).
//   boyut   → 'small' | 'medium'; şeritlerdeki küçük kartlar için (§2.5 A5).
// decoding="async" hepsinde: kapak çözümü ana iş parçacığını kilitlemesin.
function posterPlaceholder(a, oran = 0, secenekler = {}) {
  const kaynak = secenekler.boyut ? (posterUrl(a, secenekler.boyut) || a.poster) : a.poster;
  const yukleme = secenekler.oncelik ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  if (kaynak) return `<div class="poster loaded"><img src="${esc(kaynak)}" ${yukleme} decoding="async" alt="">${ilerlemeCubugu(oran)}</div>`;
  const h = hue(a.baslik);
  const zemin = `linear-gradient(150deg,hsl(${h},45%,24%),hsl(${(h + 30) % 360},40%,14%))`;
  // .poster yüksekliğini padding-bottom ile kuruyor (height:0), o yüzden içerik mutlak
  // konumlu bir sarmalayıcıya alınıyor; yoksa kutunun dışına taşıyor.
  return `<div class="poster poster-bos" style="background:${zemin}">
      <span class="poster-bos-ic">
        <span class="poster-init">${esc(initials(a.baslik))}</span>
        <span class="poster-ad">${esc(a.baslik)}</span>
        <span class="poster-not">kapak yok</span>
      </span>${ilerlemeCubugu(oran)}
    </div>`;
}

// Kart gerçek bir <a>: orta tık/Ctrl+tık yeni sekmede açar, tarayıcı bağlantı önizlemesi gösterir,
// ekran okuyucu bağlantı olarak duyurur. Favori butonu iç içe etkileşimli öğe olmasın diye
// <a>'nın dışında, sarmalayıcıda duruyor ve üstüne konumlanıyor (bkz. style.css .card-wrap).
function cardHtml(a, secenekler = {}) {
  const oran = ilerlemeOrani(a.slug); // §7.1: kartın altında ince ilerleme çubuğu
  return `
    <div class="card-wrap">
      <a class="card${a.eps ? '' : ' card-empty'}" href="#/anime/${encodeURIComponent(a.slug)}">
        ${posterPlaceholder(a, oran, secenekler)}
        ${a.puan ? `<span class="rating-badge">${ic('star','ic-star')}${a.puan}</span>` : ''}
        ${a.nsfw ? '<span class="yas-rozet" title="Yetişkin içerik">18+</span>' : ''}
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


// §4.2: eskiden her <img> satır içi onload/onerror taşıyordu; bu, Content-Security-Policy
// eklemeyi imkânsız kılıyordu. Yerine belgede tek bir yakalama fazlı dinleyici var — poster
// yüklendiğinde (ya da yüklenemediğinde) aynı sınıf ekleniyor, maliyeti sabit.
function posterYuklendi(e) {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.closest('.poster')) img.classList.add('img-loaded');
}
document.addEventListener('load', posterYuklendi, true);
document.addEventListener('error', posterYuklendi, true);

export { posterPlaceholder, cardHtml, wireCards, SERIT_BOYUT };
