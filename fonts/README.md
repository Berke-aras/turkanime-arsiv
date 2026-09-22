# Inter (self-host)

Site açılışını üçüncü taraf bir isteğe bağlamamak için (§2.1.5) Inter, Google Fonts'tan
çekilmek yerine burada barındırılıyor. Kazanç: iki `preconnect` + bir render-blocking CSS
isteği kalktı, ayrıca ziyaretçinin tarayıcısı artık Google'a hiçbir istek atmıyor.

| dosya | boyut | kapsam |
|---|---|---|
| `inter-latin.woff2` | 48.3 KB | Google'ın `latin` alt kümesi, olduğu gibi (U+0000-00FF, U+0131 `ı` dahil) |
| `inter-latin-ext.woff2` | 14.7 KB | Google'ın `latin-ext` alt kümesi **yeniden kırpıldı**: 85 KB → 14.7 KB |

İkisi de **değişken font** (wght 100–900), yani 400/500/600/700/800 ağırlıkların hepsi tek
dosyadan geliyor.

## Neden latin-ext kırpıldı

Türkçe için latin-1 dışında yalnız beş harf gerekiyor: `ğ Ğ ş Ş İ` (`ı` Google'ın `latin`
alt kümesinde). Google'ın `latin-ext` dosyası bunların yanında fonetik alfabe
(U+1D00-1DBF), Latin Extended Additional (U+1E00-1E9F) ve U+A720-A7FF gibi bu sitede hiç
kullanılmayan blokları da taşıyordu. Latin Extended-A ile sınırlandı: Türkçenin yanında
Lehçe, Çekçe, Romence gibi diller de çalışmaya devam ediyor.

## Yeniden üretmek

```bash
pip install fonttools brotli
# 1) Google'ın güncel CSS'ini modern bir tarayıcı user-agent'ı ile al, latin ve latin-ext
#    woff2 adreslerini oradan kopyala:
curl -A "Mozilla/5.0 ... Chrome/124.0 ..." \
  "https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap"
# 2) latin dosyasını olduğu gibi indir, latin-ext'i kırp:
pyftsubset inter-latin-ext-tam.woff2 \
  --unicodes="U+0100-017F,U+0218-021B,U+2020" \
  --flavor=woff2 --layout-features='*' --no-hinting \
  --output-file=inter-latin-ext.woff2
```

`style.css`'teki `@font-face` bloklarındaki `unicode-range` değerleri bu kapsamla birebir
aynı olmalı; değiştirirsen ikisini birlikte güncelle.

## Lisans

Inter, SIL Open Font License 1.1 ile dağıtılıyor — tam metin `OFL.txt`.
Kaynak: <https://github.com/rsms/inter>
