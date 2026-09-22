# TürkAnime Arşivi — Geliştirme Planı

> Bu dosya bir **devir teslim (handoff) dokümanıdır**: başka bir Claude Code oturumu ya da başka bir
> yapay zeka bu dosyayı tek başına okuyup maddeleri sırayla uygulayabilsin diye yazıldı. Her madde
> "hangi dosya / ne sorun / ölçüm / ne yapılacak / kabul kriteri" biçiminde.
>
> Ölçümler 2026-09-22'de `main` üzerinde yapıldı (6107 anime, 89.597 dosya, 307 MB `.git`).
> Satır numaraları o günkü `app.js` (856 satır) içindir; dosya değiştikçe fonksiyon adından ara.

---

## Durum takibi

Tamamlanan maddeler başlıklarında **(TAMAM)** ile işaretlenir ve en altta *Değişiklik günlüğü*
bölümüne tarihiyle yazılır. Her madde ayrı commit olarak `main`'e gider; öncesinde
`node scripts/smoke-test.js` (tarayıcı duman testi) yeşil olmalı.

---

## 0. Projenin bugünkü hâli (özet)

| | |
|---|---|
| Mimari | Tamamen statik, build adımı yok. `index.html` + `app.js` (856 satır, tek dosya) + `style.css` + iki global veri dosyası |
| Barındırma | GitHub Pages (site) + Vercel (`api/sibnet.js`) + Cloudflare Workers (`cf/uqload`) |
| Veri | `kaynak/data.js` (658 KB) ve `meta.js` (924 KB) — ikisi de `<script>` ile senkron yükleniyor |
| Bölüm verisi | `kaynak/b/<slug>.js` — 6107 dosya, 205 MB, detay sayfasında talep üzerine yükleniyor |
| Ham veri | `kaynak/animeler/` — 697 MB, 89.597 dosya; sadece `info.json` runtime'da kullanılıyor |
| Router | `location.hash` (`#/`, `#/anime/<slug>`, `#/yasal`) |
| Test / lint / CI | **Yok** (`package.json` da yok) |

**En kritik üç şey:** (1) açılışta ~354 KB gzip'li zorunlu JS, (2) repoda 697 MB kullanılmayan ham veri,
(3) linklerin %25'i ölü ama yine de basılıyor.

---

## 1. Acil — hatalar (önce bunlar)

### 1.1 `tip: "yol"` linkleri kırık iframe açıyor — **(TAMAM)**
- **Dosya:** `app.js:40` `epLinksHtml()`
- **Sorun:** Fonksiyon sadece `l.tip === 'mask'` kontrolü yapıyor. Veride üçüncü bir tip var: `yol`.
  URL'si mutlak değil, turkanime'nin kendi ajax yolu:
  `ajax/videosec&b=dXVkYXg2...` — bu `data-embed-url` olarak basılınca iframe
  `https://berke-aras.github.io/turkanime-arsiv/ajax/videosec&b=...` isteyip 404 sayfası gösteriyor.
- **Ölçüm:** Örneklemde 35 adet `yol` (hepsi `ALUCARD(BETA)`). Az ama %100'ü kırık.
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
  4. **Sanal liste.** `PAGE_SIZE = 60` (`app.js:467`) + "daha fazla yükle" ile 6107 karta kadar DOM
     şişiyor. `content-visibility: auto` + `contain-intrinsic-size` CSS'i (bedava, 2 satır) ya da
     `IntersectionObserver` tabanlı gerçek sanallaştırma.
  5. Google Fonts render-blocking. Ya `Inter`'i self-host et (`woff2`, ~15 KB subset, `font-display:swap`)
     ya da `<link rel=preload as=style onload="this.rel='stylesheet'">` kalıbını kullan. Türkçe için
     `unicode-range` subset'i yeterli.

- **Kabul:** Lighthouse mobil performans skoru ölç, önce/sonra yaz. Hedef: LCP < 2.5 s (Slow 4G).

### 2.2 Başlangıçtaki 6107 elemanlık hazırlık
- **Dosya:** `app.js:58-70`
- **Sorun:** Açılışta 6107 kez `norm()` + `split(' ')` + `localeCompare` sıralaması yapılıyor,
  ana iş parçacığında, ilk boyamadan önce.
- **Yapılacak:** `norm` edilmiş arama anahtarını ve sıralamayı **build zamanında** üret
  (`scripts/build-meta.js` zaten var). Veri dosyası zaten Türkçe alfabetik sıralı gelsin; `n`/`tok`
  alanları da önceden hesaplanmış gelsin. Runtime'da sadece `map` kalır.
- **Kabul:** `performance.mark` ile ölç; ilk `renderList()` öncesi süre <30 ms olsun.

### 2.3 Arama: her tuşta 6107 × Levenshtein
- **Dosya:** `app.js:96` `levenshtein()`, `app.js:114` `matchScore()`
- **Sorun:** 150 ms debounce var ama filtre yoksa her sorgu tüm kataloğu tarıyor. Boş sonuçta
  `renderList()` içindeki "bunu mu demek istedin" bloğu **ikinci** bir tam tarama daha yapıyor.
- **Yapılacak:**
  1. Önce `includes()` ile ucuz eleme; Levenshtein'i sadece hiç eşleşme yoksa veya aday sayısı
     azaldıktan sonra çalıştır.
  2. Uzunluk farkı eşiği zaten var (`app.js:120`), bunu sorgu başına 2–3 karakterlik n-gram
     ön-indeksiyle güçlendir (build zamanında üret).
  3. Ya da bu işi bir `Web Worker`'a taşı — ana iş parçacığı hiç takılmaz.
- **Kabul:** "narutoo" gibi hatalı bir sorguda input gecikmesi <50 ms (Performance panelinde ölç).

### 2.4 Eksik poster: 903 anime
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

---

## 3. Repo ve veri katmanı

### 3.1 697 MB kullanılmayan ham veri repoda
- **Ölçüm:** `kaynak/animeler/` = 697 MB, 89.597 dosya. Runtime'da **sadece** `info.json`
  (6107 dosya, toplam birkaç MB) kullanılıyor. Geri kalan `<slug>-<n>-bolum.json` ve `bolumler.json`
  dosyaları `kaynak/b/<slug>.js`'in **ham hâli** — yani aynı veri iki kez duruyor.
  `.git` klasörü 307 MB. `git clone` dakikalar sürüyor, GitHub Pages deploy'u yavaş.
- **Yapılacak (dikkatli, geri dönüşü zor):**
  1. Önce `scripts/build-b.js` yaz: `kaynak/animeler/<slug>/*.json` → `kaynak/b/<slug>.js` üretimini
     **kodla belgelensin** (şu an bu dönüşümün scripti repoda yok, veri elle geldi).
     Bu olmadan ham veriyi atmak tek yönlü kapı olur.
  2. Ham veriyi ayrı bir repoya (`turkanime-arsiv-ham`) veya bir GitHub Release tarball'ına taşı.
  3. Ana repoda sadece `kaynak/data.js`, `kaynak/b/`, `kaynak/animeler/*/info.json` kalsın.
     Tahmini: 902 MB → ~210 MB.
  4. Geçmişi temizlemek istersen `git filter-repo` ile; **ama** bu force-push gerektirir, fork'ları
     ve mevcut klonları bozar. Sahibine sor. Temizlemeden de yeni klonlar `--depth 1` ile hızlanır.
- **Kabul:** `du -sh .` çıktısı ve `git clone --depth 1` süresi önce/sonra not edilsin.

### 3.2 Linklerin %25'i ölü ama yine de gönderiliyor
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
- **Kabul:** One Piece detay sayfasında bir bölüm açıldığında en fazla 6–8 buton görünür.

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
- ~~`app.js:33` `PREFERRED_PLAYERS` içinde `'OK.RU'` var ama veride o ad hiç geçmiyor.~~
  **Bu madde yanlıştı (2026-09-22'de doğrulandı):** `kaynak/b/*.js` taramasında `"player":"OK.RU"`
  **3.238 kez** geçiyor ve **hepsi canlı `url` tipinde** (`ODNOKLASSNIKI` ayrıca 137.194 kez var,
  ikisi farklı kayıtlar). Giriş ölü değil, **silinmedi**.
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

### 4.2 `innerHTML` + string şablon riski
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
- **Ek (2026-09-22, §4.1'den sonra):** `test/util.test.mjs` — `js/util.js`'i doğrudan import eden
  9 birim testi (toplam 18 test): `norm` (Türkçe `ı/İ/I/ş/ğ/ü/ö/ç` eşlemesi, noktalama, boş girdi),
  `esc` (beş karakter + çift kaçış davranışı), `levenshtein` (bilinen mesafeler, simetri, boş dize),
  `initials`, `hue` (kararlılık ve 0–359 aralığı).
- **Kalan:** `matchScore`/`animeOfDay` testleri (`js/search.js` ve `js/data.js`, ikisi de tepe
  seviyede `window.INDEX`/`window.META` okuduğu için Node'da import edilemiyor — önce veri
  yüklemesini bir fonksiyona almak gerekiyor). Ayrıca CI'da tam checkout ~900 MB;
  §3.1 (ham veriyi ayırma) CI süresini ciddi düşürür.

### 4.4 Resolver'lar (Vercel/Cloudflare)
- `api/sibnet.js` ve `cf/uqload/worker.js` iyi yazılmış (geri çekilme, deadline, cache başlıkları,
  `eval` kullanmadan unpack). İki eksik:
  1. **CORS `*`** — herkes resolver'ı kullanabilir. Kötüye kullanımda Vercel faturası/limiti riski.
     `access-control-allow-origin`'i `https://berke-aras.github.io` ile sınırla (+ localhost'u
     bir env değişkeniyle aç).
  2. **Deploy elle yapılıyor** (`.claude/progress.md`: "MCP create_deployment ile inline dosya;
     repo git'e bağlı değil"). Bu kırılgan — repoyu Vercel projesine bağla ya da
     `.github/workflows/deploy-api.yml` ile `vercel deploy --prod` çalıştır. Aynısı Wrangler için.
- **Ayrıca:** `ODNOKLASSNIKI` (8721 link, en yaygın sağlayıcı) için resolver yok. Sibnet/Uqload
  kalıbı uygulanabilirse "Reklamsız izle" kapsamı ciddi biçimde genişler — en yüksek etkili
  tek backend işi bu.

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

### 5.2 Modal odak tuzağı yok
- **Dosya:** `index.html` `#player-modal`, `app.js:246` `openPlayerModal()`
- **Sorun:** Modal açıkken Tab tuşu arkadaki sayfada dolaşıyor. `aria-modal`, `role="dialog"`,
  `aria-label` yok. Kapatınca odak, açan butona dönmüyor.
- **Yapılacak:** `<div id="player-modal" role="dialog" aria-modal="true" aria-label="Bölüm oynatıcı">`,
  açılışta ilk odaklanabilir öğeye odaklan, Tab'ı modal içinde döndür, kapanışta `lastFocused.focus()`.
  Modal açıkken `body { overflow: hidden }` da ekle (şu an arka plan kayıyor).

### 5.3 Canlı bölge (live region) yok
- Arama sonucu sayısı değiştiğinde ekran okuyucu hiçbir şey duymuyor.
- **Yapılacak:** `.filter-count`'a `aria-live="polite"` ekle. Oynatıcı yüklenirken
  `#player-modal-loading`'e `role="status"`.

### 5.4 Kontrast
- **Dosya:** `style.css:6` `--muted:#848a9c`
- `--muted` (#848a9c) `--surface` (#12151d) üzerinde ~5.4:1 — normal metin için geçer,
  ama `.card .meta` 11.5px ve `.badge` 10.5px'te kullanılıyor. 12px altı metinde bu oran yorucu.
- **Yapılacak:** Küçük metinlerde `--text-2` (#b7bccb) kullan ya da `--muted`'i bir tık aydınlat.
  `.link-btn.mask` `opacity:.55` + `var(--bad)` birleşimi ~2.5:1 — "bilgi" taşıyan bir öğe için
  çok düşük; §3.2'deki özet satırı bunu zaten çözer.

### 5.5 Diğer
- `index.html`'e `<noscript>` yok — JS kapalıysa boş iskelet kalıyor. Kısa bir açıklama ekle.
- Kaydırma/atlama bağlantısı ("İçeriğe geç") yok.
- `#top-btn` `opacity:0; pointer-events:none` ile gizleniyor ama yine de odak sırasında —
  `visibility:hidden` ekle.

---

## 6. Tasarım

Mevcut tasarım iyi durumda: tutarlı token seti (`style.css:2-18`), düzgün mobil kırılımlar,
iskelet ekranlar, SVG ikon sprite'ı, `prefers-reduced-motion` desteği. Aşağıdakiler bunun üzerine.

### 6.1 Açık tema yok
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

### 6.2 Ana sayfa hiyerarşisi
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

### 6.3 Postersiz kartlar (903 adet) çirkin
- **Dosya:** `app.js:159` `posterPlaceholder()`
- Şu an: `hsl(<hash>, 45%, 20%)` düz zemin + iki harf. Ana sayfada arka arkaya gelince "bozuk" izlenimi veriyor.
- **Yapılacak:** Tasarımı iyileştir: ince bir diagonal gradyan (`hsl(h,45%,22%)` → `hsl(h+30,40%,14%)`),
  başlığın tamamını 2 satır clamp'li olarak ortada göster (iki harf yerine), alta küçük bir
  "kapak yok" etiketi. Ayrıca poster kutusuna `aspect-ratio` yerine kullanılan `padding-bottom:150%`
  tekniği (commit 69887c489) doğru ve tutarlı — ona dokunma.

### 6.4 Bölüm listesi yoğunluğu
- **Dosya:** `app.js:666` `epItemHtml`, `style.css` `.ep`
- Uzun serilerde (One Piece: 1166 bölüm) her bölüm 46px yüksekliğinde tam genişlik bir satır.
  50'lik gruplar var ama grup içi hâlâ 50 satır × tam genişlik = çok kaydırma.
- **Yapılacak:** İki görünüm modu sun: **liste** (şimdiki) ve **ızgara** (bölüm numarası kutucukları,
  `grid-template-columns: repeat(auto-fill, minmax(56px,1fr))`). Izgarada izlenen bölümler
  işaretli (§7.2), çalışan linki olmayanlar soluk. Uzun serilerde çok daha hızlı gezinilir.
  Tercihi `localStorage`'a yaz.

### 6.5 Detay sayfasındaki boşluklar
- **Japonca başlık gösterilmiyor** (§3.3) — `<h2>` altına `--text-2` renginde küçük satır.
- **Yayın yılı/tarihi gösterilmiyor** — `info-stats` şeridine ekle.
- **İlgili animeler yok** — aynı janr + yakın puandan 6 kart "Benzer animeler" olarak altta göster.
  Veri zaten bellekte (`ANIME`), maliyeti sıfır. Uzun serilerde sezonlar arası geçiş için de
  slug ön ekiyle "aynı seri" tespiti yapılabilir (`naruto`, `naruto-shippuuden`).
- **Özet 4 satırda clamp** — iyi; ama `ozet-more` düğmesi metinle aynı hizada değil, biraz kopuk duruyor.

### 6.6 Oynatıcı modalı
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

### 6.7 Küçük dokunuşlar
- Yükleme iskeletleri var ama detay sayfasında `fetch info.json` + `loadScript` sırayla (await
  ardı ardına) çalışıyor — `Promise.all` ile paralelleştir, iskelet süresi yarıya iner.
- `.filterbar` mobilde yatay kaydırmalı (`style.css` @640px) ama kaydırılabilir olduğuna dair
  görsel ipucu yok — sağ kenara yumuşak bir gradyan maskesi ekle.
- Boş sonuç ekranındaki "Bunu mu demek istedin?" iyi bir dokunuş; oraya ek olarak
  "filtreleri temizle" butonu koy (kullanıcı çoğu zaman filtre yüzünden boş sonuç alıyor).
- `#random-btn` mobilde sadece ikon; rastgele animeye gitmek keşfin en eğlenceli parçası —
  ana sayfada "Günün Animesi" kartının yanına ikinci bir giriş noktası koy.

---

## 7. Yeni özellikler (değer sırasına göre)

### 7.1 İzlemeye devam et
- **Neden:** Şu an `recent` (`app.js:147` `pushRecent`) sadece **slug** tutuyor. Kullanıcı 300.
  bölümde kaldığını hatırlamak zorunda. Bir arşiv sitesinde en çok istenen özellik budur.
- **Nasıl:** `ta_progress` anahtarında `{ [slug]: { ep: 12, t: 743, updated: 1690000000 } }`.
  `playerVideo`'nun `timeupdate` olayında 5 sn'de bir yaz (`<video>` modunda; iframe modunda
  yalnız bölüm numarası). Açılışta `playerVideo.currentTime = kayit.t`.
  Ana sayfaya "Devam et" şeridi (§6.2.3), kartta ince bir ilerleme çubuğu.
- **Dikkat:** `localStorage` kotası — 6107 anime × kayıt değil, sadece izlenenler tutulacağı için sorun yok.

### 7.2 İzlendi işareti
- Bölüm listesinde izlenen bölümler tik ile işaretli, "izlendi olarak işaretle" / "buraya kadar
  hepsini işaretle" seçenekleri. §6.4'teki ızgara görünümüyle birlikte çok güçlü.

### 7.3 Favorileri/geçmişi dışa-içe aktarma
- Tüm veri `localStorage`'da ve tarayıcı verisi temizlenince gidiyor (yasal metinde de böyle yazıyor).
  Tek düğmeyle JSON indir / JSON yükle. Sunucu gerekmez, gizlilik duruşu bozulmaz.

### 7.4 Gerçek URL'ler (SEO)
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
  en çok iş ve telif açısından en görünür hâle gelme anlamına geliyor — **sahibi bunu bilerek
  karar vermeli** (`#/yasal` sayfasındaki kaldırma talebi süreci zaten kurulu).

### 7.5 Diğer
- Klavye kısayolu `/` ile arama kutusuna odaklan.
- Fansub'a göre filtre (veride `fansub` alanı var, hiç kullanılmıyor — "sadece TAÇE çevirileri").
- "Rastgele" butonuna filtre duyarlılığı zaten var (`pickRandomAnime`, `app.js:91`) — iyi.

---

## 8. Yol haritası (önerilen sıra)

**Tur 1 — bir oturumda bitebilir, hepsi düşük riskli**
1. §1.1 `yol` linkleri (5 satır)
2. §1.2 detayda arama (2 satır)
3. §2.1.1 `top`/`masks` alanlarını at → **−42 KB gzip**, tek script çalıştırma
4. §3.4 ölü kod temizliği
5. §5.1 kartları `<a>` yap

**Tur 2 — altyapı**
6. §4.3 `package.json` + `node --test` + veri bütünlüğü testi + CI
7. §4.1 `app.js`'i modüllere böl (testler önce yazılmalı ki bölme güvenli olsun)
8. §1.5 service worker'ı düzelt

**Tur 3 — veri**
9. §3.1 `scripts/build-b.js` yaz, ham veriyi ayır → **902 MB → ~210 MB**
10. §3.2 ölü linkleri özete indir → `kaynak/b/` %32 küçülür
11. §3.3 `meta.js`'e yıl + stüdyo ekle, filtre/sıralamaya bağla
12. §2.4 eksik 903 posteri Japonca başlıkla tara

**Tur 4 — tasarım**
13. §6.1 açık tema
14. §6.6 oynatıcı modalı (6 madde)
15. §6.2 ana sayfa keşif şeritleri
16. §6.4 bölüm ızgarası

**Tur 5 — özellikler**
17. §7.1 izlemeye devam et + §7.2 izlendi işareti
18. §7.4 gerçek URL'ler + sitemap (sahibin kararına bağlı)
19. §4.4 ODNOKLASSNIKI resolver'ı (en yaygın sağlayıcı, 8721 link)

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
