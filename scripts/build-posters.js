"use strict";
// AniList'ten kapak görseli URL'lerini toplayıp meta.js içine gömer; runtime'da tarayıcı
// AniList'e hiç istek atmaz (rate-limit riski yok).
//
//   node scripts/build-posters.js            eksik posterleri sırayla üç turda arar
//   node scripts/build-posters.js --tur 2    yalnız 2. turu çalıştırır
//   node scripts/build-posters.js --rapor    hiçbir istek atmaz, sadece hangi turda kaç aday var der
//
// Yarıda kesilirse tekrar çalıştırılabilir: posteri olan slug'lar atlanır, meta.js her grup
// sonunda diske yazılır.
//
// Turlar (sırayla, her tur bir öncekinden artakalanlar üzerinde çalışır):
//   1. Türkçe/romanize başlık            — kaynak/data.js'teki başlık
//   2. Japonca özgün başlık              — info.json "Japonca" alanı; AniList'te isabet çok yüksek
//   3. Ana seri (sezon/özel ekleri atılmış) — "X 2nd Season" -> "X"; bulunanın kapağı kullanılır
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const { posterKisalt } = require("./poster-onek");
const { metaOku, metaYaz } = require("./meta-io");
const dataPath = path.join(root, "kaynak", "data.js");

const argv = process.argv.slice(2);
const sadeceRapor = argv.includes("--rapor");
const tekTur = argv.includes("--tur") ? Number(argv[argv.indexOf("--tur") + 1]) : null;

const sandbox = { window: {} };
new vm.Script(fs.readFileSync(dataPath, "utf8")).runInNewContext(sandbox);
const INDEX = sandbox.window.INDEX || [];
const meta = metaOku();
const META = meta.META;

function japoncaBaslik(slug) {
  try { return JSON.parse(fs.readFileSync(path.join(root, "kaynak", "animeler", slug, "info.json"), "utf8"))["Japonca"] || ""; }
  catch (e) { return ""; }
}

// "5-toubun no Hanayome 2nd Season" -> "5-toubun no Hanayome"
// "86 Special Edition: ..." -> "86" ; "Bleach: Sennen Kessen-hen - Ketsubetsu-tan" -> "Bleach"
const SEZON_EKI = /\s*(?::|-)?\s*(\d+(?:st|nd|rd|th)\s+Season|Season\s+\d+|Final\s+Season|Part\s+\d+|Specials?|Special\s+Edition|OVA|ONA|OAD|Movie|Film|Recaps?|Picture\s+Drama)\b.*$/i;
function anaSeri(baslik) {
  let s = baslik.replace(SEZON_EKI, "").trim();
  s = s.replace(/[\s:–-]+$/, "").trim();
  // alt başlığı da at: "Bleach: Sennen Kessen-hen" -> "Bleach"
  if (s.includes(":")) s = s.slice(0, s.indexOf(":")).trim();
  return s;
}

const TURLAR = [
  { no: 1, ad: "başlık", anahtar: a => a.baslik },
  { no: 2, ad: "Japonca başlık", anahtar: a => japoncaBaslik(a.slug) },
  { no: 3, ad: "ana seri (sezon/özel ekleri atılmış)", anahtar: a => { const s = anaSeri(a.baslik); return s && s !== a.baslik ? s : ""; } },
];

const CHUNK = 25;
const DELAY_MS = 800;
const escGql = s => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
const sleep = ms => new Promise(r => setTimeout(r, ms));

const eksikler = () => INDEX
  .map(r => ({ slug: r[0], baslik: r[1] || r[0] }))
  .filter(a => !(META[a.slug] && META[a.slug][3]));

async function grupCek(grup, deneme = 1) {
  const query = "query{" + grup.map((a, i) =>
    `m${i}: Page(perPage:1){ media(search:"${escGql(a.anahtar)}", type: ANIME){ coverImage{ large } } }`
  ).join(" ") + "}";

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query })
  });

  if (res.status === 429) {
    if (deneme > 5) throw new Error("rate limit: 5 deneme sonunda pes edildi");
    const bekle = Number(res.headers.get("retry-after")) * 1000 || DELAY_MS * deneme * 4;
    console.log(`\n  429 alındı, ${Math.round(bekle / 1000)}sn bekleniyor (deneme ${deneme})`);
    await sleep(bekle);
    return grupCek(grup, deneme + 1);
  }
  if (!res.ok) throw new Error(`AniList ${res.status}`);

  const json = await res.json();
  let bulunan = 0;
  grup.forEach((a, i) => {
    const media = json.data && json.data["m" + i] && json.data["m" + i].media;
    const url = media && media[0] && media[0].coverImage ? media[0].coverImage.large : null;
    if (!url) return;
    const m = META[a.slug] || ["", [], 0, null, 0, -1];
    m[3] = posterKisalt(url);
    META[a.slug] = m;
    bulunan++;
  });
  return bulunan;
}

(async () => {
  const baslangic = eksikler().length;
  console.log(`${INDEX.length} anime, ${baslangic} tanesinde poster eksik.`);

  for (const tur of TURLAR) {
    if (tekTur && tur.no !== tekTur) continue;
    const adaylar = eksikler()
      .map(a => ({ slug: a.slug, anahtar: tur.anahtar(a) }))
      .filter(a => a.anahtar);
    console.log(`\nTur ${tur.no} — ${tur.ad}: ${adaylar.length} aday`);
    if (sadeceRapor || !adaylar.length) continue;

    let bulunan = 0;
    for (let i = 0; i < adaylar.length; i += CHUNK) {
      const grup = adaylar.slice(i, i + CHUNK);
      try { bulunan += await grupCek(grup); }
      catch (e) { console.log(`\n  hata (${grup[0].slug}..): ${e.message}, bu grup atlandı`); }
      process.stdout.write(`\r  ${Math.min(i + CHUNK, adaylar.length)}/${adaylar.length} · bulunan ${bulunan}`);
      metaYaz({ ...meta, META });
      await sleep(DELAY_MS);
    }
    console.log(`\n  Tur ${tur.no} bitti: ${bulunan} poster eklendi.`);
  }

  if (sadeceRapor) { console.log("\n(--rapor: hiçbir istek atılmadı, meta.js'e dokunulmadı)"); return; }
  const kalan = eksikler().length;
  const boyut = metaYaz({ ...meta, META });
  console.log(`\nbitti. postersiz: ${baslangic} -> ${kalan} (${baslangic - kalan} eklendi). meta.js ${(boyut / 1024).toFixed(0)} KB`);
})();
