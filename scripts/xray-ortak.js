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

module.exports = { anilistId, KARAKTER_ONEK, KISI_ONEK, gorselKisalt };
