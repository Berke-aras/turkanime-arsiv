"use strict";
// build-xray.js ile tarayıcı tarafı (js/xray.js) arasında paylaşılan kurallar. İkisi birlikte değişmeli.

// Kapak dosya adından AniList kimliği: "bx116589-KawXHB6sApFt.jpg", "b5525-x.png", "nx21-a.jpg",
// eski biçim "5525.jpg" / "306-o0cw2vphUh6b.jpg". Tam URL (başka CDN) ya da boş değerde null.
const anilistId = ad => {
  const m = /^(?:bx|b|nx|n)?(\d+)[-.]/.exec(ad || "");
  return m ? Number(m[1]) : null;
};

const KARAKTER_ONEK = "https://s4.anilist.co/file/anilistcdn/character/medium/";
const KISI_ONEK = "https://s4.anilist.co/file/anilistcdn/staff/medium/";
// Varsayılan "görsel yok" resmi saklanmıyor; tarayıcı baş harf gösteriyor.
const gorselKisalt = (url, onek) => !url || /\/default\.jpg$/.test(url) ? "" : (url.startsWith(onek) ? url.slice(onek.length) : url);

// MyAnimeList anime sayfasındaki "Opening Theme" / "Ending Theme" bloklarını
// [OP|ED, sıra, şarkı, sanatçı, bölümler|null] listesine çevirir (build-xray.js'teki AnimeThemes
// biçimiyle aynı). Her şarkı bir <td> içinde: theme-song-index "1:", theme-song-title "\"Ad\"",
// theme-song-artist " by Sanatçı", theme-song-episode "(eps 1-12, 14)".
const HTML_VARLIK = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const metin = s => String(s || "").replace(/<[^>]*>/g, "")
  .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (t, v) => v[0] === "#"
    ? String.fromCodePoint(v[1].toLowerCase() === "x" ? parseInt(v.slice(2), 16) : Number(v.slice(1)))
    : (HTML_VARLIK[v.toLowerCase()] ?? t))
  .replace(/\s+/g, " ").trim();
function malTemalari(html) {
  const op = html.indexOf("js-theme-songs opnening");
  const ed = html.indexOf("js-theme-songs ending");
  const bolumler = [];
  if (op >= 0) bolumler.push(["OP", op, ed > op ? ed : html.length]);
  if (ed >= 0) {
    const son = html.indexOf("<h2", ed);
    bolumler.push(["ED", ed, son > ed ? son : html.length]);
  }
  const sonuc = [];
  for (const [tip, bas, son] of bolumler) {
    const parca = html.slice(bas, son);
    for (const td of parca.split(/<td[^>]*>/).slice(1)) {
      const al = sinif => { const m = new RegExp(`<span class="${sinif}">([\\s\\S]*?)</span>`).exec(td); return m ? metin(m[1]) : ""; };
      const baslik = al("theme-song-title").replace(/^"+|"+$/g, "").trim();
      if (!baslik) continue;
      const sira = parseInt(al("theme-song-index"), 10) || 0;
      const sanatci = al("theme-song-artist").replace(/^by\s+/i, "").trim();
      const bolum = al("theme-song-episode").replace(/^\(\s*eps?\s*/i, "").replace(/\)$/, "").trim();
      sonuc.push([tip, sira, baslik, sanatci, /\d/.test(bolum) ? bolum : null]);
    }
  }
  return sonuc;
}

module.exports = { anilistId, KARAKTER_ONEK, KISI_ONEK, gorselKisalt, malTemalari };
