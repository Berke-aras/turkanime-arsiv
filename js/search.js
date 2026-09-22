// Arama ve filtreleme. Liste durumu (state) ayrı modülde; burada sadece saf eleme/sıralama var.
import { norm, levenshtein } from './util.js';
import { ANIME } from './data.js';
import { isFav } from './store.js';
import { state } from './state.js';

// Her sorgu kelimesi anime'nin bir kelimesine ~%35 hata payıyla uymalı (AND).
function matchScore(queryTokens, a) {
  if (!queryTokens.length) return 0;
  let score = 0;
  for (const qt of queryTokens) {
    if (a.n.includes(qt)) continue;
    const threshold = Math.max(1, Math.ceil(qt.length / 3));
    let best = Infinity;
    for (const tok of a.tok) {
      if (Math.abs(tok.length - qt.length) > threshold) continue;
      const d = levenshtein(qt, tok);
      if (d < best) best = d;
      if (best === 0) break;
    }
    if (best > threshold) return null;
    score += best;
  }
  return score;
}

function filterAndSort() {
  const qTokens = norm(state.query).split(' ').filter(Boolean);
  let list = ANIME;
  if (state.favOnly) list = list.filter(a => isFav(a.slug));
  if (state.kategori) list = list.filter(a => a.kategori === state.kategori);
  if (state.tur) list = list.filter(a => a.tur.includes(state.tur));

  const scored = qTokens.length
    ? list.map(a => ({ a, score: matchScore(qTokens, a) })).filter(x => x.score !== null)
    : list.map(a => ({ a, score: 0 }));

  scored.sort((x, y) => {
    if (qTokens.length && x.score !== y.score) return x.score - y.score;
    if (state.sort === 'puan') return (y.a.puan - x.a.puan) || x.a.baslik.localeCompare(y.a.baslik, 'tr');
    if (state.sort === 'eps') return (y.a.eps - x.a.eps) || x.a.baslik.localeCompare(y.a.baslik, 'tr');
    return x.a.baslik.localeCompare(y.a.baslik, 'tr');
  });
  return scored.map(x => x.a);
}


// Filtre uygulanmışsa rastgele seçim o havuzdan yapılır; havuz boşsa tüm arşive düşer.
export function pickRandomAnime() {
  const filtered = filterAndSort();
  const pool = filtered.length ? filtered : ANIME;
  if (!pool.length) return;
  location.hash = '#/anime/' + pool[Math.floor(Math.random() * pool.length)].slug;
}

export { matchScore, filterAndSort };
