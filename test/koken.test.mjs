// Resolver'ların köken kısıtlaması (GELISTIRME-PLANI.md §4.4.1).
// İki uygulama (Vercel CommonJS + Cloudflare ESM) aynı kurallara uymalı; bu test ikisini de
// aynı senaryolardan geçiriyor ki biri değişip diğeri unutulmasın.
import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import { kokenDogrula as workerDogrula } from "../cf/uqload/worker.js";

const require = createRequire(import.meta.url);
const sibnet = require("../api/sibnet.js");

const IZINLI = "https://berke-aras.github.io";

// Her iki uygulamayı tek bir arayüzün arkasına alıyoruz.
const vercel = (headers, env = {}) => {
  const onceki = { ...process.env };
  Object.assign(process.env, env);
  try { return sibnet.kokenDogrula({ headers }); }
  finally { for (const k of Object.keys(process.env)) delete process.env[k]; Object.assign(process.env, onceki); }
};
const worker = (headers, env = {}) =>
  workerDogrula({ headers: { get: k => headers[k] ?? null } }, env);

const UYGULAMALAR = [
  ["vercel (api/sibnet.js)", vercel, { TKA_ALLOW_LOCALHOST: "1" }, { TKA_ALLOWED_ORIGINS: "https://ornek.test" }],
  ["worker (cf/uqload)", worker, { ALLOW_LOCALHOST: "1" }, { ALLOWED_ORIGINS: "https://ornek.test" }],
];

for (const [ad, dogrula, yerelEnv, ekEnv] of UYGULAMALAR) {
  test(`${ad}: kendi sitemizin kökenine izin veriyor`, () => {
    assert.deepEqual(dogrula({ origin: IZINLI }), { ok: true, origin: IZINLI });
  });

  test(`${ad}: başka bir siteyi reddediyor`, () => {
    assert.equal(dogrula({ origin: "https://baskasite.example" }).ok, false);
  });

  test(`${ad}: Origin başlığı yoksa reddediyor (curl/betik)`, () => {
    assert.equal(dogrula({}).ok, false);
  });

  test(`${ad}: Origin yoksa Referer'dan kökeni çıkarıyor`, () => {
    assert.deepEqual(dogrula({ referer: `${IZINLI}/turkanime-arsiv/#/anime/beck` }), { ok: true, origin: IZINLI });
    assert.equal(dogrula({ referer: "https://baskasite.example/sayfa" }).ok, false);
    assert.equal(dogrula({ referer: "bozuk-url" }).ok, false);
  });

  test(`${ad}: localhost yalnız açıkça izin verilince kabul ediliyor`, () => {
    assert.equal(dogrula({ origin: "http://localhost:8000" }).ok, false);
    assert.equal(dogrula({ origin: "http://localhost:8000" }, yerelEnv).ok, true);
    assert.equal(dogrula({ origin: "http://127.0.0.1:8123" }, yerelEnv).ok, true);
    // yerel izin açıkken bile rastgele bir site geçemez
    assert.equal(dogrula({ origin: "https://baskasite.example" }, yerelEnv).ok, false);
  });

  test(`${ad}: ek köken ortam değişkeniyle eklenebiliyor`, () => {
    assert.equal(dogrula({ origin: "https://ornek.test" }).ok, false);
    assert.equal(dogrula({ origin: "https://ornek.test" }, ekEnv).ok, true);
    // varsayılan köken her hâlükârda geçerli kalmalı
    assert.equal(dogrula({ origin: IZINLI }, ekEnv).ok, true);
  });

  test(`${ad}: benzeyen ama farklı kökenler geçmiyor`, () => {
    for (const k of ["http://berke-aras.github.io", "https://berke-aras.github.io.kotu.example",
      "https://evil-berke-aras.github.io", "https://berke-aras.github.io:8443"]) {
      assert.equal(dogrula({ origin: k }).ok, false, k);
    }
  });
}
