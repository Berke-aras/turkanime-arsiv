// §6.8 yaş kapısı: Ecchi/Hentai/Erotica türündeki başlıklarda içerik gösterilmeden önce
// çıkan onay ekranı. Yaş doğrulaması değil (sunucu yok, kimlik yok) — kullanıcının bilerek
// devam ettiğini beyan ettiği bir adım. Onay bu tarayıcıda saklanıyor, her sayfada sorulmuyor.
import { esc, ic } from '../util.js';
import { app, fadeApp } from '../dom.js';
import { NSFW_TURLER } from '../data.js';
import { yetiskinOnayli, yetiskinOnayla } from '../store.js';

const nsfwTurleri = meta => (meta && meta.tur ? meta.tur.filter(t => NSFW_TURLER.has(t)) : []);

// Kapı gerekiyor mu: başlık yetişkin türündeyse ve bu tarayıcıda henüz onay verilmemişse.
const yasKapisiGerekli = meta => nsfwTurleri(meta).length > 0 && !yetiskinOnayli();

// devamEt: onay verilince çağrılacak (detay sayfasını baştan çizer).
function yasKapisiCiz(meta, devamEt) {
  const turler = nsfwTurleri(meta);
  document.title = `Yetişkin içerik uyarısı · TürkAnime Arşivi`;
  app.innerHTML = `
    <div class="yas-kapi" role="alertdialog" aria-labelledby="yas-kapi-baslik" aria-describedby="yas-kapi-metin">
      <span class="nsfw-rozet">18+</span>
      <h2 id="yas-kapi-baslik">Yetişkin içerik</h2>
      <div id="yas-kapi-metin">
        <p><strong>${esc(meta.baslik)}</strong> başlığı <strong>${esc(turler.join(', '))}</strong>
        türünde; cinsel içerik ya da çıplaklık barındırabilir.</p>
        <p>Devam etmek için 18 yaşından büyük olduğunu onaylaman gerekiyor. İş yerinde ya da
        ortak kullanılan bir ekranda açmamanı öneririz.</p>
      </div>
      <div class="yas-kapi-btnlar">
        <button type="button" id="yas-onay" class="start-btn">${ic('check')}18 yaşından büyüğüm, onaylıyorum</button>
        <button type="button" id="yas-cik" class="link-btn">${ic('arrow-left')}Beni buradan çıkar</button>
      </div>
      <p class="yas-kapi-not">Onayın yalnız bu tarayıcıda saklanır, hiçbir yere gönderilmez ve
      yaş doğrulaması yapılmaz. Kararını <a href="#/yasal">Gizlilik &amp; Yasal</a> sayfasından geri alabilirsin.</p>
    </div>`;
  fadeApp();
  const onay = document.getElementById('yas-onay');
  onay.addEventListener('click', () => { yetiskinOnayla(); devamEt(); });
  document.getElementById('yas-cik').addEventListener('click', () => {
    // Geçmişte bir önceki sayfa arşiv listesiyse oraya dön; doğrudan link ile gelinmişse ana sayfa.
    if (history.length > 1) history.back(); else location.hash = '#/';
  });
  onay.focus();
}

// Onay verildikten sonra detay sayfasında kalan uyarı paneli — kapıyı geçtikten sonra da
// başlığın ne olduğu görünür kalsın.
function nsfwPanelHtml(meta) {
  const turler = nsfwTurleri(meta);
  if (!turler.length) return '';
  return `
      <div class="nsfw-uyari" role="note">
        <span class="nsfw-rozet">18+</span>
        <div>
          <strong>Yetişkin içerik</strong>
          <p>Bu başlık <strong>${esc(turler.join(', '))}</strong> türünde; cinsel içerik ya da
          çıplaklık barındırabilir. 18 yaşından küçükseniz devam etmeyin, iş yerinde açmayın.</p>
        </div>
      </div>`;
}

export { yasKapisiGerekli, yasKapisiCiz, nsfwPanelHtml };
