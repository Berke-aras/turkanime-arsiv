// Reklamsız oynatma için link çözme: sağlayıcının embed linkinden doğrudan video linkini, küçük yardımcı
// fonksiyon (api/sibnet.js, cf/uqload) üzerinden alır. Oynatmadan ayrı tutuldu (player-video.js) ki
// önceden çözme (düğmenin üstüne gelince, sonraki bölüm) aynı yolu kullanabilsin ve Node'da test edilebilsin.
//
// Neden önbellek: Sibnet yoğunlukta 403 veriyor ve bütün ziyaretçilerin istekleri aynı sunucudan gidiyor.
// Aynı bölüm için bir kez çözülen link (imzası saatlerce geçerli) tekrar sorulmadıkça hem hız sınırına
// daha az takılıyoruz hem de açılış anında oluyor.
import { readLS, writeLS } from './util.js';

const ANAHTAR = 'ta_cozum';
const EN_COK = 60;                     // saklanan en fazla link
const PAY = 10 * 60 * 1000;            // linkin bitmesine 10 dk'dan az kaldıysa kullanma
const E_YOKSA = 25 * 60 * 1000;        // linkte e= yoksa varsayılan ömür
// 503/429 (sağlayıcı yoğun) ve ağ hatası geçici: bu aralıklarla tekrar deneniyor. 404 (video silinmiş) ve
// diğer hatalar kalıcı, beklemeden vazgeçiliyor.
const TEKRAR = [1200, 3000, 5000];

const cozumAnahtari = (player, params) => `${player}:${params}`;
const GECICI = hata => hata === 503 || hata === 429 || hata === 0;

// Linkteki e= (unix saniye) imzanın bitişi. Sibnet de Uqload da bunu taşıyor.
function linkBitisi(url) {
  try { const e = Number(new URL(url).searchParams.get('e')); return e > 1e9 ? e * 1000 : 0; }
  catch (e) { return 0; }
}

function onbellekOku(anahtar, simdi = Date.now()) {
  const k = (readLS(ANAHTAR, {}) || {})[anahtar];
  return k && k.son - simdi > PAY ? k.veri : null;
}
function onbellegeYaz(anahtar, veri, simdi = Date.now()) {
  const tum = readLS(ANAHTAR, {}) || {};
  tum[anahtar] = { veri, son: linkBitisi(veri.url) || simdi + E_YOKSA };
  // süresi geçenleri at, sonra en yakında bitecekleri atarak sınırın altına in
  const girdiler = Object.entries(tum).filter(([, v]) => v && v.son - simdi > PAY).sort((a, b) => b[1].son - a[1].son).slice(0, EN_COK);
  writeLS(ANAHTAR, Object.fromEntries(girdiler));
}
function onbellektenSil(anahtar) {
  const tum = readLS(ANAHTAR, {}) || {};
  if (tum[anahtar]) { delete tum[anahtar]; writeLS(ANAHTAR, tum); }
}

const bekle = ms => new Promise(r => setTimeout(r, ms));
const ucusta = new Map(); // aynı link için eşzamanlı istekler tek istekte birleşiyor

// -> { veri: {url, hls?}, onbellekten } | { hata: HTTP durumu | 0 (ağ) | 'iptal' }
// bildir(deneme, toplam): tekrar denemeden önce çağrılıyor (oynatıcı "yoğun, tekrar deneniyor" yazıyor).
async function cozumle(provider, player, params, { istenmeye = () => true, bildir = () => {}, tekrar = TEKRAR, fetchFn = fetch } = {}) {
  const anahtar = cozumAnahtari(player, params);
  const eldeki = onbellekOku(anahtar);
  if (eldeki) return { veri: eldeki, onbellekten: true };
  if (ucusta.has(anahtar)) {
    // Uçuştaki istek (çoğunlukla tek denemelik önceden çözme) başarılıysa ya da kalıcı bir hatayla (404)
    // bittiyse sonucu paylaşılıyor. Geçici bir hatayla (yoğun/ağ) bittiyse bu çağrı kendi tekrar
    // denemelerini yapıyor; yoksa düğmenin üstüne gelip hemen tıklayan biri, sağlayıcı yoğunken hiç
    // beklemeden reklamlı oynatıcıya düşüyordu.
    const onceki = await ucusta.get(anahtar);
    if (onceki.veri || !istenmeye() || !GECICI(onceki.hata)) return onceki;
  }
  const is = (async () => {
    let sonHata = 0;
    for (let i = 0; i <= tekrar.length; i++) {
      if (i) {
        bildir(i, tekrar.length);
        await bekle(tekrar[i - 1]);
        if (!istenmeye()) return { hata: 'iptal' };
      }
      let r;
      try { r = await fetchFn(`${provider.resolver}?${params}`); }
      catch (e) { sonHata = 0; continue; }           // ağ hatası: geçici say
      if (r.ok) {
        const veri = await r.json().catch(() => null);
        if (!veri || !veri.url) return { hata: 502 };
        onbellegeYaz(anahtar, veri);
        return { veri, onbellekten: false };
      }
      sonHata = r.status;
      if (!GECICI(r.status)) return { hata: r.status };
    }
    return { hata: sonHata };
  })();
  ucusta.set(anahtar, is);
  try { return await is; } finally { if (ucusta.get(anahtar) === is) ucusta.delete(anahtar); }
}

// Önceden çözme: sessiz, tek deneme; sonuç önbelleğe düşüyor, oynatma anında hazır oluyor.
function onceCozumle(provider, player, params) {
  if (!provider || !params) return;
  const anahtar = cozumAnahtari(player, params);
  if (onbellekOku(anahtar) || ucusta.has(anahtar)) return;
  cozumle(provider, player, params, { tekrar: [] }).catch(() => {});
}

export { cozumle, onceCozumle, cozumAnahtari, onbellektenSil, linkBitisi, onbellekOku, onbellegeYaz, TEKRAR };
