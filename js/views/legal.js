// Yasal ve gizlilik metni (#/yasal). İki dilde; tarayıcı dili Türkçe değilse İngilizce öne alınır.
import { ic, IS_TR } from '../util.js';
import { app, fadeApp } from '../dom.js';
import { indir, yukle } from '../yedek.js';
import { yetiskinOnayli, yetiskinOnayGeriAl } from '../store.js';

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
        with the relevant anime/episode/link details; the request will be reviewed and removed as soon as possible.
        This is also the contact channel for any request about this site, including data-protection questions.</p>

      <h3>Adult Content &amp; Age Limit</h3>
      <p>The archive includes titles categorized as <strong>Ecchi, Hentai or Erotica</strong>, which may contain sexual
        content or nudity. Such titles carry an <strong>18+</strong> badge on their cover, and their detail page is shown
        only after you confirm that you are over 18. This confirmation is a declaration, not age verification: there is no
        server, no account and no identity check. Your answer is stored only in this browser (<code>ta_18</code>) and you
        can withdraw it from the "Your data" box above. The site is not intended for children under 13.</p>

      <h3>Data Stored in Your Browser</h3>
      <p>Nothing on this site is stored on a server. The following keys are kept in your browser's localStorage and are
        never transmitted: favorites (<code>ta_favs</code>), recently viewed (<code>ta_recent</code>), playback position
        and watched-episode marks (<code>ta_progress</code>), adult-content confirmation (<code>ta_18</code>) and
        interface preferences (theme, volume, playback speed, episode list layout). You can export them to a JSON file
        and restore them on another device from the box above; clearing your browser data deletes them permanently.</p>

      <h3>Disclaimer</h3>
      <p>This archive is provided "as is", with no warranty of any kind. Links point to third-party sites whose content,
        advertising, tracking and security are entirely outside this project's control; open them at your own discretion.
        A large share of the archived links no longer work — the archive documents what existed, it does not guarantee
        that it still does. This project is not affiliated with turkanime.tv, with AniList, or with any rights holder,
        studio or fansub group; names and cover images are used only to identify the works.</p>`;
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
        ilgili anime/bölüm/link bilgisini ilet; talep incelenip en kısa sürede kaldırılır.
        Bu kanal aynı zamanda siteyle ilgili her talep için geçerlidir: KVKK kapsamındaki
        başvurular da (6698 sayılı Kanun md. 11) buradan iletilebilir. Sitede kimliği belirli
        bir kişiye ait veri işlenmediği için pratikte silinecek bir kayıt bulunmuyor;
        yine de her başvuru yanıtlanır.</p>

      <h3>Yetişkin İçerik ve Yaş Sınırı</h3>
      <p>Arşivde <strong>Ecchi, Hentai ve Erotica</strong> türünde, cinsel içerik ya da çıplaklık
        barındırabilen başlıklar var. Bu başlıkların kapağında <strong>18+</strong> rozeti çıkar ve
        detay sayfası, 18 yaşından büyük olduğunu onaylamadan açılmaz. Bu bir <em>beyandır</em>,
        yaş doğrulaması değildir: sunucu, hesap ya da kimlik kontrolü yok. Verdiğin cevap yalnız bu
        tarayıcıda (<code>ta_18</code>) saklanır, hiçbir yere gönderilmez; yukarıdaki
        "Verilerini yedekle" kutusundan geri alabilirsin. Site 13 yaşından küçükler için
        tasarlanmamıştır; ebeveynlerin çocuklarının erişimini kendi cihaz ayarlarıyla
        sınırlaması önerilir.</p>

      <h3>Tarayıcında Saklanan Veriler</h3>
      <p>Bu sitede sunucuda tutulan hiçbir veri yok. Tarayıcının localStorage alanında tutulan ve
        hiçbir yere gönderilmeyen anahtarlar: favoriler (<code>ta_favs</code>), son bakılanlar
        (<code>ta_recent</code>), kaldığın bölüm ve izleme işaretleri (<code>ta_progress</code>),
        yetişkin içerik onayı (<code>ta_18</code>) ve arayüz tercihleri (tema, ses, oynatma hızı,
        bölüm listesi görünümü). Bunları yukarıdaki kutudan JSON olarak indirip başka bir cihazda
        geri yükleyebilirsin; tarayıcı verisini temizlediğinde kalıcı olarak silinirler.</p>

      <h3>Sorumluluk Reddi</h3>
      <p>Bu arşiv "olduğu gibi" sunulur, hiçbir garanti verilmez. Bağlantılar üçüncü taraf sitelere
        gider; oradaki içerik, reklamlar, takip kodları ve güvenlik tamamen bu projenin denetimi
        dışındadır — açıp açmamak senin tercihin. Arşivdeki linklerin önemli bir bölümü artık
        çalışmıyor; arşiv <em>neyin var olduğunu</em> belgeler, hâlâ çalıştığını garanti etmez.
        Bu proje turkanime.tv ile, AniList ile ya da herhangi bir hak sahibi, stüdyo veya fansub
        grubuyla bağlantılı değildir; isimler ve kapak görselleri yalnız eserleri tanıtmak için
        kullanılır. Site ticari amaç gütmez, reklam göstermez, gelir elde etmez.</p>

      <h3>Barındırma ve 5651 Sayılı Kanun</h3>
      <p>Site statik dosyalardan oluşur ve GitHub Pages üzerinde yayınlanır; kullanıcı içeriği
        yüklenemez, yorum yazılamaz, hiçbir video dosyası burada barındırılmaz. Gösterilen her
        bağlantı, kapanmadan önce turkanime.tv arşivinde bulunan üçüncü taraf adreslerine aittir.
        Hak sahiplerinin talepleri yukarıdaki kanaldan iletildiğinde ilgili kayıtlar arşivden
        çıkarılır.</p>`;
  // §7.3: veri tamamen tarayıcıda durduğu için tarayıcı verisi temizlenince gidiyor.
  // Yedek alma/geri yükleme bu sayfada duruyor, çünkü metnin kendisi "veri sende kalıyor" diyor.
  const yedek = IS_TR ? `
      <h3>Verilerini yedekle</h3>
      <p>Favorilerin, son bakılanların ve kaldığın bölümler yalnızca bu tarayıcıda duruyor;
        tarayıcı verisini temizlediğinde ya da başka bir cihaza geçtiğinde kaybolurlar.
        Aşağıdan tek dosyaya indirip başka bir cihazda geri yükleyebilirsin. Geri yükleme
        <strong>üzerine yazmaz, birleştirir</strong>: mevcut favorilerin ve izleme işaretlerin silinmez.</p>`
    : `
      <h3>Back up your data</h3>
      <p>Your favorites, recently viewed list and playback positions live only in this browser;
        clearing browser data or switching devices loses them. Download them as a single file here
        and restore it on another device. Restoring <strong>merges</strong> rather than overwrites —
        nothing you already have is deleted.</p>`;

  // tarayıcı dili Türkçe değilse İngilizce bölüm üstte gelir
  app.innerHTML = `
    <a class="back" href="#/">${ic('arrow-left')}${IS_TR ? 'Listeye dön' : 'Back to list'}</a>
    <div class="legal">
      ${IS_TR ? tr : en}

      <div class="veri-kutu">
        ${yedek}
        <div class="veri-btnlar">
          <button type="button" id="veri-indir" class="link-btn">${ic('download')}${IS_TR ? 'JSON indir' : 'Download JSON'}</button>
          <button type="button" id="veri-yukle-btn" class="link-btn">${ic('upload')}${IS_TR ? 'JSON yükle' : 'Restore JSON'}</button>
          <input type="file" id="veri-dosya" accept="application/json,.json" hidden>
          <button type="button" id="yas-geri-al" class="link-btn"${yetiskinOnayli() ? '' : ' hidden'}>${ic('shield')}${IS_TR ? '18+ onayını geri al' : 'Withdraw 18+ confirmation'}</button>
        </div>
        <p id="veri-durum" class="veri-durum" role="status" aria-live="polite"></p>
      </div>

      <hr class="legal-sep">
      ${IS_TR ? en : tr}

      <p class="legal-tarih">${IS_TR ? 'Son güncelleme' : 'Last updated'}: 22.09.2026</p>
    </div>`;
  fadeApp();
  wireYedek();
}

function wireYedek() {
  const durum = document.getElementById('veri-durum');
  const dosya = document.getElementById('veri-dosya');
  const yaz = (metin, hata = false) => {
    durum.textContent = metin;
    durum.classList.toggle('veri-hata', hata);
  };
  document.getElementById('veri-indir').addEventListener('click', () => {
    indir();
    yaz(IS_TR ? 'Yedek dosyası indirildi.' : 'Backup file downloaded.');
  });
  document.getElementById('veri-yukle-btn').addEventListener('click', () => dosya.click());
  // §6.8: yetişkin içerik onayı da bu kutudan geri alınabiliyor (yaş kapısı tekrar sorar).
  const geriAl = document.getElementById('yas-geri-al');
  geriAl.addEventListener('click', () => {
    yetiskinOnayGeriAl();
    geriAl.hidden = true;
    yaz(IS_TR ? '18+ onayı geri alındı; yetişkin başlıklarda tekrar sorulacak.' : '18+ confirmation withdrawn; adult titles will ask again.');
  });
  dosya.addEventListener('change', async () => {
    const f = dosya.files && dosya.files[0];
    if (!f) return;
    try {
      const ozet = await yukle(f);
      yaz(IS_TR
        ? `Geri yüklendi: ${ozet.favori} yeni favori, ${ozet.gecmis} yeni geçmiş kaydı, ${ozet.ilerleme} izleme kaydı. Sayfa yenileniyor…`
        : `Restored: ${ozet.favori} new favorites, ${ozet.gecmis} history entries, ${ozet.ilerleme} playback records. Reloading…`);
      // Favori kümesi, geçmiş ve ilerleme kayıtları modül seviyesinde tutuluyor; en temizi tazelemek.
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      yaz(String((e && e.message) || e), true);
    } finally {
      dosya.value = '';
    }
  });
}


export { renderLegal };
