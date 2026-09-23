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
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.webm': 'video/webm', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

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
    const tip = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
      // Range desteği: <video> sarma (seek) yapabilmek için şart. GitHub Pages de destekliyor.
      const range = req.headers.range;
      const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        const bas = m[1] ? Number(m[1]) : 0;
        const son = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
        if (bas > son) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }).end(); return; }
        res.writeHead(206, {
          'content-type': tip, 'accept-ranges': 'bytes',
          'content-range': `bytes ${bas}-${son}/${st.size}`, 'content-length': son - bas + 1,
        });
        fs.createReadStream(file, { start: bas, end: son }).pipe(res);
        return;
      }
      res.writeHead(200, { 'content-type': tip, 'accept-ranges': 'bytes', 'content-length': st.size });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

const results = [];
const check = (ad, kosul, detay = '') => results.push({ ad, ok: !!kosul, detay });

// §6.1: tema kendi tarayıcı bağlamlarını gerektiriyor (colorScheme), o yüzden ayrı fonksiyon.
async function temaTestleri(browser, base) {
  const ac = async sema => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: sema });
    const p = await ctx.newPage();
    await p.route('**/*', r => {
      const host = new URL(r.request().url()).hostname;
      return (host === '127.0.0.1' || host === 'localhost') ? r.continue() : r.abort();
    });
    await p.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.card');
    return { ctx, p };
  };
  const durum = p => p.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    themeColor: (document.querySelector('meta[name="theme-color"]') || {}).content,
    baslik: (document.getElementById('theme-btn') || {}).title || '',
  }));

  const { ctx: c1, p: p1 } = await ac('light');
  const acik = await durum(p1);
  check('§6.1 sistem açık temada açık palet',
    acik.dataTheme === null && acik.bg === 'rgb(246, 247, 251)' && acik.themeColor === '#f6f7fb',
    JSON.stringify(acik));

  // düğme: sistem -> açık -> koyu
  await p1.click('#theme-btn'); await p1.waitForTimeout(150);
  const zorlaAcik = await durum(p1);
  await p1.click('#theme-btn'); await p1.waitForTimeout(150);
  const zorlaKoyu = await durum(p1);
  check('§6.1 düğme üç durumu dönüyor ve theme-color takip ediyor',
    zorlaAcik.dataTheme === 'light' && zorlaKoyu.dataTheme === 'dark'
    && zorlaKoyu.bg === 'rgb(10, 12, 17)' && zorlaKoyu.themeColor === '#0a0c11'
    && /koyu/i.test(zorlaKoyu.baslik),
    `${zorlaAcik.dataTheme} -> ${zorlaKoyu.dataTheme}, ${zorlaKoyu.themeColor}`);

  // seçim kalıcı mı
  await p1.reload({ waitUntil: 'domcontentloaded' });
  await p1.waitForSelector('.card');
  const yenilemeSonrasi = await durum(p1);
  check('§6.1 tema seçimi yenilemede kalıyor', yenilemeSonrasi.dataTheme === 'dark', JSON.stringify(yenilemeSonrasi));
  await c1.close();

  const { ctx: c2, p: p2 } = await ac('dark');
  const koyu = await durum(p2);
  check('§6.1 sistem koyu temada koyu palet',
    koyu.dataTheme === null && koyu.bg === 'rgb(10, 12, 17)' && koyu.themeColor === '#0a0c11',
    JSON.stringify(koyu));

  // açık temada bile oynatıcı modalı koyu kalmalı
  const { ctx: c3, p: p3 } = await ac('light');
  await p3.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await p3.waitForSelector('.ep');
  await p3.locator('.ep[data-i="0"] .ep-head').click();
  await p3.waitForTimeout(400);
  await p3.locator('.ep[data-i="0"] .ep-links [data-embed-url]').first().click();
  await p3.waitForTimeout(500);
  const modal = await p3.evaluate(() => getComputedStyle(document.getElementById('player-modal')).colorScheme);
  check('§6.1 oynatıcı modalı açık temada da koyu', modal === 'dark', modal);
  await c2.close(); await c3.close();
}

// §6.6: oynatıcı modalı. Resolver isteği yerel test videosuna yönlendirilerek gerçek <video>
// yolu uçtan uca sınanıyor (reklamsız oynatma, klavye, ses/hız hatırlama, otomatik gizlenme).
async function oynaticiTestleri(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route('**/*', r => {
    const u = r.request().url();
    if (/tka-sibnet|tka-uqload|api\/sibnet/.test(u)) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ url: base + '/test/fixtures/video.webm' }) });
    }
    const host = new URL(u).hostname;
    return (host === '127.0.0.1' || host === 'localhost') ? r.continue() : r.abort();
  });

  await p.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.ep');
  await p.locator('.ep[data-i="0"] .ep-head').click();
  await p.waitForTimeout(400);
  await p.locator('.ep[data-i="0"] .ep-links .link-btn.direct').first().click();

  // video gerçekten oynamaya başlasın
  let oynadi = false;
  try {
    await p.waitForFunction(() => {
      const v = document.getElementById('player-modal-video');
      return !v.hidden && v.readyState >= 2 && v.currentTime > 0;
    }, null, { timeout: 20000 });
    oynadi = true;
  } catch (e) { /* aşağıda FAIL */ }
  check('§6.6 reklamsız oynatma <video> ile çalışıyor', oynadi);
  if (!oynadi) { await ctx.close(); return; }

  const v = () => p.evaluate(() => {
    const x = document.getElementById('player-modal-video');
    return { t: x.currentTime, paused: x.paused, muted: x.muted, volume: Math.round(x.volume * 100) / 100, rate: x.playbackRate };
  });

  // --- klavye: boşluk duraklatır ---
  await p.keyboard.press('Space');
  await p.waitForTimeout(250);
  const durakladi = await v();
  check('§6.6 Boşluk oynat/duraklat', durakladi.paused === true, JSON.stringify(durakladi));

  // --- klavye: ok tuşları SARIYOR, bölüm değiştirmiyor ---
  const once = await v();
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(250);
  const sagSonra = await v();
  const epLabel = await p.locator('#player-modal-eplabel').textContent();
  check('§6.6 Sağ ok 10 sn ileri sarıyor (bölüm değiştirmiyor)',
    sagSonra.t > once.t + 5 && epLabel.trim() === '1 / 26', `${once.t.toFixed(1)} -> ${sagSonra.t.toFixed(1)}, ${epLabel.trim()}`);
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(250);
  const solSonra = await v();
  check('§6.6 Sol ok 10 sn geri sarıyor', solSonra.t < sagSonra.t, `${sagSonra.t.toFixed(1)} -> ${solSonra.t.toFixed(1)}`);

  // --- Shift+Ok bölüm değiştiriyor ---
  await p.keyboard.press('Shift+ArrowRight');
  await p.waitForTimeout(900);
  const yeniLabel = await p.locator('#player-modal-eplabel').textContent();
  check('§6.6 Shift+Sağ bölüm değiştiriyor', yeniLabel.trim() === '2 / 26', yeniLabel.trim());

  // --- M sessize alır, ses ve hız hatırlanır ---
  await p.waitForFunction(() => { const x = document.getElementById('player-modal-video'); return !x.hidden && x.readyState >= 2; }, null, { timeout: 20000 }).catch(() => {});
  await p.keyboard.press('m');
  await p.waitForTimeout(200);
  await p.locator('#player-modal-speed').click();   // 1x -> 1.25x
  await p.waitForTimeout(200);
  const ayar = await v();
  const saklanan = await p.evaluate(() => ({ ses: localStorage.getItem('ta_ses'), sessiz: localStorage.getItem('ta_sessiz'), hiz: localStorage.getItem('ta_hiz') }));
  check('§6.6 M sessize alıyor, tercih localStorage\'a yazılıyor',
    ayar.muted === true && saklanan.sessiz === 'true', JSON.stringify({ ayar, saklanan }));
  check('§6.6 oynatma hızı değişip saklanıyor', ayar.rate !== 1 && Number(saklanan.hiz) === ayar.rate, `${ayar.rate}x / ${saklanan.hiz}`);

  // --- yeniden açılışta hatırlanıyor mu ---
  await p.locator('#player-modal-close').click();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.ep');
  await p.locator('.ep[data-i="0"] .ep-head').click();
  await p.waitForTimeout(400);
  await p.locator('.ep[data-i="0"] .ep-links .link-btn.direct').first().click();
  await p.waitForFunction(() => { const x = document.getElementById('player-modal-video'); return !x.hidden && x.readyState >= 2; }, null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(400);
  const yeniden = await v();
  check('§6.6 ses ve hız tercihi yeni açılışta geri geliyor',
    yeniden.muted === true && yeniden.rate !== 1, JSON.stringify(yeniden));

  // --- kontrol çubuğu hareketsizlikte gizleniyor ---
  await p.evaluate(() => document.getElementById('player-modal-video').play().catch(() => {}));
  await p.mouse.move(640, 300);
  await p.waitForTimeout(3600);
  const gizli = await p.evaluate(() => document.getElementById('player-modal-viewport').classList.contains('kontrol-gizli'));
  await p.mouse.move(640, 320);
  await p.waitForTimeout(250);
  const geriGeldi = await p.evaluate(() => !document.getElementById('player-modal-viewport').classList.contains('kontrol-gizli'));
  check('§6.6 kontrol çubuğu 3 sn sonra gizlenip harekette geri geliyor', gizli && geriGeldi, `gizlendi=${gizli} geriGeldi=${geriGeldi}`);

  // --- tam ekran <video> değil viewport'u alıyor ---
  const tamEkranHedefi = await p.evaluate(async () => {
    const vp = document.getElementById('player-modal-viewport');
    let hedef = null;
    const asil = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function () { hedef = this.id; return Promise.resolve(); };
    document.getElementById('player-modal-fullscreen').click();
    Element.prototype.requestFullscreen = asil;
    void vp;
    return hedef;
  });
  check('§6.6 tam ekran viewport\'u alıyor (<video> değil)', tamEkranHedefi === 'player-modal-viewport', String(tamEkranHedefi));

  await ctx.close();
}

// Oynatıcı bilgi paneli (X-Ray): karakterler/seslendirmenler, fansub, duraklatınca açılma, AniSkip ile
// "Opening'i geç" ve "Şu an çalıyor". AniSkip isteği sahte bir aralıkla cevaplanıyor.
async function xrayTestleri(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  let aniskipUrl = '';
  await p.route('**/*', r => {
    const u = r.request().url();
    if (/tka-sibnet|tka-uqload|api\/sibnet/.test(u)) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ url: base + '/test/fixtures/video.webm' }) });
    }
    if (/api\.aniskip\.com/.test(u)) {
      aniskipUrl = u;
      const uzunluk = Number(new URL(u).searchParams.get('episodeLength')) || 10;
      return r.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ found: true, results: [
          { interval: { startTime: 1, endTime: Math.max(3, Math.min(uzunluk - 1, 6)) }, skipType: 'op', episodeLength: uzunluk },
        ] }) });
    }
    const host = new URL(u).hostname;
    return (host === '127.0.0.1' || host === 'localhost') ? r.continue() : r.abort();
  });

  await p.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.ep');
  await p.locator('.ep[data-i="0"] .ep-head').click();
  await p.waitForTimeout(400);
  await p.locator('.ep[data-i="0"] .ep-links .link-btn.direct').first().click();
  const oynadi = await p.waitForFunction(() => {
    const v = document.getElementById('player-modal-video');
    return !v.hidden && v.readyState >= 2 && v.currentTime > 0;
  }, null, { timeout: 20000 }).then(() => true, () => false);
  check('X-Ray: test videosu oynuyor', oynadi);
  if (!oynadi) { await ctx.close(); return; }

  // --- Bilgi düğmesi paneli açıyor: karakterler, seslendirmenler, fansub ---
  await p.locator('#player-modal-xray').click();
  await p.waitForSelector('#player-xray .xray-kisi', { timeout: 5000 }).catch(() => {});
  const panel = await p.evaluate(() => {
    const el = document.getElementById('player-xray');
    return { acik: !el.hidden, kisi: el.querySelectorAll('.xray-kisi').length, metin: el.textContent,
      basili: document.getElementById('player-modal-xray').getAttribute('aria-pressed') };
  });
  check('X-Ray: Bilgi düğmesi karakter ve seslendirmenleri gösteriyor',
    panel.acik && panel.kisi > 0 && /Seslendirmen/.test(panel.metin) && panel.basili === 'true', `kişi=${panel.kisi}`);
  // Beck'in ilk reklamsız linkinin fansub'ı veride "Varsayılan": anlamsız olduğu için yazılmamalı.
  check('X-Ray: panelde bölüm numarası var, "Çeviri: Varsayılan" yazmıyor', /1\. bölüm/.test(panel.metin) && !/Varsayılan/.test(panel.metin));
  // AniList CDN'i testte kapalı: görseller kırık resim yerine baş harflere düşmeli.
  await p.waitForTimeout(300);
  const kirik = await p.evaluate(() => [...document.querySelectorAll('#player-xray img')].filter(i => i.complete && !i.naturalWidth).length);
  check('X-Ray: yüklenemeyen görseller baş harflere düşüyor', kirik === 0, `kırık=${kirik}`);
  check('X-Ray: panelde bölümün şarkıları var (Beck: Hit in the USA)', /Hit in the USA/.test(panel.metin));

  // --- Esc önce paneli kapatıyor, oynatıcıyı değil ---
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  const escSonra = await p.evaluate(() => ({ panel: !document.getElementById('player-xray').hidden, modal: !document.getElementById('player-modal').hidden }));
  check('X-Ray: Esc paneli kapatıyor, oynatıcı açık kalıyor', !escSonra.panel && escSonra.modal, JSON.stringify(escSonra));

  // --- I tuşu aç/kapat ---
  await p.keyboard.press('i');
  await p.waitForTimeout(150);
  const iActi = await p.evaluate(() => !document.getElementById('player-xray').hidden);
  await p.keyboard.press('i');
  await p.waitForTimeout(150);
  const iKapatti = await p.evaluate(() => document.getElementById('player-xray').hidden);
  check('X-Ray: I tuşu paneli açıp kapatıyor', iActi && iKapatti, `açtı=${iActi} kapattı=${iKapatti}`);

  // --- AniSkip: MAL kimliği, bölüm no ve süreyle soruluyor ---
  await p.waitForTimeout(300);
  check('X-Ray: AniSkip MAL kimliği + bölüm + süre ile soruluyor',
    /skip-times\/57\/1\?/.test(aniskipUrl) && /episodeLength=\d+/.test(aniskipUrl), aniskipUrl);

  // --- opening aralığında "geç" düğmesi ve "Şu an çalıyor" ---
  await p.evaluate(() => { const v = document.getElementById('player-modal-video'); v.pause(); v.currentTime = 1.5; });
  await p.waitForTimeout(400);
  const opDurum = await p.evaluate(() => ({
    gec: !document.getElementById('player-xray-gec').hidden, gecMetin: document.getElementById('player-xray-gec').textContent,
    muzik: !document.getElementById('player-xray-muzik').hidden, muzikMetin: document.getElementById('player-xray-muzik').textContent,
  }));
  check('X-Ray: opening sırasında "Opening\'i geç" düğmesi çıkıyor', opDurum.gec && /Opening'i geç/.test(opDurum.gecMetin), opDurum.gecMetin);
  check('X-Ray: opening sırasında "Şu an çalıyor" şarkıyı gösteriyor',
    opDurum.muzik && /Şu an çalıyor/.test(opDurum.muzikMetin) && /Hit in the USA/.test(opDurum.muzikMetin), opDurum.muzikMetin);
  await p.locator('#player-xray-gec').click();
  await p.waitForTimeout(300);
  const gecSonra = await p.evaluate(() => ({ t: document.getElementById('player-modal-video').currentTime,
    gec: !document.getElementById('player-xray-gec').hidden, muzik: !document.getElementById('player-xray-muzik').hidden }));
  check('X-Ray: "geç" opening sonuna sarıyor, etiket ve düğme kayboluyor',
    gecSonra.t >= 2.9 && !gecSonra.gec && !gecSonra.muzik, JSON.stringify(gecSonra));

  // --- duraklatınca panel kendiliğinden açılıyor, oynatınca kapanıyor ---
  await p.evaluate(() => { const v = document.getElementById('player-modal-video'); v.currentTime = 0.3; return v.play().catch(() => {}); });
  await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('player-modal-video').pause());
  await p.waitForTimeout(1100);
  const durakAcik = await p.evaluate(() => !document.getElementById('player-xray').hidden);
  // panel açıkken oynat düğmesi panelin altında kalmamalı (kontrol çubuğu panelin üstünde)
  const oynatErisilir = await p.evaluate(() => {
    const b = document.getElementById('player-modal-playtoggle'), r = b.getBoundingClientRect();
    return b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  check('X-Ray: panel açıkken oynat düğmesi erişilebilir', durakAcik && oynatErisilir);
  await p.evaluate(() => document.getElementById('player-modal-video').play().catch(() => {}));
  await p.waitForTimeout(300);
  const oynatKapali = await p.evaluate(() => document.getElementById('player-xray').hidden);
  check('X-Ray: duraklatınca panel açılıyor, oynatınca kapanıyor', durakAcik && oynatKapali, `açıldı=${durakAcik} kapandı=${oynatKapali}`);

  // --- kapatınca her şey sıfırlanıyor ---
  await p.locator('#player-modal-close').click();
  const kapaninca = await p.evaluate(() => ['player-xray', 'player-xray-gec', 'player-xray-muzik'].every(id => document.getElementById(id).hidden));
  check('X-Ray: oynatıcı kapanınca panel, etiket ve düğme gizleniyor', kapaninca);
  await ctx.close();

  // --- telefon: "Şu an çalıyor" etiketinin üstüne dokunmak videoyu duraklatmalı (etiket dokunuşu yutmasın) ---
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const m = await mctx.newPage();
  await m.route('**/*', r => {
    const u = r.request().url();
    if (/tka-sibnet|tka-uqload|api\/sibnet/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ url: base + '/test/fixtures/video.webm' }) });
    if (/api\.aniskip\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ found: true, results: [{ interval: { startTime: 0, endTime: 8 }, skipType: 'op' }] }) });
    const host = new URL(u).hostname;
    return (host === '127.0.0.1' || host === 'localhost') ? r.continue() : r.abort();
  });
  await m.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await m.waitForSelector('.ep');
  await m.locator('.ep[data-i="0"] .ep-head').tap();
  await m.waitForTimeout(400);
  await m.locator('.ep[data-i="0"] .ep-links .link-btn.direct').first().tap();
  const etiket = await m.waitForSelector('#player-xray-muzik:not([hidden])', { timeout: 20000 }).then(() => true, () => false);
  let durdu = false, tasma = true;
  if (etiket) {
    const k = await m.locator('#player-xray-muzik').boundingBox();
    await m.touchscreen.tap(k.x + k.width / 2, k.y + k.height / 2);
    await m.waitForTimeout(1100);
    durdu = await m.evaluate(() => document.getElementById('player-modal-video').paused && !document.getElementById('player-xray').hidden);
    tasma = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  }
  check('X-Ray mobil: etiketin üstüne dokunmak videoyu duraklatıp paneli açıyor', etiket && durdu, `etiket=${etiket} durdu=${durdu}`);
  check('X-Ray mobil: 390 px\'te yatay taşma yok', etiket && !tasma);
  await mctx.close();
}

// §7.1 / §7.2: izleme konumu ve izlendi işareti. Gerçek <video> gerektiği için resolver
// yerel test videosuna yönlendiriliyor (oynatıcı testleriyle aynı yöntem).
// §7.3 yedek indirme / geri yükleme + §7.5 "/" kısayolu.
async function yedekTestleri(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  await p.route('**/*', r => {
    const host = new URL(r.request().url()).hostname;
    return (host === '127.0.0.1' || host === 'localhost') ? r.continue() : r.abort();
  });
  await p.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.card');

  // --- §7.5: "/" arama kutusuna odaklanıyor ---
  await p.evaluate(() => document.body.focus());
  await p.keyboard.press('/');
  const odak = await p.evaluate(() => document.activeElement && document.activeElement.id);
  check('§7.5 "/" arama kutusuna odaklanıyor', odak === 'search', odak);
  const yazilan = await p.evaluate(() => document.getElementById('search').value);
  check('§7.5 "/" karakteri kutuya yazılmıyor', yazilan === '', JSON.stringify(yazilan));
  await p.keyboard.press('Escape');
  const odakSonra = await p.evaluate(() => document.activeElement && document.activeElement.id);
  check('§7.5 Esc odaktan çıkarıyor', odakSonra !== 'search', String(odakSonra));

  // --- §7.3: veri yaz, yedeği indir ---
  await p.evaluate(() => {
    localStorage.setItem('ta_favs', JSON.stringify(['beck', 'naruto']));
    localStorage.setItem('ta_recent', JSON.stringify(['beck']));
    localStorage.setItem('ta_progress', JSON.stringify({ beck: { ep: 3, t: 120, d: 1400, u: 500, izlendi: [0, 1] } }));
    localStorage.setItem('ta_tema', '"acik"');
  });
  await p.goto(base + '/index.html#/yasal', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#veri-indir');
  const [indirme] = await Promise.all([p.waitForEvent('download'), p.click('#veri-indir')]);
  const yol = await indirme.path();
  const yedek = JSON.parse(fs.readFileSync(yol, 'utf8'));
  check('§7.3 yedek dosyası indiriliyor',
    yedek.uygulama === 'turkanime-arsiv' && Array.isArray(yedek.veri.ta_favs) && yedek.veri.ta_favs.includes('beck'),
    indirme.suggestedFilename());
  check('§7.3 yedekte izleme kaydı da var',
    !!(yedek.veri.ta_progress && yedek.veri.ta_progress.beck && yedek.veri.ta_progress.beck.ep === 3),
    JSON.stringify(yedek.veri.ta_progress));

  // --- §7.3: farklı veriyle geri yükleme birleştiriyor, ezmiyor ---
  await p.evaluate(() => {
    localStorage.setItem('ta_favs', JSON.stringify(['one-piece']));
    localStorage.setItem('ta_progress', JSON.stringify({ beck: { ep: 9, t: 5, d: 1400, u: 9000, izlendi: [8] } }));
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#veri-indir');
  await p.setInputFiles('#veri-dosya', yol);
  await p.waitForFunction(() => /Geri yüklendi|Restored/.test(document.getElementById('veri-durum').textContent), null, { timeout: 5000 })
    .catch(() => {});
  const durumMetni = await p.evaluate(() => document.getElementById('veri-durum').textContent);
  await p.waitForTimeout(1800); // arayüz kendini tazeliyor
  const sonrasi = await p.evaluate(() => ({
    favs: JSON.parse(localStorage.getItem('ta_favs') || '[]'),
    prog: JSON.parse(localStorage.getItem('ta_progress') || '{}').beck,
  }));
  check('§7.3 geri yükleme favorileri birleştiriyor',
    sonrasi.favs.includes('one-piece') && sonrasi.favs.includes('beck') && sonrasi.favs.includes('naruto'),
    sonrasi.favs.join(', '));
  check('§7.3 geri yükleme cihazdaki yeni konumu ezmiyor, işaretleri birleştiriyor',
    sonrasi.prog && sonrasi.prog.ep === 9 && JSON.stringify(sonrasi.prog.izlendi) === '[0,1,8]',
    JSON.stringify(sonrasi.prog));
  check('§7.3 kullanıcıya özet gösteriliyor', /Geri yüklendi|Restored/.test(durumMetni), durumMetni);

  // --- §6.8: onay yasal sayfasından geri alınabiliyor ---
  await p.goto(base + '/index.html#/yasal', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#veri-indir');
  await p.evaluate(() => localStorage.setItem('ta_18', 'true'));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#veri-indir');
  const dugmeGorunur = await p.evaluate(() => !document.getElementById('yas-geri-al').hidden);
  await p.click('#yas-geri-al');
  await p.waitForTimeout(200);
  const geriAlindi = await p.evaluate(() => ({
    kayit: localStorage.getItem('ta_18'),
    gizli: document.getElementById('yas-geri-al').hidden,
    durum: document.getElementById('veri-durum').textContent,
  }));
  check('§6.8 18+ onayı yasal sayfasından geri alınıyor',
    dugmeGorunur && geriAlindi.kayit === 'false' && geriAlindi.gizli && /18\+/.test(geriAlindi.durum),
    JSON.stringify(geriAlindi));

  // yasal metinde yeni bölümler duruyor mu
  const yasalBasliklar = await p.evaluate(() =>
    [...document.querySelectorAll('.legal h3')].map(h => h.textContent.trim()));
  const beklenen = ['Adult Content', 'Data Stored in Your Browser', 'Disclaimer',
    'Yetişkin İçerik ve Yaş Sınırı', 'Tarayıcında Saklanan Veriler', 'Sorumluluk Reddi',
    'Barındırma ve 5651 Sayılı Kanun'];
  const eksik = beklenen.filter(b => !yasalBasliklar.some(h => h.includes(b)));
  check('yasal sayfada yeni bölümler var (iki dilde)', eksik.length === 0, eksik.join(' | ') || yasalBasliklar.length + ' başlık');

  // --- §7.3: yanlış dosya anlaşılır hata veriyor ---
  const kotuYol = path.join(os.tmpdir(), 'tka-kotu-yedek.json');
  fs.writeFileSync(kotuYol, JSON.stringify({ uygulama: 'baska-sey', veri: {} }));
  await p.goto(base + '/index.html#/yasal', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#veri-indir');
  await p.setInputFiles('#veri-dosya', kotuYol);
  await p.waitForTimeout(400);
  const hata = await p.evaluate(() => {
    const el = document.getElementById('veri-durum');
    return { metin: el.textContent, hataMi: el.classList.contains('veri-hata') };
  });
  check('§7.3 yabancı dosya reddediliyor', hata.hataMi && /yedeği değil|not a TürkAnime/.test(hata.metin), JSON.stringify(hata));
  fs.unlinkSync(kotuYol);
  await ctx.close();
}

async function ilerlemeTestleri(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route('**/*', r => {
    const u = r.request().url();
    if (/tka-sibnet|tka-uqload|api\/sibnet/.test(u)) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ url: base + '/test/fixtures/video.webm' }) });
    }
    const host = new URL(u).hostname;
    return (host === '127.0.0.1' || host === 'localhost') ? r.continue() : r.abort();
  });

  // Test videosu 9.5 sn; sonuna gelince uygulama otomatik sonraki bölüme geçiyor (doğru davranış,
  // §1.4). Ölçümler bu geçişten etkilenmesin diye açar açmaz duraklatılıyor.
  const bolumAc = async i => {
    await p.locator(`.ep[data-i="${i}"] .ep-head`).click();
    await p.waitForTimeout(400);
    await p.locator(`.ep[data-i="${i}"] .ep-links .link-btn.direct`).first().click();
    await p.waitForFunction(() => {
      const v = document.getElementById('player-modal-video');
      return !v.hidden && v.readyState >= 2;
    }, null, { timeout: 20000 });
    await p.evaluate(() => document.getElementById('player-modal-video').pause());
  };

  await p.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.ep');
  await bolumAc(1);

  // 6 saniyeye sar; seek de timeupdate tetikliyor, kayıt 5 sn'lik kısıtla yazılıyor
  await p.evaluate(() => { document.getElementById('player-modal-video').currentTime = 6; });
  await p.waitForFunction(() => {
    const k = JSON.parse(localStorage.getItem('ta_progress') || '{}').beck;
    return k && k.ep === 1 && k.t > 5;
  }, null, { timeout: 15000 }).catch(() => {});
  const kayit = await p.evaluate(() => JSON.parse(localStorage.getItem('ta_progress') || '{}').beck || null);
  check('§7.1 izleme konumu kaydediliyor', !!kayit && kayit.ep === 1 && kayit.t > 5 && kayit.d > 0, JSON.stringify(kayit));

  // modalı kapat, aynı bölümü yeniden aç: kaldığı yerden devam etmeli
  await p.locator('#player-modal-close').click();
  await p.waitForTimeout(300);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.ep');
  await bolumAc(1);
  await p.waitForTimeout(600);
  const devamT = await p.evaluate(() => document.getElementById('player-modal-video').currentTime);
  check('§7.1 kaldığı yerden devam ediyor', devamT > 4, devamT.toFixed(1) + ' sn');

  // %90'ı geçince bölüm otomatik izlendi işaretleniyor (duraklatılmış hâlde, sadece sarma ile)
  await p.evaluate(() => { const v = document.getElementById('player-modal-video'); v.pause(); v.currentTime = v.duration - 0.4; });
  await p.waitForFunction(() => {
    const k = JSON.parse(localStorage.getItem('ta_progress') || '{}').beck;
    return k && Array.isArray(k.izlendi) && k.izlendi.includes(1);
  }, null, { timeout: 15000 }).catch(() => {});
  const otomatik = await p.evaluate(() => (JSON.parse(localStorage.getItem('ta_progress') || '{}').beck || {}).izlendi || []);
  check('§7.2 %90 geçilince bölüm otomatik izlendi sayılıyor', otomatik.includes(1), JSON.stringify(otomatik));
  await p.locator('#player-modal-close').click();
  await p.waitForTimeout(200);

  // hiç izlenmemişken rozet gerçekten gizli olmalı ([hidden] ile display çakışması)
  const rozetBaslangic = await p.evaluate(() => {
    const r = document.getElementById('ep-izlenen');
    return r ? { hidden: r.hidden, display: getComputedStyle(r).display } : null;
  });
  check('§7.2 izlenen rozeti hiç izlenmemişken görünmüyor',
    !!rozetBaslangic && rozetBaslangic.display === 'none', JSON.stringify(rozetBaslangic));

  // tik düğmesi: tekil işaretleme
  await p.locator('.ep[data-i="4"] .ep-izle').click({ force: true });
  await p.waitForTimeout(250);
  const tekil = await p.evaluate(() => ({
    sinif: document.querySelector('.ep[data-i="4"]').classList.contains('ep-izlendi'),
    kayit: (JSON.parse(localStorage.getItem('ta_progress') || '{}').beck || {}).izlendi || [],
  }));
  check('§7.2 tik düğmesi bölümü izlendi işaretliyor', tekil.sinif && tekil.kayit.includes(4), JSON.stringify(tekil));

  // Shift+tık: buraya kadar hepsi
  await p.locator('.ep[data-i="9"] .ep-izle').click({ force: true, modifiers: ['Shift'] });
  await p.waitForTimeout(300);
  const toplu = await p.evaluate(() => ({
    kayit: (JSON.parse(localStorage.getItem('ta_progress') || '{}').beck || {}).izlendi || [],
    isaretli: document.querySelectorAll('.ep.ep-izlendi').length,
    rozet: (document.getElementById('ep-izlenen') || {}).hidden === false
      ? document.querySelector('#ep-izlenen span').textContent : '',
  }));
  check('§7.2 Shift+tık buraya kadar hepsini işaretliyor',
    toplu.kayit.length === 10 && toplu.isaretli === 10 && /10 \/ 26/.test(toplu.rozet), JSON.stringify(toplu));

  // ana sayfada "İzlemeye devam et" şeridi ve kartta ilerleme çubuğu
  await p.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.card');
  const devamSerit = await p.evaluate(() => {
    const basliklar = [...document.querySelectorAll('.section-title')].map(e => e.firstChild.textContent.trim());
    const cubuk = document.querySelector('.ilerleme i');
    return { basliklar, cubukVar: !!cubuk, genislik: cubuk ? cubuk.style.width : '' };
  });
  check('§7.1 ana sayfada "İzlemeye devam et" şeridi çıkıyor',
    devamSerit.basliklar[0] === 'İzlemeye devam et', devamSerit.basliklar.join(' | '));
  check('§7.1 kartta ilerleme çubuğu var', devamSerit.cubukVar && /%$/.test(devamSerit.genislik), devamSerit.genislik);

  await ctx.close();
}

async function run(page, base) {
  // Üçüncü taraf istekleri engelleniyor: test bizim uygulamamızı ölçüyor, AniList CDN'ini ya da
  // sayacı değil. Böylece internetli (CI) ve internetsiz ortamlarda aynı biçimde çalışıyor.
  await page.route('**/*', r => {
    const host = new URL(r.request().url()).hostname;
    return (host === '127.0.0.1' || host === 'localhost') ? r.continue() : r.abort();
  });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

  // --- ana sayfa ---
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 20000 });
  const kart = await page.locator('.card').count();
  check('ana sayfa kart basıyor', kart > 10, kart + ' kart');
  const stat = await page.locator('.stats-strip .stat-num').first().textContent();
  check('istatistik şeridi dolu', /\d/.test(stat || ''), stat);

  // --- §2.5: kapak yükleme ipuçları ---
  const kapak = await page.evaluate(() => {
    const boyutu = u => ((/cover\/([a-z]+)\//i.exec(u) || [])[1] || '?');
    const izgara = [...document.querySelectorAll('.grid:not(.recent-grid) .card img')];
    const serit = [...document.querySelectorAll('.recent-grid img')];
    const one = document.querySelector('.featured-poster img');
    return {
      preconnect: !!document.querySelector('link[rel=preconnect][href*="anilist"]'),
      oneYukleme: one && one.getAttribute('loading'),
      oneOncelik: one && one.getAttribute('fetchpriority'),
      ilkEager: izgara[0] && izgara[0].getAttribute('loading'),
      sonLazy: izgara[izgara.length - 1] && izgara[izgara.length - 1].getAttribute('loading'),
      eager: izgara.filter(e => e.getAttribute('loading') === 'eager').length,
      kodlamaEksik: [...izgara, ...serit].filter(e => e.getAttribute('decoding') !== 'async').length,
      seritBoyut: serit.length ? boyutu(serit[0].src) : '-',
      izgaraBoyut: izgara.length ? boyutu(izgara[0].src) : '-',
      dpr: devicePixelRatio,
    };
  });
  check('§2.5 AniList CDN\'i için preconnect var', kapak.preconnect);
  check('§2.5 Günün Animesi kapağı öncelikli (LCP öğesi)',
    kapak.oneYukleme === 'eager' && kapak.oneOncelik === 'high', JSON.stringify([kapak.oneYukleme, kapak.oneOncelik]));
  check('§2.5 ilk kartlar eager, geri kalanı lazy',
    kapak.ilkEager === 'eager' && kapak.sonLazy === 'lazy' && kapak.eager >= 4 && kapak.eager <= 8,
    `${kapak.eager} eager`);
  check('§2.5 tüm kapaklarda decoding="async"', kapak.kodlamaEksik === 0, kapak.kodlamaEksik + ' eksik');
  check('§2.5 şerit kartları küçük kapak kullanıyor (DPR<1.5)',
    kapak.dpr >= 1.5 ? kapak.seritBoyut === 'medium' : kapak.seritBoyut === 'small',
    `dpr ${kapak.dpr} → şerit ${kapak.seritBoyut}, ızgara ${kapak.izgaraBoyut}`);
  check('§2.5 ızgara kapakları medium kalıyor', kapak.izgaraBoyut === 'medium', kapak.izgaraBoyut);


  // --- arama (liste sayfasında) ---
  await page.fill('#search', 'naruto');
  await page.waitForTimeout(500);
  const ilk = await page.locator('.card').first().innerText().catch(() => '');
  check('ana sayfada arama', /naruto|boruto/i.test(ilk), ilk.split('\n')[0]);

  // --- §2.3: tam eşleşme varken bulanık tarama yapılmıyor ---
  const tamSonuc = await page.evaluate(() =>
    [...document.querySelectorAll('.grid:not(.recent-grid) .card h3')].map(h => h.textContent));
  const yabanci = tamSonuc.filter(t => !/naruto/i.test(t));
  check('§2.3 tam eşleşmede bulanık sonuç karışmıyor',
    tamSonuc.length > 0 && yabanci.length === 0, `${tamSonuc.length} sonuç, ${yabanci.length} yabancı: ${yabanci.slice(0, 3).join(', ')}`);

  // --- §2.3: yazım hatasında bulanık taramaya düşülüyor ---
  await page.fill('#search', 'narutoo');
  await page.waitForTimeout(500);
  const hataliSonuc = await page.locator('.grid:not(.recent-grid) .card').count();
  check('§2.3 yazım hatasında bulanık tarama devrede', hataliSonuc > 0, hataliSonuc + ' sonuç');

  // --- §2.1.4: ekran dışı kartlar düzenden çıkarılıyor ---
  const cv = await page.evaluate(() => {
    const w = document.querySelector('.card-wrap');
    return w ? getComputedStyle(w).contentVisibility : '';
  });
  check('§2.1.4 kartlarda content-visibility:auto', cv === 'auto', cv);

  // --- §2.1.5: yazı tipi kendi sunucumuzdan, üçüncü taraf istek yok ---
  const yaziTipi = await page.evaluate(async () => {
    const ucuncuTaraf = [...document.querySelectorAll('link[href],script[src]')]
      .map(e => e.href || e.src).filter(u => u && !u.startsWith(location.origin));
    // document.fonts yüklenen yüzleri sayar; Inter gelmemişse liste boş kalır
    await document.fonts.ready;
    const inter = [...document.fonts].filter(f => f.family === 'Inter');
    const govde = getComputedStyle(document.body).fontFamily;
    return {
      ucuncuTaraf: ucuncuTaraf.filter(u => /fonts\.(googleapis|gstatic)\.com/.test(u)),
      yuklu: inter.filter(f => f.status === 'loaded').length,
      yuz: inter.length,
      govde,
    };
  });
  check('§2.1.5 Google Fonts isteği kalmadı', yaziTipi.ucuncuTaraf.length === 0, yaziTipi.ucuncuTaraf.join(', '));
  check('§2.1.5 Inter kendi sunucumuzdan yükleniyor',
    yaziTipi.yuz >= 2 && yaziTipi.yuklu >= 1 && /Inter/.test(yaziTipi.govde),
    JSON.stringify(yaziTipi));
  await page.fill('#search', '');
  await page.waitForTimeout(400);

  // --- detay sayfası ---
  await page.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ep', { timeout: 20000 });
  const bolum = await page.locator('.ep').count();
  check('detay bölümleri basıyor', bolum > 5, bolum + ' bölüm');

  // --- §1.1: 'yol' tipi linkler pasif basılmalı, tıklanabilir buton olmamalı ---
  await page.locator('.ep[data-i="0"] .ep-head').click();
  await page.waitForTimeout(400);
  // §3.2 sonrası ölü linkler veride yok; ekranda ne pasif buton ne de göreli adres kalmalı.
  const alucard = await page.locator('.ep[data-i="0"] .ep-links').getByText('ALUCARD(BETA)', { exact: true }).count();
  const maskeli = await page.locator('.ep[data-i="0"] .ep-links .link-btn.mask').count();
  check("§1.1 ölü sağlayıcı butonu basılmıyor", alucard === 0 && maskeli === 0, `ALUCARD ${alucard}, mask ${maskeli}`);
  const embeds = await page.locator('.ep[data-i="0"] .ep-links [data-embed-url]').evaluateAll(e => e.map(x => x.dataset.embedUrl));
  const goreli = embeds.filter(u => !/^https?:/i.test(u));
  check("§1.1 göreli (ajax/) embed URL'i yok", goreli.length === 0 && embeds.length > 0, `${embeds.length} embed, ${goreli.length} göreli`);

  // §3.2: ölü linkler tek satırlık özete indi
  const oluNot = await page.locator('.ep[data-i="0"] .ep-olu').textContent().catch(() => '');
  check('§3.2 ölü linkler tek satırda özetleniyor', /^\d+ arşiv linki artık çalışmıyor/.test(oluNot.trim()), oluNot.trim().slice(0, 60));
  // Asıl ölçüt: ekranda tek bir ölü buton kalmaması. Buton sayısı, o fansub'ın canlı link
  // sayısı + "Reklamsız izle" butonları kadar olmalı — ne eksik ne fazla.
  const butonDurum = await page.evaluate(() => {
    const kok = document.querySelector('.ep[data-i="0"] .ep-links');
    return {
      toplam: kok.querySelectorAll('.link-btn').length,
      olu: kok.querySelectorAll('.link-btn.mask').length,
      reklamsiz: kok.querySelectorAll('.link-btn.direct').length,
      embed: kok.querySelectorAll('[data-embed-url]:not(.direct)').length,
      disLink: kok.querySelectorAll('a.link-btn').length,
    };
  });
  check('§3.2 ekranda ölü buton kalmadı',
    butonDurum.olu === 0 && butonDurum.toplam === butonDurum.reklamsiz + butonDurum.embed + butonDurum.disLink,
    JSON.stringify(butonDurum));

  // --- §1.2: detay sayfasındayken arama listeye dönmeli ---
  await page.fill('#search', 'beck');
  await page.waitForTimeout(600);
  const hash = await page.evaluate(() => location.hash);
  const kartSonra = await page.locator('.card').count();
  check('§1.2 detayda arama listeye dönüyor', /^#\/(\?|$)/.test(hash) && kartSonra > 0, `hash=${hash} kart=${kartSonra}`);

  // --- §1.3: filtreler hash'te, paylaşılabilir ve yenilemeye dayanıklı ---
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');
  await page.selectOption('#f-sort', 'puan');
  await page.waitForTimeout(300);
  const sortHash = await page.evaluate(() => location.hash);
  check('§1.3 filtre hash\'e yazılıyor', /sort=puan/.test(sortHash), sortHash);
  await page.goto(base + '/index.html#/?kategori=TV&sort=puan&sayfa=2', { waitUntil: 'domcontentloaded' });
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
  await page.goto(base + '/index.html#/?kategori=TV&sayfa=3', { waitUntil: 'domcontentloaded' });
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
  await page.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
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
  await page.goto(base + '/index.html#/anime/boyle-bir-anime-yok', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.empty', { timeout: 10000 }).catch(() => {});
  page.off('request', dinle);
  const bulunamadi = await page.locator('.empty').textContent().catch(() => '');
  const bosIstek = istekler.filter(u => /boyle-bir-anime-yok/.test(u));
  check('§1.7 bilinmeyen slug "bulunamadı" gösteriyor', /bulunamadı/i.test(bulunamadi), bulunamadi.slice(0, 60));
  check('§1.7 bilinmeyen slug için veri isteği atılmıyor', bosIstek.length === 0, bosIstek.join(', '));

  // --- yasal sayfası ---
  await page.goto(base + '/index.html#/yasal', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.legal', { timeout: 10000 });
  check('yasal sayfası açılıyor', true);

  // --- §5.1: kartlar gerçek bağlantı, favori butonu iç içe değil ---
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
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

  // --- §3.3: yıl ve stüdyo verisi, yıl filtresi ve sıralaması ---
  const kartYil = await page.locator('.grid:not(.recent-grid) .card .meta').first().textContent();
  check('§3.3 kartta yıl görünüyor', /^\d{4} · /.test(kartYil.trim()), kartYil.trim());

  const posterSrc = await page.locator('.grid:not(.recent-grid) .poster img').first().getAttribute('src').catch(() => '');
  check('§2.1.2 poster URL\'i öneğiyle birleştirilmiş', /^https:\/\/s4\.anilist\.co\/.+\.(jpg|png|jpeg)$/i.test(posterSrc || ''), (posterSrc || '').slice(0, 70));

  // onyıl filtresi
  await page.selectOption('#f-onyil', '1990');
  await page.waitForTimeout(400);
  const onyilDurum = await page.evaluate(() => ({
    hash: location.hash,
    yillar: [...document.querySelectorAll('.grid:not(.recent-grid) .card .meta')]
      .map(e => Number((e.textContent.match(/^(\d{4}) · /) || [])[1])).filter(Boolean),
  }));
  const disari = onyilDurum.yillar.filter(y => y < 1990 || y > 1999);
  check('§3.3 onyıl filtresi yalnız o onyılı gösteriyor',
    onyilDurum.yillar.length > 10 && disari.length === 0 && /onyil=1990/.test(onyilDurum.hash),
    `${onyilDurum.yillar.length} kart, ${disari.length} dışarıda, ${onyilDurum.hash}`);

  // yeniden eskiye sıralama
  await page.selectOption('#f-onyil', '');
  await page.selectOption('#f-sort', 'yeni');
  await page.waitForTimeout(400);
  const sirali = await page.evaluate(() => [...document.querySelectorAll('.grid:not(.recent-grid) .card .meta')]
    .map(e => Number((e.textContent.match(/^(\d{4}) · /) || [])[1])).filter(Boolean));
  const azalan = sirali.every((y, i) => i === 0 || sirali[i - 1] >= y);
  check('§3.3 "yeniden eskiye" sıralaması azalan', azalan && sirali.length > 10,
    `${sirali.length} kart, ilk üç: ${sirali.slice(0, 3).join(', ')}`);

  // detayda Japonca başlık ve yayın yılı
  await page.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.detail-info');
  const detayEk = await page.evaluate(() => ({
    japonca: (document.querySelector('.detail-japonca') || {}).textContent || '',
    stats: (document.querySelector('.info-stats') || {}).textContent || '',
  }));
  check('§3.3 detayda Japonca başlık var', detayEk.japonca.trim() === 'ベック', detayEk.japonca.trim());
  check('§3.3 detayda yayın yılı aralığı var', /2004–2005/.test(detayEk.stats), detayEk.stats.replace(/\s+/g, ' ').trim());

  // sonraki kontroller liste sayfasında sürüyor
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');

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

  // --- §6.5: benzer animeler · §6.7: küçük dokunuşlar · şerit okları ---
  await page.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ep');
  const benzer = await page.evaluate(() => {
    const bolum = document.querySelector('.benzer-row');
    if (!bolum) return null;
    const kartlar = [...bolum.querySelectorAll('.card')];
    return {
      sayi: kartlar.length,
      kendisiVar: kartlar.some(k => k.getAttribute('href') === '#/anime/beck'),
      ilk: kartlar[0] ? kartlar[0].getAttribute('href') : '',
      okVar: !!bolum.querySelector('.serit-ok'),
    };
  });
  check('§6.5 detayda "Benzer animeler" şeridi var ve kendisini içermiyor',
    !!benzer && benzer.sayi >= 6 && !benzer.kendisiVar && benzer.okVar, JSON.stringify(benzer));

  // §6.7: şerit okları taşma varken görünür, tıklayınca kaydırır
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');
  await page.waitForTimeout(500);
  // Taşan bir şerit seç: kısa şeritlerde (ör. birkaç kartlık "Son bakılanlar") ok düğmeleri
  // bilerek gizli, onları tıklamaya çalışmak yanlış olur.
  const tasanIndeks = await page.evaluate(() => [...document.querySelectorAll('.serit-sar')]
    .findIndex(s => { const g = s.querySelector('.recent-grid'); return g.scrollWidth - g.clientWidth > 50; }));
  const serit = page.locator('.serit-sar').nth(Math.max(0, tasanIndeks));
  const okDurum = i => page.evaluate(n => {
    const s = document.querySelectorAll('.serit-sar')[n];
    const g = s.querySelector('.recent-grid');
    return { sol: s.querySelector('.serit-ok-sol').hidden, sag: s.querySelector('.serit-ok-sag').hidden,
      tasma: g.scrollWidth - g.clientWidth, kaydi: Math.round(g.scrollLeft) };
  }, i);
  const okOnce = await okDurum(Math.max(0, tasanIndeks));
  await serit.locator('.serit-ok-sag').click();
  await page.waitForTimeout(900);
  const okSonra = await okDurum(Math.max(0, tasanIndeks));
  check('§6.7 şerit okları görünüyor ve kaydırıyor',
    tasanIndeks >= 0 && okOnce.sol === true && okOnce.sag === false && okOnce.tasma > 50
    && okSonra.kaydi > okOnce.kaydi && okSonra.sol === false,
    `şerit#${tasanIndeks} ${JSON.stringify(okOnce)} -> ${JSON.stringify(okSonra)}`);

  // §6.7: filtre yüzünden boş sonuçta "filtreleri temizle"
  await page.goto(base + '/index.html#/?kategori=TV&tur=Hentai', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.empty', { timeout: 10000 });
  const bosVar = await page.evaluate(() => !!document.getElementById('filtre-temizle'));
  check('§6.7 filtre kaynaklı boş sonuçta "filtreleri temizle" düğmesi var', bosVar);
  if (bosVar) {
    await page.click('#filtre-temizle');
    await page.waitForTimeout(400);
    const temiz = await page.evaluate(() => ({ hash: location.hash, kart: document.querySelectorAll('.card').length }));
    check('§6.7 "filtreleri temizle" listeyi geri getiriyor',
      temiz.kart > 10 && !/tur=|kategori=/.test(temiz.hash), JSON.stringify(temiz));
  }

  // §6.7: Günün Animesi yanında ikinci rastgele girişi
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');
  const rastgeleVar = await page.evaluate(() => !!document.getElementById('featured-random'));
  check('§6.7 ana sayfada ikinci "rastgele" girişi var', rastgeleVar);
  if (rastgeleVar) {
    await page.click('#featured-random');
    await page.waitForTimeout(600);
    const gitti = await page.evaluate(() => location.hash);
    check('§6.7 rastgele düğmesi bir animeye götürüyor', /^#\/anime\/.+/.test(gitti), gitti);
  }

  // --- NSFW uyarıları + §6.8 yaş kapısı ---
  await page.evaluate(() => localStorage.removeItem('ta_18'));
  await page.goto(base + '/index.html#/anime/high-school-dxd', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.yas-kapi', { timeout: 20000 });
  const kapi = await page.evaluate(() => ({
    metin: document.querySelector('.yas-kapi').textContent.replace(/\s+/g, ' ').trim(),
    onay: !!document.getElementById('yas-onay'),
    cik: !!document.getElementById('yas-cik'),
    bolum: document.querySelectorAll('.ep').length,
    odak: document.activeElement && document.activeElement.id,
  }));
  check('§6.8 yetişkin başlıkta önce yaş kapısı çıkıyor, içerik gizli',
    kapi.onay && kapi.cik && kapi.bolum === 0 && /18 yaşından büyüğüm/.test(kapi.metin),
    JSON.stringify({ bolum: kapi.bolum, odak: kapi.odak }));

  // "Beni buradan çıkar" geri götürüyor
  await page.goto(base + '/index.html#/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');
  await page.evaluate(() => { location.hash = '#/anime/high-school-dxd'; });
  await page.waitForSelector('#yas-cik');
  await page.click('#yas-cik');
  await page.waitForTimeout(500);
  const cikilan = await page.evaluate(() => location.hash);
  check('§6.8 "Beni buradan çıkar" sayfadan çıkarıyor', !/high-school-dxd/.test(cikilan), cikilan);

  // onay verilince içerik açılıyor ve tercih hatırlanıyor
  await page.goto(base + '/index.html#/anime/high-school-dxd', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#yas-onay');
  await page.click('#yas-onay');
  await page.waitForSelector('.ep', { timeout: 20000 });
  const onaySonrasi = await page.evaluate(() => ({
    kayit: localStorage.getItem('ta_18'),
    bolum: document.querySelectorAll('.ep').length,
  }));
  check('§6.8 onaydan sonra içerik açılıyor ve tercih saklanıyor',
    onaySonrasi.kayit === 'true' && onaySonrasi.bolum > 0, JSON.stringify(onaySonrasi));

  await page.goto(base + '/index.html#/anime/high-school-dxd', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ep', { timeout: 20000 });
  const kapiTekrar = await page.evaluate(() => !!document.querySelector('.yas-kapi'));
  check('§6.8 onay verildikten sonra kapı tekrar sorulmuyor', !kapiTekrar);

  const nsfw = await page.evaluate(() => {
    const u = document.querySelector('.nsfw-uyari');
    return u ? { metin: u.textContent.replace(/\s+/g, ' ').trim(), rozet: !!u.querySelector('.nsfw-rozet') } : null;
  });
  check('NSFW: Ecchi animesinin detayında 18+ uyarısı var',
    !!nsfw && /18\+/.test(nsfw.metin) && /Yetişkin içerik/.test(nsfw.metin) && nsfw.rozet,
    nsfw ? nsfw.metin.slice(0, 70) : 'uyarı yok');

  await page.goto(base + '/index.html#/?tur=Ecchi', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');
  const rozetSayi = await page.evaluate(() => ({
    rozet: document.querySelectorAll('.yas-rozet').length,
    kart: document.querySelectorAll('.grid:not(.recent-grid) .card').length,
  }));
  check('NSFW: Ecchi listesindeki her kartta 18+ rozeti var',
    rozetSayi.rozet === rozetSayi.kart && rozetSayi.kart > 10, JSON.stringify(rozetSayi));

  // rozet kapağın sağ üstünde durmalı, başlık/tür yazılarının üstüne binmemeli
  const rozetYeri = await page.evaluate(() => {
    const kart = document.querySelector('.grid:not(.recent-grid) .card');
    const rozet = kart.querySelector('.yas-rozet');
    const poster = kart.querySelector('.poster');
    const baslik = kart.querySelector('h3');
    const r = rozet.getBoundingClientRect(), p = poster.getBoundingClientRect(), b = baslik.getBoundingClientRect();
    return {
      posterIcinde: r.top >= p.top - 1 && r.bottom <= p.bottom + 1,
      sagda: r.right > p.left + p.width / 2,
      yaziyaBinmiyor: r.bottom <= b.top + 1,
    };
  });
  check('§6.8 18+ rozeti kapağın sağ üstünde, yazılara binmiyor',
    rozetYeri.posterIcinde && rozetYeri.sagda && rozetYeri.yaziyaBinmiyor, JSON.stringify(rozetYeri));

  await page.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ep');
  const temizAnime = await page.evaluate(() => !!document.querySelector('.nsfw-uyari'));
  check('NSFW: normal animede uyarı çıkmıyor', !temizAnime);

  // --- §6.4: bölüm ızgarası ---
  await page.goto(base + '/index.html#/anime/one-piece', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ep', { timeout: 30000 });
  const gorunen = () => page.evaluate(() => [...document.querySelectorAll('.ep')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }).length);
  const listeGorunen = await gorunen();
  await page.click('#ep-view');
  await page.waitForTimeout(400);
  const izgaraGorunen = await gorunen();
  const izgaraSinif = await page.evaluate(() => document.getElementById('ep-list').className);
  check('§6.4 ızgara görünümü ekrana çok daha fazla bölüm sığdırıyor',
    izgaraSinif === 'izgara' && izgaraGorunen > listeGorunen * 10,
    `liste ${listeGorunen} -> ızgara ${izgaraGorunen}`);

  await page.locator('.ep[data-i="3"] .ep-head').click();
  await page.waitForTimeout(500);
  const acik = await page.evaluate(() => {
    const e = document.querySelector('.ep[data-i="3"]');
    const k = document.querySelector('.ep-kutular');
    return {
      tamGenislik: Math.abs(e.getBoundingClientRect().width - k.getBoundingClientRect().width) < 2,
      adGorunur: getComputedStyle(e.querySelector('.ep-ad')).display !== 'none',
      link: e.querySelectorAll('.link-btn').length,
    };
  });
  check('§6.4 açılan bölüm satırın tamamını kaplayıp linkleri gösteriyor',
    acik.tamGenislik && acik.adGorunur && acik.link > 0, JSON.stringify(acik));

  // tercih kalıcı mı
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ep', { timeout: 30000 });
  const kalici = await page.evaluate(() => document.getElementById('ep-list').className);
  check('§6.4 görünüm tercihi yenilemede kalıyor', kalici === 'izgara', kalici || '(boş)');
  await page.click('#ep-view');  // listeye geri dön (sonraki testler etkilenmesin)
  await page.waitForTimeout(300);

  // --- §6.2: ana sayfa keşif şeritleri ---
  await page.evaluate(() => localStorage.setItem('ta_recent',
    JSON.stringify(['beck', 'one-piece', 'naruto', 'bleach', 'death-note', 'steins-gate', 'hunter-x-hunter'])));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');
  const kesif = await page.evaluate(() => ({
    basliklar: [...document.querySelectorAll('.section-title')].map(e => e.firstChild.textContent.trim()),
    sonBakilan: document.querySelectorAll('.recent-row .card').length,
    janrCip: document.querySelectorAll('.janr-chip').length,
    janrHref: (document.querySelector('.janr-chip') || {}).getAttribute
      ? document.querySelector('.janr-chip').getAttribute('href') : '',
    enIyiPuanlar: (() => {
      const serit = [...document.querySelectorAll('.recent-row')]
        .find(r => r.querySelector('.section-title').firstChild.textContent.trim() === 'En yüksek puanlı');
      return serit ? [...serit.querySelectorAll('.rating-badge')].map(e => parseFloat(e.textContent)) : [];
    })(),
  }));
  check('§6.2 "En yüksek puanlı" ve "Janra göre keşfet" şeritleri var',
    kesif.basliklar.includes('En yüksek puanlı') && kesif.basliklar.includes('Janra göre keşfet'),
    kesif.basliklar.join(' | '));
  check('§6.2 en yüksek puanlı şeridi 12 kart ve hepsi 8+',
    kesif.enIyiPuanlar.length === 12 && kesif.enIyiPuanlar.every(p => p >= 8),
    `${kesif.enIyiPuanlar.length} kart, en düşük ${Math.min(...kesif.enIyiPuanlar)}`);
  check('§6.2 janr çipi filtreli listeye gidiyor',
    kesif.janrCip === 8 && /^#\/\?tur=/.test(kesif.janrHref), `${kesif.janrCip} çip, ${kesif.janrHref}`);
  check('§6.2 "Son bakılanlar" 6 ile sınırlı değil', kesif.sonBakilan >= 7, kesif.sonBakilan + ' kart');

  await page.locator('.janr-chip').first().click();
  await page.waitForTimeout(400);
  const janrSonrasi = await page.evaluate(() => ({ hash: location.hash, secili: document.getElementById('f-tur').value }));
  check('§6.2 janr çipine tıklayınca filtre uygulanıyor',
    /tur=/.test(janrSonrasi.hash) && janrSonrasi.secili.length > 0, JSON.stringify(janrSonrasi));

  // --- §6.3: kapağı olmayan kartın yer tutucusu ---
  await page.goto(base + '/index.html#/?q=arcane', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');
  const bos = await page.evaluate(() => {
    const el = document.querySelector('.poster-bos');
    if (!el) return null;
    const ic = el.querySelector('.poster-bos-ic');
    const k = el.getBoundingClientRect(), i = ic.getBoundingClientRect();
    return {
      ad: el.querySelector('.poster-ad').textContent.trim(),
      not: el.querySelector('.poster-not').textContent.trim(),
      tasma: Math.round(i.bottom - k.bottom),
      yukseklik: Math.round(k.height),
      gradyan: /gradient/.test(el.style.background),
    };
  });
  check('§6.3 kapağı olmayan kart başlığı ve etiketi gösteriyor',
    !!bos && bos.ad.length > 0 && /kapak yok/i.test(bos.not) && bos.gradyan, JSON.stringify(bos));
  check('§6.3 yer tutucu içeriği poster kutusundan taşmıyor',
    !!bos && bos.tasma <= 1 && bos.yukseklik > 100, JSON.stringify(bos));

  // --- §1.5: service worker iki ayrı cache kullanıyor, veri cache'i LRU ile sınırlı ---
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  const swHazir = await page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));
  check('§1.5 service worker kaydoluyor', swHazir);
  if (swHazir) {
    // Cache adları sw.js'ten okunuyor; sürüm atlayınca test elle güncellenmek zorunda kalmasın.
    const swKaynak = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const adCek = (ad, varsayilan) => {
      const m = new RegExp(ad + "\\s*=\\s*'([^']+)'").exec(swKaynak);
      return m ? m[1] : varsayilan;
    };
    const KABUK = adCek('SHELL_CACHE', 'tka-shell-v14');
    const VERI = adCek('DATA_CACHE', 'tka-data-v1');
    const kabuk = await page.evaluate(async ad => {
      const c = await caches.open(ad);
      const keys = (await c.keys()).map(r => new URL(r.url).pathname);
      return { data: keys.some(k => k.endsWith('/kaynak/data.js')), meta: keys.some(k => k.endsWith('/meta.js')), sayi: keys.length };
    }, KABUK);
    check('§1.5 katalog dosyaları kabuk cache\'inde', kabuk.data && kabuk.meta, JSON.stringify(kabuk));

    // 45 bölüm dosyası iste: veri cache'i 40 girişte kalmalı, kabuk cache'i kirlenmemeli
    const sluglar = await page.evaluate(n => window.INDEX.slice(0, n).map(r => r[0]), 45);
    await page.evaluate(async ss => {
      for (const s of ss) await fetch(`kaynak/b/${s}.js`).then(r => r.arrayBuffer()).catch(() => {});
    }, sluglar);
    await page.waitForTimeout(1500);
    const lru = await page.evaluate(async adlar => {
      const d = await caches.open(adlar.veri);
      const sh = await caches.open(adlar.kabuk);
      const shKeys = (await sh.keys()).map(r => new URL(r.url).pathname);
      return { veri: (await d.keys()).length, kabuktaBolum: shKeys.filter(k => k.includes('/kaynak/b/')).length };
    }, { veri: VERI, kabuk: KABUK });
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

  // --- §5.2 / §5.3 / §5.5: erişilebilirlik ---
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card');
  await page.keyboard.press('Tab');
  const atla = await page.evaluate(() => {
    const a = document.activeElement;
    return { sinif: a.className, metin: (a.textContent || '').trim(), sol: Math.round(a.getBoundingClientRect().left) };
  });
  check('§5.5 ilk Tab "İçeriğe geç" bağlantısını getiriyor',
    atla.sinif === 'skip-link' && atla.sol >= 0, JSON.stringify(atla));
  const canli = await page.evaluate(() => ({
    sayac: (document.querySelector('.filter-count') || {}).getAttribute
      ? document.querySelector('.filter-count').getAttribute('aria-live') : null,
    noscript: !!document.querySelector('noscript'),
    topGizli: getComputedStyle(document.getElementById('top-btn')).visibility,
  }));
  check('§5.3 sonuç sayısı canlı bölge, §5.5 noscript var, #top-btn gizliyken odakta değil',
    canli.sayac === 'polite' && canli.noscript && canli.topGizli === 'hidden', JSON.stringify(canli));

  // modal: dialog rolü, odak tuzağı, arka plan kilidi, odağın geri dönmesi
  await page.goto(base + '/index.html#/anime/beck', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ep');
  await page.locator('.ep[data-i="0"] .ep-head').click();
  await page.waitForTimeout(400);
  await page.locator('.ep[data-i="0"] .ep-links [data-embed-url]').first().click();
  await page.waitForTimeout(600);
  const modalA11y = await page.evaluate(() => {
    const m = document.getElementById('player-modal');
    return {
      rol: m.getAttribute('role'), ariaModal: m.getAttribute('aria-modal'),
      etiket: !!m.getAttribute('aria-label'),
      bodyKilit: document.body.classList.contains('modal-acik'),
      odakIcerde: m.contains(document.activeElement),
      yuklemeRol: document.getElementById('player-modal-loading').getAttribute('role'),
    };
  });
  check('§5.2 modal dialog rolü, odak içeride, arka plan kilitli',
    modalA11y.rol === 'dialog' && modalA11y.ariaModal === 'true' && modalA11y.etiket
    && modalA11y.bodyKilit && modalA11y.odakIcerde && modalA11y.yuklemeRol === 'status',
    JSON.stringify(modalA11y));

  let kacan = 0;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (!await page.evaluate(() => document.getElementById('player-modal').contains(document.activeElement))) kacan++;
  }
  check('§5.2 Tab odağı modalın içinde tutuyor', kacan === 0, kacan + ' kez dışarı kaçtı');

  await page.locator('#player-modal-close').click();
  await page.waitForTimeout(300);
  const kapanis = await page.evaluate(() => ({
    bodyKilit: document.body.classList.contains('modal-acik'),
    odakDisarida: !document.getElementById('player-modal').contains(document.activeElement),
  }));
  check('§5.2 kapanışta kilit kalkıyor ve odak geri dönüyor',
    !kapanis.bodyKilit && kapanis.odakDisarida, JSON.stringify(kapanis));

  // §4.2: satır içi olay işleyicisi kalmamalı (CSP'nin ön koşulu)
  const satirIci = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter(e => e.hasAttribute('onload') || e.hasAttribute('onerror') || e.hasAttribute('onclick')).length);
  check('§4.2 satır içi olay işleyicisi yok', satirIci === 0, satirIci + ' öğe');
  const cspVar = await page.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
  check('§4.2 CSP meta etiketi var', cspVar);

  // --- §7.6: keşfedilebilirlik (başlık, meta, yapısal veri, noscript) ---
  // document.title'a router anime adını yazdığı için statik başlık HTML kaynağından okunuyor.
  const baslikEs = /<title>([^<]*)<\/title>/.exec(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  const statikBaslik = baslikEs ? baslikEs[1] : '';
  const seo = await page.evaluate(() => {
    const meta = n => (document.querySelector(`meta[name="${n}"]`) || {}).content || '';
    const og = n => (document.querySelector(`meta[property="${n}"]`) || {}).content || '';
    let ld = null;
    try { ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); } catch (e) { ld = null; }
    const ns = document.querySelector('noscript');
    return {
      aciklama: meta('description'),
      ogSite: og('og:site_name'),
      arama: ld && ld.potentialAction && ld.potentialAction.target && ld.potentialAction.target.urlTemplate,
      // noscript içeriği DOM'da metin olarak durur; uzunluğu ve başlığı olması yeter.
      noscriptUzunluk: ns ? ns.textContent.trim().length : 0,
      noscriptBaslik: !!(ns && /TürkAnime Arşivi/.test(ns.textContent)),
    };
  });
  check('§7.6 sayfa başlığı anahtar kelime taşıyor',
    /anime/i.test(statikBaslik) && statikBaslik.length > 30, statikBaslik);
  check('§7.6 açıklama metni dolu ve 120+ karakter',
    seo.aciklama.length >= 120, seo.aciklama.length + ' karakter');
  check('§7.6 og:site_name var', seo.ogSite === 'TürkAnime Arşivi', seo.ogSite);
  check('§7.6 yapısal veride SearchAction var',
    typeof seo.arama === 'string' && seo.arama.includes('{search_term_string}'), String(seo.arama));
  check('§7.6 noscript gerçek tanıtım metni içeriyor',
    seo.noscriptUzunluk > 200 && seo.noscriptBaslik, seo.noscriptUzunluk + ' karakter');

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
    await temaTestleri(browser, base);
    await oynaticiTestleri(browser, base);
    await xrayTestleri(browser, base);
    await ilerlemeTestleri(browser, base);
    await yedekTestleri(browser, base);
  } finally {
    await browser.close();
    server.close();
  }
  let hata = 0;
  for (const r of results) { if (!r.ok) hata++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.ad}${r.detay ? '  — ' + r.detay : ''}`); }
  console.log(`\n${results.length - hata}/${results.length} geçti`);
  process.exit(hata ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ:', e); process.exit(2); });
