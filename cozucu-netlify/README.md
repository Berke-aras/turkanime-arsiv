# Sibnet çözücüsü — Netlify kopyası

`https://tka-sibnet.netlify.app/api/sibnet?id=<videoid>` — `api/sibnet.js` ile aynı kod ve aynı
yanıtlar (köken kontrolü dahil, `api/_koken.js`). `netlify/functions/sibnet.mjs` yalnız Netlify'ın
`Request`/`Response` biçimini Vercel'in `(req, res)` biçimine çeviriyor.

**Neden:** Sibnet hız sınırını kaynak IP'ye göre koyuyor. Tek çözücüde yoğun saatlerde bütün ziyaretçiler
aynı IP havuzundan gidip 403 alıyordu. `js/links.js`'te Sibnet'in `resolver`'ı iki adresli bir dizi;
`js/cozum.js` yükü video numarasına göre bölüyor, biri yoğunsa (503/429/ağ hatası) ötekine geçiyor.
Cloudflare olmaz: Sibnet Cloudflare IP'lerini engelliyor.

**Yayınlama** (GitHub'a bağlı değil; `api/sibnet.js` ya da `api/_koken.js` değişince tekrarla):
yükleme kökü depo kökü gibi olmalı, çünkü function `../../../api/sibnet.js`'i içe aktarıyor. Bu dizindeki
`netlify.toml` yolları da depo köküne göre yazıldı.

```bash
D=$(mktemp -d)
mkdir -p $D/api && cp api/sibnet.js api/_koken.js $D/api/
cp -r cozucu-netlify $D/ && mv $D/cozucu-netlify/netlify.toml $D/netlify.toml
cd $D && npx netlify-cli deploy --prod --site tka-sibnet
```

Köken listesi ortam değişkeniyle genişletilebilir (Netlify panelinde *Project configuration →
Environment variables*): `TKA_ALLOWED_ORIGINS`, `TKA_ALLOW_LOCALHOST=1`.
