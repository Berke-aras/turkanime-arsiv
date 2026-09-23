// Oynatıcıdaki bilgi paneli (Amazon'un X-Ray'i gibi): karakterler ve Japon seslendirmenleri, bölümün
// opening/ending şarkıları ve çeviren fansub. Reklamsız <video> oynatımında ayrıca zamana bağlı iki
// özellik var: opening/ending sırasında "♪ Şu an çalıyor" etiketi ve "Opening'i geç" düğmesi.
// iframe embed'de videonun o anki saniyesi okunamadığı için orada yalnız panel var.
//
// Veri iki yerden geliyor:
//  - kaynak/x/<slug>.json: AniList + AnimeThemes, derleme anında toplanmış (scripts/build-xray.js)
//  - AniSkip API: OP/ED'nin bölümdeki saniye aralıkları; bölüm açılınca tarayıcıdan soruluyor
import { esc } from './util.js';
import { animeBul, veriYukle, avatar, seslendirmenHref, sarkiKartHtml as temaSatiri, EKOLAYZIR, SPOTIFY_IKON } from './xray-yukle.js';
import { playerVideo, playerViewport, playerFrame, playerLoading } from './player-dom.js';
import { spotifyLink, KARAKTER_ONEK, KISI_ONEK, bolumTemasi, atlamaAraliklari, aralikBul } from './xray-veri.js';

const panel = document.getElementById('player-xray');
const panelBtn = document.getElementById('player-modal-xray');
const muzikEl = document.getElementById('player-xray-muzik');
const gecBtn = document.getElementById('player-xray-gec');

const ANISKIP = 'https://api.aniskip.com/v2/skip-times/';
const TIP_AD = { op: 'Opening', ed: 'Ending' };
// Veride fansub adı bilinmeyen linkler "Varsayılan" olarak duruyor; "Çeviri: Varsayılan" yazmak anlamsız.
const BILINMEYEN_FANSUB = new Set(['Varsayılan', 'Bilinmeyen']);

// Açık bölümün durumu. token, bölüm değişince uçuştaki isteklerin eski bölüme yazmasını engelliyor.
let token = 0;
let durum = null; // { slug, no, fansub, veri, yuklendi, araliklar, temalar: { op, ed } }
let elleAcildi = false;

function panelCiz() {
  if (!durum) { panel.innerHTML = ''; return; }
  const { veri, fansub, no, temalar } = durum;
  const a = animeBul(durum.slug);
  const parca = [];

  parca.push(`<div class="xray-bas">
    <div><p class="xray-ust">Bu bölümde</p><h2 class="xray-baslik">${esc(a ? a.baslik : durum.slug)}</h2>
    <p class="meta">${no ? `${no}. bölüm` : ''}${no && fansub ? ' · ' : ''}${fansub ? `Çeviri: <b>${esc(fansub)}</b>` : ''}</p></div>
    <button type="button" class="xray-kapat" aria-label="Bilgi panelini kapat"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>
  </div>`);

  if (veri && veri.m && veri.m.length) {
    const bolumdeki = [temalar.op && temaSatiri(temalar.op, 'Opening'), temalar.ed && temaSatiri(temalar.ed, 'Ending')].filter(Boolean);
    const liste = bolumdeki.length
      ? bolumdeki
      // hangi bölümde hangisinin çaldığı bilinmiyorsa serinin bütün şarkıları listeleniyor
      : veri.m.map(t => temaSatiri(t, `${t[0]}${t[1] ? ' ' + t[1] : ''}`));
    parca.push(`<section><h3 class="xray-h">${bolumdeki.length ? 'Müzik' : 'Serinin şarkıları'}</h3><ul class="xray-sarkilar">${liste.join('')}</ul></section>`);
  }

  if (veri && veri.k && veri.k.length) {
    const kisiler = veri.k.map(([ad, gorsel, rol, va, vaGorsel]) => `<li class="xray-kisi">
      ${avatar(ad, gorsel, KARAKTER_ONEK, 'xray-foto')}
      <div class="xray-kisi-ad"><b>${esc(ad)}</b><span class="meta">${rol === 'A' ? 'Ana karakter' : 'Yan karakter'}</span></div>
      ${va ? `<a class="xray-kisi-va" href="${esc(seslendirmenHref(va))}" title="${esc(va)} — arşivdeki diğer rolleri"><span>${esc(va)}</span><span class="meta">Seslendirmen ›</span></a>${avatar(va, vaGorsel, KISI_ONEK, 'xray-foto xray-foto-va')}` : ''}
    </li>`).join('');
    parca.push(`<section><h3 class="xray-h">Karakterler ve seslendirmenler</h3><ul class="xray-kisiler">${kisiler}</ul></section>`);
  } else {
    parca.push(`<p class="meta xray-yok">${durum.yuklendi || !durum.slug ? 'Bu anime için karakter bilgisi bulunamadı.' : 'Yükleniyor…'}</p>`);
  }

  const kaynaklar = ['<a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>'];
  if (veri && veri.m) kaynaklar.push('<a href="https://animethemes.moe" target="_blank" rel="noopener noreferrer">AnimeThemes</a>');
  if (durum.araliklar.length) kaynaklar.push('<a href="https://aniskip.com" target="_blank" rel="noopener noreferrer">AniSkip</a>');
  parca.push(`<p class="xray-kaynak meta">Kaynak: ${kaynaklar.join(' · ')}</p>`);
  panel.innerHTML = parca.join('');
}
panel.addEventListener('click', e => { if (e.target.closest('.xray-kapat')) panelGoster(false); });

function panelGoster(acik) {
  tanitimTemizle();
  panel.hidden = !acik;
  panelBtn.setAttribute('aria-pressed', String(acik));
  if (!acik) elleAcildi = false;
}
// Oynarken elle açılan panel oynatma sürdükçe açık kalıyor; duraklatıp açılan ise (kendiliğinden
// ya da elle) oynatınca kapanıyor.
function panelDegistir() {
  // Tanıtım sırasında düğmeye basmak paneli kapatmıyor, sabitliyor.
  const ac = panel.hidden || tanitimda;
  panelGoster(ac);
  if (ac) elleAcildi = !playerVideo.hidden && !playerVideo.paused;
}
panelBtn.addEventListener('click', panelDegistir);

// --- tanıtım: bölüm açılınca panel kısa süre kendiliğinden görünüyor ---
// Video yüklenirken ve oynatma başladıktan sonra TANITIM_MS boyunca yarı saydam duruyor, sonra
// süzülerek kayboluyor. Bu sırada tıklamaları geçiriyor (videoya dokunmak engellenmesin); Bilgi
// düğmesi ya da I paneli sabitliyor. Yükleme hiç bitmezse TANITIM_EN_UZUN sonra yine kapanıyor.
const TANITIM_MS = 5000, TANITIM_EN_UZUN = 20000, CIKIS_MS = 350;
let tanitimda = false, tanitimTimer = 0, tanitimSayac = 0, cikisTimer = 0;
function tanitimTemizle() {
  tanitimda = false;
  clearTimeout(tanitimTimer); clearTimeout(tanitimSayac); clearTimeout(cikisTimer);
  tanitimTimer = tanitimSayac = cikisTimer = 0;
  panel.classList.remove('tanitim', 'cikiyor');
}
function tanitimBitir() {
  if (!tanitimda) return;
  panel.classList.add('cikiyor');
  cikisTimer = setTimeout(() => { if (tanitimda) { tanitimTemizle(); panel.hidden = true; } }, CIKIS_MS);
}
// Geri sayım içerik gerçekten başladığında (video oynuyor ya da embed yüklendi) başlıyor, bir kez.
function tanitimSaymayaBasla() {
  if (!tanitimda || tanitimSayac) return;
  clearTimeout(tanitimTimer);
  tanitimSayac = setTimeout(tanitimBitir, TANITIM_MS);
}
function tanitimBaslat() {
  const veri = durum && durum.veri;
  if (!veri || !((veri.k && veri.k.length) || (veri.m && veri.m.length)) || !panel.hidden) return;
  tanitimTemizle();
  tanitimda = true;
  panel.classList.add('tanitim');
  panel.hidden = false;
  panelBtn.setAttribute('aria-pressed', 'false');
  tanitimTimer = setTimeout(tanitimBitir, TANITIM_EN_UZUN);
  // Veri, içerik başladıktan sonra geldiyse sayım hemen başlıyor.
  if (playerLoading.hidden) tanitimSaymayaBasla();
}
playerVideo.addEventListener('playing', tanitimSaymayaBasla);
playerFrame.addEventListener('load', () => { if (!playerFrame.hidden) tanitimSaymayaBasla(); });

// --- açılış / kapanış (player.js çağırıyor) ---
async function xrayBolum({ slug, ep, fansub }) {
  const t = ++token;
  zamanliSifirla();
  panelGoster(false);
  durum = { slug, no: ep && ep.no > 0 ? ep.no : 0, fansub: BILINMEYEN_FANSUB.has(fansub) ? '' : fansub || '', veri: null, yuklendi: false, araliklar: [], temalar: { op: null, ed: null } };
  panelCiz();
  if (!slug) return;
  const veri = await veriYukle(slug);
  if (t !== token) return;
  durum.veri = veri;
  durum.yuklendi = true;
  if (veri && veri.m) {
    durum.temalar = { op: bolumTemasi(veri.m, 'OP', durum.no), ed: bolumTemasi(veri.m, 'ED', durum.no) };
  }
  panelCiz();
  tanitimBaslat();
  // metadata veriden önce geldiyse AniSkip isteği burada atılıyor
  if (!playerVideo.hidden && playerVideo.duration) atlamaSor();
}
function xrayKapat() {
  token++;
  durum = null;
  zamanliSifirla();
  panelGoster(false);
}

// --- zamana bağlı kısım: yalnız reklamsız <video> ---
const atlamaCache = new Map();
async function atlamaSor() {
  if (!durum || !durum.veri || !durum.veri.mal || !durum.no) return;
  const t = token;
  const uzunluk = Math.round(playerVideo.duration) || 0;
  const anahtar = `${durum.veri.mal}/${durum.no}/${uzunluk}`;
  if (!atlamaCache.has(anahtar)) {
    // episodeLength verilince AniSkip süresi tutmayan (farklı kesim/encode) kayıtları eliyor.
    atlamaCache.set(anahtar, fetch(`${ANISKIP}${durum.veri.mal}/${durum.no}?types[]=op&types[]=ed&episodeLength=${uzunluk}`)
      .then(r => r.ok ? r.json() : null)
      .then(atlamaAraliklari)
      .catch(() => { atlamaCache.delete(anahtar); return []; }));
  }
  const araliklar = await atlamaCache.get(anahtar);
  if (t !== token || !durum) return;
  durum.araliklar = araliklar;
  if (!panel.hidden) panelCiz();
  zamanGuncelle();
}

let aktif = null;          // içinde bulunulan aralık
// "Şu an çalıyor" etiketi aralığa girince sağ üste kayarak geliyor, ETIKET_MS görünüp çıkıyor.
const ETIKET_MS = 4000;
let etiketTimer = 0, etiketCikis = 0;
function etiketGizle(animasyonlu) {
  clearTimeout(etiketTimer); clearTimeout(etiketCikis);
  if (!animasyonlu || muzikEl.hidden) { muzikEl.hidden = true; muzikEl.classList.remove('cikiyor'); return; }
  muzikEl.classList.add('cikiyor');
  etiketCikis = setTimeout(() => { muzikEl.hidden = true; muzikEl.classList.remove('cikiyor'); }, CIKIS_MS);
}
function zamanliSifirla() {
  aktif = null;
  etiketGizle(false);
  gecBtn.hidden = true;
}
function zamanGuncelle() {
  if (!durum || playerVideo.hidden || !durum.araliklar.length) { if (aktif) zamanliSifirla(); return; }
  const a = aralikBul(durum.araliklar, playerVideo.currentTime);
  // Son 2 saniyede "geç" düğmesi anlamsız; aralık bitmek üzere.
  const gecilebilir = a && playerVideo.currentTime < a.son - 2;
  gecBtn.hidden = !gecilebilir;
  if (a === aktif) return;
  aktif = a;
  if (!a) { etiketGizle(true); return; }
  gecBtn.textContent = `${TIP_AD[a.tip]}'i geç`;
  gecBtn.dataset.son = String(a.son);
  const tema = durum.temalar[a.tip];
  if (tema) {
    const sp = spotifyLink(tema);
    muzikEl.innerHTML = `${EKOLAYZIR}<span class="xray-muzik-metin"><span class="xray-muzik-ust">Şu an çalıyor · ${TIP_AD[a.tip]}</span>`
      + `<b>${esc(tema[2] || 'Bilinmeyen şarkı')}</b>${tema[3] ? `<span class="meta"> — ${esc(tema[3])}</span>` : ''}</span>`
      + `<a class="xray-muzik-spotify xray-spotify-link" href="${esc(sp.url)}" target="_blank" rel="noopener noreferrer"`
      + ` aria-label="Spotify'da ${sp.parca ? 'dinle' : 'ara'}" title="Spotify'da ${sp.parca ? 'dinle' : 'ara'}">${SPOTIFY_IKON}</a>`;
    muzikEl.classList.toggle('durdu', playerVideo.paused);
    etiketGizle(false);
    muzikEl.hidden = false; // giriş animasyonu (CSS) her görünüşte yeniden oynuyor
    etiketTimer = setTimeout(() => etiketGizle(true), ETIKET_MS);
  } else {
    etiketGizle(false);
  }
}
// Spotify'a gidilince bölüm arkada çalmaya devam etmesin.
for (const el of [panel, muzikEl]) {
  el.addEventListener('click', e => { if (e.target.closest('.xray-spotify-link') && !playerVideo.hidden) playerVideo.pause(); });
}
// Etiketteki ekolayzır video durunca duruyor.
playerVideo.addEventListener('play', () => muzikEl.classList.remove('durdu'));
playerVideo.addEventListener('pause', () => muzikEl.classList.add('durdu'));

gecBtn.addEventListener('click', () => {
  const son = Number(gecBtn.dataset.son);
  if (isFinite(son)) playerVideo.currentTime = Math.min(son, playerVideo.duration || son);
  gecBtn.hidden = true;
});

playerVideo.addEventListener('loadedmetadata', () => { if (durum && durum.veri) atlamaSor(); });
playerVideo.addEventListener('timeupdate', zamanGuncelle);
playerVideo.addEventListener('seeked', zamanGuncelle);

// Amazon'daki gibi: duraklatınca panel kendiliğinden açılıyor, oynatınca kapanıyor. Kısa bir
// bekleme var ki hızlı duraklat/oynat ya da bölüm değişirken yapılan pause() paneli titretmesin.
let durakTimer = 0;
playerVideo.addEventListener('pause', () => {
  clearTimeout(durakTimer);
  durakTimer = setTimeout(() => {
    if (!durum || playerVideo.hidden || !playerVideo.paused || playerVideo.ended || !playerVideo.currentTime) return;
    if (playerViewport.closest('[hidden]')) return;
    panelGoster(true);
  }, 700);
});
playerVideo.addEventListener('play', () => {
  clearTimeout(durakTimer);
  if (!elleAcildi && !tanitimda) panelGoster(false);
});

// Esc için: tanıtım hâli "açık panel" sayılmıyor. Sayılsaydı ilk 5 sn'de Esc oynatıcıyı değil
// yalnız tanıtımı kapatıyor, video arkada çalmaya devam ediyordu.
const panelAcik = () => !panel.hidden && !tanitimda;

export { xrayBolum, xrayKapat, panelDegistir, panelGoster, panelAcik };
