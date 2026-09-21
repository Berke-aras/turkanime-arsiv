// Sendvid embed id -> doğrudan mp4 linki. Vercel serverless function (proje: tka-sibnet).
// UYARI: sendvid.com bu ortamdan (ve muhtemelen datacenter IP aralıklarından genel olarak) TLS
// handshake seviyesinde bağlantıyı reddediyor (SSL_ERROR_SYSCALL, HTTP isteği hiç gitmiyor) — bu
// yüzden aşağıdaki regex'ler gerçek sayfa HTML'i üzerinde test edilemedi, bilinen (yt-dlp benzeri)
// Sendvid embed yapısına dayanıyor. Vercel'e deploy ettikten sonra gerçek bir id ile doğrula;
// çalışmazsa Vercel fonksiyon loglarına düşen HTML'i inceleyip regex'i güncellemek gerekebilir.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('content-type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const id = String((req.query && req.query.id) || '');
  if (!/^[a-z0-9]{6,20}$/i.test(id)) return res.status(400).send(JSON.stringify({ error: 'bad id' }));

  try {
    const embed = `https://sendvid.com/embed/${id}`;
    const html = await (await fetch(embed, { headers: { 'user-agent': UA } })).text();
    // sendvid embed'i mp4'ü doğrudan HTML'de verir (packed JS yok); og:video meta veya <source> etiketi.
    const m = /<source[^>]+src="([^"]+\.mp4[^"]*)"/i.exec(html) || /property="og:video"\s+content="([^"]+)"/i.exec(html);
    if (!m) return res.status(404).send(JSON.stringify({ error: 'video not found' }));

    res.setHeader('cache-control', 'public, max-age=600, s-maxage=600');
    res.status(200).send(JSON.stringify({ url: m[1] }));
  } catch (e) {
    res.status(502).send(JSON.stringify({ error: String(e.message || e) }));
  }
};
