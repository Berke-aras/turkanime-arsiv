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
| **Bilgi paneli (X-Ray)** | Oynatıcıda duraklatınca (ya da **Bilgi** / `I`) karakterler, Japon seslendirmenleri, bölümün opening/ending şarkıları ve çeviren fansub görünür. Reklamsız oynatıcıda opening/ending sırasında **♪ Şu an çalıyor** etiketi ve **Opening'i geç** düğmesi çıkar |
| **Seslendirmenler** | Detay sayfasında karakter şeridi; seslendirmen adına tıklayınca arşivde seslendirdiği bütün animeler ve karakterleri (`#/seslendirmen/<ad>`) |
| **Mobil oynatıcı** | Çift dokunuşla ±10 sn sarma, resim içinde resim, kilit ekranı / bildirimde bölüm adı, kapak ve oynatma düğmeleri (Media Session) |
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

> **Bu siteye özel.** Reklamsız oynatıcının arkasındaki yardımcı fonksiyonlar yalnızca
> `https://berke-aras.github.io` kökeninden gelen istekleri kabul eder. Repoyu klonlayıp yerelde
> ya da başka bir adreste açarsan "Reklamsız izle" çalışmaz ve oynatıcı sessizce sağlayıcının
> kendi (reklamlı) iframe'ine düşer. Kendi kopyanda istiyorsan fonksiyonları kendi Vercel/Cloudflare
> hesabına deploy edip `TKA_ALLOWED_ORIGINS` ile kendi adresini, yerel geliştirme için
> `TKA_ALLOW_LOCALHOST=1` tanımlaman ve `js/links.js`'teki resolver adreslerini değiştirmen gerekir.

Sibnet ve Uqload bölümlerinde "Reklamsız izle" seçeneği, videoyu sağlayıcının reklamlı iframe'i
yerine sitenin kendi oynatıcısında açar. Orijinal gömülü oynatıcı butonları da yerinde durur.

**Kısaca nasıl çalışıyor:**

1. Butona basınca tarayıcı, embed linkindeki video numarasını küçük bir yardımcı fonksiyona gönderir.
2. Fonksiyon isteğin bu siteden geldiğini kontrol eder (Origin/Referer), sağlayıcının sayfasını
   açıp asıl video dosyasının (mp4 ya da HLS) adresini bulur ve yalnız bu adresi döndürür.
3. Tarayıcı videoyu doğrudan sağlayıcının sunucusundan çekip kendi `<video>` oynatıcısında oynatır.
   Video trafiği fonksiyondan geçmez, yani barındırma maliyeti yok denecek kadar azdır.
4. Herhangi bir adım başarısız olursa oynatıcı otomatik olarak klasik iframe embed'e düşer ve
   nedenini kısa bir notla söyler (video sağlayıcıdan kaldırılmış / sağlayıcı yoğun / dosya açılmadı).

**Neden bazen çalışmıyor:** Sibnet, bütün ziyaretçilerin istekleri aynı sunucudan geldiği için yoğunlukta
geçici engel (403) uyguluyor; bunun yanında arşivdeki videoların bir kısmı sağlayıcıdan silinmiş.
Bu yüzden oynatıcı yoğunluk hatasında 3 kez tekrar dener (ekranda "yoğun, tekrar deneniyor" yazar),
çözülen linkleri imzaları bitene kadar hem sunucuda hem tarayıcıda önbelleğe alır, düğmenin üstüne
gelince ve bölümün %60'ında sonraki bölüm için linki önceden çözer. Uqload Worker'ı (`cf/uqload`) GitHub'a
bağlı değil; değişince elle deploy edilmeli: `cd cf/uqload && npx wrangler deploy`.

Kendi oynatıcımız olduğu için hız ayarı, kaldığın yerden devam, klavye kısayolları ve
[bilgi paneli](#bilgi-paneli-x-ray) (şu an çalan şarkı, opening'i geç) yalnızca bu modda tam çalışır.

| Sağlayıcı | Nerede | Dosya |
|---|---|---|
| Sibnet | Vercel function (`tka-sibnet.vercel.app`) | `api/sibnet.js` |
| Uqload | Cloudflare Worker (`tka-uqload.turkanime-arsiv.workers.dev`) | `cf/uqload/worker.js` |

Sibnet için Cloudflare denendi, Cloudflare IP'lerini 403 ile engellediği için Vercel'de duruyor.
ok.ru için de fonksiyon yazıldı ama döndürdüğü video linki yalnız fonksiyonun IP'sinden açıldığı
için kapalı (bkz. `js/links.js`, `OKRU_ETKIN`).

<div align="center">

<img src="docs/assets/loop-1.gif" height="280" alt="">

</div>

## Bilgi paneli (X-Ray)

Amazon Prime'daki X-Ray gibi: oynatıcıda videoyu duraklatınca (ya da **Bilgi** düğmesi / `I`)
soldan bir panel açılır. Panelde animenin karakterleri ve Japon seslendirmenleri, bölümün
opening/ending şarkıları ve bölümü çeviren fansub görünür. Reklamsız oynatıcıda ayrıca opening/ending
sırasında sağ üstte **♪ Şu an çalıyor** etiketi ve sağ altta **Opening'i geç** düğmesi çıkar.
Bölüm açılınca panel, video yüklenirken ve ilk 5 saniye boyunca yarı saydam bir tanıtım olarak görünür
(tıklamaları engellemez, **Bilgi** ile sabitlenir); "Şu an çalıyor" etiketi opening/ending başında
sağ üste kayarak gelir ve 4 saniye sonra çıkar. Mobilde panel ekranı kaplar ve kaydırılabilir;
kontrol çubuğu her zaman panelin üstünde kalır.

| Veri | Kaynak | Ne zaman |
|---|---|---|
| Karakterler, seslendirmenler | [AniList](https://anilist.co) | derleme anında → `kaynak/x/<slug>.json` |
| Opening/ending şarkıları | [AnimeThemes](https://animethemes.moe), yoksa [MyAnimeList](https://myanimelist.net) | derleme anında |
| Opening/ending'in bölümdeki saniyeleri | [AniSkip](https://aniskip.com) | bölüm açılınca, tarayıcıdan |

Bugünkü kapsam (6107 anime): 6014'ünde veri dosyası, 5840'ında karakter + seslendirmen, 4846'sında
opening/ending şarkıları, 5483'ünde AniSkip için MyAnimeList kimliği var.

Hangi şarkının hangi bölümde çaldığından emin olunamıyorsa etiket hiç gösterilmez (yanlış şarkı
göstermektense boş kalır); panelde serinin bütün şarkıları listelenir. Veriyi güncellemek için:

```bash
npm run build:xray      # yeni animeler: AniList + AnimeThemes
npm run build:xray-ek   # yanlış sezona bağlanmış kapakları düzelt, eksik şarkıları MyAnimeList'ten tamamla
```

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
  xray · xray-veri · xray-yukle             oynatıcı bilgi paneli, şu an çalan şarkı, opening'i geç
  views/seslendirmen                        seslendirmenin arşivdeki rolleri
kaynak/data.js                              anime listesi (slug, başlık, bölüm/link sayısı)
kaynak/b/<slug>.js                          her anime için bölüm ve izleme linkleri
kaynak/x/<slug>.json                        bilgi paneli: karakterler, seslendirmenler, OP/ED şarkıları
kaynak/sv/<0-31>.json                       seslendirmen -> seslendirdiği animeler (32 kovaya bölünmüş)
kaynak/animeler/<slug>/info.json            özet, kategori, puan gibi detay bilgisi
scripts/build-meta.js                       info.json'lardan meta.js üretir
scripts/build-posters.js                    AniList kapaklarını meta.js'e gömer
scripts/build-xray.js                       AniList + AnimeThemes'ten kaynak/x/ dosyalarını üretir
scripts/build-xray-ek.js                    sezon eşleşmesini düzeltir, eksik şarkıları MAL'dan tamamlar
scripts/build-seslendirmen.js               kaynak/x'ten seslendirmen ters dizinini (kaynak/sv/) üretir
scripts/trim-data.js                        data.js'i kullanılan alanlara kırpar
scripts/smoke-test.js                       tarayıcı duman testi (Playwright)
scripts/social-gorsel.py                    GitHub sosyal önizlemesi + og:image üretir
og-image.jpg                                link paylaşımlarında çıkan önizleme (WhatsApp, X…)
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
node scripts/build-xray.js     # yeni kapağı olan animelere bilgi paneli verisi
node scripts/build-xray-ek.js  # sezon düzeltme + eksik şarkılar + Spotify kimlikleri
node scripts/build-seslendirmen.js
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
