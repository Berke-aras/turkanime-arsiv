// Sibnet videoid -> doğrudan mp4 linki. Vercel serverless function olarak çalışır (proje: tka-sibnet).
// Cloudflare Workers denendi ama sibnet CF IP'lerine 403 veriyor; Vercel (AWS) IP'lerinden erişim var.
// Video trafiği buradan geçmez; sadece link çözülür, tarayıcı mp4'ü doğrudan sibnet CDN'inden çeker.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Köken kısıtlaması ortak dosyada: api/_koken.js (Cloudflare eşi cf/uqload/worker.js).
const { kokenDogrula, kokenReddet } = require('./_koken.js');

// Sibnet yoğun isteklerde "403 Forbidden - Request forbidden by administrative rules." döndürüyor.
// Bu, videonun silindiği anlamına GELMİYOR: aynı istek birkaç yüz ms sonra 200 dönüyor (ölçüldü:
// 403 alan 4 videonun 3'ü tek tekrarda, kalanı ikinci tekrarda çözüldü). Eskiden durum kodu hiç
// kontrol edilmediği için bu engel sayfası da regex'e takılmayıp "video not found" (404) oluyordu;
// istemci de reklamsız linki kalıcı olarak ölü sayıp reklamlı embed'e düşüyordu.
// Sınırlayıcının penceresi uzun (1,5sn arayla yapılan isteklerde bile 403 sürebiliyor), üstelik her
// çağrı engellenen video.sibnet.ru'ya 2 istek atıyor (shell.php + yönlendirmenin ilk adımı). Bu yüzden
// tekrarı kısa tutuyoruz: çok denemek yükü artırıp engeli uzatıyor. Kısa engeller burada yakalanır,
// uzun sürenler 503 olarak istemciye bırakılır.
const BLOCKED = s => s === 403 || s === 429 || s >= 500;
const BACKOFF = [700, 1800, 3500]; // denemeler arası bekleme (ms); hepsi 15 sn'lik bütçenin içinde
const sleep = ms => new Promise(r => setTimeout(r, ms));

// vercel.json'da maxDuration 20sn; tekrarlar bu bütçeyi aşmasın diye ortak bir son tarih tutuyoruz.
async function fetchRetry(url, init, deadline) {
  let lastStatus = 0;
  for (let i = 0; i <= BACKOFF.length; i++) {
    if (i) {
      const wait = BACKOFF[i - 1] + Math.floor(Math.random() * 150); // jitter: eşzamanlı çağrılar aynı anda vurmasın
      if (Date.now() + wait > deadline) break;
      await sleep(wait);
    }
    // Sibnet bazen hiç cevap vermeden bekletiyor; bütçe bitince isteği kesip "yoğun" (503) sayıyoruz ki
    // istemci öteki çözücüye geçebilsin (platformun kendi zaman aşımı 502/504 olur, geçici sayılmaz).
    let r;
    try { r = await fetch(url, { ...init, signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())) }); }
    catch (e) { if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) break; throw e; }
    if (!BLOCKED(r.status)) return r;
    lastStatus = r.status;
    if (Date.now() > deadline) break;
  }
  const e = new Error('sibnet blocked'); e.blocked = true; e.status = lastStatus;
  throw e;
}

module.exports = async (req, res) => {
  if (kokenReddet(req, res)) return;
  const id = String((req.query && req.query.id) || '');
  // hata yanıtları cache'lenmemeli: geçici bir 403'ü yarım saat boyunca "video yok" diye servis etmeyelim.
  const fail = (code, body, extra) => {
    res.setHeader('cache-control', 'no-store');
    if (extra) for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
    return res.status(code).send(JSON.stringify(body));
  };
  if (!/^\d{1,12}$/.test(id)) return fail(400, { error: 'bad id' });

  const deadline = Date.now() + 15000;
  try {
    const shell = `https://video.sibnet.ru/shell.php?videoid=${id}`;
    const html = await (await fetchRetry(shell, { headers: { 'user-agent': UA } }, deadline)).text();
    const m = /src:\s*"(\/v\/[^"]+\.mp4)"/.exec(html);
    // buraya 200 ile gelindi: sayfa açıldı ama link yok => video gerçekten kalkmış.
    if (!m) return fail(404, { error: 'video not found' });

    // /v/<hash>/<id>.mp4 sadece sibnet referer'ıyla açılıyor; yönlendirmeleri elle takip edip
    // referer gerektirmeyen nihai CDN linkini (cvs*.sibnet.ru/...?st=..&e=..) döndürüyoruz.
    let url = 'https://video.sibnet.ru' + m[1];
    for (let i = 0; i < 6; i++) {
      const r = await fetchRetry(url, { headers: { 'user-agent': UA, referer: shell, range: 'bytes=0-0' }, redirect: 'manual' }, deadline);
      const loc = r.headers.get('location');
      if (!loc) { if (r.status >= 400) return fail(502, { error: `cdn ${r.status}` }); break; }
      url = new URL(loc, url).href;
      // İlk yönlendirme doğrudan CDN'e (dvXX.sibnet.ru/...mp4?st=..&e=..) gidiyor: o link zaten son
      // link. Eskiden CDN'e bir istek daha atılıyordu; ~1 sn ekliyordu ve tarayıcı zaten kendisi deniyor.
      if (new URL(url).hostname !== 'video.sibnet.ru') break;
    }
    // st/e imzası linkin geçerlilik sonunu (e=, unix saniye) taşıyor. Önbellek süresi ona göre: aynı bölümü
    // açan herkes Sibnet'e hiç gitmeden linki alıyor, bu da hız sınırına takılmayı azaltıyor. Link bitmeden
    // 15 dk önce önbellekten düşüyor; e= okunamazsa eskisi gibi 30 dk.
    const e = Number(new URL(url).searchParams.get('e')) || 0;
    const ttl = e ? Math.max(300, Math.min(6 * 3600, e - Math.floor(Date.now() / 1000) - 900)) : 1800;
    res.setHeader('cache-control', `public, max-age=${ttl}, s-maxage=${ttl}`);
    res.status(200).send(JSON.stringify({ url }));
  } catch (e) {
    // engellendiyse 404 değil 503 dönüyoruz: istemci bunu "video yok" sanıp pes etmesin, tekrar denesin.
    if (e && e.blocked) return fail(503, { error: 'sibnet busy', status: e.status }, { 'retry-after': '2' });
    return fail(502, { error: String((e && e.message) || e) });
  }
};

// test/koken.test.js için; çalışma zamanında kullanılmıyor.
module.exports.kokenDogrula = kokenDogrula;
