// Bilgi paneli verisinin (kaynak/x, kaynak/sv) yüklenmesi ve oynatıcı, detay sayfası ile seslendirmen
// sayfasının paylaştığı küçük HTML parçaları (avatar, seslendirmen linki).
import { esc, initials, hue } from './util.js';
import { ANIME } from './data.js';
import { anilistId, gorselAc, svKova, spotifyLink } from './xray-veri.js';

let slugIndex = null;
const animeBul = slug => {
  if (!slugIndex) slugIndex = new Map(ANIME.map(a => [a.slug, a]));
  return slugIndex.get(slug) || null;
};

// slug -> Promise<veri|null>. Kimliği çıkmayan animede hiç istek atılmıyor: derleme betiği de aynı
// kuralla dosya yazmıyor, böylece 404 oluşmuyor.
const veriCache = new Map();
function veriYukle(slug) {
  const a = animeBul(slug);
  if (!a || !anilistId(a.posterAd)) return Promise.resolve(null);
  if (!veriCache.has(slug)) {
    veriCache.set(slug, fetch(`kaynak/x/${encodeURIComponent(slug)}.json`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => { veriCache.delete(slug); return null; }));
  }
  return veriCache.get(slug);
}

// Seslendirmen -> { g, r: [[slug, karakter, rol]...] } | null. Kovalar (kaynak/sv/0..31.json) önbellekte.
const kovaCache = new Map();
function seslendirmenYukle(ad) {
  const k = svKova(ad);
  if (!kovaCache.has(k)) {
    kovaCache.set(k, fetch(`kaynak/sv/${k}.json`).then(r => r.ok ? r.json() : {})
      .catch(() => { kovaCache.delete(k); return {}; }));
  }
  return kovaCache.get(k).then(kova => kova[ad] || null);
}

const basHarfler = (ad, sinif) => `<span class="${sinif} xray-bos" style="--h:${hue(ad)}" aria-hidden="true">${esc(initials(ad))}</span>`;
function avatar(ad, gorsel, onek, sinif) {
  const url = gorselAc(gorsel, onek);
  return url
    ? `<img class="${sinif}" src="${esc(url)}" alt="" loading="lazy" decoding="async" data-ad="${esc(ad)}">`
    : basHarfler(ad, sinif);
}
// Görsel yüklenemezse (AniList CDN'i erişilemez, silinmiş görsel) kırık resim yerine baş harfler.
// CSP satır içi onerror'a izin vermediği için 'error' yakalama aşamasında dinleniyor (bubble etmiyor).
document.addEventListener('error', e => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.dataset.ad !== undefined) img.outerHTML = basHarfler(img.dataset.ad, img.className);
}, true);

const seslendirmenHref = ad => `#/seslendirmen/${encodeURIComponent(ad)}`;

// Ekolayzır çubukları: şarkı kartlarında ve "Şu an çalıyor" etiketinde dönen küçük müzik animasyonu.
const EKOLAYZIR = '<span class="xray-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const SPOTIFY_IKON = '<svg class="ic" aria-hidden="true"><use href="#i-spotify"/></svg>';

// Şarkı kartı (oynatıcı paneli ve detay sayfası): tıklanınca Spotify'da parçaya (ya da aramaya) gidiyor.
// ek: sanatçının yanına eklenecek kısa not (ör. "1–12. bölümler").
function sarkiKartHtml(t, etiket, ek = '') {
  const sp = spotifyLink(t);
  const ad = t[2] || 'Bilinmeyen şarkı';
  const alt = [t[3], ek].filter(Boolean).map(esc).join(' · ');
  return `<li class="xray-sarki"><a class="xray-sarki-kart xray-spotify-link" href="${esc(sp.url)}" target="_blank" rel="noopener noreferrer"`
    + ` title="${esc(ad)} — Spotify'da ${sp.parca ? 'dinle' : 'ara'}">`
    + EKOLAYZIR
    + `<span class="xray-sarki-metin"><span class="xray-sarki-tip">${etiket}</span><b>${esc(ad)}</b>${alt ? `<span class="meta">${alt}</span>` : ''}</span>`
    + `<span class="xray-spotify">${SPOTIFY_IKON}<span>${sp.parca ? 'Dinle' : 'Ara'}</span></span></a></li>`;
}

export { animeBul, veriYukle, seslendirmenYukle, avatar, basHarfler, seslendirmenHref, sarkiKartHtml, EKOLAYZIR, SPOTIFY_IKON };
