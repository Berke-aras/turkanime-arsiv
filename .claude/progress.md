# İlerleme

- Tasarım baştan yazıldı (style.css), mobil/tablet/masaüstü uyumlu. Emojiler SVG sprite ikonlarla değişti (index.html `<svg>` sprite, app.js `ic()`).
- Reklamsız Sibnet: `api/sibnet.js` Vercel function (proje tka-sibnet, https://tka-sibnet.vercel.app/api/sibnet). app.js `SIBNET_RESOLVER` dolu. Cloudflare Workers sibnet tarafından 403'lü, kullanılmadı.
- Fonksiyon değişirse Vercel'e yeniden deploy gerekir (MCP create_deployment ile inline dosya; repo git'e bağlı değil).

## Geliştirme planı
- Tasarım + teknik iyileştirme planı: **`GELISTIRME-PLANI.md`** (repo kökü). Ölçüm tabanlı, madde madde,
  öncelik sırasıyla. Yeni bir oturum işe başlamadan önce onu okusun.
