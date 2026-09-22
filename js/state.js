// Liste görünümünün durumu ve onu adres çubuğunda taşıyan hash biçimi.
import { jumpTo } from './util.js';
import { searchEl } from './dom.js';

const PAGE_SIZE = 60;

const state = { query: '', page: 1, kategori: '', tur: '', onyil: 0, sort: 'isim', favOnly: false };

// Liste görünümünün tamamı hash'te taşınır: #/?q=naruto&kategori=TV&tur=Aksiyon&onyil=2010&sort=puan&fav=1&sayfa=3
// Böylece filtrelenmiş bir görünüm paylaşılabilir, yenilemede ve geri tuşunda kaybolmaz.
const isListHash = h => !h || h === '#' || h === '#/' || h.startsWith('#/?');

function listHash() {
  const p = new URLSearchParams();
  if (state.query) p.set('q', state.query);
  if (state.kategori) p.set('kategori', state.kategori);
  if (state.tur) p.set('tur', state.tur);
  if (state.onyil) p.set('onyil', String(state.onyil));
  if (state.sort !== 'isim') p.set('sort', state.sort);
  if (state.favOnly) p.set('fav', '1');
  if (state.page > 1) p.set('sayfa', String(state.page));
  const qs = p.toString();
  return qs ? `#/?${qs}` : '#/';
}

function parseListHash(hash) {
  const qs = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '');
  state.query = qs.get('q') || '';
  state.kategori = qs.get('kategori') || '';
  state.tur = qs.get('tur') || '';
  state.onyil = Number(qs.get('onyil')) || 0;
  state.sort = ['isim', 'puan', 'eps', 'yeni', 'eski'].includes(qs.get('sort')) ? qs.get('sort') : 'isim';
  state.favOnly = qs.get('fav') === '1';
  state.page = Math.max(1, Number(qs.get('sayfa')) || 1);
  if (searchEl.value !== state.query) searchEl.value = state.query;
}

// filtre değişiminde her tuş vuruşu için yeni geçmiş girdisi açma; sadece adresi tazele
function syncListHash() {
  const h = listHash();
  if (location.hash !== h) history.replaceState(history.state, '', h);
}

// Listeden detaya geçerken kaydırma konumunu sakla, geri dönünce aynı yere koy.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const SCROLL_KEY = 'ta_list_scroll';

function writeListScroll(hash) {
  try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ h: hash, y: window.scrollY })); } catch (e) { /* kota/gizli mod */ }
}

// Kaydırma sırasında kısıtlı yazım: sayfa yenilenirse konum kaybolmasın diye.
let scrollSaveTimer = 0;
function saveListScroll() {
  if (!isListHash(location.hash) || scrollSaveTimer) return;
  scrollSaveTimer = setTimeout(() => {
    scrollSaveTimer = 0;
    if (isListHash(location.hash)) writeListScroll(location.hash);
  }, 120);
}

function restoreListScroll() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || 'null'); } catch (e) { /* yok say */ }
  const y = saved && saved.h === location.hash ? saved.y : 0;
  requestAnimationFrame(() => jumpTo(y));
}


// hashchange'te kısıtlı yazım iptal edilip kesin konum yazılıyor (bkz. main.js).
export function scrollSaveTimerSifirla() { clearTimeout(scrollSaveTimer); scrollSaveTimer = 0; }

export { PAGE_SIZE, state, isListHash, listHash, parseListHash, syncListHash,
  writeListScroll, saveListScroll, restoreListScroll };
