"use strict";
// Oynatıcıdaki bilgi paneli (X-Ray) verisini toplar: AniList'ten karakterler + Japon seslendirmenleri,
// AnimeThemes'ten opening/ending şarkıları. Her anime için kaynak/x/<slug>.json yazılır; tarayıcı
// bunu yalnız oynatıcı açıldığında çeker (bkz. js/xray.js). Runtime'da AniList'e/AnimeThemes'e
// hiç istek gitmez.
//
//   node scripts/build-xray.js             eksik dosyaları üretir (yarıda kesilirse kaldığı yerden sürer)
//   node scripts/build-xray.js --yenile    hepsini baştan üretir
//   node scripts/build-xray.js --sinir 20  yalnız ilk 20 AniList kimliğini işler (deneme için)
//
// AniList kimliği ayrıca aranmıyor: meta.js'teki kapak dosya adı zaten onu taşıyor
// ("bx116589-KawXHB6sApFt.jpg" -> 116589, eski biçim "5525.jpg" -> 5525). Kimliği çıkmayan
// animeye dosya yazılmaz; tarayıcı da aynı kuralla (js/xray.js anilistId) o animeyi hiç istemez,
// böylece 404 isteği oluşmaz.
//
// Kapaklar başlık aramasıyla eşleştirildiği için bazı animeler serinin başka bir sezonuna bağlanmış
// olabilir (bkz. scripts/build-posters.js 3. tur). Karakterler sezonlar arasında büyük ölçüde aynı
// kaldığı için her durumda yazılıyor; ama bölüme özgü veriler (MAL kimliği -> AniSkip zamanları,
// OP/ED şarkıları) yalnız yıl ve bölüm sayısı tutuyorsa yazılıyor (bkz. uyumlu()).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { metaOku } = require("./meta-io");
const { anilistId, KARAKTER_ONEK, KISI_ONEK, gorselKisalt } = require("./xray-ortak");

const root = path.join(__dirname, "..");
const cikis = path.join(root, "kaynak", "x");
const argv = process.argv.slice(2);
const yenile = argv.includes("--yenile");
const sinir = argv.includes("--sinir") ? Number(argv[argv.indexOf("--sinir") + 1]) : Infinity;

const sandbox = { window: {} };
new vm.Script(fs.readFileSync(path.join(root, "kaynak", "data.js"), "utf8")).runInNewContext(sandbox);
const INDEX = sandbox.window.INDEX || [];
const { META } = metaOku();

// AnimeThemes (Cloudflare) User-Agent'sız istekleri 403 ile geri çeviriyor.
const UA = "turkanime-arsiv build-xray (https://github.com/berke-aras/turkanime-arsiv)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KARAKTER_SAYISI = 12;
const ANILIST_GRUP = 10;
const ANILIST_ARALIK = 2200; // AniList şu an dakikada 30 istek veriyor
const ISCI = 4;
const TEMA_GRUP = 40;
const TEMA_ARALIK = 900;     // AnimeThemes dakikada 90

// id -> [{ slug, eps, yil }]
const kimlikler = new Map();
for (const r of INDEX) {
  const m = META[r[0]];
  const id = m && anilistId(m[3]);
  if (!id) continue;
  if (!yenile && fs.existsSync(path.join(cikis, r[0] + ".json"))) continue;
  if (!kimlikler.has(id)) kimlikler.set(id, []);
  kimlikler.get(id).push({ slug: r[0], eps: r[2] || 0, yil: m[4] || 0 });
}

async function istek(url, secenek, ad, deneme = 1) {
  let res;
  try { res = await fetch(url, secenek); }
  catch (e) {
    if (deneme > 4) throw e;
    await sleep(3000 * deneme);
    return istek(url, secenek, ad, deneme + 1);
  }
  if (res.status === 429 || res.status >= 500) {
    if (deneme > 6) throw new Error(`${ad} ${res.status}: 6 deneme sonunda pes edildi`);
    const bekle = Number(res.headers.get("retry-after")) * 1000 || 4000 * deneme;
    process.stdout.write(`\n  ${ad} ${res.status}, ${Math.round(bekle / 1000)}sn bekleniyor`);
    await sleep(bekle + 500);
    return istek(url, secenek, ad, deneme + 1);
  }
  // AniList, sorulan kimliklerden biri yoksa cevabı 404 + gövdede `errors` ile döndürüyor;
  // bu kalıcı bir durum, gövde anilistGrup'a veriliyor (orada tek tek sorguya bölünüyor).
  if (res.status === 404 && ad === "AniList") {
    const json = await res.json().catch(() => null);
    if (json && json.data) return json;
  }
  if (!res.ok) throw new Error(`${ad} ${res.status}`);
  return res.json();
}

async function anilistGrup(idler) {
  const query = "query{" + idler.map(id =>
    `m${id}: Media(id:${id}, type: ANIME){ id idMal episodes seasonYear startDate{ year }
      characters(sort:[ROLE, RELEVANCE, ID], perPage:${KARAKTER_SAYISI}){ edges{ role
        node{ name{ full } image{ medium } }
        voiceActors(language: JAPANESE, sort:[RELEVANCE, ID]){ name{ full } image{ medium } } } } }`
  ).join(" ") + "}";
  const json = await istek("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
    body: JSON.stringify({ query }),
  }, "AniList");
  // Gruptaki tek bir kimlik bile AniList'te yoksa bütün takma adlar null dönüyor; o zaman grup
  // tek tek soruluyor ki kalan dokuz anime o yüzden boş kalmasın.
  if (json.errors && idler.length > 1) {
    const sonuc = new Map();
    for (const id of idler) {
      await sleep(ANILIST_ARALIK);
      for (const [k, v] of await anilistGrup([id])) sonuc.set(k, v);
    }
    return sonuc;
  }
  const sonuc = new Map();
  for (const id of idler) {
    const m = json.data && json.data["m" + id];
    if (m) sonuc.set(id, m);
  }
  return sonuc;
}

const ROL = { MAIN: "A", SUPPORTING: "Y", BACKGROUND: "F" };
function karakterler(media) {
  return ((media.characters && media.characters.edges) || []).map(e => {
    const va = (e.voiceActors || [])[0];
    return [
      e.node.name.full || "",
      gorselKisalt(e.node.image && e.node.image.medium, KARAKTER_ONEK),
      ROL[e.role] || "Y",
      va ? va.name.full || "" : "",
      va ? gorselKisalt(va.image && va.image.medium, KISI_ONEK) : "",
    ];
  });
}

// Kapak eşleşmesi bu animeye mi ait, yoksa serinin başka bir sezonuna mı? Yıl ±1 ve bölüm sayısı
// makul aralıkta ise "uyumlu". Bilinmeyen alanlar (yıl 0, bölüm null) engel sayılmıyor.
function uyumlu(media, a) {
  const aniYil = media.seasonYear || (media.startDate && media.startDate.year) || 0;
  if (a.yil && aniYil && Math.abs(a.yil - aniYil) > 1) return false;
  const aniEps = media.episodes || 0;
  if (a.eps && aniEps && (a.eps > aniEps + 2 || a.eps < Math.floor(aniEps / 2))) return false;
  return true;
}

// AnimeThemes: aynı AniList kimliğine birden fazla kayıt bağlı olabiliyor; hepsinin temaları birleşiyor.
async function temaGrup(idler) {
  const sonuc = new Map();
  const q = new URLSearchParams({
    "filter[has]": "resources", "filter[site]": "AniList", "filter[external_id]": idler.join(","),
    include: "resources,animethemes.song.artists,animethemes.animethemeentries",
    "fields[anime]": "id", "fields[resource]": "site,external_id", "fields[animetheme]": "type,sequence",
    "fields[song]": "title", "fields[artist]": "name", "fields[animethemeentry]": "episodes,version",
    "page[size]": "100",
  });
  let url = "https://api.animethemes.moe/anime?" + q;
  while (url) {
    const json = await istek(url, { headers: { Accept: "application/json", "User-Agent": UA } }, "AnimeThemes");
    for (const anime of json.anime || []) {
      const temalar = (anime.animethemes || []).map(t => {
        const bolumler = (t.animethemeentries || []).map(e => e.episodes).filter(Boolean);
        return [
          t.type, t.sequence || 0,
          (t.song && t.song.title) || "",
          ((t.song && t.song.artists) || []).map(x => x.name).join(", "),
          bolumler.length ? bolumler.join(", ") : null,
        ];
      }).filter(t => t[0] === "OP" || t[0] === "ED");
      for (const r of anime.resources || []) {
        if (r.site !== "AniList") continue;
        const id = Number(r.external_id);
        if (!sonuc.has(id)) sonuc.set(id, []);
        sonuc.get(id).push(...temalar);
      }
    }
    url = json.links && json.links.next;
    if (url) await sleep(TEMA_ARALIK);
  }
  return sonuc;
}

(async () => {
  fs.mkdirSync(cikis, { recursive: true });
  const tumIdler = [...kimlikler.keys()].slice(0, sinir);
  const slugSayisi = tumIdler.reduce((s, id) => s + kimlikler.get(id).length, 0);
  console.log(`${tumIdler.length} AniList kimliği (${slugSayisi} anime) işlenecek.`);

  let yazilan = 0, uyumsuz = 0, temali = 0, biten = 0;
  async function grupIsle(grup) {
    let medyalar = new Map(), temalar = new Map();
    try { medyalar = await anilistGrup(grup); }
    catch (e) { console.log(`\n  AniList hatası (${grup[0]}..): ${e.message}, grup atlandı`); return; }
    // Tema isteği yalnız bölüme özgü veri yazılacak kimlikler için atılıyor.
    const temaIdleri = grup.filter(id => medyalar.has(id) && kimlikler.get(id).some(a => uyumlu(medyalar.get(id), a)));
    for (let j = 0; j < temaIdleri.length; j += TEMA_GRUP) {
      try { for (const [k, v] of await temaGrup(temaIdleri.slice(j, j + TEMA_GRUP))) temalar.set(k, v); }
      catch (e) { console.log(`\n  AnimeThemes hatası: ${e.message}, şarkılar atlandı`); }
    }
    for (const id of grup) {
      const media = medyalar.get(id);
      for (const a of kimlikler.get(id)) {
        const kayit = { id };
        if (media) {
          const k = karakterler(media);
          if (k.length) kayit.k = k;
          if (uyumlu(media, a)) {
            if (media.idMal) kayit.mal = media.idMal;
            const t = temalar.get(id);
            if (t && t.length) { kayit.m = t; temali++; }
          } else uyumsuz++;
        }
        fs.writeFileSync(path.join(cikis, a.slug + ".json"), JSON.stringify(kayit));
        yazilan++;
      }
    }
  }

  // Tek bir AniList isteği (10 anime x 12 karakter) 10 saniyeyi bulabiliyor; sıralı gidince dakikada
  // ancak 4 istek atılıyordu. Birkaç işçi paralel çalışıp her biri istek arasında bekliyor; toplam hız
  // yine AniList'in dakikada 30 sınırının altında kalıyor.
  const gruplar = [];
  for (let i = 0; i < tumIdler.length; i += ANILIST_GRUP) gruplar.push(tumIdler.slice(i, i + ANILIST_GRUP));
  let sira = 0;
  await Promise.all(Array.from({ length: ISCI }, async () => {
    while (sira < gruplar.length) {
      const grup = gruplar[sira++];
      await grupIsle(grup);
      biten += grup.length;
      process.stdout.write(`\r  ${biten}/${tumIdler.length} kimlik · ${yazilan} dosya · ${temali} şarkılı · ${uyumsuz} sezon uyumsuz`);
      await sleep(ANILIST_ARALIK * ISCI);
    }
  }));
  console.log(`\nBitti: ${yazilan} dosya yazıldı (${temali} tanesinde OP/ED var, ${uyumsuz} tanesinde yalnız karakterler).`);
})();
