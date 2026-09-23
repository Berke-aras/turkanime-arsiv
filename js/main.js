// Giriş noktası: modülleri bağlar, global dinleyicileri kurar ve ilk rotayı çizer.
import { IS_TR } from './util.js';
import { searchEl } from './dom.js';
import { isListHash, listHash, syncListHash, state, saveListScroll, writeListScroll,
  scrollSaveTimerSifirla } from './state.js';
import { pickRandomAnime } from './search.js';
import { renderList } from './views/list.js';
import { route } from './router.js';
import { initTheme } from './theme.js';
import { baslat as aramaOnerileriBaslat } from './arama-oneri.js';

initTheme();
aramaOnerileriBaslat();

let t;
searchEl.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => {
    state.query = searchEl.value;
    state.page = 1;
    // detay ya da yasal sayfasındayken yazılırsa listeye dön; hash değişimi route() -> renderList() tetikler
    if (!isListHash(location.hash)) location.hash = listHash();
    else { syncListHash(); renderList(); }
  }, 150);
});

document.getElementById('random-btn').addEventListener('click', pickRandomAnime);

// §7.5: "/" arama kutusuna odaklanır, Esc odaktan çıkarır. Bir alana yazarken ya da
// oynatıcı modalı açıkken devreye girmiyor (modal kendi kısayollarını kullanıyor).
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const hedef = e.target;
  const yaziyor = hedef && (hedef.tagName === 'INPUT' || hedef.tagName === 'TEXTAREA' || hedef.tagName === 'SELECT' || hedef.isContentEditable);
  const modalAcik = !document.getElementById('player-modal').hidden;
  if (e.key === '/' && !yaziyor && !modalAcik) {
    e.preventDefault();
    searchEl.focus();
    searchEl.select();
  } else if (e.key === 'Escape' && hedef === searchEl) {
    searchEl.blur();
  }
});

if (!IS_TR) {
  const nav = document.getElementById('legal-link');
  nav.querySelector('span').textContent = 'Privacy & Legal';
  nav.title = nav.ariaLabel = 'Privacy & Legal';
  document.getElementById('footer-legal').textContent = 'Privacy & Legal Notice';
}

// route()'tan ÖNCE kayıt: bu noktada sayfa hâlâ listenin konumunda duruyor.
window.addEventListener('hashchange', e => {
  const eski = e.oldURL ? e.oldURL.slice(e.oldURL.indexOf('#')) : '';
  if (isListHash(eski) && eski !== location.hash) {
    scrollSaveTimerSifirla();
    writeListScroll(eski || '#/');
  }
});

window.addEventListener('hashchange', route);

const topBtn = document.getElementById('top-btn');
window.addEventListener('scroll', () => {
  topBtn.classList.toggle('show', window.scrollY > 500);
  saveListScroll();
}, { passive: true });

topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

route();
