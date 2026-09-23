// Seslendirmen sayfası (#/seslendirmen/<ad>): arşivde seslendirdiği bütün animeler ve karakterleri.
// Oynatıcıdaki bilgi panelinden ve detay sayfasındaki karakter şeridinden açılıyor.
import { esc, ic } from '../util.js';
import { app, fadeApp } from '../dom.js';
import { cardHtml, wireCards } from '../cards.js';
import { KISI_ONEK } from '../xray-veri.js';
import { animeBul, seslendirmenYukle, avatar } from '../xray-yukle.js';
import { getRouteToken } from '../router.js';

const ROL_AD = { A: 'Ana karakter', Y: 'Yan karakter', F: 'Figüran' };

async function renderSeslendirmen(ad, token) {
  document.title = `${ad} · Seslendirmen · TürkAnime Arşivi`;
  app.innerHTML = `<a class="back" href="#/">${ic('arrow-left')}Listeye dön</a>
    <div class="sv-bas"><div class="skel sv-foto"></div><div class="skel-lines"><div class="skel skel-line w60"></div></div></div>`;
  const d = await seslendirmenYukle(ad);
  if (token !== getRouteToken()) return;

  // Aynı animenin birden çok kaydı (aynı karakteri iki slug'da) ayrı kart; önce ana roller, sonra yeni yıllar.
  const roller = (d ? d.r : [])
    .map(([slug, karakter, rol]) => ({ a: animeBul(slug), karakter, rol }))
    .filter(x => x.a)
    .sort((x, y) => (x.rol === 'A' ? 0 : 1) - (y.rol === 'A' ? 0 : 1) || (y.a.yil || 0) - (x.a.yil || 0));

  app.innerHTML = `
    <a class="back" href="#/" data-geri>${ic('arrow-left')}Geri</a>
    <div class="sv-bas">
      ${avatar(ad, d && d.g, KISI_ONEK, 'sv-foto')}
      <div>
        <p class="xray-ust">Seslendirmen</p>
        <h2 class="sv-ad">${esc(ad)}</h2>
        <p class="meta">${roller.length ? `Arşivde ${roller.length} animede seslendirdi · ${roller.filter(x => x.rol === 'A').length} ana karakter` : 'Arşivde bu seslendirmene ait kayıt bulunamadı.'}</p>
      </div>
    </div>
    ${roller.length ? `<div class="grid sv-grid">${roller.map(x => `
      <div class="sv-rol">
        ${cardHtml(x.a)}
        <p class="sv-karakter"><b>${esc(x.karakter)}</b><span class="meta">${ROL_AD[x.rol] || ''}</span></p>
      </div>`).join('')}</div>` : ''}
    <p class="meta sv-kaynak">Kaynak: <a href="https://anilist.co/search/staff?search=${encodeURIComponent(ad)}" target="_blank" rel="noopener noreferrer">AniList</a></p>`;
  fadeApp();
  wireCards(app);
  // Geri: geldiği sayfaya (oynatıcı paneli / detay sayfası) döner; doğrudan açılan linkte listeye gider.
  app.querySelector('[data-geri]').addEventListener('click', e => {
    if (history.length <= 1) return;
    e.preventDefault();
    history.back();
  });
}

export { renderSeslendirmen };
