// "Reklamsız izle": linki resolver'dan çözüp <video> ile oynatma, HLS kurtarma ve embed'e düşme.
// Modal kabuğu ayrı (player.js); burası yalnız oynatma katmanı.
import { DIRECT_PROVIDERS, NO_EMBED_PLAYERS } from './links.js';
import { playerVideo, playerFrame, playerControls, playerLoading, playerLoadingHint,
  playerNewTab, playerNextBtn, playerProgress, playerPlayToggle, playerMuteBtn, playerVolume,
  playerTime, playerSpeedBtn, playerFullscreenBtn, fmtTime, setIcon, clearLoadHint } from './player-dom.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
let playerSpeed = 1;
function applySpeed() { playerVideo.playbackRate = playerSpeed; playerSpeedBtn.textContent = playerSpeed + 'x'; }
playerSpeedBtn.addEventListener('click', () => {
  playerSpeed = SPEEDS[(SPEEDS.indexOf(playerSpeed) + 1) % SPEEDS.length];
  applySpeed();
});
playerPlayToggle.addEventListener('click', () => { playerVideo.paused ? playerVideo.play() : playerVideo.pause(); });
playerVideo.addEventListener('click', () => { playerVideo.paused ? playerVideo.play() : playerVideo.pause(); });
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
});
playerVolume.addEventListener('input', () => { playerVideo.muted = false; playerVideo.volume = playerVolume.value; });
playerFullscreenBtn.addEventListener('click', () => { playerVideo.requestFullscreen?.(); });


let hlsInstance = null;

function stopVideo() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
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

// Sibnet yoğun anlarda geçici olarak 403 verip resolver'ın 503 dönmesine yol açıyor (bkz. api/sibnet.js).
// Bu kalıcı bir hata değil, o yüzden reklamlı embed'e düşmeden önce kısa aralıklarla tekrar deniyoruz.
// 404/502 gibi kalıcı hatalarda beklemeden vazgeçiyoruz.
const RESOLVE_RETRY = [900, 2000];
async function resolveDirect(provider, params, stillWanted) {
  for (let i = 0; i <= RESOLVE_RETRY.length; i++) {
    if (i) {
      await new Promise(r => setTimeout(r, RESOLVE_RETRY[i - 1]));
      if (!stillWanted()) return null;
    }
    const r = await fetch(`${provider.resolver}?${params}`);
    if (!stillWanted()) return null;
    if (r.ok) return r.json();
    if (r.status !== 503) return null;
  }
  return null;
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
    fallbackToEmbed(player, embedUrl);
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
// resolver'dan mp4/m3u8 linkini alıp <video> ile oynatır; olmazsa sessizce klasik iframe embed'e düşer.
let currentDirectPlayer = null;
async function playDirect(direct, embedUrl) {
  const token = ++directToken;
  currentDirectPlayer = direct.player;
  try {
    const provider = DIRECT_PROVIDERS[direct.player];
    const data = await resolveDirect(provider, direct.params, () => token === directToken);
    if (token !== directToken) return;
    if (!data || !data.url) throw new Error('resolve failed');
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
    playerVideo.play().catch(() => {});
    playerLoading.hidden = true; clearLoadHint();
  } catch (e) {
    if (token !== directToken) return;
    fallbackToEmbed(direct.player, embedUrl);
  }
}
// bazı sağlayıcılar (NO_EMBED_PLAYERS) iframe'de hiç açılmaz; onlar için boş bir iframe'e düşüp
// sessizce başarısız olmak yerine direkt "ayrı sayfada aç" ipucunu göster.
function fallbackToEmbed(player, embedUrl) {
  playerVideo.hidden = true; playerControls.hidden = true;
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
playerVideo.addEventListener('error', () => { if (playerVideo.hidden || !playerVideo.getAttribute('src')) return; fallbackToEmbed(currentDirectPlayer, playerNewTab.href); });

// Modal kapanınca uçuştaki çözümleme/oynatma isteklerini geçersiz kılar.
export function bumpDirectToken() { directToken++; }

export { applySpeed, stopVideo, ensureHls, playDirect, fallbackToEmbed };
