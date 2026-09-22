// Saf yardımcılar: DOM'a ve uygulama durumuna dokunmuyorlar, bu yüzden doğrudan birim testi
// yazılabilir (bkz. test/util.test.js). Yeni saf yardımcılar da buraya.

const TR_MAP = {'ı':'i','İ':'i','I':'i','ş':'s','Ş':'s','ğ':'g','Ğ':'g','ü':'u','Ü':'u','ö':'o','Ö':'o','ç':'c','Ç':'c'};
function norm(s){
  let t = '';
  for (const ch of String(s)) t += TR_MAP[ch] || ch;
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const IS_TR = (navigator.languages || [navigator.language || 'tr']).some(l => /^tr\b/i.test(l));
const ic = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// Levenshtein mesafesi: yazım hatalarına toleranslı arama için.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

function readLS(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function writeLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* localStorage yoksa sessiz geç */ } }

function initials(title) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function hue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

// html'de scroll-behavior:smooth var; rota geçişlerinde sayfanın animasyonla kayması yerine
// anında yerine oturması gerekiyor (eski ve yeni sayfa arasında görünür bir kayma olmasın).
export function jumpTo(y) {
  const el = document.documentElement;
  const onceki = el.style.scrollBehavior;
  el.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  el.style.scrollBehavior = onceki;
}

export { TR_MAP, norm, esc, IS_TR, ic, levenshtein, readLS, writeLS, initials, hue };
