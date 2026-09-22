"use strict";
// Derleme adımı olmayan bir proje: tarayıcı dosyaları klasik <script> (module değil),
// scripts/ ve test/ ise CommonJS Node. Kural seti bilerek dar tutuldu — amaç stil dayatmak değil,
// gerçek hataları (tanımsız değişken, ulaşılamaz kod, yanlış kaçış) yakalamak.
const js = require("@eslint/js");

const tarayiciGlobals = {
  window: "readonly", document: "readonly", navigator: "readonly", location: "writable",
  history: "readonly", localStorage: "readonly", sessionStorage: "readonly", caches: "readonly",
  fetch: "readonly", Response: "readonly", URL: "readonly", URLSearchParams: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  requestAnimationFrame: "readonly", console: "readonly", CSS: "readonly", Event: "readonly",
  Hls: "readonly", performance: "readonly", self: "writable", AbortController: "readonly",
};

const nodeGlobals = {
  require: "readonly", module: "writable", process: "readonly", console: "readonly",
  __dirname: "readonly", __filename: "readonly", Buffer: "readonly", exports: "writable",
  setTimeout: "readonly", clearTimeout: "readonly", URL: "readonly", fetch: "readonly",
};

module.exports = [
  { ignores: ["kaynak/**", "meta.js", "cf/**/node_modules/**"] },
  js.configs.recommended,
  {
    files: ["app.js", "sw.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: tarayiciGlobals },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["scripts/**/*.js", "test/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "commonjs",
      // smoke-test.js'te page.evaluate() geri çağrıları tarayıcıda çalışıyor, o yüzden tarayıcı
      // global'leri de tanımlı sayılıyor.
      globals: { ...nodeGlobals, ...tarayiciGlobals },
    },
    rules: { "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }] },
  },
  {
    // Vercel function: CommonJS (module.exports), Fetch API ortamı.
    files: ["api/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "commonjs",
      globals: { module: "writable", require: "readonly", console: "readonly",
        fetch: "readonly", Response: "readonly", Request: "readonly", URL: "readonly",
        URLSearchParams: "readonly", AbortController: "readonly", setTimeout: "readonly",
        clearTimeout: "readonly", TextDecoder: "readonly", atob: "readonly", caches: "readonly" },
    },
    rules: { "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }] },
  },
  {
    // Cloudflare Worker: ESM (export default).
    files: ["cf/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "module",
      globals: { console: "readonly", fetch: "readonly", Response: "readonly", Request: "readonly",
        URL: "readonly", URLSearchParams: "readonly", AbortController: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", TextDecoder: "readonly", atob: "readonly", caches: "readonly" },
    },
    rules: { "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }] },
  },
];
