// "Reklamsız izle": linki resolver'dan çözüp <video> ile oynatma, HLS kurtarma ve embed'e düşme.
// Modal kabuğu ayrı (player.js); burası yalnız oynatma katmanı.
import { readLS, writeLS } from './util.js';
import { DIRECT_PROVIDERS, NO_EMBED_PLAYERS } from './links.js';
import { cozumle, cozumAnahtari, onbellektenSil } from './cozum.js';
import { playerVideo, playerFrame, playerViewport, playerControls, playerLoading, playerLoadingHint,
  playerNewTab, playerNextBtn, playerProgress, playerPlayToggle, playerMuteBtn, playerVolume,
  playerTime, playerSpeedBtn, playerFullscreenBtn, playerPipBtn, fmtTime, setIcon, clearLoadHint } from './player-dom.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
// Hız ve ses seviyesi oturumlar arası hatırlanıyor; her açılışta 1x'e ve tam sese dönmüyor.
let playerSpeed = SPEEDS.includes(readLS('ta_hiz', 1)) ? readLS('ta_hiz', 1) : 1;
function applySpeed() { playerVideo.playbackRate = playerSpeed; playerSpeedBtn.textContent = playerSpeed + 'x'; }
playerSpeedBtn.addEventListener('click', () => {
  playerSpeed = SPEEDS[(SPEEDS.indexOf(playerSpeed) + 1) % SPEEDS.length];
  writeLS('ta_hiz', playerSpeed);
  applySpeed();
});

const sesOku = () => { const v = Number(readLS('ta_ses', 1)); return v >= 0 && v <= 1 ? v : 1; };
const sessizOku = () => readLS('ta_sessiz', false) === true;
// <video> her yeni kaynakta varsayılana döndüğü için oynatmadan hemen önce uygulanıyor.
export function applySesTercihi() { playerVideo.volume = sesOku(); playerVideo.muted = sessizOku(); }
playerPlayToggle.addEventListener('click', () => { playerVideo.paused ? playerVideo.play() : playerVideo.pause(); });
const oynatDurdur = () => { playerVideo.paused ? playerVideo.play() : playerVideo.pause(); };

// --- dokunmatik: tek dokunuş oynat/duraklat, çift dokunuş ±10 sn (YouTube gibi) ---
// Fareyle tık hemen oynatıp duraklatıyor. Dokunuşta tek/çift ayrımı için tek dokunuş kısa bir süre
// bekletiliyor; ikinci dokunuş gelirse videonun o yarısına göre sarılıyor. Sarmadan hemen sonraki
// dokunuşlar da sarmaya devam ediyor (art arda +10, +20, ...).
const CIFT_DOKUNUS_MS = 280;
let isaretci = 'mouse', tekDokunusTimer = 0, sonDokunus = 0, sarmaSerisi = 0;
const sarIpucu = document.getElementById('player-sar-ipucu');
let sarToplam = 0, sarYon = 0, ipucuTimer = 0;
function dokunusSar(e) {
  const r = playerVideo.getBoundingClientRect();
  const yon = e.clientX - r.left < r.width / 2 ? -1 : 1;
  playerVideo.currentTime = Math.min(Math.max(0, playerVideo.currentTime + yon * 10), playerVideo.duration || Infinity);
  sarToplam = yon === sarYon ? sarToplam + 10 : 10;
  sarYon = yon;
  sarIpucu.textContent = `${yon < 0 ? '−' : '+'}${sarToplam} sn`;
  sarIpucu.className = `sar-ipucu ${yon < 0 ? 'sol' : 'sag'}`;
  void sarIpucu.offsetWidth; // animasyonu yeniden başlat
  sarIpucu.classList.add('goster');
  clearTimeout(ipucuTimer);
  ipucuTimer = setTimeout(() => { sarIpucu.classList.remove('goster'); sarToplam = 0; }, 700);
}
playerVideo.addEventListener('pointerdown', e => { isaretci = e.pointerType || 'mouse'; });
playerVideo.addEventListener('click', e => {
  if (isaretci !== 'touch') { oynatDurdur(); return; }
  const simdi = Date.now();
  if (simdi - sarmaSerisi < 600 || (tekDokunusTimer && simdi - sonDokunus < CIFT_DOKUNUS_MS)) {
    clearTimeout(tekDokunusTimer); tekDokunusTimer = 0;
    dokunusSar(e);
    sarmaSerisi = simdi;
    return;
  }
  sonDokunus = simdi;
  tekDokunusTimer = setTimeout(() => { tekDokunusTimer = 0; oynatDurdur(); }, CIFT_DOKUNUS_MS);
});
// Yeni kaynakta bekleyen tek dokunuş eski videoya uygulanmasın.
export function dokunusSifirla() { clearTimeout(tekDokunusTimer); tekDokunusTimer = 0; sarmaSerisi = 0; }

// --- resim içinde resim ---
// Tarayıcı desteklemiyorsa (Firefox) düğme hiç görünmüyor.
const pipDestekli = !!document.pictureInPictureEnabled && !playerVideo.disablePictureInPicture;
playerPipBtn.hidden = !pipDestekli;
playerPipBtn.addEventListener('click', () => {
  if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
  else playerVideo.requestPictureInPicture().catch(() => {});
});
export function pipKapat() { if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {}); }
playerVideo.addEventListener('play', () => setIcon(playerPlayToggle, 'i-pause'));
playerVideo.addEventListener('pause', () => setIcon(playerPlayToggle, 'i-play'));
playerVideo.addEventListener('timeupdate', () => {
  if (playerVideo.duration) playerProgress.value = (playerVideo.currentTime / playerVideo.duration) * 100;
  playerTime.textContent = `${fmtTime(playerVideo.currentTime)} / ${fmtTime(playerVideo.duration)}`;
});
playerProgress.addEventListener('input', () => { if (playerVideo.duration) playerVideo.currentTime = (playerProgress.value / 100) * playerVideo.duration; });
playerMuteBtn.addEventListener('click', () => { playerVideo.muted = !playerVideo.muted; });
playerVideo.addEventListener('volumechange', () => {
  setIcon(playerMuteBtn, playerVideo.muted || playerVideo.volume === 0 ? 'i-volume-mute' : 'i-volume');
  playerVolume.value = playerVideo.muted ? 0 : playerVideo.volume;
  writeLS('ta_ses', playerVideo.volume);
  writeLS('ta_sessiz', playerVideo.muted);
});
playerVolume.addEventListener('input', () => { playerVideo.muted = false; playerVideo.volume = playerVolume.value; });
// Tam ekrana <video> yerine viewport alınıyor: aksi hâlde özel kontrol çubuğu (video'nun kardeşi)
// tam ekranda görünmüyor ve tarayıcının kendi kontrolleri devreye giriyordu.
function tamEkranDegistir() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else (playerViewport || playerVideo).requestFullscreen?.();
}
playerFullscreenBtn.addEventListener('click', tamEkranDegistir);
document.addEventListener('fullscreenchange', () => {
  setIcon(playerFullscreenBtn, document.fullscreenElement ? 'i-minimize' : 'i-maximize');
  kontrolleriGoster();
});

// --- kontrol çubuğu otomatik gizlenmesi ---
// Video oynarken 3 sn hareketsizlikte çubuk kayboluyor; fare/dokunma/klavye onu geri getiriyor.
let gizleTimer = 0;
function kontrolleriGoster() {
  playerViewport.classList.remove('kontrol-gizli');
  clearTimeout(gizleTimer);
  if (!playerVideo.paused && !playerVideo.hidden) {
    gizleTimer = setTimeout(() => {
      // fare çubuğun üstündeyse gizleme
      if (!playerControls.matches(':hover')) playerViewport.classList.add('kontrol-gizli');
    }, 3000);
  }
}
export { kontrolleriGoster };
for (const olay of ['mousemove', 'pointerdown', 'touchstart']) playerViewport.addEventListener(olay, kontrolleriGoster, { passive: true });
playerVideo.addEventListener('pause', kontrolleriGoster);
playerVideo.addEventListener('play', kontrolleriGoster);

// --- klavye: video kontrolleri ---
// Ok tuşları artık ±10 sn sarıyor (bölüm değiştirmiyor); bölüm geçişi N/P ya da Shift+Ok.
export function videoKlavye(e) {
  if (playerVideo.hidden) return false;
  const k = e.key.toLowerCase();
  if (e.key === ' ' || k === 'k') { playerVideo.paused ? playerVideo.play() : playerVideo.pause(); return true; }
  if (e.key === 'ArrowLeft') { playerVideo.currentTime = Math.max(0, playerVideo.currentTime - 10); return true; }
  if (e.key === 'ArrowRight') { playerVideo.currentTime = Math.min(playerVideo.duration || Infinity, playerVideo.currentTime + 10); return true; }
  if (e.key === 'ArrowUp') { playerVideo.muted = false; playerVideo.volume = Math.min(1, playerVideo.volume + 0.1); return true; }
  if (e.key === 'ArrowDown') { playerVideo.volume = Math.max(0, playerVideo.volume - 0.1); return true; }
  if (k === 'm') { playerVideo.muted = !playerVideo.muted; return true; }
  if (k === 'f') { tamEkranDegistir(); return true; }
  return false;
}


let hlsInstance = null;

function stopVideo() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  oynaticiDurumuSifirla();
  dokunusSifirla();
  playerVideo.pause(); playerVideo.removeAttribute('src'); playerVideo.load();
}

// tarayıcı HLS'i native oynatamıyorsa (Safari dışında) hls.js'i ilk ihtiyaç anında CDN'den yükler.
function ensureHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
    s.onload = () => resolve(window.Hls);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// mp4 yolunda <video>'nun kendi 'error' olayı embed'e düşürüyor, ama hls.js kendi hatalarını oraya
// taşımıyor: manifest yüklendikten sonra gelen fatal hata (süresi dolmuş token, ölü segment,
// desteklenmeyen codec) yakalanmazsa oynatıcı boş ekranda asılı kalıyordu. hls.js'in önerdiği
// kurtarmayı her hata türü için bir kez deniyoruz; o da tutmazsa reklamlı embed'e düşüyoruz.
function wireHlsRecovery(Hls, hls, player, embedUrl, stillWanted) {
  const denendi = { net: false, media: false };
  let manifestGeldi = false;
  let vazgecTimer = null;
  const vazgec = () => {
    clearTimeout(vazgecTimer);
    if (!stillWanted()) return;
    hls.destroy();
    if (hlsInstance === hls) hlsInstance = null;
    fallbackToEmbed(player, embedUrl, 'video');
  };
  // Kurtarma çağrısı sessizce hiçbir şey yapmayabiliyor (ör. manifest hiç yüklenmediyse startLoad'ın
  // yeniden deneyeceği bir seviye yok), o zaman ikinci bir hata da gelmiyor ve oynatıcı asılı kalıyor.
  // Bu yüzden kurtarmadan sonra oynatma gerçekten ilerliyor mu diye bakıp ilerlemiyorsa vazgeçiyoruz.
  const kurtarmayiIzle = () => {
    clearTimeout(vazgecTimer);
    const t = playerVideo.currentTime;
    vazgecTimer = setTimeout(() => {
      if (!stillWanted()) return;
      if (playerVideo.currentTime > t + 0.1 && !playerVideo.paused) return; // toparlandı
      vazgec();
    }, 6000);
  };
  hls.on(Hls.Events.MANIFEST_PARSED, () => { manifestGeldi = true; });
  hls.on(Hls.Events.ERROR, (_e, d) => {
    if (!d || !d.fatal || !stillWanted()) return;
    // Manifest hiç gelmediyse (404, ayrıştırma hatası, desteklenmeyen codec) kurtarılacak bir şey yok.
    if (manifestGeldi && d.type === Hls.ErrorTypes.NETWORK_ERROR && !denendi.net) {
      denendi.net = true; hls.startLoad(); kurtarmayiIzle(); return;
    }
    if (manifestGeldi && d.type === Hls.ErrorTypes.MEDIA_ERROR && !denendi.media) {
      denendi.media = true; hls.recoverMediaError(); kurtarmayiIzle(); return;
    }
    vazgec();
  });
}
// --- kullanıcıya durum: "yoğun, tekrar deneniyor" ve reklamlı oynatıcıya düşme sebebi ---
const SAGLAYICI_AD = { SIBNET: 'Sibnet', UQLOAD: 'Uqload', ODNOKLASSNIKI: 'ok.ru', 'OK.RU': 'ok.ru' };
const durumEl = document.getElementById('player-modal-loading-durum');
const bildirimEl = document.getElementById('player-modal-bildirim');
let bildirimTimer = 0;
function durumYaz(metin) { durumEl.textContent = metin || ''; durumEl.hidden = !metin; }
function bildir(metin) {
  clearTimeout(bildirimTimer);
  bildirimEl.textContent = metin;
  bildirimEl.hidden = false;
  bildirimTimer = setTimeout(() => { bildirimEl.hidden = true; }, 7000);
}
function oynaticiDurumuSifirla() { durumYaz(''); clearTimeout(bildirimTimer); bildirimEl.hidden = true; }
// Neden düşüldüğü: 404 kalıcı (video silinmiş), 503/429 geçici (sağlayıcı yoğun), 0 ağ, 'video' dosya açılmadı.
function dusmeSebebi(player, hata) {
  const ad = SAGLAYICI_AD[player] || player;
  if (hata === 404) return `Reklamsız oynatılamadı: bu video ${ad}'ten kaldırılmış görünüyor. Açılmazsa başka bir link dene.`;
  if (hata === 503 || hata === 429) return `${ad} şu an yoğun, reklamsız oynatılamadı; ${ad}'in kendi oynatıcısı açıldı. Birazdan tekrar deneyebilirsin.`;
  if (hata === 'video') return `Video dosyası açılamadı; ${ad}'in kendi oynatıcısı açıldı.`;
  return `Reklamsız oynatıcıya bağlanılamadı; ${ad}'in kendi oynatıcısı açıldı.`;
}

// resolver'dan mp4/m3u8 linkini alıp <video> ile oynatır; olmazsa klasik iframe embed'e düşer ve sebebini söyler.
let currentDirectPlayer = null;
let sonDirect = null; // { direct, embedUrl, onbellekten, tazelendi } — önbellekteki link bayatsa bir kez tazelemek için
async function playDirect(direct, embedUrl, { tazele = false } = {}) {
  const token = ++directToken;
  currentDirectPlayer = direct.player;
  const ad = SAGLAYICI_AD[direct.player] || direct.player;
  try {
    const provider = DIRECT_PROVIDERS[direct.player];
    if (tazele) onbellektenSil(cozumAnahtari(direct.player, direct.params));
    const sonuc = await cozumle(provider, direct.player, direct.params, {
      istenmeye: () => token === directToken,
      bildir: (i, n) => { if (token === directToken) durumYaz(`${ad} şu an yoğun, tekrar deneniyor (${i}/${n})…`); },
    });
    if (token !== directToken) return;
    durumYaz('');
    if (!sonuc.veri) { fallbackToEmbed(direct.player, embedUrl, sonuc.hata); return; }
    const data = sonuc.veri;
    sonDirect = { direct, embedUrl, onbellekten: sonuc.onbellekten, tazelendi: tazele };
    if (data.hls && !playerVideo.canPlayType('application/vnd.apple.mpegurl')) {
      const Hls = await ensureHls();
      if (token !== directToken) return;
      if (!Hls || !Hls.isSupported()) throw new Error('hls unsupported');
      hlsInstance = new Hls();
      wireHlsRecovery(Hls, hlsInstance, direct.player, embedUrl, () => token === directToken);
      hlsInstance.loadSource(data.url);
      hlsInstance.attachMedia(playerVideo);
    } else {
      playerVideo.src = data.url;
    }
    applySpeed();
    applySesTercihi();
    playerVideo.play().catch(() => {});
    playerLoading.hidden = true; clearLoadHint();
  } catch (e) {
    if (token !== directToken) return;
    durumYaz('');
    fallbackToEmbed(direct.player, embedUrl, 'video');
  }
}
// bazı sağlayıcılar (NO_EMBED_PLAYERS) iframe'de hiç açılmaz; onlar için boş bir iframe'e düşüp
// sessizce başarısız olmak yerine direkt "ayrı sayfada aç" ipucunu göster.
function fallbackToEmbed(player, embedUrl, sebep) {
  playerVideo.hidden = true; playerControls.hidden = true;
  if (sebep !== undefined) bildir(dusmeSebebi(player, sebep));
  if (NO_EMBED_PLAYERS.has(player)) {
    playerFrame.hidden = true;
    playerLoadingHint.hidden = false;
    clearLoadHint();
  } else {
    playerFrame.hidden = false;
    playerFrame.src = embedUrl;
  }
}

let directToken = 0;
playerVideo.addEventListener('ended', () => { if (!playerNextBtn.disabled) playerNextBtn.click(); });
playerVideo.addEventListener('error', () => {
  if (playerVideo.hidden || !playerVideo.getAttribute('src')) return;
  // Önbellekten gelen link bayatlamış olabilir (imza erken düşmüş): bir kez taze çözüp tekrar dene.
  if (sonDirect && sonDirect.onbellekten && !sonDirect.tazelendi) { playDirect(sonDirect.direct, sonDirect.embedUrl, { tazele: true }); return; }
  fallbackToEmbed(currentDirectPlayer, playerNewTab.href, 'video');
});

// Modal kapanınca uçuştaki çözümleme/oynatma isteklerini geçersiz kılar.
export function bumpDirectToken() { directToken++; }

export { applySpeed, stopVideo, ensureHls, playDirect, fallbackToEmbed };
