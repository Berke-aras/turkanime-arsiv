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
// [OP|ED, sıra, şarkı, sanatçı, bölümler|null, spotifyParçaKimliği|""] listesine çevirir (build-xray.js'teki AnimeThemes
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
      // Dinleme linki olmayan şarkılarda MAL başlığı <span> içine koymuyor: sıra numarasından sonra,
      // sanatçıdan önce düz metin ("Aggressive Girl (アグレッシブガール)").
      let ham = al("theme-song-title");
      if (!ham) {
        const sanatciYeri = td.indexOf('<span class="theme-song-artist"');
        if (sanatciYeri > 0) ham = metin(td.slice(0, sanatciYeri).replace(/<span class="theme-song-index">[\s\S]*?<\/span>/, ""));
      }
      const baslik = ham.replace(/^"+|"+$/g, "").trim();
      if (!baslik) continue;
      const sira = parseInt(al("theme-song-index"), 10) || 0;
      const sanatci = al("theme-song-artist").replace(/^by\s+/i, "").trim();
      const bolum = al("theme-song-episode").replace(/^\(\s*eps?\s*/i, "").replace(/\)$/, "").trim();
      const spotify = /spotify_url_\d+" value="https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/.exec(td);
      sonuc.push([tip, sira, baslik, sanatci, /\d/.test(bolum) ? bolum : null, spotify ? spotify[1] : ""]);
    }
  }
  return sonuc;
}

// Şarkı adlarını karşılaştırmak için: MAL "Aka no Kakera (緋色のカケラ)" yazarken AnimeThemes
// "Aka no Kakera" yazıyor; parantez içi, büyük/küçük harf ve noktalama farkı yok sayılıyor.
const sarkiAnahtar = s => String(s || "").replace(/\([^)]*\)/g, "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

// Seslendirmen ters dizini kaynak/sv/<kova>.json'a bölünüyor; tarayıcı yalnız aradığı adın
// kovasını indiriyor. Tarayıcı tarafındaki eşi: js/xray-veri.js svKova. İkisi birlikte değişmeli.
const SV_KOVA = 32;
const svKova = ad => {
  let h = 0;
  for (const c of String(ad)) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return h % SV_KOVA;
};

// Arama dizininin parça adı (bkz. scripts/build-ara.js, js/oneri.js): kelimenin normalize edilmiş ilk
// harfi; a-z ve 0-9 dışındakiler "_" parçasına düşüyor. İki eş birlikte değişmeli.
const araHarf = kelime => {
  const c = String(kelime || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ı/g, "i").charAt(0);
  return !c ? "" : /[a-z0-9]/.test(c) ? c : "_";
};

module.exports = { araHarf, anilistId, KARAKTER_ONEK, KISI_ONEK, gorselKisalt, malTemalari, sarkiAnahtar, SV_KOVA, svKova };
