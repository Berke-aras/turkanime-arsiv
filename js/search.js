// Arama ve filtreleme. Liste durumu (state) ayrı modülde; burada sadece saf eleme/sıralama var.
import { norm } from './util.js';
import { ANIME, TR_SIRA } from './data.js';
import { aramaAnahtari, matchScore } from './eslesme.js';
import { isFav } from './store.js';
import { state } from './state.js';

function filterAndSort() {
  const qTokens = norm(state.query).split(' ').filter(Boolean);
  let list = ANIME;
  if (state.favOnly) list = list.filter(a => isFav(a.slug));
  if (state.kategori) list = list.filter(a => a.kategori === state.kategori);
  if (state.tur) list = list.filter(a => a.tur.includes(state.tur));
  if (state.onyil) list = list.filter(a => a.yil >= state.onyil && a.yil < state.onyil + 10);

  // §2.3: önce ucuz eleme. Sorgunun her kelimesi arama anahtarında aynen geçiyorsa
  // Levenshtein'e hiç girilmiyor — yazım hatası olmayan (yani olağan) aramada tam tarama yok.
  // Tam eşleşme bulunduğunda bulanık tarama atlanıyor: "naruto" artık "boruto"yu getirmiyor.
  let scored;
  let bulanik = false;
  if (qTokens.length) {
    const tam = list.filter(a => { const n = aramaAnahtari(a); return qTokens.every(qt => n.includes(qt)); });
    if (tam.length) {
      scored = tam.map(a => ({ a, score: 0 }));
    } else {
      bulanik = true;
      scored = list.map(a => ({ a, score: matchScore(qTokens, a) })).filter(x => x.score !== null);
    }
  } else {
    scored = list.map(a => ({ a, score: 0 }));
  }

  // ANIME kuruluşta başlığa göre sıralı ve filtreler sırayı bozmuyor; isim sıralamasında
  // (varsayılan) ve puanların eşit olduğu durumda tekrar sıralamak boşa iş.
  const sirasiHazir = state.sort === 'isim' && !bulanik;
  if (!sirasiHazir) {
    scored.sort((x, y) => {
      if (bulanik && x.score !== y.score) return x.score - y.score;
      const ad = () => TR_SIRA.compare(x.a.baslik, y.a.baslik);
      if (state.sort === 'puan') return (y.a.puan - x.a.puan) || ad();
      if (state.sort === 'eps') return (y.a.eps - x.a.eps) || ad();
      // yılı bilinmeyenler (0) her iki yönde de sona
      if (state.sort === 'yeni') return (y.a.yil - x.a.yil) || ad();
      if (state.sort === 'eski') return ((x.a.yil || 9999) - (y.a.yil || 9999)) || ad();
      return ad();
    });
  }
  return scored.map(x => x.a);
}


// Filtre uygulanmışsa rastgele seçim o havuzdan yapılır; havuz boşsa tüm arşive düşer.
export function pickRandomAnime() {
  const filtered = filterAndSort();
  const pool = filtered.length ? filtered : ANIME;
  if (!pool.length) return;
  location.hash = '#/anime/' + pool[Math.floor(Math.random() * pool.length)].slug;
}

// matchScore js/eslesme.js'te; eski çağıranlar bozulmasın diye buradan da veriliyor.
export { matchScore, filterAndSort };
