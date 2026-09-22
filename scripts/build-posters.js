"use strict";
// AniList'ten poster URL'lerini toplayıp meta.js içine gömer, runtime'da tarayıcının
// AniList'e istek atmasını (ve rate-limit yemesini) gerektirmez.
// Yarıda kesilirse tekrar çalıştırılabilir: zaten poster'ı olan slug'ları atlar.
// Çalıştır: node scripts/build-posters.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const { posterKisalt } = require("./poster-onek");
const dataPath = path.join(root, "kaynak", "data.js");
const metaPath = path.join(root, "meta.js");

function loadGlobal(file, name) {
  const sandbox = { window: {} };
  new vm.Script(fs.readFileSync(file, "utf8")).runInNewContext(sandbox);
  return sandbox.window[name];
}

const INDEX = loadGlobal(dataPath, "INDEX") || [];
const META = loadGlobal(metaPath, "META") || {};

const todo = INDEX
  .map(r => ({ slug: r[0], baslik: r[1] || r[0] }))
  .filter(a => !(META[a.slug] && META[a.slug][3]));

console.log(`${INDEX.length} anime, ${todo.length} tanesinde poster eksik.`);

const CHUNK = 25;
const DELAY_MS = 800;
const escGql = s => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchChunk(chunk, attempt = 1) {
  const query = "query{" + chunk.map((a, i) =>
    `m${i}: Page(perPage:1){ media(search:"${escGql(a.baslik)}", type: ANIME){ coverImage{ large } } }`
  ).join(" ") + "}";

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query })
  });

  if (res.status === 429) {
    if (attempt > 5) throw new Error("rate limit: 5 deneme sonunda pes edildi");
    const wait = Number(res.headers.get("retry-after")) * 1000 || DELAY_MS * attempt * 4;
    console.log(`  429 alındı, ${Math.round(wait / 1000)}sn bekleniyor (deneme ${attempt})`);
    await sleep(wait);
    return fetchChunk(chunk, attempt + 1);
  }
  if (!res.ok) throw new Error(`AniList ${res.status}`);

  const json = await res.json();
  chunk.forEach((a, i) => {
    const media = json.data && json.data["m" + i] && json.data["m" + i].media;
    const url = media && media[0] && media[0].coverImage ? media[0].coverImage.large : null;
    if (url) {
      const m = META[a.slug] || ["", [], 0, null, 0, ""];
      m[3] = posterKisalt(url);
      META[a.slug] = m;
    }
  });
}

(async () => {
  for (let i = 0; i < todo.length; i += CHUNK) {
    const chunk = todo.slice(i, i + CHUNK);
    try {
      await fetchChunk(chunk);
    } catch (e) {
      console.log(`  hata (${chunk[0].slug}..): ${e.message}, bu grup atlandı, sonraki çalıştırmada tekrar denenir`);
    }
    process.stdout.write(`\r${Math.min(i + CHUNK, todo.length)}/${todo.length}`);
    fs.writeFileSync(metaPath, `"use strict";\nwindow.META = ${JSON.stringify(META)};\n`);
    await sleep(DELAY_MS);
  }
  console.log(`\nbitti. meta.js güncellendi (${(fs.statSync(metaPath).size / 1024).toFixed(0)} KB)`);
})();
