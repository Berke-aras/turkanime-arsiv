// Bilgi paneli (X-Ray) verisinin DOM'suz yardımcıları: kimlik çıkarma, görsel URL'leri, hangi OP/ED
// bu bölümde çalıyor, video şu an hangi aralıkta. Oynatıcıya bağlı kısım js/xray.js'te; burası Node'da
// da import edilebiliyor (test/xray.test.mjs).
//
// kaynak/x/<slug>.json biçimi (bkz. scripts/build-xray.js):
//   { id, mal?, k?: [[karakter, karakterGörseli, rol A|Y|F, seslendirmen, seslendirmenGörseli]...],
//     m?: [[OP|ED, sıra, şarkı, sanatçı, bölümler|null]...] }

// Tarayıcı tarafındaki eş: scripts/xray-ortak.js. İkisi birlikte değişmeli.
const anilistId = ad => {
  const m = /^(?:bx|b|nx|n)?(\d+)[-.]/.exec(ad || '');
  return m ? Number(m[1]) : null;
};
const KARAKTER_ONEK = 'https://s4.anilist.co/file/anilistcdn/character/medium/';
const KISI_ONEK = 'https://s4.anilist.co/file/anilistcdn/staff/medium/';
const gorselAc = (ad, onek) => !ad ? '' : (/^https?:\/\//i.test(ad) ? ad : onek + ad);

// AnimeThemes bölüm aralığı: "1-11", "2-3, 5, 7, 9-11", "25-" (25 ve sonrası). Sayı olmayan
// parçalar ("OVA") yok sayılıyor.
function bolumdeMi(aralik, no) {
  if (!aralik || !no) return false;
  for (const m of String(aralik).matchAll(/(\d+)\s*(?:-\s*(\d*))?/g)) {
    const bas = Number(m[1]);
    const son = m[2] === undefined ? bas : (m[2] === '' ? Infinity : Number(m[2]));
    if (no >= bas && no <= son) return true;
  }
  return false;
}

// Bu bölümde çalan opening (ya da ending). Emin olunamıyorsa null: aynı bölüme iki şarkı düşüyorsa ya da
// serinin birden çok şarkısı olup hangi bölümde çaldığı bilinmiyorsa yanlış şarkı göstermektense hiç
// göstermiyoruz.
function bolumTemasi(temalar, tip, no) {
  const liste = (temalar || []).filter(t => t[0] === tip);
  const acik = liste.filter(t => t[4] && bolumdeMi(t[4], no));
  if (acik.length) return acik.length === 1 ? acik[0] : null;
  return liste.length === 1 && !liste[0][4] ? liste[0] : null;
}

// AniSkip cevabı -> [{ tip: 'op'|'ed', bas, son }]
function atlamaAraliklari(json) {
  if (!json || !json.found || !Array.isArray(json.results)) return [];
  return json.results
    .filter(r => (r.skipType === 'op' || r.skipType === 'ed') && r.interval)
    .map(r => ({ tip: r.skipType, bas: Number(r.interval.startTime), son: Number(r.interval.endTime) }))
    .filter(a => isFinite(a.bas) && isFinite(a.son) && a.son > a.bas);
}
const aralikBul = (araliklar, t) => araliklar.find(a => t >= a.bas && t < a.son) || null;

export { anilistId, KARAKTER_ONEK, KISI_ONEK, gorselAc, bolumdeMi, bolumTemasi, atlamaAraliklari, aralikBul };
