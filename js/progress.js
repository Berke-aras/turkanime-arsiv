// İzleme durumu: nerede kalındığı (§7.1) ve hangi bölümlerin izlendiği (§7.2).
// Tamamı localStorage'da, hiçbir yere gönderilmiyor.
//
// Biçim:  ta_progress = { "<slug>": { ep, t, d, u, izlendi: [bölümIndeksi...] } }
//   ep  en son açılan bölümün indeksi        t  o bölümde kalınan saniye
//   d   bölümün toplam süresi (varsa)        u  son güncelleme (ms)
//   izlendi  izlenmiş bölüm indeksleri, artan sırada
import { readLS, writeLS } from './util.js';

const ANAHTAR = 'ta_progress';
// Sınırsız büyümesin diye en eski kayıtlar atılıyor (localStorage kotası ~5 MB).
const KAYIT_SINIRI = 200;

let kayitlar = readLS(ANAHTAR, {});
if (!kayitlar || typeof kayitlar !== 'object' || Array.isArray(kayitlar)) kayitlar = {};

function yaz() {
  const anahtarlar = Object.keys(kayitlar);
  if (anahtarlar.length > KAYIT_SINIRI) {
    anahtarlar
      .sort((a, b) => (kayitlar[b].u || 0) - (kayitlar[a].u || 0))
      .slice(KAYIT_SINIRI)
      .forEach(k => delete kayitlar[k]);
  }
  writeLS(ANAHTAR, kayitlar);
}

const kayitAl = slug => kayitlar[slug] || null;
const kayitKur = slug => (kayitlar[slug] = kayitlar[slug] || { ep: 0, t: 0, d: 0, u: 0, izlendi: [] });

// --- §7.1 nerede kalındı ---
export const ilerlemeOku = slug => kayitAl(slug);

export function ilerlemeYaz(slug, ep, t = 0, d = 0) {
  const k = kayitKur(slug);
  k.ep = ep; k.t = t; k.d = d; k.u = Date.now();
  yaz();
}

// Kaydedilmiş konum yalnız anlamlıysa geri yüklenir: başa çok yakınsa ya da bölüm neredeyse
// bitmişse kullanıcıyı oraya atmak faydadan çok rahatsızlık verir.
// Eşikler oransal: sabit 15/30 saniye, 3 dakikalık bir özel bölümde ya da kısa bir OVA'da
// pencerenin tamamını yiyordu. Uzun bölümlerde yine 15 sn / 30 sn'ye oturuyor.
const BASLANGIC_ESIGI = d => Math.min(15, (d || 0) * 0.03);
const BITIS_ESIGI = d => Math.min(30, (d || 0) * 0.08);
export function devamSaniyesi(slug, ep) {
  const k = kayitAl(slug);
  if (!k || k.ep !== ep || !k.t) return 0;
  if (k.t <= BASLANGIC_ESIGI(k.d)) return 0;
  if (k.d && k.t >= k.d - BITIS_ESIGI(k.d)) return 0;
  return k.t;
}

// Kart üstündeki ince çubuk için 0–1 arası oran; bilinmiyorsa 0.
export function ilerlemeOrani(slug) {
  const k = kayitAl(slug);
  if (!k || !k.d || !k.t) return 0;
  return Math.max(0, Math.min(1, k.t / k.d));
}

// "İzlemeye devam et" kartı için: hangi bölüm açılacak ve kartta ne yazacak.
// Son açılan bölüm bitmişse (izlendi işaretli ya da sonuna gelinmiş) sıradaki bölüm, değilse aynı bölüm
// kaldığı saniyeden. Numara veri dizisindeki sıra + 1 (bölüm dosyası yüklenmeden kartta yazılabilsin diye).
export function devamBilgisi(slug, bolumSayisi = Infinity) {
  const k = kayitAl(slug);
  if (!k) return null;
  const ep = k.ep || 0;
  const bitti = (Array.isArray(k.izlendi) && k.izlendi.includes(ep)) || (k.d && k.t >= k.d - BITIS_ESIGI(k.d));
  if (bitti && ep + 1 >= bolumSayisi) return null; // son bölüm de bitmiş: devam edecek yer yok
  const i = bitti ? ep + 1 : ep;
  const t = bitti ? 0 : devamSaniyesi(slug, ep);
  const dk = t ? ` · ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '';
  return { i, etiket: bitti ? `Sıradaki: ${i + 1}. bölüm` : `Devam: ${i + 1}. bölüm${dk}` };
}

// "Devam et" şeridi: en son bakılandan geriye doğru.
export function devamListesi() {
  return Object.entries(kayitlar)
    .filter(([, k]) => k.u)
    .sort((a, b) => b[1].u - a[1].u)
    .map(([slug]) => slug);
}

// --- §7.2 izlendi işareti ---
export const izlendiMi = (slug, ep) => {
  const k = kayitAl(slug);
  return !!k && Array.isArray(k.izlendi) && k.izlendi.includes(ep);
};

export const izlenenSayisi = slug => {
  const k = kayitAl(slug);
  return k && Array.isArray(k.izlendi) ? k.izlendi.length : 0;
};

export function izlendiAyarla(slug, ep, deger) {
  const k = kayitKur(slug);
  const kume = new Set(k.izlendi || []);
  if (deger) kume.add(ep); else kume.delete(ep);
  k.izlendi = [...kume].sort((a, b) => a - b);
  k.u = Date.now();
  yaz();
}

// "Buraya kadar hepsini işaretle": 0..ep aralığının tamamı.
export function burayaKadarIsaretle(slug, ep) {
  const k = kayitKur(slug);
  const kume = new Set(k.izlendi || []);
  for (let i = 0; i <= ep; i++) kume.add(i);
  k.izlendi = [...kume].sort((a, b) => a - b);
  k.u = Date.now();
  yaz();
}

export function izlenenleriTemizle(slug) {
  const k = kayitAl(slug);
  if (!k) return;
  k.izlendi = [];
  k.u = Date.now();
  yaz();
}
