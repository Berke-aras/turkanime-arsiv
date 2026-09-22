#!/usr/bin/env node
// TürkAnime Arşivi — tarayıcı duman testi.
//
// Statik siteyi geçici bir HTTP sunucusunda yayınlar, headless Chromium'da açar ve GELISTIRME-PLANI.md
// maddelerinin kabul kriterlerini doğrular. Bir maddeyi bitirdikten sonra push etmeden önce çalıştır:
//
//   node scripts/smoke-test.js
//
// Playwright gerekir (küresel ya da yerel kurulum ikisi de olur):
//   npm i -D playwright   ·   ya da: npm i -g playwright
// Tarayıcı indirilmemişse: npx playwright install chromium
// (Claude Code web ortamında Chromium hazır gelir, indirme gerekmez.)

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(id); } catch { /* sıradakini dene */ }
  }
  console.error('Playwright bulunamadı. Kur: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel === '' ? 'index.html' : rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

const results = [];
const check = (ad, kosul, detay = '') => results.push({ ad, ok: !!kosul, detay });

async function run(page, base) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

  // --- ana sayfa ---
  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card', { timeout: 20000 });
  const kart = await page.locator('.card').count();
  check('ana sayfa kart basıyor', kart > 10, kart + ' kart');
  const stat = await page.locator('.stats-strip .stat-num').first().textContent();
  check('istatistik şeridi dolu', /\d/.test(stat || ''), stat);

  // --- arama (liste sayfasında) ---
  await page.fill('#search', 'naruto');
  await page.waitForTimeout(500);
  const ilk = await page.locator('.card').first().innerText().catch(() => '');
  check('ana sayfada arama', /naruto|boruto/i.test(ilk), ilk.split('\n')[0]);

  // --- detay sayfası ---
  await page.goto(base + '/index.html#/anime/beck', { waitUntil: 'networkidle' });
  await page.waitForSelector('.ep', { timeout: 20000 });
  const bolum = await page.locator('.ep').count();
  check('detay bölümleri basıyor', bolum > 5, bolum + ' bölüm');

  // --- §1.1: 'yol' tipi linkler pasif basılmalı, tıklanabilir buton olmamalı ---
  await page.locator('.ep[data-i="0"] .ep-head').click();
  await page.waitForTimeout(400);
  const alucard = page.locator('.ep[data-i="0"] .ep-links').getByText('ALUCARD(BETA)', { exact: true });
  const varMi = await alucard.count();
  const etiket = varMi ? await alucard.first().evaluate(el => el.tagName + '.' + el.className) : '';
  check("§1.1 'yol' linki pasif basılıyor", varMi > 0 && /^SPAN/.test(etiket) && /mask/.test(etiket), etiket || 'link bulunamadı');
  const embeds = await page.locator('.ep[data-i="0"] .ep-links [data-embed-url]').evaluateAll(e => e.map(x => x.dataset.embedUrl));
  const goreli = embeds.filter(u => !/^https?:/i.test(u));
  check("§1.1 göreli (ajax/) embed URL'i yok", goreli.length === 0, goreli.join(', '));

  // --- §1.2: detay sayfasındayken arama listeye dönmeli ---
  await page.fill('#search', 'beck');
  await page.waitForTimeout(600);
  const hash = await page.evaluate(() => location.hash);
  const kartSonra = await page.locator('.card').count();
  check('§1.2 detayda arama listeye dönüyor', /^#\/(\?|$)/.test(hash) && kartSonra > 0, `hash=${hash} kart=${kartSonra}`);

  // --- §1.3: filtreler hash'te, paylaşılabilir ve yenilemeye dayanıklı ---
  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  await page.selectOption('#f-sort', 'puan');
  await page.waitForTimeout(300);
  const sortHash = await page.evaluate(() => location.hash);
  check('§1.3 filtre hash\'e yazılıyor', /sort=puan/.test(sortHash), sortHash);
  await page.goto(base + '/index.html#/?kategori=TV&sort=puan&sayfa=2', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  const restored = await page.evaluate(() => ({
    sort: document.getElementById('f-sort').value,
    kategori: document.getElementById('f-kategori').value,
    kart: document.querySelectorAll('.grid:not(.recent-grid) .card').length,
  }));
  check('§1.3 hash yenilemede durumu geri yüklüyor',
    restored.sort === 'puan' && restored.kategori === 'TV' && restored.kart === 120,
    JSON.stringify(restored));

  // --- §1.3 + §1.6: detaydan geri dönünce kaydırma konumu korunur, detaya girince başa gider ---
  // filtreli hash kullanılıyor: filtresiz ana sayfada "Son bakılanlar" şeridi detay ziyaretinden
  // sonra büyüyüp listeyi aşağı kaydırdığı için piksel karşılaştırması anlamsız olurdu.
  await page.goto(base + '/index.html#/?kategori=TV&sayfa=3', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  // html'de scroll-behavior:smooth var; kaydırma oturana kadar bekle
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForFunction(() => Math.abs(window.scrollY - 1500) < 2, null, { timeout: 5000 });
  const oncekiY = await page.evaluate(() => window.scrollY);
  const kartHref = await page.locator('.grid:not(.recent-grid) .card').nth(20).getAttribute('href');
  await page.evaluate(h => { location.hash = h; }, kartHref);
  await page.waitForSelector('.ep, .detail', { timeout: 20000 });
  const detayY = await page.evaluate(() => window.scrollY);
  check('§1.6 detay sayfası başa kaydırıyor', detayY < 50, 'scrollY=' + detayY);
  await page.goBack();
  await page.waitForSelector('.card');
  await page.waitForTimeout(400);
  const geriDonus = await page.evaluate(() => ({ y: window.scrollY, kart: document.querySelectorAll('.grid:not(.recent-grid) .card').length }));
  check('§1.3 geri dönüşte konum ve kart sayısı korunuyor',
    Math.abs(geriDonus.y - oncekiY) < 60 && geriDonus.kart === 180,
    `${JSON.stringify(geriDonus)} beklenen y≈${oncekiY}`);

  // --- §1.4: tersten sıralamada "Sonraki" ekrandaki yönü izliyor ---
  await page.goto(base + '/index.html#/anime/beck', { waitUntil: 'networkidle' });
  await page.waitForSelector('#ep-reverse');
  const epNo = async () => (await page.locator('#player-modal-eplabel').textContent()).trim();
  const oynat = async () => {
    await page.locator('.ep[data-i="5"] .ep-head').click();
    await page.waitForTimeout(300);
    await page.locator('.ep[data-i="5"] .ep-links [data-embed-url]').first().click();
    await page.waitForTimeout(300);
  };
  await oynat();
  const duz = await epNo();
  await page.locator('#player-modal-next').click();
  await page.waitForTimeout(500);
  const duzSonraki = await epNo();
  check('§1.4 düz sırada "Sonraki" bir ileri gidiyor', duz === '6 / 26' && duzSonraki === '7 / 26', `${duz} -> ${duzSonraki}`);
  await page.locator('#player-modal-close').click();
  await page.locator('#ep-reverse').click();
  await page.waitForTimeout(300);
  await oynat();
  await page.locator('#player-modal-next').click();
  await page.waitForTimeout(500);
  const tersSonraki = await epNo();
  check('§1.4 tersten sırada "Sonraki" listede aşağı gidiyor', tersSonraki === '5 / 26', `6 / 26 -> ${tersSonraki}`);
  const prevBaslik = await page.locator('#player-modal-prev').getAttribute('title');
  check('§1.4 buton başlığı hedef bölümü söylüyor', /Önceki: .+Bölüm/.test(prevBaslik || ''), prevBaslik);
  await page.locator('#player-modal-close').click();
  await page.locator('#ep-reverse').click(); // varsayılana dön (localStorage'da kalıcı)

  // --- §1.7: arşivde olmayan slug temiz bir "bulunamadı" gösteriyor, 404 isteği atmıyor ---
  const istekler = [];
  const dinle = r => istekler.push(new URL(r.url()).pathname);
  page.on('request', dinle);
  await page.goto(base + '/index.html#/anime/boyle-bir-anime-yok', { waitUntil: 'networkidle' });
  await page.waitForSelector('.empty', { timeout: 10000 }).catch(() => {});
  page.off('request', dinle);
  const bulunamadi = await page.locator('.empty').textContent().catch(() => '');
  const bosIstek = istekler.filter(u => /boyle-bir-anime-yok/.test(u));
  check('§1.7 bilinmeyen slug "bulunamadı" gösteriyor', /bulunamadı/i.test(bulunamadi), bulunamadi.slice(0, 60));
  check('§1.7 bilinmeyen slug için veri isteği atılmıyor', bosIstek.length === 0, bosIstek.join(', '));

  // --- yasal sayfası ---
  await page.goto(base + '/index.html#/yasal', { waitUntil: 'networkidle' });
  await page.waitForSelector('.legal', { timeout: 10000 });
  check('yasal sayfası açılıyor', true);

  // --- §5.1: kartlar gerçek bağlantı, favori butonu iç içe değil ---
  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');

  // --- §2.1.1: data.js yalnız kullanılan 4 alanı taşıyor ---
  const indexAlan = await page.evaluate(() => ({
    kayit: window.INDEX.length,
    fazla: window.INDEX.filter(r => r.length !== 4).length,
    ornek: window.INDEX[0],
  }));
  check('§2.1.1 data.js kayıtları 4 alanlı', indexAlan.fazla === 0 && indexAlan.kayit > 6000,
    `${indexAlan.kayit} kayıt, ${indexAlan.fazla} fazla alanlı`);
  const kartMeta = await page.evaluate(() => {
    const c = document.querySelector('.grid:not(.recent-grid) .card');
    return c ? c.querySelector('.meta').textContent.trim() : '';
  });
  check('§2.1.1 kartta bölüm/link sayısı hâlâ doğru basılıyor', /\d+ bölüm · \d+ link|bölüm verisi yok/.test(kartMeta), kartMeta);

  const kartYapi = await page.evaluate(() => {
    const c = document.querySelector('.grid:not(.recent-grid) .card');
    const fav = document.querySelector('.grid:not(.recent-grid) .fav-btn');
    return {
      etiket: c.tagName,
      href: c.getAttribute('href'),
      role: c.getAttribute('role'),
      tabindex: c.getAttribute('tabindex'),
      favIcinde: !!c.querySelector('.fav-btn'),
      favSarmalayicida: fav.parentElement.classList.contains('card-wrap'),
      genislik: Math.round(c.getBoundingClientRect().width),
      sarmalayiciGenislik: Math.round(c.parentElement.getBoundingClientRect().width),
    };
  });
  check('§5.1 kart <a href> oldu', kartYapi.etiket === 'A' && /^#\/anime\/.+/.test(kartYapi.href || ''), `${kartYapi.etiket} ${kartYapi.href}`);
  check('§5.1 iç içe etkileşimli öğe yok', !kartYapi.favIcinde && kartYapi.favSarmalayicida && !kartYapi.role && !kartYapi.tabindex, JSON.stringify(kartYapi));
  check('§5.1 kart sarmalayıcıyı dolduruyor (düzen bozulmadı)', Math.abs(kartYapi.genislik - kartYapi.sarmalayiciGenislik) < 2, `${kartYapi.genislik} / ${kartYapi.sarmalayiciGenislik}`);
  const featuredEtiket = await page.locator('.featured').evaluate(e => e.tagName + ' ' + e.getAttribute('href'));
  check('§5.1 Günün Animesi kartı da bağlantı', /^A #\/anime\/.+/.test(featuredEtiket), featuredEtiket);

  // Ctrl+tık yeni sekmede açmalı
  const [yeniSekme] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null),
    page.locator('.grid:not(.recent-grid) .card').first().click({ modifiers: ['Control'] }),
  ]);
  // yeni sekme önce about:blank olarak açılıp sonra hedefe gidiyor; URL oturana kadar bekle
  if (yeniSekme) await yeniSekme.waitForURL(/#\/anime\//, { timeout: 10000 }).catch(() => {});
  check('§5.1 Ctrl+tık yeni sekmede açıyor', !!yeniSekme && /#\/anime\//.test(yeniSekme.url()), yeniSekme ? yeniSekme.url() : 'sekme açılmadı');
  if (yeniSekme) await yeniSekme.close();

  // favori butonu gezinmeyi tetiklememeli
  const hashOnce = await page.evaluate(() => location.hash);
  await page.locator('.grid:not(.recent-grid) .fav-btn').first().click();
  await page.waitForTimeout(300);
  const favDurum = await page.evaluate(() => ({
    hash: location.hash,
    aktif: document.querySelector('.grid:not(.recent-grid) .fav-btn').classList.contains('active'),
  }));
  check('§5.1 favori butonu gezinmiyor, favoriye ekliyor', favDurum.hash === hashOnce && favDurum.aktif, JSON.stringify(favDurum));
  await page.locator('.grid:not(.recent-grid) .fav-btn').first().click(); // geri al
  await page.waitForTimeout(200);

  // --- §1.5: service worker iki ayrı cache kullanıyor, veri cache'i LRU ile sınırlı ---
  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
  const swHazir = await page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));
  check('§1.5 service worker kaydoluyor', swHazir);
  if (swHazir) {
    const kabuk = await page.evaluate(async () => {
      const c = await caches.open('tka-shell-v5');
      const keys = (await c.keys()).map(r => new URL(r.url).pathname);
      return { data: keys.some(k => k.endsWith('/kaynak/data.js')), meta: keys.some(k => k.endsWith('/meta.js')), sayi: keys.length };
    });
    check('§1.5 katalog dosyaları kabuk cache\'inde', kabuk.data && kabuk.meta, JSON.stringify(kabuk));

    // 45 bölüm dosyası iste: veri cache'i 40 girişte kalmalı, kabuk cache'i kirlenmemeli
    const sluglar = await page.evaluate(n => window.INDEX.slice(0, n).map(r => r[0]), 45);
    await page.evaluate(async ss => {
      for (const s of ss) await fetch(`kaynak/b/${s}.js`).then(r => r.arrayBuffer()).catch(() => {});
    }, sluglar);
    await page.waitForTimeout(1500);
    const lru = await page.evaluate(async () => {
      const d = await caches.open('tka-data-v1');
      const sh = await caches.open('tka-shell-v5');
      const shKeys = (await sh.keys()).map(r => new URL(r.url).pathname);
      return { veri: (await d.keys()).length, kabuktaBolum: shKeys.filter(k => k.includes('/kaynak/b/')).length };
    });
    check('§1.5 veri cache\'i 40 girişi aşmıyor', lru.veri > 0 && lru.veri <= 40, lru.veri + ' giriş');
    check('§1.5 bölüm dosyaları kabuk cache\'ine sızmıyor', lru.kabuktaBolum === 0, lru.kabuktaBolum + ' sızıntı');

    // çevrimdışı ilk açılış: katalog kabukta olduğu için liste dolu gelmeli
    await page.context().setOffline(true);
    let cevrimdisiKart = 0;
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.card', { timeout: 15000 });
      cevrimdisiKart = await page.locator('.card').count();
    } catch (e) { /* aşağıda FAIL olarak raporlanır */ }
    check('§1.5 çevrimdışı açılışta liste dolu geliyor', cevrimdisiKart > 10, cevrimdisiKart + ' kart');
    await page.context().setOffline(false);
  }

  // --- konsol temiz mi (dış kaynak/ağ hataları hariç) ---
  const gercek = errors.filter(e => !/favicon|net::ERR|ERR_INTERNET|anilist|zgo\.at/i.test(e));
  check('konsol hatası yok', gercek.length === 0, gercek.slice(0, 3).join(' | '));
}

(async () => {
  const { chromium } = loadPlaywright();
  const { server, base } = await serve();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    await run(await ctx.newPage(), base);
  } finally {
    await browser.close();
    server.close();
  }
  let hata = 0;
  for (const r of results) { if (!r.ok) hata++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.ad}${r.detay ? '  — ' + r.detay : ''}`); }
  console.log(`\n${results.length - hata}/${results.length} geçti`);
  process.exit(hata ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ:', e); process.exit(2); });
