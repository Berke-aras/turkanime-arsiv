// Tema: sistem / açık / koyu. Seçim <html data-theme> ile uygulanır, localStorage'da saklanır.
// Renkler style.css'teki token'lardan geliyor; burada yalnız hangi setin açık olduğu belirleniyor.
import { readLS, writeLS } from './util.js';
import { ic } from './util.js';

const SIRA = ['sistem', 'acik', 'koyu'];
const ETIKET = { sistem: 'Tema: sistem', acik: 'Tema: açık', koyu: 'Tema: koyu' };
const IKON = { sistem: 'monitor', acik: 'sun', koyu: 'moon' };
// Adres çubuğu/işletim sistemi çubuğu rengi; style.css'teki --bg değerleriyle aynı kalmalı.
const TEMA_RENGI = { koyu: '#0a0c11', acik: '#f6f7fb' };

const kokEl = document.documentElement;
const sistemKoyu = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

let tema = SIRA.includes(readLS('ta_tema', 'sistem')) ? readLS('ta_tema', 'sistem') : 'sistem';

// Seçim "sistem" ise data-theme hiç yazılmaz; CSS'teki @media kuralı devreye girer.
const etkinTema = () => tema === 'sistem' ? (sistemKoyu && sistemKoyu.matches ? 'koyu' : 'acik') : tema;

function uygula() {
  if (tema === 'sistem') kokEl.removeAttribute('data-theme');
  else kokEl.setAttribute('data-theme', tema === 'acik' ? 'light' : 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', TEMA_RENGI[etkinTema()]);
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.innerHTML = ic(IKON[tema]);
    btn.title = btn.ariaLabel = `${ETIKET[tema]} (değiştirmek için tıkla)`;
  }
}

export function initTheme() {
  const btn = document.getElementById('theme-btn');
  if (btn) btn.addEventListener('click', () => {
    tema = SIRA[(SIRA.indexOf(tema) + 1) % SIRA.length];
    writeLS('ta_tema', tema);
    uygula();
  });
  // "sistem" seçiliyken kullanıcı işletim sistemi temasını değiştirirse theme-color de dönsün
  if (sistemKoyu && sistemKoyu.addEventListener) sistemKoyu.addEventListener('change', () => { if (tema === 'sistem') uygula(); });
  uygula();
}
