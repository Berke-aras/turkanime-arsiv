<div align="center">

<img src="docs/assets/hero.jpg" width="820" alt="">

# TürkAnime Arşivi

**トルコアニメ・アーカイブ**

**turkanime.tv arşivi · Türkçe anime arşivi · 6100+ anime, bölüm listesi ve izleme linkleri**

turkanime.tv kapandı. Geriye kalan arşiv burada yaşıyor:
tek sayfalık, sunucusuz, build adımı olmayan bir görüntüleyici.

![Mimari](https://img.shields.io/badge/mimari-statik-6c8dff?style=flat-square)
![Backend](https://img.shields.io/badge/backend-yok-8f6cff?style=flat-square)
![Anime](https://img.shields.io/badge/anime-~6100-3ddc84?style=flat-square)
![Kurulum](https://img.shields.io/badge/kurulum-gerekmez-ff6c8d?style=flat-square)

[![Arşivi aç](https://img.shields.io/badge/ar%C5%9Fivi_a%C3%A7-berke--aras.github.io-0a0c11?style=for-the-badge&labelColor=6c8dff)](https://berke-aras.github.io/turkanime-arsiv/)

</div>

---

## Genel bakış

**TürkAnime Arşivi**, kapanan **turkanime.tv**'nin geride bıraktığı katalogu okunabilir bir arayüzde
gösteren statik bir arşiv görüntüleyicisidir. Türkçe anime arşivi, anime bölüm listesi ve izleme
linklerini tek yerde toplar; üyelik, reklam ve sunucu yoktur.

Arşivde ~6100 anime var; her biri için bölüm listesi, izleme linkleri, AniList'ten çekilmiş kapak
görseli ve özet bilgisi. Uygulamanın tamamı `index.html` + `js/` altındaki ES modülleri +
`style.css` ve iki veri dosyasından ibaret — paket yöneticisi, derleme adımı, veritabanı ya da
kullanıcı hesabı yok.
Dosyayı açtığın anda çalışır.

## Özellikler

| | |
|---|---|
| **Arama** | Yazım hatasına toleranslı (Levenshtein tabanlı); sonuç çıkmazsa "bunu mu demek istedin" önerileri |
| **Filtre ve sıralama** | Kategori, tür ve puana göre |
| **Favoriler** | Yıldızlananlar ve son bakılanlar `localStorage`'da tutulur, hiçbir yere gönderilmez |
| **Günün Animesi** | Puanı 7 ve üzerindekilerden, gün boyunca değişmeyen bir seçim |
| **Rastgele** | Tek tuşla arşivden rastgele bir başlık |
| **Reklamsız oynatıcı** | Sibnet ve Uqload bölümleri sitenin kendi oynatıcısında, reklamsız açılır |
| **İzlemeye devam et** | Bıraktığın yeri hatırlar, izlenen bölümleri işaretler, ilerleme çubuğu gösterir |
| **Benzer animeler** | Detay sayfasında aynı seri ve aynı türden öneriler |
| **18+ uyarısı** | Ecchi/Hentai/Erotica başlıklarında NSFW uyarısı ve kartlarda `18+` rozeti |
| **Yedekleme** | Favoriler, geçmiş ve izleme konumları tek JSON dosyasına iner; başka cihazda birleştirilerek geri yüklenir |
| **Klavye** | `/` aramaya odaklanır; oynatıcıda `Esc` kapatır, `←` ve `→` bölüm değiştirir |
| **Çevrimdışı** | Service worker uygulama kabuğunu önbelleğe alır; PWA olarak kurulabilir |

## Çalıştırma

```bash
git clone https://github.com/berke-aras/turkanime-arsiv.git
cd turkanime-arsiv
python3 -m http.server 8000     # ya da: npx serve .
```

Ardından `http://localhost:8000` adresini aç. Kurulacak bağımlılık yok.

## Reklamsız oynatıcı

Sibnet ve Uqload bölümlerinde "Reklamsız izle" seçeneği, videoyu sağlayıcının reklamlı iframe'i
yerine sitenin kendi oynatıcısında açar. Orijinal gömülü oynatıcı butonları da yerinde durur.

Bunun için iki küçük yardımcı fonksiyon var:

| Sağlayıcı | Nerede | Dosya |
|---|---|---|
| Sibnet | Vercel function (`tka-sibnet.vercel.app`) | `api/sibnet.js` |
| Uqload | Cloudflare Worker (`tka-uqload.turkanime-arsiv.workers.dev`) | `cf/uqload/worker.js` |

Fonksiyon yalnızca video numarasını alır, gerekiyorsa Referer ile yönlendirmeleri takip eder ve
Referer istemeyen nihai video adresini döndürür. Video trafiği fonksiyondan geçmez; tarayıcı
videoyu doğrudan sağlayıcının sunucusundan çeker. (Sibnet için Cloudflare denendi, Cloudflare
IP'lerini 403 ile engellediği için Vercel'de duruyor.)

<div align="center">

<img src="docs/assets/loop-1.gif" height="280" alt="">

</div>

## Proje yapısı

```
index.html · style.css · meta.js            uygulama kabuğu ve katalog metası
fonts/                                      Inter (self-host, değişken font) + lisans
js/                                         ES modülleri (giriş: js/main.js)
  util · dom · store · data · search        yardımcılar, durum, veri, arama
  eslesme · yedek                           arama puanlaması, JSON yedek al/geri yükle
  state · router · main                     liste durumu, hash router, bağlama
  links · cards · views/                    link butonları, kart, liste/detay/yasal görünümleri
  views/yas-kapisi                          18+ onay ekranı ve uyarı paneli
  player · player-dom · player-video        reklamsız oynatıcı modalı
kaynak/data.js                              anime listesi (slug, başlık, bölüm/link sayısı)
kaynak/b/<slug>.js                          her anime için bölüm ve izleme linkleri
kaynak/animeler/<slug>/info.json            özet, kategori, puan gibi detay bilgisi
scripts/build-meta.js                       info.json'lardan meta.js üretir
scripts/build-posters.js                    AniList kapaklarını meta.js'e gömer
scripts/trim-data.js                        data.js'i kullanılan alanlara kırpar
scripts/smoke-test.js                       tarayıcı duman testi (Playwright)
scripts/social-gorsel.py                    GitHub sosyal önizlemesi + og:image üretir
docs/assets/social-preview.png              GitHub Settings > Social preview'a yüklenen görsel
test/                                       birim ve veri bütünlüğü testleri
api/ · cf/                                  reklamsız oynatıcı yardımcıları (sibnet · okru · uqload)
```

## Geliştirme

```bash
npm install
npm run lint        # eslint
npm test            # birim + veri bütünlüğü testleri (DOM/ağ gerekmez)
npm run test:smoke  # headless Chromium'da uçtan uca duman testi
```

Veride bir değişiklik olduğunda sırasıyla:

```bash
node scripts/build-meta.js
node scripts/build-posters.js
```

## Sık sorulan sorular

<details>
<summary><strong>turkanime.tv kapandı mı, arşivi nerede?</strong></summary>

Evet, site kapandı. Bu repo kapanmadan önce toplanmış katalogu — anime listesi, bölüm listeleri ve
üçüncü taraf oynatıcı linkleri — barındırır ve
[berke-aras.github.io/turkanime-arsiv](https://berke-aras.github.io/turkanime-arsiv/) adresinde
tarayıcıdan açılabilir hâlde sunar.
</details>

<details>
<summary><strong>Video dosyaları burada mı duruyor?</strong></summary>

Hayır. Depoda hiçbir video yok; yalnızca GDrive, Sibnet, Mp4upload gibi üçüncü taraf sağlayıcılara
ait arşivlenmiş linkler var. Videoyu tarayıcı doğrudan o sağlayıcıdan çeker.
</details>

<details>
<summary><strong>Üyelik ya da kurulum gerekiyor mu?</strong></summary>

Hayır. Statik bir sayfa; açtığın anda çalışır. Favoriler ve izleme geçmişi yalnızca kendi
tarayıcındaki `localStorage`'da tutulur, hiçbir yere gönderilmez.
</details>

<details>
<summary><strong>Kendi bilgisayarımda çalıştırabilir miyim?</strong></summary>

Evet — repoyu klonlayıp herhangi bir statik sunucuyla aç (yukarıdaki *Çalıştırma* bölümü).
Bağımlılık, veritabanı ya da API anahtarı gerekmez.
</details>

## English

**TürkAnime Arşivi (TurkAnime Archive)** is a static, serverless viewer for the catalogue left behind
by *turkanime.tv*, a Turkish anime site that shut down. It lists ~6100 anime with their episodes,
archived third-party streaming links, AniList cover art and synopses. No backend, no build step, no
account: `index.html` + ES modules + two data files. The project hosts **no video files** — only
links that already existed elsewhere. See the
[legal & privacy page](https://berke-aras.github.io/turkanime-arsiv/#/yasal) for takedown requests.

## Yol haritası

Performans, veri boyutu ve ölü link temizliği gibi başlıklar için ölçüm tabanlı plan:
[`GELISTIRME-PLANI.md`](GELISTIRME-PLANI.md).

## Yasal not

Bölüm linkleri GDrive, Mp4upload, Sibnet gibi üçüncü taraf sağlayıcılara ait. Bu proje arşivlenmiş
linkleri düzenli bir arayüzde gösterir; hiçbir video dosyası barındırmaz. Ayrıntı için sitedeki
[yasal ve gizlilik sayfası](https://berke-aras.github.io/turkanime-arsiv/#/yasal).

---

<div align="center">

<img src="docs/assets/loop-2.gif" height="240" alt="">

**さようなら、turkanime.tv**

Arşiv için [Kerim Demirkaynak](https://github.com/KerimDemirkaynak)'a teşekkürler.

</div>
