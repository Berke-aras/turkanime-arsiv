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
// Bir çözümlemenin toplam süre sınırı: her çözücü engelliyken tek istek sunucuda ~8 sn sürüyor (kendi
// tekrarlarıyla); iki çözücü × 4 tur izleyiciyi bir dakikadan fazla bekletirdi. Bu süre geçtiyse yeni tur
// başlamıyor, reklamlı oynatıcıya düşülüyor.
const BUTCE = 25 * 1000;

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

// Birden çok çözücü (links.js'te resolver bir dizi olabilir): Sibnet hız sınırını kaynak IP'ye göre
// uyguluyor, bu yüzden aynı kodu ayrı IP havuzlarında (Vercel, Netlify) çalıştırıp yükü bölüyoruz.
//  - Başlangıç çözücüsü video numarasından seçiliyor: yük eşit dağılıyor ve aynı bölümü açan herkes aynı
//    çözücüye gidip onun CDN önbelleğinden yararlanıyor.
//  - Biri yoğun (503/429) ya da erişilemezse beklemeden sıradakine geçiliyor; hepsi yoğunsa TEKRAR
//    aralıklarıyla yeni tur. Yoğun çıkan çözücü YOGUN_MS boyunca sıranın sonuna konuyor ki
//    sonraki bölümler de onu boşuna denemesin.
const YOGUN_MS = 60 * 1000;
const yogunluk = new Map(); // çözücü adresi -> ne zamana kadar yoğun sayılıyor
function cozucuSirasi(provider, params, simdi = Date.now()) {
  const liste = [].concat(provider.resolver || []);
  if (liste.length < 2) return liste;
  let h = 0;
  for (const c of String(params)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bas = h % liste.length;
  const sirali = liste.slice(bas).concat(liste.slice(0, bas));
  const yogun = u => (yogunluk.get(u) || 0) > simdi;
  return sirali.filter(u => !yogun(u)).concat(sirali.filter(yogun));
}
const yogunIsaretle = (u, simdi = Date.now()) => yogunluk.set(u, simdi + YOGUN_MS);
// 404 (video silinmiş) ve 400 (bozuk numara) her çözücüde aynı: başkasına sormanın anlamı yok.
const KESIN = hata => hata === 404 || hata === 400;

// -> { veri: {url, hls?}, onbellekten } | { hata: HTTP durumu | 0 (ağ) | 'iptal' }
// bildir(deneme, toplam): tekrar denemeden önce çağrılıyor (oynatıcı "yoğun, tekrar deneniyor" yazıyor).
async function cozumle(provider, player, params, { istenmeye = () => true, bildir = () => {}, tekrar = TEKRAR, fetchFn = fetch, butce = BUTCE } = {}) {
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
    const bas = Date.now();
    let sonHata = 0, turSure = 0;
    for (let i = 0; i <= tekrar.length; i++) {
      if (i) {
        // Yeni tur, bir öncekinin süresi kadar sürecekmiş gibi sınıra sığıyorsa başlıyor: sağlayıcı hızlıca
        // "yoğun" diyorsa tekrarlar sürüyor, çözücüler ancak kendi uzun tekrarlarından sonra pes ediyorsa
        // (Sibnet hepsini engellemiş) bir turdan sonra düşülüyor.
        if (Date.now() - bas + tekrar[i - 1] + turSure > butce) break;
        bildir(i, tekrar.length);
        await bekle(tekrar[i - 1]);
        if (!istenmeye()) return { hata: 'iptal' };
      }
      // Bir tur: her çözücü bir kez. Tur içinde yalnız geçici hata kalırsa (hepsi yoğun) bekleyip yeni tur;
      // hiç geçici hata yoksa (ör. hepsi 502) tekrar denemenin anlamı yok.
      let geciciVar = false;
      const turBas = Date.now();
      for (const cozucu of cozucuSirasi(provider, params)) {
        let r;
        try { r = await fetchFn(`${cozucu}?${params}`); }
        catch (e) { sonHata = 0; geciciVar = true; yogunIsaretle(cozucu); continue; }   // ağ hatası: geçici
        if (r.ok) {
          yogunluk.delete(cozucu);
          const veri = await r.json().catch(() => null);
          if (!veri || !veri.url) { sonHata = 502; continue; }
          onbellegeYaz(anahtar, veri);
          return { veri, onbellekten: false };
        }
        sonHata = r.status;
        if (KESIN(r.status)) return { hata: r.status };
        if (GECICI(r.status)) { geciciVar = true; yogunIsaretle(cozucu); }
      }
      if (!geciciVar) return { hata: sonHata };
      turSure = Date.now() - turBas;
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

export { cozumle, onceCozumle, cozucuSirasi, yogunluk, cozumAnahtari, onbellektenSil, linkBitisi, onbellekOku, onbellegeYaz, TEKRAR, BUTCE };
