"use strict";
// build-xray.js'in bıraktığı iki boşluğu doldurur (önce o çalışmış olmalı):
//
//  1. Sezon düzeltme: kapağı serinin başka bir sezonuna bağlanmış animelerde (yıl/bölüm sayısı
//     tutmadığı için dosyasında MAL kimliği yok) AniList'te başlıkla arayıp yılı ve bölüm sayısı
//     tutan kaydı buluyor; bulursa karakterler, MAL kimliği ve OP/ED o kayıttan yeniden yazılıyor.
//  2. Eksik şarkılar: MAL kimliği olup AnimeThemes'te şarkısı bulunmayan animeler için şarkılar
//     MyAnimeList'in anime sayfasından ("Opening Theme" / "Ending Theme") okunuyor. Jikan API'si de
//     aynı veriyi veriyor ama yalnız kendi önbelleğindeki animeler için; gerisinde 504 dönüyor.
//
//   node scripts/build-xray-ek.js              iki adımı da çalıştırır
//   node scripts/build-xray-ek.js --sezon      yalnız 1. adım
//   node scripts/build-xray-ek.js --mal        yalnız 2. adım
//   node scripts/build-xray-ek.js --sinir 20   her adımda en çok 20 anime (deneme için)
//
// Tekrar çalıştırılabilir: 2. adım yalnız hâlâ şarkısı olmayan dosyalara bakıyor. Filmlerin ve
// OVA'ların bir kısmının gerçekten opening/ending'i yok; onlar her çalıştırmada yeniden sorulur.
const fs = require("fs");
const path = require("path");
const { UA, sleep, istek, anilistGrup, karakterler, uyumlu, temaGrup, cikis, INDEX, META } = require("./build-xray");
const { malTemalari } = require("./xray-ortak");

const root = path.join(__dirname, "..");
const argv = process.argv.slice(2);
const sadece = argv.includes("--sezon") ? "sezon" : argv.includes("--mal") ? "mal" : null;
const sinir = argv.includes("--sinir") ? Number(argv[argv.indexOf("--sinir") + 1]) : Infinity;

const MAL_ARALIK = 2000; // MyAnimeList'e nazik davran: iki saniyede bir sayfa
const ARAMA_GRUP = 8;
const ARAMA_ARALIK = 2500;

const dosyaYolu = slug => path.join(cikis, slug + ".json");
const oku = slug => { try { return JSON.parse(fs.readFileSync(dosyaYolu(slug), "utf8")); } catch (e) { return null; } };
const yaz = (slug, x) => fs.writeFileSync(dosyaYolu(slug), JSON.stringify(x));
const escGql = s => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
const japonca = slug => {
  try { return JSON.parse(fs.readFileSync(path.join(root, "kaynak", "animeler", slug, "info.json"), "utf8"))["Japonca"] || ""; }
  catch (e) { return ""; }
};

// Arşivin kategorisi -> AniList biçimleri. Eşleşen biçim adaya puan kazandırıyor.
const BICIM = { TV: ["TV", "TV_SHORT"], Movie: ["MOVIE"], OVA: ["OVA"], ONA: ["ONA"], Special: ["SPECIAL", "TV_SHORT"], "TV Special": ["SPECIAL"] };

function enIyiAday(adaylar, a) {
  let enIyi = null, puan = -1;
  for (const m of adaylar) {
    if (m.id === a.eskiId || !uyumlu(m, a)) continue;
    const yil = m.seasonYear || (m.startDate && m.startDate.year) || 0;
    const p = (yil === a.yil ? 2 : 0) + ((BICIM[a.kategori] || []).includes(m.format) ? 2 : 0) + (m.episodes === a.eps ? 1 : 0);
    if (p > puan) { puan = p; enIyi = m; }
  }
  // Yalnız yılı ±1 tutan ama ne biçimi ne bölüm sayısı tutan aday güvenilir değil.
  return puan >= 2 ? enIyi : null;
}

async function aramaGrup(grup) {
  const query = "query{" + grup.map((g, i) =>
    `s${i}: Page(perPage:8){ media(search:"${escGql(g.anahtar)}", type: ANIME){ id idMal episodes format seasonYear startDate{ year } } }`
  ).join(" ") + "}";
  const json = await istek("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ query }),
  }, "AniList");
  return grup.map((_, i) => (json.data && json.data["s" + i] && json.data["s" + i].media) || []);
}

async function sezonDuzelt() {
  // Yıl bilgisi olmayanlar aranmıyor: yıl, yanlış sezonu eleyen asıl ölçüt.
  const adaylar = INDEX.map(r => ({ slug: r[0], baslik: r[1] || r[0], eps: r[2] || 0, yil: META[r[0]][4] || 0, kategori: META[r[0]][0] }))
    .map(a => ({ ...a, x: oku(a.slug) }))
    .filter(a => a.x && !a.x.mal && a.yil)
    .map(a => ({ ...a, eskiId: a.x.id }))
    .slice(0, sinir);
  console.log(`Sezon düzeltme: ${adaylar.length} aday.`);
  const bulunan = new Map(); // slug -> media
  for (const tur of [a => a.baslik, a => japonca(a.slug)]) {
    const kalan = adaylar.filter(a => !bulunan.has(a.slug)).map(a => ({ a, anahtar: tur(a) })).filter(g => g.anahtar);
    for (let i = 0; i < kalan.length; i += ARAMA_GRUP) {
      const grup = kalan.slice(i, i + ARAMA_GRUP);
      try {
        const sonuc = await aramaGrup(grup);
        grup.forEach((g, j) => { const m = enIyiAday(sonuc[j], g.a); if (m) bulunan.set(g.a.slug, m); });
      } catch (e) { console.log(`\n  arama hatası: ${e.message}`); }
      process.stdout.write(`\r  arama ${Math.min(i + ARAMA_GRUP, kalan.length)}/${kalan.length} · bulunan ${bulunan.size}`);
      await sleep(ARAMA_ARALIK);
    }
  }
  console.log(`\n  ${bulunan.size} animenin doğru AniList kaydı bulundu; karakter ve şarkılar çekiliyor.`);

  const idler = [...new Set([...bulunan.values()].map(m => m.id))];
  const medyalar = new Map(), temalar = new Map();
  for (let i = 0; i < idler.length; i += 10) {
    try { for (const [k, v] of await anilistGrup(idler.slice(i, i + 10))) medyalar.set(k, v); }
    catch (e) { console.log(`\n  AniList hatası: ${e.message}`); }
    try { for (const [k, v] of await temaGrup(idler.slice(i, i + 10))) temalar.set(k, v); }
    catch (e) { console.log(`\n  AnimeThemes hatası: ${e.message}`); }
    process.stdout.write(`\r  ${Math.min(i + 10, idler.length)}/${idler.length} kayıt`);
    await sleep(ARAMA_ARALIK);
  }
  let yazilan = 0;
  for (const [slug, m] of bulunan) {
    const media = medyalar.get(m.id);
    if (!media) continue;
    const kayit = { id: m.id };
    const k = karakterler(media);
    if (k.length) kayit.k = k; else if (oku(slug).k) kayit.k = oku(slug).k;
    if (media.idMal) kayit.mal = media.idMal;
    const t = temalar.get(m.id);
    if (t && t.length) kayit.m = t;
    yaz(slug, kayit);
    yazilan++;
  }
  console.log(`\n  Sezon düzeltme bitti: ${yazilan} dosya güncellendi.`);
}

async function malSayfa(mal, deneme = 1) {
  const res = await fetch(`https://myanimelist.net/anime/${mal}`, { headers: { "User-Agent": UA, Accept: "text/html" } })
    .catch(() => null);
  if (!res || res.status === 429 || res.status >= 500) {
    if (deneme > 4) throw new Error(`MAL ${res ? res.status : "ağ hatası"}`);
    await sleep(10000 * deneme);
    return malSayfa(mal, deneme + 1);
  }
  if (res.status === 404) return "";
  if (!res.ok) throw new Error(`MAL ${res.status}`);
  return res.text();
}

async function malSarkilari() {
  const hedef = INDEX.map(r => ({ slug: r[0], x: oku(r[0]) })).filter(a => a.x && a.x.mal && !a.x.m).slice(0, sinir);
  // Aynı MAL kimliğini paylaşan animeler (aynı kapağa düşen yan kayıtlar) tek sayfayla çözülüyor.
  const malaGore = new Map();
  for (const a of hedef) { if (!malaGore.has(a.x.mal)) malaGore.set(a.x.mal, []); malaGore.get(a.x.mal).push(a); }
  console.log(`Eksik şarkılar: ${hedef.length} anime, ${malaGore.size} MAL sayfası.`);
  let sayfa = 0, sarkili = 0, hata = 0;
  for (const [mal, liste] of malaGore) {
    try {
      const temalar = malTemalari(await malSayfa(mal));
      if (temalar.length) for (const a of liste) { yaz(a.slug, { ...a.x, m: temalar }); sarkili++; }
    } catch (e) { hata++; console.log(`\n  MAL ${mal}: ${e.message}`); }
    process.stdout.write(`\r  ${++sayfa}/${malaGore.size} sayfa · ${sarkili} animeye şarkı eklendi · ${hata} hata`);
    await sleep(MAL_ARALIK);
  }
  console.log(`\n  Eksik şarkılar bitti: ${sarkili} animeye şarkı eklendi.`);
}

(async () => {
  if (sadece !== "mal") await sezonDuzelt();
  if (sadece !== "sezon") await malSarkilari();
})();
