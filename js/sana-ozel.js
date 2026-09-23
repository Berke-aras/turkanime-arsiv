// "Sana özel" şeridi: favorilerindeki ve izlediklerindeki animelerin türlerine ve ortak seslendirmenlerine
// göre öneriler. Ortak seslendirmen verisi derleme anında hazırlanıyor (kaynak/oneri.json, bkz.
// scripts/build-ara.js); yüklenmeden önce yalnız türlere göre hesaplanıyor, yüklenince şerit tazeleniyor.
// Hesaplama saf (DOM yok): test/sana-ozel.test.mjs.

// Seri anahtarı: slug'ın ilk kelimesi; kısaysa (one-piece, k-on) ilk iki kelimesi. "naruto" ile
// "naruto-shippuuden" aynı seri sayılıyor. Eşi: scripts/build-ara.js seriAnahtari.
const kok = slug => { const p = slug.split('-'); return p[0].length >= 5 ? p[0] : p.slice(0, 2).join('-'); };
// Aynı seri: anahtarlar aynı ya da birinin anahtarı ötekinde tam kelime olarak geçiyor
// ("the-last-naruto-the-movie" ve "boruto-naruto-next-generations" -> "naruto").
const ayniSeri = (a, b) => kok(a) === kok(b) || `-${b}-`.includes(`-${kok(a)}-`) || `-${a}-`.includes(`-${kok(b)}-`);

// tohumlar: [{ slug, w }]   oneriler: slug -> [slug...] (ortak seslendirmen, en benzer önce) | null
function sanaOzel(ANIME, tohumlar, oneriler = null, n = 12) {
  const bySlug = new Map(ANIME.map(a => [a.slug, a]));
  const tohum = tohumlar.map(t => ({ ...t, a: bySlug.get(t.slug) })).filter(t => t.a);
  if (!tohum.length) return [];
  const disla = new Set(tohum.map(t => t.a.slug));

  // tür profili: tohumların ağırlıklı tür sayımı, en sık türe göre 0–1
  const profil = new Map();
  for (const t of tohum) for (const g of t.a.tur) profil.set(g, (profil.get(g) || 0) + t.w);
  const enCok = Math.max(1, ...profil.values());

  // ortak seslendirmen puanı: bir tohumun öneri listesinde üst sırada olmak daha değerli
  const ses = new Map();
  if (oneriler) {
    for (const t of tohum) {
      (oneriler.get(t.a.slug) || []).forEach((s, r) => ses.set(s, (ses.get(s) || 0) + t.w * (1 - r / 10)));
    }
  }
  const sesEnCok = Math.max(1, ...ses.values());

  const puanli = [];
  for (const a of ANIME) {
    if (disla.has(a.slug) || a.nsfw || !a.eps || tohum.some(t => ayniSeri(t.a.slug, a.slug))) continue;
    const tur = a.tur.reduce((s, g) => s + (profil.get(g) || 0), 0) / enCok / Math.sqrt(Math.max(1, a.tur.length));
    const s = (ses.get(a.slug) || 0) / sesEnCok;
    if (!tur && !s) continue;
    puanli.push({ a, p: 0.55 * tur + 0.3 * s + 0.15 * ((a.puan || 0) / 10) });
  }
  puanli.sort((x, y) => y.p - x.p);
  // aynı seriden tek temsilci: şerit aynı serinin sezonlarıyla dolmasın
  const secilen = [];
  for (const { a } of puanli) {
    if (secilen.some(s => ayniSeri(s.slug, a.slug))) continue;
    secilen.push(a);
    if (secilen.length >= n) break;
  }
  return secilen;
}

// kaynak/oneri.json -> slug haritası. Numaralar kaynak/data.js INDEX sırası.
let oneriSozu = null;
function onerileriYukle(INDEX = globalThis.INDEX || []) {
  if (!oneriSozu) {
    oneriSozu = fetch('kaynak/oneri.json').then(r => r.ok ? r.json() : null).then(j => {
      if (!j || j.n !== INDEX.length) return null; // dizin bayat (data.js değişmiş, build-ara çalışmamış)
      const m = new Map();
      for (const [i, liste] of Object.entries(j.o)) m.set(INDEX[i][0], liste.map(b => INDEX[b][0]));
      return m;
    }).catch(() => { oneriSozu = null; return null; });
  }
  return oneriSozu;
}

export { sanaOzel, onerileriYukle };
