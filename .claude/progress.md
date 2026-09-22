# İlerleme

- Tasarım baştan yazıldı (style.css), mobil/tablet/masaüstü uyumlu. Emojiler SVG sprite ikonlarla değişti (index.html `<svg>` sprite, app.js `ic()`).
- Reklamsız Sibnet: `api/sibnet.js` Vercel function (proje tka-sibnet, https://tka-sibnet.vercel.app/api/sibnet). app.js `SIBNET_RESOLVER` dolu. Cloudflare Workers sibnet tarafından 403'lü, kullanılmadı.
- Fonksiyon değişirse Vercel'e yeniden deploy gerekir (MCP create_deployment ile inline dosya; repo git'e bağlı değil).

## Geliştirme planı
- Tasarım + teknik iyileştirme planı: **`GELISTIRME-PLANI.md`** (repo kökü). Ölçüm tabanlı, madde madde,
  öncelik sırasıyla. Yeni bir oturum işe başlamadan önce onu okusun.

## 2026-09-22: §4.4.1 + §4.4.2 deploy ve doğrulama
- Resolver köken kısıtlaması **canlıda**: Vercel (sibnet+okru) push'ta otomatik deploy olmuş,
  Cloudflare Worker (uqload) `npx wrangler deploy` ile elle deploy edildi. Üçü de doğrulandı:
  başlıksız/yabancı köken 403, `https://berke-aras.github.io` geçiyor.
- ok.ru resolver'ı **kalıcı olarak devre dışı** (`OKRU_ETKIN = false`, `js/links.js`): dönen
  mp4 linkindeki `srcIp` gerçekten doğrulanıyor, fonksiyonun IP'si dışından 400 dönüyor —
  gerçek kullanıcı tarayıcısı hiç oynatamaz. Bu mimarinin çözemediği bir kısıt, deploy sorunu değil.
  Detay: `GELISTIRME-PLANI.md` §4.4.2.
