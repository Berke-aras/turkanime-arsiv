# İlerleme

- Tasarım baştan yazıldı (style.css), mobil/tablet/masaüstü uyumlu. Emojiler SVG sprite ikonlarla değişti (index.html `<svg>` sprite, app.js `ic()`).
- Reklamsız Sibnet: `worker/sibnet-resolver.js` (Cloudflare Worker) videoid → nihai CDN mp4 linki. app.js `SIBNET_RESOLVER` boşken buton görünmez.
- Sıradaki: worker deploy edilip `SIBNET_RESOLVER` doldurulacak; canlıda CDN'in farklı IP'den (noip=1) çalıştığı doğrulanacak.
