// §7.3 Favorileri / geçmişi dışa ve içe aktarma.
//
// Tüm kullanıcı verisi localStorage'da duruyor ve tarayıcı verisi temizlenince gidiyor
// (yasal metinde de böyle yazıyor). Burası tek düğmeyle JSON indirme ve geri yükleme:
// sunucu gerekmiyor, gizlilik duruşu bozulmuyor.
//
// Birleştirme mantığı (birlestir) saf tutuldu: DOM'a ve localStorage'a dokunmuyor,
// doğrudan birim testi yazılabiliyor (test/yedek.test.mjs).
import { readLS, writeLS, IS_TR } from './util.js';

const SURUM = 1;
const UYGULAMA = 'turkanime-arsiv';

// Yedeğe giren anahtarlar. Yeni bir tercih eklenirse buraya da eklenmeli.
const ANAHTARLAR = [
  'ta_favs',      // favori slug listesi
  'ta_recent',    // son bakılanlar
  'ta_progress',  // izleme konumu + izlendi işaretleri
  'ta_eprev',     // bölüm listesi ters mi
  'ta_epizgara',  // bölüm listesi ızgara mı
  'ta_tema',      // tema tercihi
  'ta_ses', 'ta_sessiz', 'ta_hiz', // oynatıcı tercihleri
];
// Basit değerler: içe aktarmada olduğu gibi üzerine yazılıyor (kullanıcının açık tercihi).
const TERCIHLER = ['ta_eprev', 'ta_epizgara', 'ta_tema', 'ta_ses', 'ta_sessiz', 'ta_hiz'];
const RECENT_SINIRI = 16;

const dizi = v => (Array.isArray(v) ? v : []);
const nesne = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function yedekOlustur(veri) {
  return { uygulama: UYGULAMA, surum: SURUM, tarih: new Date().toISOString(), veri };
}

function yedekGecerliMi(o) {
  return !!o && typeof o === 'object' && o.uygulama === UYGULAMA && !!o.veri && typeof o.veri === 'object';
}

// İki ilerleme kaydını birleştirir: konum olarak yenisi (u büyük olan) kazanır,
// izlendi işaretleri ise birleşir — hiçbir izleme kaydı kaybolmasın.
function ilerlemeBirlestir(a, b) {
  const yeni = (b.u || 0) >= (a.u || 0) ? b : a;
  const izlendi = [...new Set([...dizi(a.izlendi), ...dizi(b.izlendi)])].sort((x, y) => x - y);
  return { ep: yeni.ep || 0, t: yeni.t || 0, d: yeni.d || 0, u: Math.max(a.u || 0, b.u || 0), izlendi };
}

// mevcut: cihazdaki veri · gelen: dosyadan okunan veri. Üzerine yazmak yerine birleştiriyor.
function birlestir(mevcut, gelen) {
  const m = nesne(mevcut), g = nesne(gelen);
  const veri = {};
  const ozet = { favori: 0, gecmis: 0, ilerleme: 0 };

  const favs = new Set(dizi(m.ta_favs));
  const oncekiFav = favs.size;
  dizi(g.ta_favs).forEach(s => typeof s === 'string' && favs.add(s));
  veri.ta_favs = [...favs];
  ozet.favori = favs.size - oncekiFav;

  // Gelen geçmiş öne alınıyor (yedek alındığı andaki sıra korunsun), sonra cihazdaki.
  const gecmis = [...dizi(g.ta_recent), ...dizi(m.ta_recent)].filter(s => typeof s === 'string');
  veri.ta_recent = [...new Set(gecmis)].slice(0, RECENT_SINIRI);
  ozet.gecmis = veri.ta_recent.filter(s => !dizi(m.ta_recent).includes(s)).length;

  const ilerleme = { ...nesne(m.ta_progress) };
  for (const [slug, kayit] of Object.entries(nesne(g.ta_progress))) {
    if (!kayit || typeof kayit !== 'object') continue;
    ilerleme[slug] = ilerleme[slug] ? ilerlemeBirlestir(ilerleme[slug], kayit) : kayit;
    ozet.ilerleme++;
  }
  veri.ta_progress = ilerleme;

  for (const k of TERCIHLER) {
    if (g[k] !== undefined) veri[k] = g[k];
    else if (m[k] !== undefined) veri[k] = m[k];
  }
  return { veri, ozet };
}

// --- tarayıcı tarafı ---

const yerelOku = () => {
  const veri = {};
  for (const k of ANAHTARLAR) {
    const v = readLS(k, undefined);
    if (v !== undefined) veri[k] = v;
  }
  return veri;
};

function indir() {
  const gun = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(yedekOlustur(yerelOku()), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `turkanime-arsiv-yedek-${gun}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Sekme kapanmadan da sızmasın diye nesne URL'i hemen bırakılıyor.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Dosyayı okur, birleştirip yazar; çağıran taraf sayfayı tazeliyor (bellekteki favori
// kümesi, geçmiş ve ilerleme kayıtları modül seviyesinde tutuluyor).
async function yukle(file) {
  const metin = await file.text();
  let o;
  try { o = JSON.parse(metin); } catch (e) {
    throw new Error(IS_TR ? 'Dosya okunamadı: geçerli bir JSON değil.' : 'Could not read the file: not valid JSON.');
  }
  if (!yedekGecerliMi(o)) {
    throw new Error(IS_TR ? 'Bu dosya bir TürkAnime Arşivi yedeği değil.' : 'This file is not a TürkAnime Arşivi backup.');
  }
  const { veri, ozet } = birlestir(yerelOku(), o.veri);
  for (const [k, v] of Object.entries(veri)) writeLS(k, v);
  return ozet;
}

export { ANAHTARLAR, SURUM, birlestir, yedekOlustur, yedekGecerliMi, indir, yukle };
