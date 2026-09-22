"use strict";
// meta.js'i okuyup yazan tek yer. Dosya üç global taşıyor (META_TURLER, META_STUDYOLAR, META);
// build scriptlerinden biri yazarken diğerlerini düşürürse site açılışta çöker — bu yüzden
// yazma işi tek bir fonksiyonda toplandı.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const META_YOLU = path.join(__dirname, "..", "meta.js");

function metaOku() {
  const sandbox = { window: {} };
  try { new vm.Script(fs.readFileSync(META_YOLU, "utf8")).runInNewContext(sandbox); }
  catch (e) { return { META: {}, TURLER: [], STUDYOLAR: [] }; } // ilk çalıştırma
  return {
    META: sandbox.window.META || {},
    TURLER: sandbox.window.META_TURLER || [],
    STUDYOLAR: sandbox.window.META_STUDYOLAR || [],
  };
}

function metaYaz({ META, TURLER, STUDYOLAR }) {
  const metin = `"use strict";\n`
    + `window.META_TURLER = ${JSON.stringify(TURLER)};\n`
    + `window.META_STUDYOLAR = ${JSON.stringify(STUDYOLAR)};\n`
    + `window.META = ${JSON.stringify(META)};\n`;
  fs.writeFileSync(META_YOLU, metin);
  return metin.length;
}

module.exports = { META_YOLU, metaOku, metaYaz };
