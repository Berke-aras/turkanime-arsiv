// Arama eşleştirmesinin saf çekirdeği: arama anahtarı üretimi ve bir animenin sorguya
// ne kadar uyduğunu söyleyen puanlama. DOM'a, localStorage'a ve uygulama durumuna
// dokunmaz — bu yüzden Node'da doğrudan birim testi yazılabiliyor (test/eslesme.test.mjs).
import { norm, levenshtein } from './util.js';

// Arama anahtarı yalnız arama yapılırken gerekiyor; açılışta 6107 kez norm() + split()
// çalıştırmak ilk boyamanın önünde duruyordu (§2.2 ölçümü: 17.3 ms). Bu yüzden ilk
// kullanımda üretilip kaydın üstünde saklanıyor.
// `n`  : norm edilmiş "başlık + slug" (ucuz `includes` eleme için)
// `tok`: aynı dizenin kelimeleri (yalnız bulanık/Levenshtein taramasında gerekiyor)
function aramaAnahtari(a) {
  if (a.n === undefined) a.n = norm(a.baslik + ' ' + a.slug);
  return a.n;
}
function aramaKelimeleri(a) {
  if (a.tok === undefined) a.tok = aramaAnahtari(a).split(' ').filter(Boolean);
  return a.tok;
}

// Her sorgu kelimesi anime'nin bir kelimesine ~%35 hata payıyla uymalı (AND).
// Dönen değer: 0 = tam isabet, büyüdükçe uzak; `null` = hiç uymuyor (elenir).
function matchScore(queryTokens, a) {
  if (!queryTokens.length) return 0;
  let score = 0;
  for (const qt of queryTokens) {
    if (aramaAnahtari(a).includes(qt)) continue;
    const threshold = Math.max(1, Math.ceil(qt.length / 3));
    let best = Infinity;
    for (const tok of aramaKelimeleri(a)) {
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

export { aramaAnahtari, aramaKelimeleri, matchScore };
