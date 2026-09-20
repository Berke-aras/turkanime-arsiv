# TürkAnime Arşivi

turkanime.tv kapandıktan sonra geride bıraktığı arşivi görüntülemek için yaptığım, sunucusuz (statik) bir web uygulaması. ~6100 anime, bölüm/izleme linkleri ve AniList üzerinden çekilmiş kapak görselleriyle birlikte tek sayfalık bir viewer.

**[👉 Canlı demo](https://berke-aras.github.io/turkanime-arsiv/)**

## Özellikler

- Yazım hatasına toleranslı arama (Levenshtein tabanlı)
- Kategori / tür / puana göre filtreleme ve sıralama
- Favoriler ve son bakılanlar (localStorage)
- Günün Animesi (puanı 7+ olanlardan, gün boyunca sabit kalan seçim)
- Rastgele anime butonu
- Tamamen statik: build adımı olmadan doğrudan açılabilir

## Çalıştırma

```bash
python3 -m http.server 8000
# veya
npx serve .
```

`index.html`'i açman yeterli.

## Yapı

```
index.html / app.js / style.css / meta.js   → viewer uygulaması
kaynak/data.js                               → anime listesi (slug, başlık, bölüm/link sayısı)
kaynak/b/<slug>.js                           → her anime için bölüm + izleme linkleri
kaynak/animeler/<slug>/info.json             → özet, kategori, puan gibi detay bilgisi
scripts/build-meta.js                        → info.json'lardan meta.js üretir
scripts/build-posters.js                     → AniList'ten poster URL'lerini çekip meta.js'e gömer
```

Veride bir değişiklik olursa sırayla `node scripts/build-meta.js` ve `node scripts/build-posters.js` çalıştırılır.

## Not

Bölüm linkleri farklı video sağlayıcılara (GDrive, Mp4upload, vb.) ait; bu proje sadece arşivlenmiş linkleri düzenli bir arayüzde sunar, dosyaları barındırmaz.

---

Special thanks to [Kerim Demirkaynak](https://github.com/KerimDemirkaynak) — turkanime.tv kapanmadan önce bu arşivi (bölüm/izleme linkleri) derleyip paylaştığı için.
