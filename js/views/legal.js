// Yasal ve gizlilik metni (#/yasal). İki dilde; tarayıcı dili Türkçe değilse İngilizce öne alınır.
import { ic, IS_TR } from '../util.js';
import { app, fadeApp } from '../dom.js';

function renderLegal() {
  document.title = IS_TR ? 'Gizlilik & Yasal · TürkAnime Arşivi' : 'Privacy & Legal · TürkAnime Arşivi';
  const en = `
      <div class="legal-lang">EN</div>
      <h2>Privacy &amp; Legal Information</h2>

      <h3>Privacy</h3>
      <p>This site is fully static: there are no user accounts, forms, or server-side data storage (the only exception is the ad-free playback helper described below). Your favorites and "recently viewed" list are kept only in your own browser's storage (localStorage), are never sent anywhere, and are deleted when you clear your browser data. The site itself does not use cookies. It is hosted on <a href="https://pages.github.com/" target="_blank" rel="noopener noreferrer">GitHub Pages</a>; as with any web request, your IP address is technically visible to GitHub's infrastructure for the duration of the request, subject to the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub Privacy Statement</a>.</p>
      <p>To see how many people visit the site, and which page/link they arrived from, it uses <a href="https://www.goatcounter.com/" target="_blank" rel="noopener noreferrer">GoatCounter</a>, a cookie-free visitor counter. It collects the page viewed, the referring site/link, browser/OS type, and a rough country derived from your IP address; it does not permanently store the IP address and does not build a profile that singles you out from other visitors. Results are shown only as aggregate/statistical counts (daily, weekly, monthly, all-time). See <a href="https://www.goatcounter.com/privacy" target="_blank" rel="noopener noreferrer">GoatCounter's privacy policy</a> for details. Under Turkish law (KVKK, Law No. 6698 on the Protection of Personal Data), this means no data tied to an identified or identifiable person is processed.</p>
      <p>Anime cover images are loaded from <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>, and episode players are embedded from their respective video-hosting sites; these third-party services are subject to their own privacy policies and cookies, which are outside this site's control.</p>
      <p>For the "Watch ad-free" option on Sibnet and Uqload episodes, the site calls a small helper function hosted on <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a> (for Sibnet, <code>tka-sibnet.vercel.app</code>) or <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer">Cloudflare</a> Workers (for Uqload, <code>tka-uqload.turkanime-arsiv.workers.dev</code>). This function receives only the provider's video ID, resolves the direct video address and returns it; it keeps no database, sets no cookies, and does not store the request. As with any web request, your IP address is technically visible to that provider's infrastructure for the duration of the request and may appear in its short-lived operational logs, subject to <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel's</a> or <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare's</a> privacy policy. The video itself is then streamed directly from that provider's own servers to your browser, exactly as with the classic embedded player. For Uqload, which delivers video as HLS (a segmented streaming format), the browser also loads a small open-source player library (hls.js) from a public CDN (jsDelivr) to play it.</p>

      <h3>Copyright</h3>
      <p>This site hosts no video files of its own. It is only a directory/archive collecting links, found in the archive of the now-closed turkanime.tv, to public third-party video services (GDrive, various embed providers, etc.). All copyrights to the video content and translations belong to their respective rights holders (production studio, distributor, fansub groups).</p>

      <h3>Takedown Requests</h3>
      <p>If you are a rights holder and want something removed, please
        <a href="https://github.com/Berke-aras/turkanime-arsiv/issues/new" target="_blank" rel="noopener noreferrer">open an issue on GitHub</a>
        with the relevant anime/episode/link details; the request will be reviewed and removed as soon as possible.</p>`;
  const tr = `
      <div class="legal-lang">TR</div>
      <h2>Gizlilik &amp; Yasal Bilgilendirme</h2>

      <h3>KVKK / Gizlilik</h3>
      <p>Bu site statik çalışır: herhangi bir kullanıcı hesabı, form ya da sunucu tarafı veri kaydı yoktur (tek istisna aşağıda anlatılan reklamsız oynatma yardımcısıdır). Favori animeler ve "son bakılanlar" listesi yalnızca kendi cihazındaki tarayıcı belleğinde (localStorage) tutulur, hiçbir yere gönderilmez; tarayıcı verilerini temizlediğinde silinir. Site kendi adına çerez kullanmaz. Site <a href="https://pages.github.com/" target="_blank" rel="noopener noreferrer">GitHub Pages</a> üzerinde barındırılır; her web isteğinde olduğu gibi IP adresin istek süresince GitHub altyapısı tarafından teknik olarak görülür, bu <a href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub Gizlilik Bildirimi</a> kapsamındadır.</p>
      <p>Kaç kişinin siteyi, hangi sayfadan/bağlantıdan girip hangi bölümlere baktığını görebilmek için <a href="https://www.goatcounter.com/" target="_blank" rel="noopener noreferrer">GoatCounter</a> adlı, çerez kullanmayan bir ziyaretçi sayacı kullanılır. Bu sayaç görüntülenen sayfa, yönlendiren site/bağlantı, tarayıcı-işletim sistemi türü ve IP adresinden türetilen kabaca ülke bilgisini toplar; IP adresini kalıcı saklamaz ve seni diğer ziyaretçilerden ayırt edip profil çıkaracak bir kimlik kullanmaz. Sonuçlar yalnızca toplu/istatistiksel sayılar (günlük, haftalık, aylık, tüm zamanlar) olarak görüntülenir. Ayrıntı için <a href="https://www.goatcounter.com/privacy" target="_blank" rel="noopener noreferrer">GoatCounter'ın gizlilik politikası</a>na bakabilirsin. Bu nedenlerle 6698 sayılı KVKK kapsamında kimliği belirli veya belirlenebilir bir kişiyle ilişkilendirilen veri işlenmemektedir.</p>
      <p>Anime kapak görselleri <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>'ten, bölüm oynatıcıları ise ilgili video barındırma sitelerinden (embed) yüklenir; bu üçüncü taraf servisler kendi gizlilik politikalarına ve çerezlerine tabidir, bu sitenin sorumluluğunda değildir.</p>
      <p>Sibnet ve Uqload bölümlerindeki "Reklamsız izle" seçeneği için site, <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a> üzerinde (Sibnet için, <code>tka-sibnet.vercel.app</code>) ya da <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer">Cloudflare</a> Workers üzerinde (Uqload için, <code>tka-uqload.turkanime-arsiv.workers.dev</code>) barındırılan küçük bir yardımcı fonksiyona istek atar. Bu fonksiyon yalnızca ilgili sağlayıcının video numarasını alır, videonun doğrudan adresini çözüp geri döndürür; veritabanı tutmaz, çerez kullanmaz, isteği kaydetmez. Her web isteğinde olduğu gibi IP adresin istek süresince ilgili altyapı tarafından teknik olarak görülür ve <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel'in</a> ya da <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare'in</a> gizlilik politikası kapsamında kısa süreli işletim kayıtlarında yer alabilir. Videonun kendisi ise klasik gömülü oynatıcıda olduğu gibi doğrudan ilgili sağlayıcının sunucularından tarayıcına akar. HLS formatıyla video veren Uqload için tarayıcı ayrıca halka açık bir CDN'den (jsDelivr) küçük bir açık kaynak oynatıcı kütüphanesi (hls.js) yükler.</p>

      <h3>Telif Hakkı</h3>
      <p>Bu site hiçbir video dosyasını kendi sunucusunda barındırmaz. Yalnızca, artık kapanmış olan turkanime.tv'nin arşivinde bulunan ve halka açık üçüncü taraf video servislerine (GDrive, çeşitli embed sağlayıcıları vb.) ait bağlantıları bir araya getiren bir dizin/arşivdir. Tüm video içeriklerinin ve çevirilerin telif hakları ilgili hak sahiplerine (yapımcı stüdyo, dağıtımcı, fansub grupları) aittir.</p>

      <h3>Kaldırma Talebi</h3>
      <p>Bir içeriğin veya bağlantının hak sahibiysen ve kaldırılmasını istiyorsan, lütfen
        <a href="https://github.com/Berke-aras/turkanime-arsiv/issues/new" target="_blank" rel="noopener noreferrer">GitHub üzerinden bir issue açarak</a>
        ilgili anime/bölüm/link bilgisini ilet; talep incelenip en kısa sürede kaldırılır.</p>`;
  // tarayıcı dili Türkçe değilse İngilizce bölüm üstte gelir
  app.innerHTML = `
    <a class="back" href="#/">${ic('arrow-left')}${IS_TR ? 'Listeye dön' : 'Back to list'}</a>
    <div class="legal">
      ${IS_TR ? tr : en}

      <hr class="legal-sep">
      ${IS_TR ? en : tr}
    </div>`;
  fadeApp();
}


export { renderLegal };
