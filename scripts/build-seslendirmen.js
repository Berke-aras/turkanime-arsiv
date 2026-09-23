"use strict";
// Seslendirmen ters dizini: "bu seslendirmen arşivde başka hangi animelerde, hangi karakteri
// seslendirdi". kaynak/x/*.json'daki karakter listelerinden üretilir, kaynak/sv/<0-31>.json
// kovalarına bölünür (tarayıcı yalnız aradığı adın kovasını indiriyor, bkz. js/views/seslendirmen.js).
//
//   node scripts/build-seslendirmen.js      (build-xray.js / build-xray-ek.js'ten sonra)
//
// Kova biçimi: { "<seslendirmen>": { g: "<görsel>", r: [[slug, karakter, rol A|Y|F], ...] } }
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { SV_KOVA, svKova } = require("./xray-ortak");

const root = path.join(__dirname, "..");
const cikis = path.join(root, "kaynak", "sv");
const sandbox = { window: {} };
new vm.Script(fs.readFileSync(path.join(root, "kaynak", "data.js"), "utf8")).runInNewContext(sandbox);

const dizin = new Map();
for (const r of sandbox.window.INDEX) {
  const dosya = path.join(root, "kaynak", "x", r[0] + ".json");
  if (!fs.existsSync(dosya)) continue;
  const x = JSON.parse(fs.readFileSync(dosya, "utf8"));
  for (const [karakter, , rol, va, vaGorsel] of x.k || []) {
    if (!va) continue;
    if (!dizin.has(va)) dizin.set(va, { g: vaGorsel || "", r: [] });
    const d = dizin.get(va);
    if (!d.g && vaGorsel) d.g = vaGorsel;
    d.r.push([r[0], karakter, rol]);
  }
}

const kovalar = Array.from({ length: SV_KOVA }, () => ({}));
for (const [ad, d] of [...dizin].sort((a, b) => a[0].localeCompare(b[0]))) kovalar[svKova(ad)][ad] = d;
fs.rmSync(cikis, { recursive: true, force: true });
fs.mkdirSync(cikis, { recursive: true });
let toplam = 0;
kovalar.forEach((k, i) => { const m = JSON.stringify(k); toplam += m.length; fs.writeFileSync(path.join(cikis, i + ".json"), m); });
const cokRollu = [...dizin.values()].filter(d => d.r.length > 1).length;
console.log(`${dizin.size} seslendirmen (${cokRollu} tanesi birden çok animede), ${SV_KOVA} kova, toplam ${(toplam / 1024).toFixed(0)} KB.`);
