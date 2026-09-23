// Anında arama önerileri: arama kutusuna yazarken kapaklı küçük bir liste açılıyor. Animeler anında
// geliyor; karakter ve seslendirmen adları (kaynak/ara/<harf>.json, bkz. scripts/build-ara.js) yazılan
// harfin parçası indirilince ekleniyor. "Levi" -> Shingeki no Kyojin, "Kenji Nojima" -> seslendirmen sayfası.
// Klavye: ↓/↑ gezinir, Enter seçileni açar, Esc listeyi kapatır (ikinci Esc kutudan çıkar, main.js).
import { esc, norm } from './util.js';
import { searchEl } from './dom.js';
import { ANIME, posterUrl } from './data.js';
import { animeOnerileri, karakterOnerileri, seslendirmenOnerileri } from './eslesme.js';
import { araHarf } from './xray-veri.js';
import { seslendirmenHref } from './xray-yukle.js';
import { isListHash } from './state.js';

// --- tarayıcı kısmı ---
const parcaCache = new Map();
function parcaYukle(harf) {
  if (!parcaCache.has(harf)) {
    parcaCache.set(harf, fetch(`kaynak/ara/${harf}.json`).then(r => r.ok ? r.json() : { k: [], s: [] })
      .catch(() => { parcaCache.delete(harf); return { k: [], s: [] }; }));
  }
  return parcaCache.get(harf);
}
// INDEX sırası (kaynak/ara'daki numaralar) -> anime kaydı
let ixHarita = null;
const slugBul = ix => {
  if (!ixHarita) {
    const slugIx = new Map(ANIME.map(a => [a.slug, a]));
    ixHarita = (globalThis.INDEX || []).map(r => slugIx.get(r[0]));
  }
  return ixHarita[ix] || null;
};

let liste = null, secili = -1, token = 0, zamanlayici = 0;
function kur() {
  if (liste || !searchEl) return;
  liste = document.createElement('div');
  liste.id = 'arama-oneri';
  liste.className = 'arama-oneri';
  liste.setAttribute('role', 'listbox');
  liste.setAttribute('aria-label', 'Arama önerileri');
  liste.hidden = true;
  searchEl.parentElement.appendChild(liste);
  searchEl.setAttribute('role', 'combobox');
  searchEl.setAttribute('aria-autocomplete', 'list');
  searchEl.setAttribute('aria-controls', 'arama-oneri');
  searchEl.setAttribute('aria-expanded', 'false');
  // mousedown: blur'dan önce geliyor, tıklanan öğe liste kapanmadan açılabiliyor
  liste.addEventListener('mousedown', e => e.preventDefault());
  liste.addEventListener('click', e => { if (e.target.closest('a')) kapat(); });
}

const secenekler = () => liste ? [...liste.querySelectorAll('[role="option"]')] : [];
function sec(i) {
  const s = secenekler();
  if (!s.length) return;
  secili = (i + s.length) % s.length;
  s.forEach((el, j) => el.setAttribute('aria-selected', String(j === secili)));
  searchEl.setAttribute('aria-activedescendant', s[secili].id);
  s[secili].scrollIntoView({ block: 'nearest' });
}
function kapat() {
  if (!liste) return;
  liste.hidden = true;
  secili = -1;
  searchEl.setAttribute('aria-expanded', 'false');
  searchEl.removeAttribute('aria-activedescendant');
}

let sira = 0;
const secenek = (href, ic, ust, alt) => `<a id="ao-${sira++}" role="option" aria-selected="false" class="ao-oge" href="${esc(href)}">${ic}`
  + `<span class="ao-metin"><b>${ust}</b>${alt ? `<span class="meta">${alt}</span>` : ''}</span></a>`;
const kapak = a => { const u = posterUrl(a, 'small'); return u ? `<img class="ao-kapak" src="${esc(u)}" alt="" loading="lazy" decoding="async">` : '<span class="ao-kapak ao-bos" aria-hidden="true"></span>'; };
const animeHref = a => `#/anime/${encodeURIComponent(a.slug)}`;

function ciz(animeler, karakterler, seslendirmenler, bekliyor) {
  sira = 0;
  const bolumler = [];
  if (animeler.length) {
    bolumler.push(`<div class="ao-baslik">Animeler</div>` + animeler.map(a => secenek(animeHref(a), kapak(a), esc(a.baslik),
      [a.yil || '', a.eps ? `${a.eps} bölüm` : '', a.puan ? `★ ${a.puan}` : ''].filter(Boolean).join(' · '))).join(''));
  }
  if (karakterler.length) {
    bolumler.push(`<div class="ao-baslik">Karakterler</div>` + karakterler.map(k => secenek(animeHref(k.a), kapak(k.a), esc(k.ad),
      `${esc(k.a.baslik)}${k.fazla ? ` <span class="ao-fazla">+${k.fazla}</span>` : ''}`)).join(''));
  }
  if (seslendirmenler.length) {
    bolumler.push(`<div class="ao-baslik">Seslendirmenler</div>` + seslendirmenler.map(ad => secenek(seslendirmenHref(ad),
      '<span class="ao-kapak ao-kisi" aria-hidden="true">♪</span>', esc(ad), 'Seslendirmen · arşivdeki rolleri')).join(''));
  }
  if (!bolumler.length && !bekliyor) { kapat(); return; }
  if (bekliyor) bolumler.push('<div class="ao-bekle meta">Karakter ve seslendirmenler aranıyor…</div>');
  liste.innerHTML = bolumler.join('');
  liste.hidden = false;
  searchEl.setAttribute('aria-expanded', 'true');
  secili = -1;
  searchEl.removeAttribute('aria-activedescendant');
}

async function guncelle() {
  kur();
  const q = searchEl.value.trim();
  const t = ++token;
  if (norm(q).length < 2) { kapat(); return; }
  const kelimeler = norm(q).split(' ').filter(Boolean);
  const animeler = animeOnerileri(q, ANIME);
  const harf = araHarf(kelimeler[0]);
  const hazir = parcaCache.has(harf);
  ciz(animeler, [], [], !hazir);
  const parca = await parcaYukle(harf);
  if (t !== token || document.activeElement !== searchEl) return;
  ciz(animeler, karakterOnerileri(parca, kelimeler, slugBul), seslendirmenOnerileri(parca, kelimeler), false);
}

function baslat() {
  if (!searchEl) return;
  kur();
  searchEl.addEventListener('input', () => { clearTimeout(zamanlayici); zamanlayici = setTimeout(guncelle, 80); });
  searchEl.addEventListener('focus', () => { if (searchEl.value.trim().length >= 2) guncelle(); });
  searchEl.addEventListener('blur', () => setTimeout(kapat, 120));
  searchEl.addEventListener('keydown', e => {
    if (!liste || liste.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sec(secili + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sec(secili - 1); }
    else if (e.key === 'Enter' && secili >= 0) {
      e.preventDefault();
      const a = secenekler()[secili];
      kapat();
      searchEl.blur();
      location.hash = a.getAttribute('href');
    } else if (e.key === 'Escape') {
      // yalnız listeyi kapat; kutudan çıkmak için ikinci Esc (main.js)
      e.stopPropagation();
      kapat();
    }
  });
  // Detay sayfasında yazmaya başlayınca site listeye geçiyor (main.js); o geçişte liste açık kalmalı.
  window.addEventListener('hashchange', () => { if (!isListHash(location.hash)) kapat(); });
}

export { baslat };
