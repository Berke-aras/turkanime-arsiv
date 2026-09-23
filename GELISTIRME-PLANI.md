# TürkAnime Arşivi — Geliştirme Planı

> Bu dosya bir **devir teslim (handoff) dokümanıdır**: başka bir Claude Code oturumu ya da başka bir
> yapay zeka bu dosyayı tek başına okuyup maddeleri sırayla uygulayabilsin diye yazıldı. Her madde
> "hangi dosya / ne sorun / ölçüm / ne yapılacak / kabul kriteri" biçiminde.
>
> Ölçümler 2026-09-22'de `main` üzerinde yapıldı (6107 anime, 89.597 dosya, 307 MB `.git`).
> Satır numaraları o günkü `app.js` (856 satır) içindir; dosya değiştikçe fonksiyon adından ara.

---

## Durum takibi

Başlık işaretleri:

| işaret | anlamı |
|---|---|
| **(TAMAM)** | Yapıldı, doğrulandı, `main`'e pushlandı. |
| **(YAPILMAYACAK)** | Bilerek yapılmıyor. Gerekçe maddenin altında yazılı; çoğu repo sahibinin kararını gerektiriyor (geri dönüşü olmayan işlem, telif riski). Karar değişirse işaret kaldırılır. |
| işaretsiz | Sırada. |

Her madde ayrı commit olarak `main`'e gider; öncesinde `npm run lint`, `npm test` ve
`npm run test:smoke` yeşil olmalı. Tamamlananlar en altta *Değişiklik günlüğü*'ne tarihiyle yazılır.

**Ölçümü yanlış çıkan maddeler bu dosyadan silinir** (düzeltme notu bırakılmaz); ne bulunduğu
değişiklik günlüğünde ve commit mesajında durur.

---

## 0. Projenin bugünkü hâli (özet)

*(2026-09-22 akşamı, tüm turlar sonrası ölçüldü. Planın ilk yazıldığı andaki değerler maddelerin
kendi "Ölçüm" satırlarında duruyor.)*

| | |
|---|---|
| Mimari | Tamamen statik, build adımı yok. `index.html` + `js/` altında **23 ES modülü** (2.133 satır) + `style.css` + iki global veri dosyası |
| Barındırma | GitHub Pages (site) + Vercel (`api/sibnet.js`, `api/okru.js`) + Cloudflare Workers (`cf/uqload`) |
| Veri | `kaynak/data.js` **396 KB** (658'di) ve `meta.js` **524 KB** (924'tü) — ikisi de `<script>` ile senkron |
| Bölüm verisi | `kaynak/b/<slug>.js` — 6107 dosya, **143 MB** (205'ti), detayda talep üzerine |
| Ham veri | `kaynak/animeler/` — 697 MB, 89.597 dosya; sadece `info.json` runtime'da kullanılıyor |
| Router | `location.hash` (`#/`, `#/anime/<slug>`, `#/yasal`) |
| Test / lint / CI | **72 birim testi** (`node --test`), **114 duman testi** (Playwright), ESLint, GitHub Actions (2 iş) |
| Yazı tipi | Inter self-host (`fonts/`, 63 KB, değişken font) — üçüncü taraf istek yok |

---

## 0.1 Geriye kalanlar (tek bakışta)

Planın **40 başlığından 36'sı tamamen kapandı**; kalan 4 başlıkta toplam **10 açık madde** var
ve hepsi aşağıda. Hiçbiri "unutuldu" değil — her birinin gerekçesi yazılı.

### A. Repo sahibinin kararını bekleyenler — **(YAPILMAYACAK)** işaretli
| madde | ne | neden bekliyor |
|---|---|---|
| §3.1 adım 2–4 | 697 MB ham veriyi ayrı repoya/Release'e taşıma + `git filter-repo` ile geçmiş temizliği | 4. adım **force-push** gerektiriyor: her fork'u ve mevcut klonu bozar. 2. adım "veri nereye taşınacak, orayı kim bakacak" kararı. Hazırlık bitti (`scripts/build-b.js`), karar verilirse güvenle uygulanabilir. |
| §7.4 | Her anime için gerçek URL + 6107 URL'lik sitemap (SEO) | Teknik değil **telif** kararı: arşivi arama motorlarına 6107 kapıdan açar. Ziyaretçi sayısındaki en büyük sıçramayı bu yapar. Adımlar hazır. |

### B. Repo dışında, elle yapılacaklar (koddan yapılamıyor)
| madde | ne |
|---|---|
| §4.4.1 | `npx vercel deploy --prod` — köken kısıtlaması **canlıda değil**, uçlar hâlâ herkese açık |
| §4.4.2 | Aynı deploy + başka bir ağdan tek bölüm denemesi → sonra `js/links.js`'te `OKRU_ETKIN = true` |
| §7.6 | Repo **About** açıklaması, **topics**, **website** alanı (GitHub arama motoru bunlara bakıyor) |
| §7.6 | **Google Search Console**: doğrulama dosyası repoda — Verify'a bas, `sitemap.xml` gönder |
| §7.6 | **Social preview** görselini yükle (`docs/assets/social-preview.png`, Settings → General) |

### C. Sırada bekleyen gerçek işler
| madde | ne | not |
|---|---|---|
| §2.1.3 | `data.js` + `meta.js`'i tek bir `index.json`'a birleştirip `fetch` ile al | **Sıradaki en büyük perf işi**: kısılmış bağlantı ölçümünde LCP'yi asıl bekleten bu 920 KB (bkz. §2.5) |
| §2.5 B/C | Kapakları WebP olarak kendimiz servis etmek (−%75 bayt) ve baskın renk yer tutucusu | Ayrı depo/CDN kararı gerektiriyor |
| §2.1 kabul | Lighthouse mobil skoru (önce/sonra), LCP < 2.5 s (Slow 4G) | Bu ortamda Lighthouse yok; ölçüm repo sahibinde |
| §4.4 madde 2 | Deploy'un elle yapılması kırılgan — repoyu Vercel projesine bağla ya da `.github/workflows/deploy-api.yml` yaz | Wrangler için de aynısı |
| §7.5 | Fansub'a göre filtre (veride `fansub` alanı var, hiç kullanılmıyor) | "sadece TAÇE çevirileri" gibi |
| §4.3 kalan | CI'da tam checkout ~900 MB sürüyor | §3.1'e bağlı (ham veri ayrılırsa CI hızlanır) |

---

## 1. Acil — hatalar (önce bunlar)

### 1.1 `tip: "yol"` linkleri kırık iframe açıyor — **(TAMAM)**
- **Dosya:** `app.js:40` `epLinksHtml()`
- **Sorun:** Fonksiyon sadece `l.tip === 'mask'` kontrolü yapıyor. Veride üçüncü bir tip var: `yol`.
  URL'si mutlak değil, turkanime'nin kendi ajax yolu:
  `ajax/videosec&b=dXVkYXg2...` — bu `data-embed-url` olarak basılınca iframe
  `https://berke-aras.github.io/turkanime-arsiv/ajax/videosec&b=...` isteyip 404 sayfası gösteriyor.
- **Ölçüm:** Tam taramada **1.708 adet** `yol` (hepsi `ALUCARD(BETA)`), %100'ü kırık.
  (Karşılaştırma: 1.165.204 `url`, 387.519 `mask`.)
- **Yapılacak:** `mask` kontrolünü `const OLU = t => t !== 'url'` hâline getir; `epLinksHtml`,
  `epItemHtml` (`app.js:666`), `openEpisode` (`app.js:412`) ve `firstPlayable`
  (`app.js` renderDetail içi) hepsi bu yardımcıyı kullansın.
- **Kabul:** `grep '"tip":"yol"' kaynak/b/*.js` ile bulunan bir animede o buton üstü çizili/pasif görünür.
- **Yapıldı (2026-09-22):** `app.js`'e `const OLU = tip => tip !== 'url'` yardımcısı eklendi;
  `epLinksHtml`, `openEpisode` (fansub çipi + önerilen seçim), `epItemHtml` ve `firstPlayable`
  hepsi bu yardımcıyı kullanıyor. Repo genelinde ölçüm: 1.165.204 `url`, 387.519 `mask`,
  **1.708 `yol`** (plandaki 35 örneklem tahminiydi). `beck` 1. bölümde ALUCARD(BETA) artık
  `<span class="link-btn mask">`; hiçbir `data-embed-url` göreli değil (duman testiyle doğrulandı).

### 1.2 Detay sayfasındayken arama kutusu hiçbir şey yapmıyor — **(TAMAM)**
- **Dosya:** `app.js:836` → `if (location.hash.startsWith('#/anime/')) return;`
- **Sorun:** Kullanıcı detay sayfasında üstteki arama kutusuna yazıyor, hiçbir şey olmuyor. Sessiz ölüm.
- **Yapılacak:** `return` yerine listeye dön:
  `state.query = searchEl.value; state.page = 1; if (location.hash !== '#/') location.hash = '#/'; else renderList();`
  (hash değişimi `route()` → `renderList()` tetikler.)
- **Kabul:** Bir anime detayındayken "naruto" yazınca liste sayfasına düşüp sonuçlar gelir.
- **Yapıldı (2026-09-22):** `return` kaldırıldı; `state.query`/`state.page` her durumda güncelleniyor,
  hash `#/` değilse `location.hash = '#/'` (route() -> renderList() tetikler), değilse doğrudan
  `renderList()`. Yasal sayfası için de çalışır. Duman testi: detaydayken yazınca `hash=#/`, 60 kart.

### 1.3 Geri tuşunda liste konumu ve filtreler kayboluyor — **(TAMAM)**
- **Dosya:** `app.js:822` `route()`, `app.js:468` `state`
- **Sorun:** Filtre/sıralama/arama yalnız bellekteki `state`'te. Detaydan geri dönünce sayfa en üste
  atıyor; sekme yenilenirse tüm filtreler sıfırlanıyor; filtrelenmiş bir görünüm paylaşılamıyor.
- **Yapılacak:**
  1. Filtreleri hash'e taşı: `#/?q=naruto&kategori=TV&tur=Aksiyon&sort=puan&fav=1&sayfa=3`.
     `route()` hash'i parse edip `state`'i doldursun; `wireFilterBar()` değişiklikte
     `history.replaceState` ile hash'i güncellesin (her tuş vuruşunda `pushState` yapma).
  2. Listeden detaya giderken `sessionStorage`'a `scrollY` yaz, listeye dönünce geri yükle.
     `history.scrollRestoration = 'manual'` kur.
- **Kabul:** 5. sayfaya kadar yükle → bir animeye gir → geri → aynı kaydırma konumu ve aynı kart sayısı.
- **Yapıldı (2026-09-22):** `listHash()` / `parseListHash()` / `syncListHash()` eklendi; hash artık
  `#/?q=&kategori=&tur=&sort=&fav=1&sayfa=N` taşıyor, filtre çubuğu ve "daha fazla yükle"
  `history.replaceState` ile adresi tazeliyor (geçmiş kirlenmiyor). Kaydırma konumu
  `sessionStorage['ta_list_scroll']`'da; `history.scrollRestoration = 'manual'`.
  **Ek bulgu:** kısıtlı (throttle) kaydırma yazımı, kullanıcı kaydırmanın hemen ardından bir karta
  tıklayınca son konumu kaçırıyordu — `hashchange`'in `oldURL`'ü kullanılarak rota değişiminden önce
  senkron yazım eklendi. Testte konum piksel isabetli dönüyor (1500 → 1500).

### 1.4 Ters sıralamada "sonraki bölüm" yanlış yöne gidiyor — **(TAMAM)**
- **Dosya:** `app.js:394` `jumpToEpisode()`, modal ileri/geri butonları
- **Sorun:** Gezinme `currentEpisodes` dizisindeki indeksle yapılıyor, ekrandaki sırayla değil.
  "Tersten" açıkken (`epReverse`) "Sonraki" listede yukarıdaki bölümü açıyor.
- **Yapılacak:** Modalde görüntü sırasını tutan ayrı bir dizi kullan (`displayOrder`), ileri/geri
  bu dizide yürüsün. Ya da daha basiti: modal açıkken `epReverse`'ü dikkate alıp adımı `±1` yerine
  `epReverse ? -1 : +1` yap ve buton etiketlerini de ona göre çevir.
- **Kabul:** Tersten açıkken "Sonraki" bir sonraki bölüm numarasına (yani listede aşağıya) gider.
- **Yapıldı (2026-09-22):** `epStep()` / `neighborEp()` / `hasEp()` yardımcıları; adım
  `epReverse ? -1 : +1`. Buton durumları tek yerden (`syncEpNavButtons()`) tazeleniyor ve
  `title` artık hedef bölümün adını yazıyor ("Sonraki: BECK 7. Bölüm"), böylece yön hiç
  belirsiz kalmıyor. Modal açıkken "Tersten" düğmesine basılırsa butonlar yeniden senkronlanıyor.
  Video bitince otomatik geçiş de aynı yönü izliyor.

### 1.5 Service Worker sınırsız büyüyor ve güncellemeyi geciktiriyor — **(TAMAM)**
- **Dosya:** `sw.js`
- **Sorun:** `fetch` handler'ı **aynı origin'deki her GET'i** cache'liyor — `kaynak/b/one-piece.js`
  tek başına 3.4 MB. Birkaç uzun seriye bakan kullanıcının cihazında yüzlerce MB birikir, kota
  hatasında SW sessizce çöker. Ayrıca stale-while-revalidate `index.html` için de geçerli olduğundan
  yeni sürüm hep "bir ziyaret sonra" geliyor. `SHELL` içinde `data.js`/`meta.js` yok, yani çevrimdışı
  ilk açılış boş liste gösteriyor.
- **Yapılacak:**
  1. İki ayrı cache: `tka-shell-v4` (app kabuğu, `index.html` dâhil) ve `tka-data-v1`.
  2. Gezinme istekleri (`request.mode === 'navigate'`) için **network-first**, kabuk dosyaları için
     cache-first, `kaynak/b/*.js` ve `kaynak/animeler/*/info.json` için LRU'lu SWR (en fazla ~40 giriş,
     `cache.keys()` ile en eskileri sil).
  3. `SHELL`'e `kaynak/data.js` ve `meta.js` ekle.
  4. `CACHE` adını sürümle ve `activate`'te eski sürümleri sil (bu kısım zaten doğru).
- **Kabul:** DevTools → Application → Cache Storage'da veri cache'i 40 girişi aşmaz; `index.html`
  değişikliği ilk yenilemede görünür.
- **Yapıldı (2026-09-22):** `sw.js` yeniden yazıldı. `tka-shell-v4` (kabuk + `kaynak/data.js` +
  `meta.js`, cache-first) ve `tka-data-v1` (`kaynak/b/*.js` + `info.json`, SWR + 40 girişlik LRU)
  ayrıldı; gezinme istekleri network-first, çevrimdışında `index.html`'e düşüyor. `install`
  artık `addAll` yerine dosya başına `add().catch()` kullanıyor — tek bir 404 kurulumun tamamını
  düşürmüyor. Test: 45 bölüm dosyası çekildikten sonra veri cache'i 40 girişte kalıyor, kabuk
  cache'ine sızıntı yok, çevrimdışı yeniden yüklemede liste 62 kartla dolu geliyor.

### 1.6 `#/yasal` ve detay sayfaları sayfa başına kaydırmıyor — **(TAMAM)**
- **Dosya:** `app.js:822` `route()`
- **Sorun:** Listenin ortasından bir animeye tıklayınca detay sayfası ortadan açılıyor.
- **Yapılacak:** `route()` içinde, geri navigasyonu değilse `window.scrollTo(0,0)` (1.3'teki
  scroll restore ile birlikte kurgula).
- **Yapıldı (2026-09-22):** `route()` detay ve yasal için `jumpTo(0)`, liste için
  `restoreListScroll()` çağırıyor.
  **Ek bulgu:** `style.css:22`'de `html{scroll-behavior:smooth}` global olduğundan rota geçişindeki
  `scrollTo` animasyonla çalışıyor, sayfalar arasında görünür bir kayma oluyordu. `jumpTo()`
  yardımcısı kaydırma sırasında `scroll-behavior`'ı geçici olarak `auto` yapıyor; `#top-btn`'in
  yumuşak kaydırması korundu.

### 1.7 Arşivde olmayan slug boş detay sayfası açıyor — **(TAMAM)**
- **Dosya:** `app.js` `renderDetail()`
- **Bulundu:** §5.1 çalışılırken, `#/anime/<olmayan-slug>` adresinin iskeletten sonra boş bir detay
  sayfası açtığı ve `kaynak/animeler/<slug>/info.json` ile `kaynak/b/<slug>.js` için iki 404 isteği
  attığı görüldü. Eski ya da yanlış yazılmış paylaşılan linklerde kullanıcının gördüğü hâl bu.
- **Yapıldı (2026-09-22):** `renderDetail()` başında `meta` bulunamazsa "Bu anime arşivde
  bulunamadı" ekranı basılıyor ve hiçbir veri isteği atılmıyor. Test: `.empty` metni doğru,
  o slug için 0 ağ isteği.

---

## 2. Yükleme performansı

### 2.1 Açılışta 354 KB gzip zorunlu JS
- **Ölçüm:**

  | dosya | ham | gzip |
  |---|---|---|
  | `kaynak/data.js` | 658 KB | 173 KB |
  | `meta.js` | 924 KB | 180 KB |
  | `app.js` | 49 KB | 17 KB |
  | `style.css` | 34 KB | 7.6 KB |

  İkisi de `<script src>` ile **senkron** yükleniyor (`index.html` sonu) ve `app.js` bunları global
  `window.INDEX` / `window.META` olarak bekliyor. Yavaş bağlantıda ilk kart görünene kadar
  ~350 KB indirilmesi gerekiyor.

- **Yapılacak (ucuzdan pahalıya):**
  1. **Kullanılmayan alanları at.** — **(TAMAM, 2026-09-22)** `data.js`'in 6. alanı (`top`) ve
     5. alanı (`masks`) `app.js`'te okunuyordu ama hiçbir yerde kullanılmıyordu.
     `scripts/trim-data.js` yazıldı (idempotent, veri tazelendikten sonra tekrar çalıştırılabilir);
     kayıt biçimi artık `[slug, baslik, eps, urls]`.
     Ölçüldü: **658 KB → 392 KB ham, 174.7 KB → 130.9 KB gzip (−43.8 KB)**. `build-posters.js`
     yalnız `r[0]`/`r[1]` okuduğu için etkilenmiyor.
  2. **Poster URL'lerini kısalt.** — **(TAMAM, 2026-09-22)** 5204 posterin **%100'ü** standart
     önekliymiş. Önek `scripts/poster-onek.js` (build tarafı) ve `js/data.js` içindeki
     `POSTER_ONEK` (tarayıcı tarafı) olarak sabite alındı; meta'da yalnız dosya adı duruyor.
     Yardımcılar idempotent (mutlak URL'e dokunmuyor), scriptler tekrar çalıştırılabilir.

     **Ölçüm (4 varyant, hepsi aynı 6107 kayıt):**

     | varyant | ham | gzip |
     |---|---|---|
     | eski (yıl/stüdyo yok, tam URL) | 923 KB | 181.6 KB |
     | yıl+stüdyo eklenmiş, tam URL | 1037 KB | 215.9 KB |
     | yıl/stüdyo yok, öneksiz URL | 603 KB | 173.5 KB |
     | **yeni** (yıl+stüdyo, öneksiz URL, tür/stüdyo dizinli) | **506 KB** | **189.9 KB** |

     Yani önek çıkarma tek başına ham −320 KB / gzip −8.1 KB; yıl+stüdyo eklemesi gzip'e +32 KB
     getiriyordu, tür ve stüdyo adlarının dizinlenmesi bunun 16 KB'ını geri aldı.
     **Net: eskiye göre ham −417 KB (%-45), gzip +8.3 KB** — iki yeni filtre bu fiyata alındı.
     Gzip'in ham kadar düşmemesi beklenen: tekrar eden öneki gzip zaten sıkıştırıyordu; kazanç
     asıl **JS ayrıştırma süresinde** (ham bayta bağlı, bkz. §2.2).
  3. **Bölünmüş veri.** `meta.js`'i ikiye ayır: liste için gereken minimum (kategori, tür, puan,
     poster) ve detayda gereken (özet vb. — zaten `info.json`'da). Daha iyisi: `data.js` + `meta.js`'i
     **tek bir `index.json`**'da birleştirip `fetch` ile al (JSON parse, JS parse'tan hızlıdır) ve
     `app.js`'i `defer` yap. Bu, `<script>` zincirini kırar, ilk boyamayı öne çeker.
  4. **Sanal liste.** — **(TAMAM, 2026-09-22)** `.card-wrap`'e `content-visibility: auto` +
     `contain-intrinsic-size: auto 320px` eklendi (2 satır CSS; `IntersectionObserver` tabanlı
     sanallaştırmaya gerek kalmadı). `auto` anahtar sözcüğü sayesinde kart bir kez ölçüldükten
     sonra gerçek boyutu hatırlanıyor, kaydırma çubuğu zıplamıyor.

     **Ölçüm** (headless Chromium, 1280×900, `#/?q=a`, "daha fazla yükle" × 25 → 1560 kart;
     her tıklamadan sonra `document.body.offsetHeight` ile düzen zorlanıp süre alındı):

     | | önce | sonra |
     |---|---|---|
     | son 5 tıklamada 60 kart ekleme | 17–18 ms | **7.1–7.6 ms** |
     | 25 tıklamanın toplam düzen maliyeti | 410 ms | **163 ms (−%60)** |

     §1.6'daki kaydırma konumu korunması bozulmadı (duman testi geçiyor).
  5. **Google Fonts render-blocking.** — **(TAMAM, 2026-09-22)** `Inter` self-host edildi
     (`fonts/`, ayrıntı: `fonts/README.md`). İki `preconnect` + bir render-blocking stylesheet
     kalktı; `index.html`'de yalnız latin dosyası `preload` ediliyor, latin-ext'i tarayıcı
     ancak `ğ/ş/İ` gibi bir harf geçtiğinde indiriyor. İkisi de değişken font (wght 100–900),
     yani beş ayrı ağırlık dosyası yerine tek dosya.

     **Alt küme kırpması:** Türkçe için latin-1 dışında yalnız `ğ Ğ ş Ş İ` gerekiyor
     (`ı` zaten latin alt kümesinde). Google'ın `latin-ext` dosyası bunların yanında fonetik
     alfabe (U+1D00-1DBF), Latin Extended Additional ve U+A720-A7FF bloklarını da taşıyordu;
     `pyftsubset` ile Latin Extended-A'ya indirildi.

     | | önce (Google Fonts) | sonra (self-host) |
     |---|---|---|
     | latin | 48.3 KB | 48.3 KB (aynı dosya) |
     | latin-ext | 85.1 KB | **14.7 KB** |
     | toplam yazı tipi | 133.4 KB | **63.0 KB (−%53)** |
     | üçüncü taraf istek | 2 preconnect + 1 CSS + 2 woff2 | **0** |
     | FCP (5 açılış ortancası) | 396 ms | **100 ms** |

     FCP farkının tamamını gerçek kullanıcı görmez: ölçüm ortamında Google'a giden istek
     bir vekil sunucudan geçiyor ve yavaş. **Her ortamda geçerli olan** kısım yapısal:
     render-blocking bir üçüncü taraf isteği ortadan kalktı ve yazı tipi baytları yarıya indi.
     Ek olarak ziyaretçinin tarayıcısı artık Google'a hiçbir istek atmıyor — yasal metne de
     bu not eklendi. CSP daraltıldı: `font-src 'self'`, `style-src`'den `fonts.googleapis.com` çıktı.
     Yazı tipleri service worker kabuk cache'inde, yani çevrimdışında da duruyor.

- **Kabul:** Lighthouse mobil performans skoru ölç, önce/sonra yaz. Hedef: LCP < 2.5 s (Slow 4G).

### 2.2 Başlangıçtaki 6107 elemanlık hazırlık — **(TAMAM)**
- **Dosya:** `js/data.js`
- **Sorun:** Açılışta 6107 kez `norm()` + `split(' ')` + `localeCompare` sıralaması yapılıyordu,
  ana iş parçacığında, ilk boyamadan önce.
- **Ölçüm (önce, Node/V8, aynı veri):** script parse+eval 29.7 ms · `map` (norm+split) 31.7 ms ·
  `sort` 13.1 ms → **hazırlık 44.8 ms**.
- **Yapılan:** Arama anahtarı build zamanında üretilmedi — çünkü `n` alanı başlığın bir kopyası
  ve `kaynak/data.js`'i ~150 KB büyütüyordu (§2.1 ile çelişir). Bunun yerine **tembel** hâle geldi:
  `aramaAnahtari(a)` / `aramaKelimeleri(a)` ilk kullanımda üretip kayıtta saklıyor. Arama
  yapılmayan oturumda hiç üretilmiyor. Sıralama tek bir `Intl.Collator('tr')` ile yapılıyor
  (`String#localeCompare` her çağrıda karşılaştırıcıyı yeniden kuruyordu; ölçüm: 5.3 → 2.7 ms).
- **Ölçüm (sonra):** `map` 31.7 → **6.4 ms** (−17.3 ms). Tarayıcıda ilk kartın boyanması
  (headless Chromium, 5 açılışın ortancası): **274 → 233 ms**.
- **Kabul:** ✅ Hazırlık (map+sort) <30 ms hedefiydi; ölçülen ~20 ms.

### 2.3 Arama: her tuşta 6107 × Levenshtein — **(TAMAM)**
- **Dosya:** `js/search.js` (`matchScore`, `filterAndSort`)
- **Sorun:** 150 ms debounce vardı ama her sorgu tüm kataloğu Levenshtein ile tarıyordu.
- **Yapılan (planın 1. maddesi):** İki aşamalı arama. Önce **ucuz eleme**: sorgunun her kelimesi
  arama anahtarında aynen geçiyor mu (`includes`). Bir tek tam eşleşme bulunursa bulanık tarama
  hiç çalışmıyor; hiç bulunmazsa eskisi gibi Levenshtein'e düşülüyor. Ayrıca varsayılan
  (isim) sıralamada liste zaten sıralı geldiği için her çizimde yeniden sıralanmıyor.
  2. ve 3. maddelere (n-gram indeksi, Web Worker) gerek kalmadı — ölçüm aşağıda.
- **Ölçüm** (headless Chromium, `filterAndSort()` doğrudan çağrılarak):

  | sorgu | önce | sonra |
  |---|---|---|
  | boş (tüm arşiv) | 1.8 ms | **0.2 ms** |
  | `naruto` (ilk arama) | 46.6 ms | **25.8 ms** |
  | `naruto` (sonraki aramalar) | 31.6 ms | **1.0 ms** |
  | `narutoo` (hatalı → bulanık) | 36.3 ms | 43.8 ms |

  İlk aramanın 25.8 ms'si tembel arama anahtarlarının bir kereye mahsus üretimini de içeriyor
  (§2.2); `narutoo` satırında da aynı ödeme var, üstelik bulanık yol artık önce bir tam-eşleşme
  turu yapıyor — yani hatalı yazım biraz pahalılaştı, doğru yazım 30 kat ucuzladı.
- **Davranış değişikliği:** Tam eşleşme varken bulanık komşular artık listelenmiyor —
  `naruto` sonucu 56 → 19 (eskiden "Boruto" da geliyordu). Yazım hatasında öneri mekanizması
  ve "bunu mu demek istedin" bloğu aynen duruyor.
- **Kabul:** ✅ Hatalı sorguda <50 ms (43.8 ms ölçüldü).

### 2.5 Kapaklar geç geliyor — **(A grubu TAMAM)**
- **Ölçüm (önce):** Ana sayfa açılışında ilk ekranda **35 kapak** (masaüstü 1280) / **15 kapak**
  (telefon 390) isteniyor; ilk kapak isteği sayfa açıldıktan **272 ms** sonra atılıyor (liste JS
  ile çiziliyor) ve tam o anda `s4.anilist.co` bağlantısı sıfırdan kuruluyor — **preconnect yoktu**.
- **AniList'in verdiği boyutlar** (8 kapak ortalaması): `small` 100×142 **17 KB** ·
  `medium` 230×326 **57 KB** · `large` 460×652 **231 KB**. Kart ekranda 177×265 css px,
  şerit kartı 126×189 css px basılıyor. `Accept: image/webp` gönderilse bile CDN **hep JPEG**
  dönüyor (denendi), yani sağlayıcı tarafında sıkıştırma kazancı yok.
- **LCP ölçümü:** Sayfanın en büyük içeriği **"Günün Animesi" kapağı** (`A.featured`) — hem `<img>`
  hem `::before` arka planı aynı adresi kullanıyor. Yani ilk izlenim tek bir kapağa bağlı, ve o
  kapak `loading="lazy"` ile, önceliksiz isteniyordu.
- **Yapılan (A grubu, hiçbir bağımlılık eklemeden):**
  1. `index.html`'e `<link rel="preconnect" href="https://s4.anilist.co" crossorigin>`.
  2. Günün Animesi ve detay sayfasının büyük kapağı: `loading="eager" fetchpriority="high"`.
  3. Izgaranın ilk kartları eager (`ONCELIKLI_KART`): geniş ekranda 8, **dar ekranda 4** —
     telefonda 8 demek ekran altındaki iki satırı da indirmek oluyordu (ölçüldü: +115 KB boşa).
  4. Tüm kapaklarda `decoding="async"`.
  5. Şerit kartları (126×189 / 112×168 css px) `small` kapak kullanıyor; yoğunluğu 1.5+ olan
     ekranlarda gözle görülür yumuşama olduğu için orada `medium` kalıyor (`SERIT_BOYUT`).
- **Ölçüm (sonra)** — 1.6 Mbps / 150 ms gecikmeye kısılmış bağlantı, kapaklar gerçek
  ağırlıklarına yakın yer tutucularla, 3 açılışın ortalaması:

  | | önce | sonra |
  |---|---|---|
  | masaüstü — ilk ekran kapak trafiği | 1.721 KB | **1.248 KB (−%27)** |
  | telefon — ilk ekran kapak trafiği | 860 KB | **860 KB** (eager sayısı ekrana göre ayarlandığı için artmadı) |

  **Dürüst sınır:** preconnect ve öncelik ipuçlarının süre kazancı bu ortamda ölçülemiyor —
  tüm trafik yerel bir vekilden geçiyor ve testte kapak yanıtları ağ katmanını atlıyor. Bayt
  kazancı ölçüldü, süre kazancı yapısal (bağlantı kurulumu sayfa açılırken başlıyor, LCP kapağı
  sıraya son değil ilk giriyor).
- **Bu ölçümde çıkan asıl darboğaz:** Kısılmış bağlantıda LCP ~7 sn ve bunun büyük kısmı
  **kapaklar değil, kendi veri dosyalarımız** (`kaynak/data.js` 396 KB + `meta.js` 524 KB
  senkron `<script>`). Yani sıradaki gerçek kazanç **§2.1.3** (tek `index.json` + `fetch`).
- **Yapılmayanlar (bilerek, ayrı karar):** kapakları WebP'ye çevirip kendimiz servis etmek
  (ölçüldü: aynı 230 px kapak WebP q75 ile **14 KB**, yani −%75; 6015 kapak ≈ 82 MB) ve
  baskın renk yer tutucusu. İkisi de ayrı bir depo/CDN kararı gerektiriyor; `wsrv.nl` gibi
  ücretsiz dönüştürücü proxy'ler AniList'i engelliyor (denendi: `Domain or TLD blocked by policy`).

### 2.4 Eksik poster: 903 anime — **(TAMAM)**
- **Dosya:** `scripts/build-posters.js`
- **Ölçüm:** 6107 animenin **903'ünde** (%14.8) poster yok; bunlar harf baş harfli renkli kutu olarak
  görünüyor ve ana sayfanın görsel kalitesini düşürüyor.
- **Bulgu:** Bu 903'ün **hepsinde** `info.json` → `Resim` alanı dolu, ama hepsi
  `http://www.turkanime.co/imajlar/...` — site kapalı **ve** `http` (HTTPS sayfada karışık içerik
  olarak bloklanır). Doğrudan kullanılamaz.
- **Yapılacak:**
  1. `build-posters.js` arama anahtarı olarak sadece Türkçe/romanize `baslik` kullanıyor.
     Eksik kalanlar için **ikinci tur**: `info.json`'daki `Japonca` (özgün Japonca başlık) ile ara —
     AniList'te isabet oranı çok daha yüksek.
  2. Üçüncü tur: başlıktan sezon/özel ekleri (`2nd Season`, `Specials`, `OVA`, `Movie`) ayıklayıp
     ana seriyi ara, bulunanın kapağını kullan.
  3. Hâlâ boş kalanlar için `posterPlaceholder`'ın harf kutusu kalsın — ama tasarımı iyileştir (§6.3).
- **Kabul:** Postersiz anime sayısı <300'e insin; script yeniden çalıştırılabilir kalsın (zaten öyle).
- **Yapıldı (2026-09-22):** `scripts/build-posters.js` çok turlu hâle getirildi
  (`--tur N` ile tek tur, `--rapor` ile istek atmadan aday sayımı):

  | tur | arama anahtarı | aday | bulunan |
  |---|---|---|---|
  | 1 | Türkçe/romanize başlık | 903 | — (daha önce tüketilmişti) |
  | 2 | `info.json` → `Japonca` özgün başlık | 857 | **578** |
  | 3 | ana seri (sezon/özel ekleri atılmış) | 273 | **233** |

  **Sonuç: postersiz 903 → 92** (hedef <300 idi). Poster kapsamı 5204/6107 → **6015/6107 (%98.5)**.
  Kalan 92, AniList'te o adla indekslenmeyen batı yapımları ve çok niş girdiler
  (Arcane, Beware the Batman, Blood of Zeus…).
  3. turun ürettiği eşleşmelerin 125'i ana serinin kapağını paylaşıyor (kasıtlı), 582 sezon
  ise 1. ve 2. turda kendi kapağını bulmuş. Örnek URL'ler `curl` ile doğrulandı (200, image/jpeg).
- **Yan düzeltme (aynı gün):** `build-posters.js`, `meta.js`'i yazarken §3.3 ile gelen
  `window.META_TURLER` / `window.META_STUDYOLAR` sözlüklerini düşürüyordu — çalıştırılsaydı site
  açılışta çökerdi. `meta.js` okuma/yazma işi tek yere alındı: **`scripts/meta-io.js`**.
  `build-meta.js` ve `build-posters.js` artık onu kullanıyor.

---

## 3. Repo ve veri katmanı

### 3.1 697 MB kullanılmayan ham veri repoda — **(1. ADIM TAMAM; ÖNEMLİ BULGU, aşağıyı oku)**
- **Ölçüm:** `kaynak/animeler/` = 697 MB, 89.597 dosya. Runtime'da **sadece** `info.json`
  (6107 dosya, toplam birkaç MB) kullanılıyor. Geri kalan `<slug>-<n>-bolum.json` ve `bolumler.json`
  dosyaları büyük ölçüde `kaynak/b/<slug>.js`'in ham karşılığı. (**Dikkat:** birebir aynı veri
  değil — ölçüm için bkz. 1b.)
  `.git` klasörü 307 MB. `git clone` dakikalar sürüyor, GitHub Pages deploy'u yavaş.
- **Yapılacak (dikkatli, geri dönüşü zor):**
  1. ~~Önce `scripts/build-b.js` yaz~~ — **(TAMAM, 2026-09-22)** `scripts/build-b.js` yazıldı ve
     dönüşüm kuralları mevcut çıktıdan geri çıkarılıp ölçüldü:

     | kural | doğrulama |
     |---|---|
     | `url` alanı varsa `tip:"url"`, yoksa `mask` varsa `tip:"mask"`, ikisi de yoksa `tip:"yol"` | — |
     | `href.li` yönlendirme sarmalayıcısı atılıyor, adres `trim()`leniyor | — |
     | Link sırası: `url` olanlar öne, ölüler arkaya; **ikili kararlı bölümleme** (üçlü değil) | — |
     | Bölüm `no`'su: slug'daki **son** `-<sayı>-bolum` eşleşmesi, yoksa `null` | **71.573/71.573 bölümde birebir** |
     | Linksiz bölümler çıktıya girmiyor; sıralama `no`, eşitlikte slug | — |

     Sonuç: **6107 dosyanın 5998'i (%98.2) baytı baytına üretiliyor.**

  1b. **ÖNEMLİ BULGU — planın bu maddedeki varsayımı yanlış.** Plan `kaynak/animeler`'i
     `kaynak/b`'nin "ham hâli" (üst kümesi) sayıyordu. Değil:
     - Kalan **109** dosyadaki farkın **87'si** bölüm sayısından: `kaynak/b`'de, ham karşılığı
       **boş** olan bölümler için yer tutucu kayıtlar var (`{"player":"?","fansub":"-","tip":"url","url":null}`).
       Aynı durumdaki başka bölümler ise çıktıya hiç girmemiş — yani veri, zaman içinde değişmiş
       ve kendi içinde tutarsız bir kazıma hattından geçmiş.
     - **14'ü** yalnız `durum` alanından: repoda 157 link `calisiyor`/`olu`/`supheli` işareti
       taşıyor. Bu alan ham veride **yok** ve uygulama hiçbir yerde okumuyor — yarım kalmış bir
       ölü-link taramasından kalma. (Script yeniden üretirken bu alanı koruyor.)
     - **8'i** bölüm sırasından.

     **Sonuç:** `kaynak/b` türetilmiş bir çıktı değil, **kaynağın kendisi**. Ham veriyi atmak
     güvenli (kaynak/b daha zengin), ama `kaynak/b`'yi ham veriden yeniden üretmek **kayıplı**.
     Bu yüzden script varsayılan olarak **hiçbir şey yazmıyor**, yalnız rapor veriyor:
     `--yaz` sadece eksik dosyaları ekler, üzerine yazmak için açık `--zorla` gerekir.
  2. Ham veriyi ayrı bir repoya (`turkanime-arsiv-ham`) veya bir GitHub Release tarball'ına taşı.
  3. Ana repoda sadece `kaynak/data.js`, `kaynak/b/`, `kaynak/animeler/*/info.json` kalsın.
     Tahmini: 902 MB → ~210 MB.
  4. Geçmişi temizlemek istersen `git filter-repo` ile; **ama** bu force-push gerektirir, fork'ları
     ve mevcut klonları bozar. Sahibine sor. Temizlemeden de yeni klonlar `--depth 1` ile hızlanır.
- **Kabul:** `du -sh .` çıktısı ve `git clone --depth 1` süresi önce/sonra not edilsin.
- **2–4. adımlar — (YAPILMAYACAK)** Ham veriyi ayrı repoya/Release'e taşıma ve `git filter-repo`
  ile geçmiş temizliği yapılmıyor. Gerekçe:
  - 4. adım **force-push** gerektiriyor; her fork'u ve her mevcut klonu bozar. Bir ajanın
    tek başına alacağı karar değil.
  - 2. adım verinin nereye taşınacağına (ayrı repo mu, GitHub Release mı) ve oranın bakımına
    dair kalıcı bir karar gerektiriyor.
  - 3. adım 2'ye bağlı.

  **Hazırlık tamamlandı:** dönüşüm `scripts/build-b.js` ile kodla belgelendi ve ham verinin
  `kaynak/b`'den **daha fakir** olduğu ölçüldü (1b). Yani sahibi isterse bu adımlar artık
  güvenle atılabilir; karar verildiğinde bu işaret kaldırılsın.

### 3.2 Linklerin %25'i ölü ama yine de gönderiliyor — **(TAMAM)**
- **Ölçüm:** Örneklemde 69.298 `url`, 23.032 `mask`, 35 `yol`. `kaynak/b/` baytlarının **%32.5'i**
  ölü linklerden oluşuyor (örneklem: 18.0 MB'ın 5.8 MB'ı).
- **Kimler tamamen ölü:** `AMATERASU(BETA)`, `ALUCARD(BETA)`, `BANKAI(BETA)`, `HDVID` (%98) —
  hepsi turkanime'nin kendi sunucusunu gerektiriyor, site kapalı olduğundan **hiçbiri asla çalışmayacak**.
- **Yapılacak:** İki seçenek, ikincisi önerilir:
  - (a) Veriden tamamen çıkar: `kaynak/b/` 205 MB → ~138 MB, her detay sayfası %32 daha hızlı.
  - (b) **Önerilen:** Veride kalsınlar ama tek bir özete indirgensinler. Bölüm başına
    `{"olu": 4}` gibi bir sayı yeterli; arayüzde "4 arşiv linki artık çalışmıyor" diye tek satır göster.
    Böylece arşivin bütünlüğü kaybolmaz, ekran da 15 tane üstü çizili butonla dolmaz.
  - Her iki durumda da `scripts/build-b.js` (§3.1) bu ayıklamayı yapsın, ham veri dokunulmadan kalsın.
- **Kabul:** ~~One Piece detay sayfasında bir bölüm açıldığında en fazla 6–8 buton görünür.~~
  Bu ölçüt tutmuyor, çünkü varsayımı yanlıştı: One Piece 1. bölümde ölü linkler atıldıktan sonra
  bile **46 canlı** link kalıyor (tek fansub'da 25'e kadar). Yerine geçen ölçüt: **ekranda tek bir
  ölü buton kalmaması** ve buton sayısının "o fansub'ın canlı linkleri + Reklamsız izle" toplamına
  eşit olması — duman testi bunu doğruluyor.
- **Yapıldı (2026-09-22):** Önerilen (b) seçeneği uygulandı.
  - `scripts/trim-b.js` — ölü linkleri (`mask` + `yol`) atıp bölüme `"olu": <sayı>` yazıyor.
    Idempotent; varsayılan **rapor modu**, yazmak için `--yaz`.
  - `scripts/build-b.js` aynı kırpma işlevini çağırıyor, böylece iki script aynı çıktıyı üretiyor
    (yeniden doğrulandı: **%98.2 birebir**, kırpmadan önceki oranla aynı).
  - Arayüz: `openEpisode` bölüm başına tek satır basıyor —
    *"6 arşiv linki artık çalışmıyor (turkanime sunucusu gerekiyordu)"*.
    `epLinksHtml`'deki ölü link dalları savunma amaçlı duruyor (kırpılmamış veri gelirse çalışsın).

  **Ölçüm:**

  | | önce | sonra |
  |---|---|---|
  | `kaynak/b` toplam | 192.0 MB | **129.4 MB** (−%32.6) |
  | `one-piece.js` | 3.4 MB | **1.95 MB** |
  | link | 1.165.204 canlı + 389.227 ölü | 1.165.204 canlı + sayaç |
  | hiç canlı linki olmayan bölüm | — | 19 (71.573 bölümde) |

- **Maliyet (ölçüldü):** 6007 dosya yeniden yazıldı, yani `.git` kalıcı olarak büyüdü —
  §3.1'in geçmiş temizliği **(YAPILMAYACAK)** olduğu için geri alınamaz.
  **`.git` 310 MB → 345 MB (+35 MB).** Beklenen 129 MB'ın çok altında: yeni dosyalar eskilerin
  alt kümesi olduğu için git'in delta sıkıştırması neredeyse tamamını yutuyor.
  Karşılığında her detay sayfasında inen bayt %32.6 azaldı (One Piece 3.4 → 1.95 MB).
- **Geri alınabilirlik:** Atılan ölü linkler `kaynak/animeler`'deki ham veride duruyor;
  `kaynak/b` gerekirse `scripts/build-b.js` ile yeniden üretilebilir.

### 3.3 `meta.js` şeması eksik: yıl yok — **(TAMAM)**
- **Ölçüm:** `info.json` şu alanları taşıyor: `Kategori`, `Japonca`, `Anime Türü`, `Bölüm Sayısı`,
  `Başlama Tarihi`, `Bitiş Tarihi`, `Stüdyo`, `Puanı`, `Özet`, `Resim`.
  `app.js` bunlardan **`Japonca`, `Başlama Tarihi`, `Bitiş Tarihi`'ni hiç kullanmıyor**
  (`grep` ile doğrulandı: app.js'te 0 eşleşme).
- **Sonuç:** Kullanıcı **yıla göre filtreleyemiyor, yıla göre sıralayamıyor**, kartta yıl göremiyor.
  Bir anime arşivinde bu en beklenen filtrelerden biri. Ayrıca stüdyoya göre filtre de yok.
- **Yapılacak:**
  1. `scripts/build-meta.js`'i genişlet: `meta[slug] = [kategori, türler, puan, poster, yıl, stüdyo]`.
     Yıl `Başlama Tarihi`'nden regex ile (`/(\d{4})/`).
  2. `app.js:58` ANIME map'ine `yil`, `studyo` ekle.
  3. Filtre çubuğuna (`app.js:510` `filterBarHtml`) yıl aralığı (onyıl: 2020'ler, 2010'lar…) ve
     sıralamaya "Yeniden eskiye" ekle.
  4. Kartta (`app.js:164` `cardHtml`) puanın yanına yıl yaz.
  5. Detay sayfasında (`heroInfoHtml`) Japonca başlığı `<h2>` altına küçük gri satır olarak göster —
     hem bilgi hem de arama için değerli.
- **Kabul:** "2015 aksiyon" araması ya da yıl filtresi çalışır; kartta yıl görünür.
- **Yapıldı (2026-09-22):** `meta.js` şeması `[kategori, [türIx...], puan, poster, yıl, studyoIx]`.
  Kapsam ölçüldü: **6092/6107 yıl (%99.8)**, **5707 stüdyo**, 51 farklı tür, 791 farklı stüdyo.
  - `scripts/build-meta.js` yılı `Başlama Tarihi`'nden regex ile alıyor; tür ve stüdyo adları
    kayıt başına tekrarlanmak yerine `window.META_TURLER` / `window.META_STUDYOLAR` sözlüklerine
    indeksleniyor (sözlükler alfabetik → çıktı deterministik, git diff'i sakin).
  - `js/data.js` indeksleri tek `map` içinde çözüyor; çözülen adlar sözlükteki tek dize örneğini
    paylaşıyor.
  - Filtre çubuğuna **onyıl seçicisi** (2020'ler…1910'lar, boş onyıl gösterilmiyor) ve sıralamaya
    **"Yeniden eskiye" / "Eskiden yeniye"** eklendi (yılı bilinmeyenler her iki yönde de sona).
    Onyıl da hash'te: `#/?onyil=1990`.
  - Kartta puanın yanına yıl (`2004 · 26 bölüm · 320 link`).
  - Detay sayfasında başlığın altına **Japonca özgün başlık** (`ベック`, `lang="ja"`) ve
    bilgi şeridine **yayın yılı aralığı** (`2004–2005`; başlangıç ve bitiş aynıysa tek yıl).
    Yeni `i-calendar` ikonu eklendi.
- **Kalan:** Stüdyoya göre filtre — veri artık hazır (`a.studyo` dolu), ama 791 girdilik bir
  `<select>` filtre çubuğunu boğar; aranabilir bir seçici ya da detay sayfasında tıklanabilir
  stüdyo etiketi daha doğru olur.

### 3.4 Ölü/kullanılmayan kod — **(TAMAM)**
- `api/sendvid.js`, `api/doodstream.js` — **(TAMAM, 2026-09-22)** İkisi de silindi ve
  `vercel.json`'daki `maxDuration` girdileri kaldırıldı; `DIRECT_PROVIDERS`'a kayıtlı değillerdi,
  hedef sitelerin anti-bot/routing korumaları yüzünden hiç çalışmamışlardı. Deploy edilen ölü kod
  kalmadı; dosyalar git geçmişinde duruyor. `app.js` başındaki yorum gerekçeyi anlatacak biçimde
  güncellendi.
- `masks` ve `top` alanları: **(TAMAM)** §2.1.1 ile veriden ve `app.js`'ten kaldırıldı.

---

## 4. Mimari ve kod yapısı

### 4.1 `app.js` 856 satırlık tek dosya — **(TAMAM)**
- **Sorun:** Router, oynatıcı, arama, favoriler, yasal metin, HTML şablonları — hepsi tek dosyada.
  `renderLegal()` (`app.js:773`) tek başına ~50 satır gömülü HTML: iki dilde uzun yasal metin
  **JavaScript string'i içinde**. Bir yazım düzeltmesi bile JS dosyasını değiştirip cache'i bozuyor.
- **Yapılacak:** Build adımı eklemeden, ES modüllerine böl (`<script type="module">`, GitHub Pages
  destekliyor):
  ```
  js/util.js       norm, esc, levenshtein, readLS/writeLS, ic
  js/data.js       ANIME/META yükleme + türetilmiş listeler (KATEGORILER, TURLER, istatistikler)
  js/search.js     matchScore, filterAndSort
  js/player.js     modal + DIRECT_PROVIDERS + hls kurtarma (en karmaşık parça, ~200 satır)
  js/views/list.js renderList, cardHtml, filterBarHtml
  js/views/detail.js renderDetail
  js/router.js     route(), hash parse/serialize
  js/main.js       bağlama
  ```
  Yasal metni `yasal.tr.html` / `yasal.en.html` olarak ayır, `fetch` ile yükle (§4.2 ile birlikte
  ayrı bir gerçek sayfa hâline getirmek daha da iyi).
- **Not:** Modüle geçince `defer` bedava gelir (modüller varsayılan defer'dir) — §2.1'e katkı.
- **Kabul:** Hiçbir dosya 250 satırı geçmesin; davranış birebir aynı kalsın.
- **Yapıldı (2026-09-22):** `app.js` silindi, yerine 16 ES modülü (`index.html` artık
  `<script type="module" src="js/main.js">`). En büyük dosya **176 satır**:

  | dosya | satır | içerik |
  |---|---|---|
  | `js/util.js` | 60 | `norm`, `esc`, `ic`, `levenshtein`, `readLS/writeLS`, `initials`, `hue`, `jumpTo` |
  | `js/dom.js` | 7 | `app`, `searchEl`, `fadeApp` |
  | `js/store.js` | 18 | favoriler, son bakılanlar, `epReverse` (erişimcili) |
  | `js/data.js` | 64 | `ANIME`/`META`, türetilmiş listeler, `loadScript` |
  | `js/search.js` | 56 | `matchScore`, `filterAndSort`, `pickRandomAnime` |
  | `js/state.js` | 73 | liste durumu, hash biçimi, kaydırma konumu |
  | `js/links.js` | 53 | `DIRECT_PROVIDERS`, `OLU`, `epLinksHtml` |
  | `js/cards.js` | 41 | `posterPlaceholder`, `cardHtml`, `wireCards` |
  | `js/player-dom.js` | 40 | modal DOM referansları, yükleme ipucu zamanlayıcısı |
  | `js/player-video.js` | 159 | resolver + HLS kurtarma + kontrol çubuğu |
  | `js/player.js` | 139 | modal kabuğu, bölümler arası gezinme, `openEpisode` |
  | `js/views/list.js` | 117 | `renderList`, filtre çubuğu |
  | `js/views/detail.js` | 176 | `renderDetail` |
  | `js/views/legal.js` | 54 | `renderLegal` |
  | `js/router.js` | 27 | `route()` |
  | `js/main.js` | 52 | bağlama |

  Modüller arası döngüsel bağımlılık yok. Paylaşılan değişken durum erişimcilerle veriliyor
  (`getEpReverse`/`setEpReverse`, `getRouteToken`, `setCurrentEpisodes`, `startLoadHint`) — modül
  sınırında canlı bağlama sorunu çıkmasın diye. `sw.js` `SHELL` listesi 16 modülü kapsayacak
  şekilde genişletildi, cache sürümü `tka-shell-v5`.
  **Doğrulama:** refactor sonrası duman testi **31/31**, eslint temiz, masaüstü/mobil/filtreli
  ekran görüntüleri değişmedi — davranış birebir aynı.
- **Kalan:** Yasal metin hâlâ `js/views/legal.js` içinde JS string'i; ayrı `yasal.tr.html` /
  `yasal.en.html` dosyalarına çıkarmak (planın önerisi) yapılmadı — artık kendi modülünde
  olduğu için bir yazım düzeltmesi yalnız o dosyanın cache'ini bozuyor.

### 4.2 `innerHTML` + string şablon riski — **(TAMAM)**
- **Sorun:** Tüm görünümler `innerHTML` ile basılıyor. `esc()` (`app.js:8`) doğru yazılmış ve
  tutarlı kullanılıyor — **bugün bir XSS açığı görmedim** — ama her yeni özellikte `esc` unutmak
  tek satırlık bir hata. Ayrıca `posterPlaceholder` (`app.js:159`) satır içi `onload=`/`onerror=`
  kullanıyor; bu, ileride Content-Security-Policy eklemeyi imkânsız kılar.
- **Yapılacak:**
  1. Satır içi olay işleyicilerini kaldır, `img.addEventListener` ya da tek bir delegasyonlu
     `load` dinleyicisi kullan.
  2. `index.html`'e CSP meta etiketi ekle. Dikkat: `script-src` en az `'self'`,
     `https://cdn.jsdelivr.net` (hls.js), `https://gc.zgo.at` (sayaç); `img-src` `https://s4.anilist.co`;
     `frame-src` embed sağlayıcıları için geniş kalmak zorunda (`https:`).
  3. Yeni kod yazarken şablonları küçük fonksiyonlara böl, `esc` zorunluluğunu yorumla işaretle.
- **Yapıldı (2026-09-22):**
  - Satır içi `onload`/`onerror` kaldırıldı; yerine belgede tek bir yakalama fazlı dinleyici var
    (`js/cards.js`), maliyeti sabit. Duman testi sayfada satır içi olay işleyicisi kalmadığını ölçüyor.
  - `index.html`'e **CSP meta etiketi** eklendi: `script-src 'self' cdn.jsdelivr.net gc.zgo.at`,
    `img-src 'self' data: s4.anilist.co`, `media-src 'self' https: blob:`, `worker-src 'self' blob:`
    (hls.js blob worker kullanıyor), `frame-src https:`, `object-src 'none'`, `form-action 'none'`.
  - **CSP bir sorun yakaladı:** sayaç scripti protokolsüz (`//gc.zgo.at/...`) yazılmıştı;
    `https://` olarak sabitlendi. Veride hiç `http://` link olmadığı da ölçüldü (0 adet),
    yani `frame-src https:` hiçbir bölümü engellemiyor.

### 4.3 Test, lint, CI yok — **(TAMAM)**
- **Yapılacak:**
  1. `package.json` ekle (bağımlılık gerektirmeden `node --test` yeterli).
  2. **Saf mantık için birim testleri** — bunlar DOM gerektirmiyor, kolay:
     `norm()` (Türkçe karakterler: "Şİ" → "si"), `levenshtein()`, `matchScore()` (eşik davranışı),
     `animeOfDay()` (aynı gün aynı sonuç), `esc()`.
     Bu fonksiyonlar §4.1'deki `js/util.js`'e taşınınca doğrudan import edilebilir.
  3. **Veri bütünlüğü testi** (en değerlisi): `kaynak/data.js`'teki her slug için
     `kaynak/b/<slug>.js` ve `kaynak/animeler/<slug>/info.json` var mı; `meta.js` anahtarları
     `INDEX` ile birebir örtüşüyor mu; bilinmeyen `tip` değeri var mı (§1.1 bu testle yakalanırdı).
  4. `.github/workflows/ci.yml`: push'ta `node --test` + `npx eslint` + basit bir HTML/link kontrolü.
  5. GitHub Pages deploy'u Actions'a al ki `kaynak/animeler/` hariç tutulabilsin (deploy süresi düşer).
- **Kabul:** CI yeşil; bozuk bir slug eklenince kırmızı.
- **Yapıldı (2026-09-22):**
  - `package.json` (bağımlılık yalnız eslint) + `package-lock.json`. Komutlar:
    `npm run lint`, `npm test` (veri bütünlüğü), `npm run test:smoke` (tarayıcı).
  - `test/veri-butunlugu.test.js` — 9 test, `node --test`, DOM/ağ gerekmez, ~1.4 sn:
    kayıt biçimi, benzersiz slug, `meta.js` ↔ `INDEX` örtüşmesi, `info.json` ve `kaynak/b`
    varlığı, **bilinmeyen `tip` değeri** (§1.1'i yakalayan test), bölüm dosyasının kendi
    anahtarını kullanması, `url` tipinin mutlak adres taşıması.
    Ayırt edicilik doğrulandı: `beck.js`'e uydurma bir tip enjekte edilince test kırmızıya düştü.
    Yavaş ortamlar için `TKA_TEST_ORNEK=200` ile örnekleme yapılabilir.
  - `eslint.config.js` (flat config): `app.js`/`sw.js` tarayıcı, `scripts/`+`test/` Node CommonJS,
    `api/` CommonJS + Fetch API, `cf/` ESM. `npx eslint .` temiz.
  - `.github/workflows/ci.yml`: iki iş — *lint + veri bütünlüğü* ve *tarayıcı duman testi*
    (Playwright + Chromium). push/PR/manuel tetikleme.
  - **CI'da yakalanan fark (2026-09-22):** duman testi yerelde yeşilken CI'da zaman aşımına düştü.
    Sebep: geliştirme ortamının dışarıya çıkışı yok, CI'ın var; `waitUntil: 'networkidle'`
    CI'da AniList kapakları ve sayaç scripti yüzünden hiç oturmuyordu. Test artık
    `page.route` ile üçüncü taraf isteklerini engelliyor (ölçtüğümüz kendi uygulamamız,
    CDN değil) ve `domcontentloaded` + `waitForSelector` kullanıyor. Her iki ortamda da
    aynı sonuç, süre 14 sn.
- **Ek (2026-09-22, §4.1'den sonra):** `test/util.test.mjs` — `js/util.js`'i doğrudan import eden
  9 birim testi (toplam 18 test): `norm` (Türkçe `ı/İ/I/ş/ğ/ü/ö/ç` eşlemesi, noktalama, boş girdi),
  `esc` (beş karakter + çift kaçış davranışı), `levenshtein` (bilinen mesafeler, simetri, boş dize),
  `initials`, `hue` (kararlılık ve 0–359 aralığı).
- **`matchScore`/`animeOfDay` testleri — (TAMAM, 2026-09-22).** İkisi de Node'da import
  edilemiyordu. Çözüm iki adımda:
  1. Arama puanlaması ve arama anahtarı üretimi saf bir modüle alındı: **`js/eslesme.js`**
     (`aramaAnahtari`, `aramaKelimeleri`, `matchScore`). DOM'a, `state`'e ve `store`'a
     bağlı değil; `js/search.js` artık bunu import ediyor ve `matchScore`'u yeniden dışa
     veriyor, çağıranlar bozulmadı. → `test/eslesme.test.mjs` (10 test: tam eşleşme,
     eşikteki yazım hatası, eşiği aşan, çok kelimeli AND, Türkçe karakterler, tembel
     anahtar üretiminin bir kez çalışması).
  2. `js/data.js` globalleri `window.*` yerine **`globalThis.*`** üzerinden okuyor.
     Tarayıcıda ikisi aynı şey; Node'da ise test veriyi global'e koyup modülü import
     edebiliyor (her senaryo için `import('../js/data.js?t=N')` ile önbellek atlatılıyor).
     → `test/data.test.mjs` (9 test: INDEX+META katlanması, başlıksız/metasız kayıt,
     poster öneki, NSFW bayrağı, Türkçe sıralama, türetilmiş listeler, Günün Animesi'nin
     havuzu/kararlılığı, veri hiç yokken çökmemesi).
- **Kalan:** CI'da tam checkout ~900 MB; §3.1 (ham veriyi ayırma) CI süresini ciddi düşürür.

### 4.4 Resolver'lar (Vercel/Cloudflare)
- `api/sibnet.js` ve `cf/uqload/worker.js` iyi yazılmış (geri çekilme, deadline, cache başlıkları,
  `eval` kullanmadan unpack). İki eksik:
  1. ~~**CORS `*`**~~ — **(TAMAM, 2026-09-22)** İkisi de tamamen açıktı: `access-control-allow-origin: *`
     ve hiçbir köken kontrolü yoktu, yani başka bir site resolver'ı kendi oynatıcısına bağlayabilir,
     fatura/limit bize yazılırdı.
     - Artık `Origin` (yoksa `Referer`) **sunucuda** doğrulanıyor; izinli değilse istek hiç
       yapılmadan **403** dönüyor. CORS başlığı yalnız izinli kökene veriliyor, `vary: origin` ile.
     - Varsayılan izinli köken `https://berke-aras.github.io`. Ek köken:
       Vercel'de `TKA_ALLOWED_ORIGINS`, Worker'da `ALLOWED_ORIGINS` (virgülle ayrılmış).
       Yerel geliştirme için `TKA_ALLOW_LOCALHOST=1` / `ALLOW_LOCALHOST=1`.
     - **Ne kadar korur (dürüst sınır):** CORS yalnız tarayıcıyı bağlar. Sunucu tarafı kontrol
       başlıksız `curl`'ü ve başka sitelerden gelen tarayıcı isteklerini keser, ama
       `-H "Origin: …"` ile başlığı uyduran birini durdurmaz. Bu kimlik doğrulama değil,
       kötüye kullanımı zorlaştıran bir sürtünme katmanıdır. **Gerçek koruma için önüne oran
       sınırlayıcı gerekir:** Vercel Firewall ya da Cloudflare Rate Limiting (ücretsiz planda da var).
     - `test/koken.test.mjs`: iki uygulama da aynı 7 senaryodan geçiyor (kendi kökeni, yabancı köken,
       başlıksız istek, Referer'dan çıkarım, localhost, ek köken, benzeyen sahte kökenler).
     - ✅ **CANLIDA, DOĞRULANDI (2026-09-22).** `npx wrangler deploy` ile Worker deploy edildi
       (Vercel tarafı repo push'unda otomatik deploy olmuş, ayrıca elle tetiklemeye gerek kalmadı).
       Ölçüm (deploy sonrası, üç uç): başlıksız `curl` → sibnet **403**, okru **403**, uqload **403**
       (`{"error":"origin not allowed"}`); `Origin: https://berke-aras.github.io` ile üçü de isteği
       işliyor (CORS başlığı yalnız bu köken için dönüyor); `Origin: https://kotusite.example` →
       uqload **403**. Uçlar artık herkese açık değil.
  2. **Deploy elle yapılıyor** (`.claude/progress.md`: "MCP create_deployment ile inline dosya;
     repo git'e bağlı değil"). Bu kırılgan — repoyu Vercel projesine bağla ya da
     `.github/workflows/deploy-api.yml` ile `vercel deploy --prod` çalıştır. Aynısı Wrangler için.
### 4.4.2 ok.ru resolver'ı — **kod hazır, yayına alınmadı**
- **Ölçüm (düzeltme):** Planda "8721 link" yazıyordu; gerçek sayı çok daha büyük —
  `ODNOKLASSNIKI` **137.184** + `OK.RU` **3.238** link, neredeyse tamamı
  `https://odnoklassniki.ru/videoembed/<id>` biçiminde. Arşivin açık ara en yaygın sağlayıcısı.
- **Canlılık ölçümü:** Rastgele 25 ok.ru linki çekildi, **12'sinde** oynatıcı verisi var
  (%48), 13'ü silinmiş (sayfa 200 dönüyor ama veri boş). Yani ~65.000 bölüm reklamsız
  açılabilir görünüyor.
- **Nasıl çözülüyor:** Embed sayfasında oynatıcının tüm verisi `data-options` özniteliğinde,
  HTML-escape'li bir JSON olarak duruyor; içindeki `flashvars.metadata` → `videos[{name,url}]`
  ve `hlsManifestUrl`. JavaScript çalıştırmaya gerek yok. `api/okru.js` bunu ayrıştırıp en iyi
  mp4'ü döndürüyor (`full` → `hd` → `sd` → …).
- **Neden mp4, neden HLS değil:** m3u8 de çalışıyor ama okcdn yanıtında
  `access-control-allow-origin` **yok** — hls.js tarayıcıdan çekemez. mp4 `<video src>` ile
  oynuyor (media elemanı CORS istemiyor); ölçüldü: `Accept-Ranges: bytes`, Range isteğine
  **206** dönüyor, yani sarma çalışıyor. İkisi de tarayıcı `user-agent`'ı gerektiriyor
  (UA'sız istek 400 alıyor).
- **Risk DOĞRULANDI, ÇALIŞMIYOR (2026-09-22):** Deploy edilmiş uçtan gerçek bir link çözüldü
  (`srcIp=100.54.9.58`, fonksiyonun çıkış IP'si), dönen mp4 URL'i başka bir ağdan (`88.231.55.233`,
  farklı `Origin`/`Referer`/`Range` kombinasyonlarıyla denendi) **HTTP 400** verdi — yani `srcIp`
  gerçekten imzaya dahil, link yalnız fonksiyonun kendi IP'sinden açılıyor. Gerçek kullanıcıların
  tarayıcısı (farklı IP) linki hiçbir zaman oynatamayacak.
- **Durum:** `api/okru.js` + `vercel.json` kaydı + 9 birim testi (ayrıştırıcı saf fonksiyon,
  `test/fixtures/okru-embed*.html` üzerinden) hazır ve doğru çalışıyor (ayrıştırma sorunu yok).
  `js/links.js`'te **`OKRU_ETKIN = false`** bayrağı **kasıtlı olarak kalıcı** — mevcut mimariyle
  (Vercel serverless resolver) çözülemeyen bir mimari kısıt bu, "deploy edilince açılacak" bir
  şey değil. Açılması için ya ok.ru'nun IP kısıtlamasını atlatan farklı bir yaklaşım (ör. kullanıcı
  tarayıcısından embed sayfasını doğrudan okuyup ayrıştırma) ya da bu sağlayıcının tamamen
  vazgeçilmesi gerekir. O ana kadar ok.ru linklerinde klasik embed kalıyor.
- Ayrıca köken kontrolü iki Vercel fonksiyonunda tekrarlanmasın diye `api/_koken.js`'e alındı
  (alt çizgiyle başlayan dosyayı Vercel uç nokta olarak yayınlamıyor).

---

## 5. Erişilebilirlik (a11y)

### 5.1 Kartlar link değil, `role="button"` div — **(TAMAM)**
- **Dosya:** `app.js:164` `cardHtml()`, `app.js:176` `wireCards()`
- **Sorun:** Kart `<div role="button" tabindex="0">` ve **içinde** favori `<button>`'u var.
  İç içe etkileşimli öğe geçersiz ARIA. Ayrıca: orta tık/Ctrl+tık ile yeni sekmede açılamıyor,
  bağlantı önizlemesi yok, ekran okuyucu kart başlığını link olarak duyurmuyor.
- **Yapılacak:** Kartı `<a href="#/anime/<slug>" class="card">` yap; favori butonunu `<a>`'nın
  **dışına**, `position:absolute` ile üstüne konumlandır (kart `position:relative` zaten).
  `wireCards`'taki tıklama/klavye dinleyicileri tamamen silinir — tarayıcı bedava halleder.
  Aynısı `.featured` için de geçerli (`app.js` renderList içi).
- **Kabul:** Bir karta Ctrl+tık yeni sekmede detayı açar; axe DevTools'ta iç içe etkileşim uyarısı gitmiş olur.
- **Yapıldı (2026-09-22):** Kart `<a class="card" href="#/anime/<slug>">` oldu; `role`/`tabindex`
  kalktı. Favori butonu `<a>`'nın dışına, yeni `.card-wrap` sarmalayıcısına taşındı (sarmalayıcı
  `position:relative`, kart onu dolduruyor, buton eskisi gibi sağ üstte). `wireCards` artık yalnız
  favori butonlarını bağlıyor; kart tıklama/klavye dinleyicileri tamamen silindi.
  `.featured` (Günün Animesi) de `<a>` oldu, kendi JS dinleyicileri silindi. CSS'te `:hover`
  kuralları `.card-wrap:hover .card`'a taşındı (favori butonunun üstündeyken kart sönük kalmasın),
  `.recent-grid` genişlik kuralları sarmalayıcıya geçti, `:focus-visible` anahatı eklendi.
  Test: Ctrl+tık gerçekten yeni sekmede detayı açıyor, favori butonu gezinmeyi tetiklemiyor,
  kart genişliği sarmalayıcıyla birebir (düzen bozulmadı), masaüstü + mobil ekran görüntüsüyle doğrulandı.

### 5.2 Modal odak tuzağı yok — **(TAMAM)**
- **Dosya:** `index.html` `#player-modal`, `app.js:246` `openPlayerModal()`
- **Sorun:** Modal açıkken Tab tuşu arkadaki sayfada dolaşıyor. `aria-modal`, `role="dialog"`,
  `aria-label` yok. Kapatınca odak, açan butona dönmüyor.
- **Yapılacak:** `<div id="player-modal" role="dialog" aria-modal="true" aria-label="Bölüm oynatıcı">`,
  açılışta ilk odaklanabilir öğeye odaklan, Tab'ı modal içinde döndür, kapanışta `lastFocused.focus()`.
  Modal açıkken `body { overflow: hidden }` da ekle (şu an arka plan kayıyor).
- **Yapıldı (2026-09-22):** Hepsi. `role="dialog" aria-modal="true" aria-label="Bölüm oynatıcı"`,
  açılışta odak modalın ilk öğesine, Tab/Shift+Tab modalın içinde dönüyor, kapanışta odak açan
  öğeye geri veriliyor, `body.modal-acik{overflow:hidden}`.
  Test 30 kez Tab'a basıp odağın bir kez bile dışarı kaçmadığını ölçüyor.

### 5.3 Canlı bölge (live region) yok — **(TAMAM)**
- Arama sonucu sayısı değiştiğinde ekran okuyucu hiçbir şey duymuyor.
- **Yapılacak:** `.filter-count`'a `aria-live="polite"` ekle. Oynatıcı yüklenirken
  `#player-modal-loading`'e `role="status"`.
- **Yapıldı (2026-09-22):** İkisi de.

### 5.4 Kontrast — **(TAMAM)**
- **Dosya:** `style.css:6` `--muted:#848a9c`
- `--muted` (#848a9c) `--surface` (#12151d) üzerinde ~5.4:1 — normal metin için geçer,
  ama `.card .meta` 11.5px ve `.badge` 10.5px'te kullanılıyor. 12px altı metinde bu oran yorucu.
- **Yapılacak:** Küçük metinlerde `--text-2` (#b7bccb) kullan ya da `--muted`'i bir tık aydınlat.
  `.link-btn.mask` `opacity:.55` + `var(--bad)` birleşimi ~2.5:1 — "bilgi" taşıyan bir öğe için
  çok düşük; §3.2'deki özet satırı bunu zaten çözer.
- **Yapıldı (2026-09-22):** `.card .meta` (11.5px) artık `--text-2` kullanıyor.
  Üstü çizili `.link-btn.mask` sorunu §3.2 ile kendiliğinden çözüldü: ölü linkler hiç basılmıyor.
  Açık tema (§6.1) da kendi kontrast setiyle geldi.

### 5.5 Diğer — **(TAMAM)**
- `index.html`'e `<noscript>` yok — JS kapalıysa boş iskelet kalıyor. Kısa bir açıklama ekle.
- Kaydırma/atlama bağlantısı ("İçeriğe geç") yok.
- `#top-btn` `opacity:0; pointer-events:none` ile gizleniyor ama yine de odak sırasında —
  `visibility:hidden` ekle.
- **Yapıldı (2026-09-22):** Üçü de: `<noscript>` uyarısı, "İçeriğe geç" atlama bağlantısı
  (ilk Tab'da görünür hâle geliyor) ve `#top-btn`'e `visibility:hidden`.

---

## 6. Tasarım

Mevcut tasarım iyi durumda: tutarlı token seti (`style.css:2-18`), düzgün mobil kırılımlar,
iskelet ekranlar, SVG ikon sprite'ı, `prefers-reduced-motion` desteği. Aşağıdakiler bunun üzerine.

### 6.1 Açık tema yok — **(TAMAM)**
- **Ölçüm:** `style.css`'te `prefers-color-scheme` **hiç geçmiyor**; `:root`'ta `color-scheme:dark` sabit.
- **Sorun:** Gündüz kullanan ve sistemi açık temada olan kullanıcı için zorlayıcı.
- **Yapılacak:** Token'lar zaten değişkende — iş büyük ölçüde değer değiştirmek:
  ```css
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) { --bg:#f7f8fb; --surface:#fff; --text:#12151d; ... }
  }
  :root[data-theme="light"] { ... }
  ```
  Başlığa üç durumlu (sistem/açık/koyu) bir tema düğmesi koy, seçimi `localStorage`'a yaz.
  **Dikkat edilecekler:** `.featured::after` ve `.detail-head::after` gradyanlarında `rgba(10,12,17,…)`
  sabit kodlu — token'a çevir. `.fav-btn`, `.rating-badge`, `#top-btn` arka planlarında da sabit
  `rgba(10,12,17,…)` var. `<meta name="theme-color">` de temaya göre değişmeli.
- **Yapıldı (2026-09-22):**
  - Sabit renkler token'a alındı: `--scrim-rgb` (yapışkan başlık + hero gradyanları), `--film`
    (hover zemini), `--hairline`, `--float-bg`, `--accent-ink` / `--accent-ink-2`
    (accent zeminli çip ve etiketlerin yazı rengi — açık temada `#c3cdff` okunmuyordu).
  - **Kapak görselinin üstündeki öğeler bilerek koyu bırakıldı** (`--on-art-bg`, `--on-art-fg`,
    `--on-art-border`): favori düğmesi ve puan rozeti iki temada da aynı görselin üstünde duruyor,
    tema ile dönmeleri okunaklılığı bozardı.
  - **Oynatıcı modalı her iki temada da koyu**: bir video yüzeyi olduğu için `#player-modal`
    token'ları yerel olarak koyu değerlere geri alıyor (`color-scheme:dark` dâhil).
  - `@media (prefers-color-scheme:light)` + `:root:not([data-theme="dark"])` ve
    `:root[data-theme="light"]` blokları; başlıkta üç durumlu düğme (sistem/açık/koyu),
    seçim `localStorage['ta_tema']`'da, `js/theme.js`.
  - `<meta name="theme-color">` etkin temaya göre güncelleniyor; "sistem" seçiliyken işletim
    sistemi teması değişirse de takip ediyor.
  - Yeni ikonlar: `i-sun`, `i-moon`, `i-monitor`.
- **Doğrulama:** duman testine 5 kontrol eklendi (sistem açık/koyu paleti, düğmenin üç durumu +
  `theme-color`, seçimin yenilemede kalması, modalın koyu kalması). Açık temada liste ve detay
  sayfası ekran görüntüsüyle de gözden geçirildi.

### 6.2 Ana sayfa hiyerarşisi — **(TAMAM)**
- Şu an: istatistik şeridi → Günün Animesi → Son bakılanlar → Tüm Arşiv. Mantıklı ama
  6107 anime "Tüm Arşiv" başlığı altında tek düze alfabetik bir duvar hâlinde akıyor. Keşif yok.
- **Yapılacak (etkiye göre sıralı):**
  1. **"En yüksek puanlı"** yatay şerit (puan ≥ 8, 12 kart) — veri hazır, `animeOfDay()`'in
     havuzu zaten benzer.
  2. **Tür/janr keşif satırı**: en kalabalık 8 janr için yatay kaydırmalı çip satırı
     ("Aksiyon 1.240", "Romantik 830"…) → tıklayınca o filtre uygulanır. `TURLER` zaten hesaplanıyor.
  3. **"Devam et"** şeridi — §7.1'deki izleme konumu özelliği geldiğinde en üst sıraya.
  4. "Son bakılanlar" 6 kartla sınırlı (`app.js` renderList); zaten yatay kaydırmalı olduğu için
     16'ya (saklanan sayı) çıkarmanın maliyeti yok.
- **Yapıldı (2026-09-22):** 1, 2 ve 4 uygulandı; 3 (§7.1'e bağlı) sırada.
  - **"En yüksek puanlı" şeridi**: puanı 8+ olanlar puana göre sıralanıp ilk 120'ye iniliyor,
    sonra günün tohumuyla **aralıklı** örnekleme yapılıyor. İlk denemede ardışık seçim
    kullanılmıştı; alfabetik komşular geldiği için şerit "Hellsing, Hellsing Ultimate,
    Helsing Türkçe…" gibi aynı serinin sezonlarıyla doluyordu. Aralıklı örneklemeyle hem
    gerçekten yüksek puanlılar çıkıyor (9.2+) hem şerit her gün değişiyor.
  - **"Janra göre keşfet"**: en kalabalık 8 janr, sayılarıyla; çip tıklanınca yalnız o janrın
    seçili olduğu temiz bir listeye gidiyor (gerçek `<a href="#/?tur=…">`).
  - **"Son bakılanlar"** artık saklanan 16 kaydın tamamını gösteriyor (eskiden 6).
  - Şeritlerin tamamı tek bir `seritHtml()` yardımcısını kullanıyor.
- **3. madde de tamamlandı (§7.1 ile birlikte):** "İzlemeye devam et" şeridi ana sayfada
  en üstte; bırakılan bölüm ve ilerleme çubuğu kartın üstünde görünüyor.

### 6.3 Postersiz kartlar (903 adet) çirkin — **(TAMAM)**
- **Dosya:** `app.js:159` `posterPlaceholder()`
- Şu an: `hsl(<hash>, 45%, 20%)` düz zemin + iki harf. Ana sayfada arka arkaya gelince "bozuk" izlenimi veriyor.
- **Yapılacak:** Tasarımı iyileştir: ince bir diagonal gradyan (`hsl(h,45%,22%)` → `hsl(h+30,40%,14%)`),
  başlığın tamamını 2 satır clamp'li olarak ortada göster (iki harf yerine), alta küçük bir
  "kapak yok" etiketi. Ayrıca poster kutusuna `aspect-ratio` yerine kullanılan `padding-bottom:150%`
  tekniği (commit 69887c489) doğru ve tutarlı — ona dokunma.
- **Yapıldı (2026-09-22):** Diagonal gradyan (`hsl(h,45%,24%)` → `hsl(h+30,40%,14%)`), baş harfler,
  **başlığın tamamı** (3 satır clamp) ve küçük "kapak yok" etiketi. `padding-bottom:150%`
  tekniğine dokunulmadı; `.poster` yüksekliği 0 olduğu için içerik `position:absolute;inset:0`
  bir sarmalayıcıya alındı — ilk denemede içerik kutunun dışına taşıyordu, duman testi
  taşmayı ölçüyor. Yatay şeritlerde (dar kart) yalnız baş harfler gösteriliyor.
- **Not:** §2.4 sonrası bu durumdaki anime sayısı **903 değil 92**.

### 6.4 Bölüm listesi yoğunluğu — **(TAMAM)**
- **Dosya:** `app.js:666` `epItemHtml`, `style.css` `.ep`
- Uzun serilerde (One Piece: 1166 bölüm) her bölüm 46px yüksekliğinde tam genişlik bir satır.
  50'lik gruplar var ama grup içi hâlâ 50 satır × tam genişlik = çok kaydırma.
- **Yapılacak:** İki görünüm modu sun: **liste** (şimdiki) ve **ızgara** (bölüm numarası kutucukları,
  `grid-template-columns: repeat(auto-fill, minmax(56px,1fr))`). Izgarada izlenen bölümler
  işaretli (§7.2), çalışan linki olmayanlar soluk. Uzun serilerde çok daha hızlı gezinilir.
  Tercihi `localStorage`'a yaz.
- **Yapıldı (2026-09-22):** Bölüm araç çubuğuna görünüm düğmesi eklendi, tercih
  `localStorage['ta_epizgara']`'da. **Aynı DOM iki görünümü de besliyor**; hangi parçanın
  görüneceğine CSS karar veriyor, böylece `openEpisode`, bölüm araması, gruplama ve klavye
  gezinmesi ikisinde de değişmeden çalışıyor:
  - Izgarada yalnız bölüm numarası görünür (`grid-template-columns:repeat(auto-fill,minmax(56px,1fr))`,
    mobilde 48px), çalışan linki olmayan bölümler soluk.
  - Açılan bölüm `grid-column:1/-1` ile satırın tamamını kaplar, tam başlık ve link listesi
    yine tam genişlikte çıkar.
  - Bölümler `.ep-kutular` sarmalayıcısına alındı; 50'lik `<details>` grupları korunuyor.
- **Ölçüm (One Piece, 1280×900):** ekranda görünen bölüm sayısı **2 → 457**.
- **Not:** §7.2'deki "izlendi" işareti geldiğinde ızgara kutucuklarına doğrudan oturur.

### 6.5 Detay sayfasındaki boşluklar — **(TAMAM)**
- **Japonca başlık gösterilmiyor** (§3.3) — `<h2>` altına `--text-2` renginde küçük satır.
- **Yayın yılı/tarihi gösterilmiyor** — `info-stats` şeridine ekle.
- **İlgili animeler yok** — aynı janr + yakın puandan 6 kart "Benzer animeler" olarak altta göster.
  Veri zaten bellekte (`ANIME`), maliyeti sıfır. Uzun serilerde sezonlar arası geçiş için de
  slug ön ekiyle "aynı seri" tespiti yapılabilir (`naruto`, `naruto-shippuuden`).
- **Özet 4 satırda clamp** — iyi; ama `ozet-more` düğmesi metinle aynı hizada değil, biraz kopuk duruyor.
- **Yapıldı (2026-09-22):** Japonca başlık ve yayın yılı §3.3 ile gelmişti; kalan ikisi:
  - **Benzer animeler** şeridi eklendi: önce **aynı seri** (slug ön eki, en az 6 karakter — kısa
    ön ekler alakasız yüzlerce sonuç getiriyordu), sonra **ortak janr sayısı** ve **puan yakınlığı**
    sırasına göre 12 kart. Veri zaten bellekte, ek istek yok. Şerit ok düğmeleriyle kaydırılıyor.
  - `ozet-more` düğmesi metinle aynı hizaya alındı (`padding` ve `line-height` özetle eşitlendi).

### 6.6 Oynatıcı modalı — **(TAMAM)**
- Özel kontrol çubuğu (`index.html` `#player-modal-controls`) sadece "reklamsız" `<video>` modunda
  görünüyor, iframe modunda gizli — doğru karar. Eksikler:
  1. **Klavye:** Boşluk (oynat/duraklat), ok tuşları ±5 sn, `F` tam ekran, `M` sessiz.
     Şu an `app.js`'te yalnız `Escape` ve sol/sağ **bölüm değiştirme** bağlı — bu, video oynatırken
     beklenmedik: sol/sağ ok "10 sn geri/ileri" olmalı, bölüm değiştirme `Shift+Ok` ya da `N`/`P` olmalı.
  2. **Ses seviyesi hatırlanmıyor** — `localStorage`'a yaz.
  3. **Oynatma hızı hatırlanmıyor** — `playerSpeed` her açılışta 1x'e dönüyor.
  4. **Mobilde kontroller dokunmatiğe küçük** (`#player-modal-controls button` 32px) — 44px'e çıkar.
  5. **Otomatik gizlenme yok** — kontrol çubuğu videoyu sürekli örtüyor; 3 sn hareketsizlikte gizle.
  6. **Tam ekranda kontroller kaybolur**: `playerVideo.requestFullscreen()` yalnız `<video>`'yu
     tam ekrana alıyor, özel kontrol çubuğu (`<video>`'nun kardeşi) görünmüyor → tam ekranda
     tarayıcının kendi kontrolleri devreye giriyor, tutarsız. `#player-modal-viewport`'u tam ekrana al.
- **Bu 6 madde, projenin "reklamsız izleme" iddiasının vitrini — en görünür tasarım işi burası.**
- **Yapıldı (2026-09-22), altı maddenin tamamı:**
  1. **Klavye.** Ok tuşları artık videoyu **±10 sn sarıyor**; bölüm değiştirme `N`/`P` ya da
     `Shift+Ok`'a taşındı. Ayrıca `Boşluk`/`K` oynat-duraklat, `↑`/`↓` ses ±%10, `M` sessiz,
     `F` tam ekran. iframe embed modunda video kısayolu olmadığı için ok tuşları orada
     eskisi gibi bölüm değiştiriyor.
  2. **Ses seviyesi hatırlanıyor** (`ta_ses`, `ta_sessiz`). `<video>` her yeni kaynakta
     varsayılana döndüğü için tercih oynatmadan hemen önce uygulanıyor.
  3. **Oynatma hızı hatırlanıyor** (`ta_hiz`).
  4. **Dokunmatik hedefler**: kontrol düğmeleri 32 → 36px, mobil kırılımda **44px**.
  5. **Otomatik gizlenme**: video oynarken 3 sn hareketsizlikte çubuk ve imleç kayboluyor;
     fare/dokunma/klavye geri getiriyor. Fare çubuğun üstündeyken gizlenmiyor.
  6. **Tam ekran** artık `#player-modal-viewport`'u alıyor (eskiden yalnız `<video>`), böylece
     özel kontrol çubuğu tam ekranda da görünüyor. İkon tam ekranda `i-minimize`'a dönüyor.
- **Doğrulama:** duman testine **10 uçtan uca kontrol** eklendi. Resolver isteği
  `test/fixtures/video.webm`'e yönlendirilerek gerçek `<video>` yolu sınanıyor (reklamsız
  oynatma, boşluk, sarma, Shift+Ok, sessiz, hız, yeniden açılışta hatırlama, otomatik gizlenme,
  tam ekran hedefi).
  **Yan bulgu:** duman testinin HTTP sunucusu Range isteklerini desteklemiyordu, bu yüzden
  `<video>` sarma yapamıyordu — sunucuya `206 Partial Content` desteği eklendi
  (GitHub Pages de destekliyor, yani test artık gerçeğe daha yakın).

### 6.7 Küçük dokunuşlar — **(TAMAM)**
- Yükleme iskeletleri var ama detay sayfasında `fetch info.json` + `loadScript` sırayla (await
  ardı ardına) çalışıyor — `Promise.all` ile paralelleştir, iskelet süresi yarıya iner.
- `.filterbar` mobilde yatay kaydırmalı (`style.css` @640px) ama kaydırılabilir olduğuna dair
  görsel ipucu yok — sağ kenara yumuşak bir gradyan maskesi ekle.
- Boş sonuç ekranındaki "Bunu mu demek istedin?" iyi bir dokunuş; oraya ek olarak
  "filtreleri temizle" butonu koy (kullanıcı çoğu zaman filtre yüzünden boş sonuç alıyor).
- `#random-btn` mobilde sadece ikon; rastgele animeye gitmek keşfin en eğlenceli parçası —
  ana sayfada "Günün Animesi" kartının yanına ikinci bir giriş noktası koy.
- **Yapıldı (2026-09-22):** Dördü de.
  - `info.json` ve bölüm dosyası artık `Promise.all` ile paralel yükleniyor; iskelet süresi
    ikisinin toplamı değil uzun olanı kadar.
  - `.filterbar` mobilde sağ kenarda yumuşak maske ile kaydırılabilir olduğunu belli ediyor.
  - Filtre kaynaklı boş sonuçta **"Filtreleri temizle"** düğmesi çıkıyor.
  - Günün Animesi kartının altına ikinci bir **"Rastgele bir anime"** girişi kondu.
- **Ek (plan dışı, kullanıcı isteği):** Yatay şeritler masaüstünde kaydırılamıyordu — dokunmatik
  yok, kaydırma çubuğu da gizli. Şeritlere **sol/sağ ok düğmeleri** eklendi (`js/serit.js`):
  yalnız taşma varsa görünüyorlar, uçlara gelince ilgili düğme kayboluyor, mobilde hiç çıkmıyorlar.
  Ana sayfa şeritleri ve "Benzer animeler" aynı bileşeni kullanıyor.

### 6.8 Yetişkin içerik uyarısı — **(TAMAM)** *(plan dışı, kullanıcı isteği)*
- **Sorun:** Ecchi/Hentai türündeki başlıklar hiçbir uyarı olmadan, diğerleriyle aynı biçimde
  listeleniyordu.
- **Ölçüm:** `Ecchi` 531 anime, `Hentai` 1, ayrıca veride `Erotica` türü de var. (`Yaoi` 22 ve
  `Yuri` 2 bu kapsama alınmadı — yetişkin içerik göstergesi değiller.)
- **Yapıldı (2026-09-22):** `js/data.js` içinde `NSFW_TURLER` (`Ecchi`, `Hentai`, `Erotica`);
  her anime `nsfw` bayrağı taşıyor.
  - Kartta kapak üstünde **18+** rozeti.
  - Detay sayfasında hero'nun altında uyarı paneli: *"Yetişkin içerik — Bu başlık … türünde;
    cinsel içerik ya da çıplaklık barındırabilir. 18 yaşından küçükseniz devam etmeyin,
    iş yerinde açmayın."*
  - Ana sayfadaki **keşif şeritlerine ve Günün Animesi'ne hiç girmiyorlar**
    (`animeOfDay` zaten hariç tutuyordu, "En yüksek puanlı" de artık tutuyor).
  - Arama ve filtreler değişmedi: arayan bulabiliyor, uyarıyı görüyor.
- **İkinci tur (2026-09-22, kullanıcı isteği):**
  - **Dosyalar:** `js/data.js` (`NSFW_TURLER`), `js/cards.js` (rozet), `js/views/yas-kapisi.js`
    (kapı + kalıcı panel), `js/store.js` (`ta_18`), `js/views/legal.js` (metin + geri alma).
  - Ecchi/Hentai/Erotica türündeki başlıklarda kartta **18+** rozeti, detayda uyarı paneli.
    Rozet önce kartın **sol altındaydı** ve `.card` konumlandırma bağlamı olduğu için başlık/tür
    yazılarının üstüne biniyordu; **kapağın sağ üstüne** alındı (puan rozeti sol üstte kalıyor).
    Duman testi rozetin kutusunu ölçüp posterin içinde ve başlığın üstünde olduğunu doğruluyor.
  - **Yaş kapısı:** Yetişkin başlıkların detay sayfası, "18 yaşından büyüğüm, onaylıyorum" /
    "Beni buradan çıkar" seçeneği olmadan açılmıyor; onay verilmeden `info.json` ve bölüm
    verisi bile istenmiyor. Onay `ta_18` anahtarında bu tarayıcıda saklanıyor, `#/yasal`
    sayfasındaki kutudan geri alınabiliyor.
  - **Bilerek yapılmayan:** Onay `js/yedek.js`'in yedeklediği anahtarlara dahil edilmedi —
    bir cihazın yaş beyanı başka bir cihaza taşınmamalı.
  - **Dürüst sınır:** Bu bir yaş *doğrulaması* değil, beyan. Sunucu, hesap ya da kimlik kontrolü
    olmayan statik bir sitede yapılabilecek en fazlası bu; yasal metinde de böyle yazıyor.

---

## 7. Yeni özellikler (değer sırasına göre)

### 7.1 İzlemeye devam et — **(TAMAM)**
- **Neden:** Şu an `recent` (`app.js:147` `pushRecent`) sadece **slug** tutuyor. Kullanıcı 300.
  bölümde kaldığını hatırlamak zorunda. Bir arşiv sitesinde en çok istenen özellik budur.
- **Nasıl:** `ta_progress` anahtarında `{ [slug]: { ep: 12, t: 743, updated: 1690000000 } }`.
  `playerVideo`'nun `timeupdate` olayında 5 sn'de bir yaz (`<video>` modunda; iframe modunda
  yalnız bölüm numarası). Açılışta `playerVideo.currentTime = kayit.t`.
  Ana sayfaya "Devam et" şeridi (§6.2.3), kartta ince bir ilerleme çubuğu.
- **Dikkat:** `localStorage` kotası — 6107 anime × kayıt değil, sadece izlenenler tutulacağı için sorun yok.
- **Yapıldı (2026-09-22):** `js/progress.js` — `ta_progress` anahtarında
  `{ [slug]: { ep, t, d, u, izlendi: [...] } }`, en fazla 200 anime (en eskiler düşer).
  - Konum `timeupdate`'te 5 sn kısıtla, ayrıca **duraklatma, sarma, modalın kapanması ve
    `pagehide` anında kısıtsız** yazılıyor.
  - Açılışta `loadedmetadata`'da kaldığı yere dönüyor.
  - Ana sayfada **"İzlemeye devam et"** şeridi en üstte (§6.2.3 de böylece kapandı).
  - Kartta posterin alt kenarında ince ilerleme çubuğu.
- **Çalışırken bulunan iki gerçek hata (ikisi de testle yakalandı):**
  1. Oynatıcı kapandıktan sonra sayfadan ayrılınca `pagehide`, `stopVideo()`'nun sıfırladığı
     `currentTime` ile kaydı **eziyordu** — kaydedilen konum sıfırlanıyordu. Artık kapanışta
     `currentEpIndex` temizleniyor ve `currentTime` 0 ise hiç yazılmıyor.
  2. Devam eşikleri sabit saniyeydi (başta 15 sn, sonda 30 sn); 3 dakikalık bir özel bölümde
     ya da kısa bir OVA'da pencerenin tamamını yiyordu. Eşikler oransal yapıldı
     (`min(15, %3)` ve `min(30, %8)`), uzun bölümlerde yine aynı değerlere oturuyor.

### 7.2 İzlendi işareti — **(TAMAM)**
- Bölüm listesinde izlenen bölümler tik ile işaretli, "izlendi olarak işaretle" / "buraya kadar
  hepsini işaretle" seçenekleri. §6.4'teki ızgara görünümüyle birlikte çok güçlü.
- **Yapıldı (2026-09-22):**
  - Her bölüm satırında tik düğmesi: normal tık tekil işaretler, **Shift+tık buraya kadar
    hepsini** işaretler.
  - Video %90'ı geçince ya da bittiğinde bölüm **otomatik** izlendi sayılıyor.
  - İzlenen bölümlerin başlığı soluklaşıyor; ızgara görünümünde kutucuk yeşil kenarlı ve
    köşesinde tik rozeti var.
  - Araç çubuğunda "3 / 26 izlendi" rozeti; tıklanınca o anime için işaretler temizleniyor.

### 7.3 Favorileri/geçmişi dışa-içe aktarma — **(TAMAM)**
- **Dosya:** `js/yedek.js` (mantık) + `js/views/legal.js` (arayüz), `test/yedek.test.mjs` (7 test)
- Tüm veri `localStorage`'da ve tarayıcı verisi temizlenince gidiyor (yasal metinde de böyle yazıyor).
  `#/yasal` sayfasına "Verilerini yedekle" kutusu eklendi: **JSON indir** / **JSON yükle**.
  Sunucu gerekmiyor, gizlilik duruşu bozulmuyor.
- **Yedeğe giren anahtarlar:** `ta_favs`, `ta_recent`, `ta_progress`, `ta_eprev`, `ta_epizgara`,
  `ta_tema`, `ta_ses`, `ta_sessiz`, `ta_hiz`. Dosya biçimi:
  `{ uygulama: "turkanime-arsiv", surum: 1, tarih, veri: {...} }`.
- **Geri yükleme üzerine yazmaz, birleştirir** — asıl tasarım kararı bu:
  - favoriler ve "son bakılanlar": birleşim (geçmişte yedekteki sıra öne alınıp 16'ya kırpılıyor),
  - ilerleme: kayıt başına `u` (son güncelleme) büyük olan konum kazanıyor, **`izlendi` işaretleri
    birleşiyor** — iki cihazda izlenmiş bölümlerin hiçbiri kaybolmuyor,
  - tercihler (tema, hız, ses…): yedektekiler uygulanıyor (kullanıcının açık isteği).
  Böylece iki cihaz arasında dosya gidip gelse de veri kaybı olmuyor.
- Birleştirme (`birlestir`) saf fonksiyon: DOM'a ve `localStorage`'a dokunmuyor, Node'da doğrudan
  test ediliyor. Bozuk/yabancı dosya anlaşılır hata veriyor, kısmi yazma yapılmıyor.

### 7.4 Gerçek URL'ler (SEO) — **(YAPILMAYACAK)**
- **Ölçüm:** `sitemap.xml`'de **tek bir URL** var (ana sayfa). 6107 animenin hiçbiri aranabilir değil,
  çünkü hepsi `#/anime/<slug>` hash rotası — arama motorları hash'i ayrı sayfa saymaz.
  Paylaşılan linklerde de Open Graph önizlemesi hep aynı genel görseli gösteriyor.
- **Yapılacak (statik kaldığı yerden):**
  1. Her anime için `anime/<slug>/index.html` üret (build script). İçinde doğru `<title>`,
     `<meta name=description>` (özetten), `og:image` (poster), `<link rel=canonical>` ve
     `<script>location.replace('/#/anime/<slug>')</script>` yerine **doğrudan uygulamayı yükleyen**
     aynı kabuk. 6107 küçük HTML dosyası (~2 KB) = ~12 MB, kabul edilebilir.
  2. Router'ı hash'ten `history.pushState`'e geçir (GitHub Pages'te 404.html hilesiyle veya
     yukarıdaki gerçek dosyalarla çalışır).
  3. `sitemap.xml`'i build'de üret (6107 URL; 50.000 sınırının altında, tek dosya yeter).
  4. `application/ld+json` ile her anime sayfasında `TVSeries`/`Movie` şeması.
- **Beklenen etki:** Bu, ziyaretçi sayısında en büyük sıçramayı yapacak tek madde. Ama aynı zamanda
  en çok iş ve telif açısından en görünür hâle gelme anlamına geliyor.
- **Neden yapılmıyor:** Maddenin kendisi "sahibi bunu bilerek karar vermeli" diyor. 6107 anime
  sayfasını arama motorlarına açmak, üçüncü taraf video linklerini barındıran bir arşivi
  telif açısından görünür kılar; bu teknik değil hukuki/kişisel bir karar. `#/yasal`'daki
  kaldırma talebi süreci kurulu olsa da tetiği repo sahibi çekmeli.
  Karar verilirse işaret kaldırılsın; 1–4. adımlar olduğu gibi uygulanabilir.

### 7.5 Diğer
- ~~Klavye kısayolu `/` ile arama kutusuna odaklan.~~ **(TAMAM)** `js/main.js`; `Esc` odaktan
  çıkarıyor. Bir alana yazarken ve oynatıcı modalı açıkken devre dışı. Kutunun sağında
  görünen `/` rozeti yalnız fare/klavye olan geniş ekranlarda çıkıyor.
- Fansub'a göre filtre (veride `fansub` alanı var, hiç kullanılmıyor — "sadece TAÇE çevirileri").
- "Rastgele" butonuna filtre duyarlılığı zaten var (`pickRandomAnime`, `app.js:91`) — iyi.


### 7.6 Keşfedilebilirlik — GitHub ve Google'da öne çıkmak — **(TAMAM — repodaki kısmı)**
- **Sorun:** "türk anime arşivi", "turkanime kapandı" gibi aramalarda repo da site de görünmüyordu.
  GitHub aramasının baktığı alanlar: **repo adı, About açıklaması, topics, README**. Google'ın
  baktıkları: `<title>`, `<meta description>`, sayfadaki metin, yapısal veri, backlink.
- **Paylaşım görselleri (2026-09-22):** `scripts/social-gorsel.py` ikisini birden üretiyor —
  `docs/assets/social-preview.png` (1280×640 PNG, GitHub) ve `og-image.jpg` (1200×630 JPEG,
  sitenin `og:image`'i). **Neden JPEG:** WhatsApp'ın önizleme robotu büyük görselleri sessizce
  atlıyor (aynı tasarımın PNG'si 520 KB, JPEG'i **141 KB**); dosya adı da değiştiği için
  WhatsApp/Telegram'ın eski önizleme önbelleği kendiliğinden geçersiz oluyor. `og:image:type`,
  `og:image:alt` ve `twitter:image:alt` eklendi; boyut/ağırlık sınırı testle korunuyor. Sanat, README'deki `loop-1.gif`'in bir karesi; yazı tipi Inter, sayılar
  `kaynak/data.js`'ten okunuyor (6.107 anime · 71.573 bölüm · 1.165.204 link), yani veri
  tazelendiğinde script tekrar çalıştırılıp görseller güncellenebiliyor. Boyut/ağırlık sınırları
  veri bütünlüğü testinde.
- **Yapıldı (repoda):**
  1. `index.html` başlığı jenerik "Arşiv Görüntüleyici"den anahtar kelimeli hâle getirildi:
     *"TürkAnime Arşivi — Türkçe anime arşivi, bölüm ve izleme linkleri"*. Açıklama, `keywords`,
     `og:site_name`, OG/Twitter metinleri de güncellendi.
  2. Yapısal veri genişletildi: `alternateName`, `keywords`, `isAccessibleForFree` ve
     **`SearchAction`** (Google sonuçta site içi arama kutusu gösterebiliyor; hash rotası
     `#/?q=…` sorguyu olduğu gibi alıyor).
  3. `<noscript>` bloğu tek cümlelik uyarıdan, JS çalıştırmayan tarayıcı/tarayıcı botlarının
     okuyabileceği gerçek bir tanıtım metnine dönüştü (başlık + iki paragraf + linkler).
  4. README: ilk satıra anahtar kelimeli alt başlık, "Genel bakış"a *turkanime.tv* bağlamı,
     **Sık sorulan sorular** bölümü (insanların aradığı soru kalıpları) ve bir **English** özeti.
     GitHub araması README gövdesini de tarıyor; İngilizce özet uluslararası aramalarda yakalar.
- **Elle yapılacak (repodan yapılamıyor — MCP'de repo ayarı yazan araç yok):**
  1. **About açıklaması** (repo sayfası → ⚙ Edit):
     > Kapanan turkanime.tv'nin arşivi: 6100+ Türkçe anime, bölüm listeleri ve izleme linkleri. Statik, sunucusuz, kurulum gerektirmeyen arşiv görüntüleyici.
  2. **Topics** (aynı yer): `turkanime` · `turkanime-tv` · `anime` · `turkish-anime` · `anime-archive`
     · `arsiv` · `turkce-anime` · `static-site` · `github-pages` · `vanilla-js` · `pwa` · `anilist`
  3. **Website** alanına `https://berke-aras.github.io/turkanime-arsiv/` yazılsın (About kutusunda
     link olarak çıkar, Google için de backlink'tir).
  4. **Google Search Console**: doğrulama dosyası **repoda ve yayında**
     (`google65be1d669fd704c0.html`, repo kökü → GitHub Pages aynen servis ediyor). Geriye kalan:
     Search Console'da **Verify**'a bas, sonra **Sitemaps → `sitemap.xml` → Submit**. Dosyanın
     kaybolmaması `test/veri-butunlugu.test.js` ile korunuyor.
  5. **Sosyal önizleme görseli** — görsel hazır: **`docs/assets/social-preview.png`** (1280×640,
     557 KB). Repo sayfası → **Settings → General → Social preview → Edit → Upload an image**.
     Bu görsel GitHub arama sonuçlarında, repo kartlarında ve paylaşılan linklerde çıkıyor.
  6. İsteğe bağlı: repoya bir **Release** ekle; paylaşılan linkler tık alır, tık da sıralamayı besler.
- **En büyük kaldıraç hâlâ §7.4** (her anime için gerçek URL + sitemap). Bu madde bilerek
  **(YAPILMAYACAK)** işaretli: teknik değil, telif/görünürlük kararı. Repo sahibi kararı verirse
  §7.4'teki 1–4. adımlar olduğu gibi uygulanabilir ve ziyaretçi sayısındaki asıl sıçrama o zaman olur.

### 7.7 Yasal/gizlilik metninin tamamlanması — **(TAMAM)**
- Metinde eksik olan başlıklar iki dilde de eklendi:
  **Yetişkin İçerik ve Yaş Sınırı** (§6.8 kapısı, beyan/doğrulama ayrımı, 13 yaş notu),
  **Tarayıcında Saklanan Veriler** (tüm `localStorage` anahtarları tek tek, yedekleme),
  **Sorumluluk Reddi** ("olduğu gibi", üçüncü taraf reklam/güvenlik, ölü linkler,
  turkanime.tv/AniList/stüdyolarla bağlantısızlık, ticari amaç yok),
  **Barındırma ve 5651 Sayılı Kanun** (kullanıcı içeriği yok, video barındırılmıyor).
- Kaldırma talebi bölümüne **KVKK md. 11 başvuru kanalı** eklendi (aynı GitHub issue kanalı;
  kimliği belirli kişiye ait veri işlenmediği notuyla).
- Sayfanın sonuna **son güncelleme tarihi** eklendi.
---

## 8. Yol haritası (önerilen sıra)

**Tur 1 — bir oturumda bitebilir, hepsi düşük riskli** — TAMAM
1. ~~§1.1 `yol` linkleri~~ · 2. ~~§1.2 detayda arama~~ · 3. ~~§2.1.1 `top`/`masks` alanlarını at~~
   · 4. ~~§3.4 ölü kod temizliği~~ · 5. ~~§5.1 kartları `<a>` yap~~
   (ayrıca §1.3, §1.4, §1.5, §1.6 ve plan dışı bulunan §1.7 de bu turda kapandı)

**Tur 2 — altyapı** — TAMAM
6. ~~§4.3 `package.json` + `node --test` + veri bütünlüğü testi + CI~~
7. ~~§4.1 `app.js`'i modüllere böl~~
8. ~~§1.5 service worker'ı düzelt~~

**Tur 3 — veri**
9. §3.1 — 1. adım (`scripts/build-b.js`) ~~yazıldı~~; **2–4. adımlar (YAPILMAYACAK)**, bkz. §3.1
10. ~~§2.4 eksik 903 posteri Japonca başlıkla tara~~ → **903'ten 92'ye indi**
11. ~~§3.2 ölü linkleri özete indir~~ → `kaynak/b` **192 → 129 MB (−%32.6)**
12. ~~§3.3 `meta.js`'e yıl + stüdyo ekle~~ (+ §2.1.2 poster öneki)

**Tur 4 — tasarım**
13. ~~§6.1 açık tema~~
14. ~~§6.6 oynatıcı modalı (6 madde)~~
15. ~~§6.2 ana sayfa keşif şeritleri~~ (+ §6.3 postersiz kart tasarımı)
16. ~~§6.4 bölüm ızgarası~~ → One Piece'te ekranda görünen bölüm 2 → 457

**Tur 5 — özellikler**
17. ~~§7.1 izlemeye devam et + §7.2 izlendi işareti~~
18. §7.4 gerçek URL'ler + sitemap — **(YAPILMAYACAK)**, bkz. §7.4
19. ~~§4.4.1 resolver köken kısıtlaması~~ — **(TAMAM, deploy edildi ve doğrulandı 2026-09-22)**
20. ~~§7.6 keşfedilebilirlik~~ — repodaki kısım bitti; About/topics/Search Console elle
21. ~~§7.3 yedek al / geri yükle~~ + ~~§7.5 "/" kısayolu~~

**Tur 6 — performans** — TAMAM (kalan tek madde isteğe bağlı)
22. ~~§2.2 açılış hazırlığı~~ + ~~§2.3 arama~~ → `naruto` 31.6 → 1.0 ms
23. ~~§2.1.4 sanal liste (`content-visibility`)~~ → 1560 kartta düzen maliyeti −%60
24. ~~§2.1.5 Inter self-host~~ → yazı tipi 133 → 63 KB, üçüncü taraf istek 0
25. ~~§4.3 kalan birim testleri~~ (`js/eslesme.js` + `globalThis` ile) → 53 → 72 test
26. §2.1.3 bölünmüş veri / tek `index.json` — tek kalan performans maddesi

**Kalanlar (öncelik sırasıyla)**
26. §4.4.2 ok.ru resolver'ı — deploy edildi, **doğrulandı ve ÇALIŞMIYOR** (bkz. §4.4.2): `srcIp` imzaya
    dahil, farklı IP'den 400 dönüyor. `OKRU_ETKIN` kasıtlı olarak `false` kalacak.
28. §7.6'nın elle yapılacakları (About, topics, Search Console)
29. §2.1.3 · §2.1.5 · §7.5'in kalan iki maddesi (fansub filtresi)

---

## 9. Çalışırken dikkat

- **Veri değişirse sırayla:** `node scripts/build-meta.js` → `node scripts/build-posters.js`.
  `build-meta.js` mevcut poster alanını koruyor (`app.js` değil, `scripts/build-meta.js:12-19`), silme.
- **`api/sibnet.js` değişirse Vercel'e yeniden deploy gerekir** — repo Vercel'e bağlı değil
  (bkz. `.claude/progress.md`). Aynısı `cf/uqload/worker.js` için Wrangler ile.
- **`kaynak/` `.vercelignore`'da**, `.gitignore`'da **değil** — yani git'e giriyor, Vercel'e gitmiyor. Doğru.
- Ölçüm yapmadan "hızlandı" deme: önce/sonra Lighthouse veya `performance.mark` sayısı yaz.
- Türkçe metinlerde `norm()`'un `ı/İ/ş/ğ/ü/ö/ç` eşlemesi var (`app.js:3`) — yeni arama kodu
  yazarken onu atlama.

---

## Değişiklik günlüğü

| tarih | madde | özet |
|---|---|---|
| 2026-09-22 | §1.1 | `tip:"yol"` linkleri artık pasif basılıyor (1.708 kırık iframe linki) |
| 2026-09-22 | §1.2 | Detay/yasal sayfasında arama kutusu listeye dönüyor |
| 2026-09-22 | altyapı | `scripts/smoke-test.js` — Playwright tabanlı tarayıcı duman testi eklendi |
| 2026-09-22 | §1.3 | Liste durumu hash'te (paylaşılabilir/yenilemeye dayanıklı) + kaydırma konumu korunuyor |
| 2026-09-22 | §1.4 | Ters sıralamada ileri/geri ekrandaki yönü izliyor, buton başlığı hedef bölümü söylüyor |
| 2026-09-22 | §1.6 | Rota geçişleri sayfa başına, animasyonsuz kaydırıyor |
| 2026-09-22 | §1.5 | SW: kabuk/veri cache'leri ayrıldı, veri LRU'lu (40), gezinme network-first, çevrimdışı açılış dolu |
| 2026-09-22 | §5.1 | Kartlar ve Günün Animesi gerçek `<a>`; iç içe etkileşimli öğe kalmadı |
| 2026-09-22 | §2.1.1 | `data.js` 4 alana kırpıldı: 658→392 KB ham, 174.7→130.9 KB gzip |
| 2026-09-22 | §3.4 | `api/sendvid.js` + `api/doodstream.js` silindi; OK.RU maddesinin yanlış olduğu ölçümle saptandı |
| 2026-09-22 | §1.7 | Bilinmeyen slug artık "bulunamadı" gösteriyor, 404 isteği atmıyor (plan dışı, çalışırken bulundu) |
| 2026-09-22 | §4.3 | package.json, 9 veri bütünlüğü testi, eslint flat config, GitHub Actions CI |
| 2026-09-22 | §4.1 | `app.js` (955 satır) 16 ES modülüne bölündü; en büyük dosya 176 satır |
| 2026-09-22 | §4.3+ | `test/util.test.mjs` — saf mantık birim testleri (toplam 18 test) |
| 2026-09-22 | §3.3 | `meta.js`'e yıl + stüdyo; onyıl filtresi, yıl sıralaması, kartta yıl, detayda Japonca başlık |
| 2026-09-22 | §2.1.2 | Poster öneki sabite alındı + tür/stüdyo dizinlendi: `meta.js` ham 923→506 KB |
| 2026-09-22 | CI | Duman testi hermetik hâle getirildi (üçüncü taraf istekleri engelli, `networkidle` yerine `domcontentloaded`) |
| 2026-09-22 | §3.1.1 | `scripts/build-b.js`: dönüşüm kodla belgelendi (%98.2 birebir); `kaynak/b`'nin ham veriden zengin olduğu saptandı |
| 2026-09-22 | belge | Ölçümle yanlış çıkan OK.RU maddesi silindi, §1.1 ve §3.1'in eskimiş ölçümleri düzeltildi; §3.1.2–4 ve §7.4 **(YAPILMAYACAK)** işaretlendi |
| 2026-09-22 | §2.4 | Çok turlu poster taraması: postersiz 903 → 92; `scripts/meta-io.js` ile meta.js yazımı tek yere alındı |
| 2026-09-22 | §3.2 | Ölü linkler bölüm başına tek sayıya indi: `kaynak/b` 192 → 129 MB (−%32.6), `.git` +35 MB |
| 2026-09-22 | §6.1 | Açık tema + üç durumlu tema düğmesi; sabit renkler token'a alındı |
| 2026-09-22 | §6.6 | Oynatıcı modalının altı maddesi: klavye, ses/hız hatırlama, 44px hedefler, otomatik gizlenme, tam ekran |
| 2026-09-22 | §6.2 + §6.3 | Ana sayfaya "En yüksek puanlı" ve "Janra göre keşfet" şeritleri; postersiz kart tasarımı yenilendi |
| 2026-09-22 | §6.4 | Bölüm ızgarası: One Piece'te ekranda görünen bölüm 2 → 457 |
| 2026-09-22 | §7.1 + §7.2 | İzlemeye devam et (konum kaydı, şerit, ilerleme çubuğu) ve izlendi işareti |
| 2026-09-22 | §4.2 + §5.2–5.5 | Satır içi olay işleyicileri kalktı, CSP eklendi; modal odak tuzağı, canlı bölgeler, kontrast, noscript + atlama bağlantısı |
| 2026-09-22 | §6.5 + §6.7 | Benzer animeler şeridi, paralel yükleme, filtre temizleme, ikinci rastgele girişi, şerit ok düğmeleri |
| 2026-09-22 | §6.8 | Ecchi/Hentai/Erotica için 18+ rozeti ve detay sayfasında yetişkin içerik uyarısı |
| 2026-09-22 | §4.4.1 | Resolver'lara köken kısıtlaması (`Origin`/`Referer` sunucuda doğrulanıyor) + 7 senaryolu ortak test |
| 2026-09-22 | §7.6 | Keşfedilebilirlik: başlık/meta/yapısal veri, zengin `noscript`, README (SSS + English); elle yapılacaklar listelendi |
| 2026-09-22 | §2.2 + §2.3 | Tembel arama anahtarı, iki aşamalı arama, tek `Intl.Collator`: `naruto` 31.6 → 1.0 ms, ilk kart 274 → 233 ms |
| 2026-09-22 | §2.1.4 | Kartlara `content-visibility:auto`: 1560 kartta düzen maliyeti −%60 |
| 2026-09-22 | §7.3 + §7.5 | JSON yedek al / birleştirerek geri yükle (7 birim + 6 duman testi), "/" arama kısayolu |
| 2026-09-22 | §4.4.2 | ok.ru resolver'ı (140.428 link, örneklemde %48 canlı): `api/okru.js` + 9 test; `OKRU_ETKIN` bayrağı deploy'u bekliyor |
| 2026-09-22 | §6.8 + §7.7 | Yaş kapısı (onayla / buradan çıkar), 18+ rozeti kapağın sağ üstüne, yasal metne 4 yeni bölüm + KVKK kanalı |
| 2026-09-22 | belge | §0 güncel ölçümlerle tazelendi, **§0.1 "Geriye kalanlar"** tablosu eklendi; §6.8/§7.5–7.7 sıralaması düzeltildi |
| 2026-09-22 | §2.1.5 | Inter self-host (133 → 63 KB, 0 üçüncü taraf istek, FCP 396 → 100 ms); CSP daraltıldı |
| 2026-09-22 | §4.3 | `js/eslesme.js` ayrıldı + `data.js` `globalThis`'e geçti; `matchScore` ve `animeOfDay` artık birim testli (53 → 72 test) |
| 2026-09-22 | §7.6 | Google doğrulama dosyası eklendi; `scripts/social-gorsel.py` ile GitHub sosyal önizleme (1280×640) ve yeni `og-image.png` üretildi |
| 2026-09-22 | §7.6 | `og:image` PNG yerine 141 KB JPEG (WhatsApp önizlemesi büyük dosyaları atlıyor) + `og:image:alt` |
| 2026-09-22 | §2.5 | Kapak yükleme: preconnect, LCP kapağına öncelik, ilk kartlar eager, `decoding=async`, şeritlerde küçük kapak → masaüstünde kapak trafiği −%27 |
| 2026-09-23 | yeni | Oynatıcı bilgi paneli (X-Ray): AniList karakter + seslendirmen, AnimeThemes OP/ED (`scripts/build-xray.js` → `kaynak/x/`), AniSkip ile "♪ Şu an çalıyor" ve "Opening'i geç"; duraklatınca panel açılıyor, `I` kısayolu |
| 2026-09-23 | yeni | Bilgi paneli: mobil düzeltmeleri (etiket dokunuşu yutuyordu, panel kontrol çubuğunu örtüyordu); `scripts/build-xray-ek.js` ile 156 yanlış sezon eşleşmesi düzeltildi, 1272 animeye MAL'dan şarkı eklendi (şarkılı anime 3445 → 4846) |
| 2026-09-23 | yeni | Şarkılar Spotify'a yönleniyor (parça kimliği MAL'dan, yoksa arama), ekolayzır animasyonlu şarkı kartları; seslendirmen sayfası + detayda karakter şeridi (`kaynak/sv/`, 4559 seslendirmen); mobilde çift dokunuşla sarma, Media Session, resim içinde resim |
| 2026-09-23 | düzeltme | Reklamsız oynatma güvenilirliği: link önbelleği + önceden çözme + görünür tekrar deneme + düşme sebebi notu (`js/cozum.js`); Sibnet çözücüsü CDN'e fazladan istek atmıyor, önbellek süresi linkin imzasına göre; Uqload Worker'ı Cloudflare engelini "video yok" sanmıyor (elle deploy gerekiyor). Esc tanıtım sırasında oynatıcıyı kapatıyor. Detayda OP/ED + Spotify bölümü, karakter şeridinde oklar |
| 2026-09-23 | yeni | Ana sayfa: anında arama önerileri (karakter/seslendirmen dahil, `kaynak/ara/`), "İzlemeye devam et"te tek tık devam (detaya uğramadan), etkin filtre çipleri, "Sana özel" şeridi (tür + ortak seslendirmen, `kaynak/oneri.json`), sonsuz kaydırma. On yıl ekleri ünlü uyumuyla (1990'lar) |
