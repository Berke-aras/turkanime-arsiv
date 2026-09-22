// Oynatıcı modalının sabit DOM referansları ve iki küçük biçimlendirici.
// Yükleme ipucu zamanlayıcısı modal kabuğu (player.js) ile oynatma kodu (player-video.js)
// arasında paylaşıldığı için erişimcilerle burada tutuluyor.

const playerModal = document.getElementById('player-modal');
const playerFrame = document.getElementById('player-modal-frame');
const playerVideo = document.getElementById('player-modal-video');
const playerNewTab = document.getElementById('player-modal-newtab');
const playerPrevBtn = document.getElementById('player-modal-prev');
const playerNextBtn = document.getElementById('player-modal-next');
const playerEpLabel = document.getElementById('player-modal-eplabel');
const playerLoading = document.getElementById('player-modal-loading');
const playerLoadingHint = document.getElementById('player-modal-loading-hint');
// reklamsız <video> oynatımına özel custom kontrol çubuğu; iframe embed'de içeriği kontrol edemediğimiz için orada gizli.
const playerControls = document.getElementById('player-modal-controls');
const playerProgress = document.getElementById('player-modal-progress');
const playerPlayToggle = document.getElementById('player-modal-playtoggle');
const playerMuteBtn = document.getElementById('player-modal-mute');
const playerVolume = document.getElementById('player-modal-volume');
const playerTime = document.getElementById('player-modal-time');
const playerSpeedBtn = document.getElementById('player-modal-speed');
const playerFullscreenBtn = document.getElementById('player-modal-fullscreen');
const playerViewport = document.getElementById('player-modal-viewport');

const fmtTime = s => !isFinite(s) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const setIcon = (btn, id) => btn.querySelector('use').setAttribute('href', '#' + id);


// bazı sağlayıcılar sandbox içinde hiç yüklenmeyebilir; uzun sürerse "ayrı sayfada aç"ı hatırlat.
let playerLoadTimer = null;
export function startLoadHint() {
  clearTimeout(playerLoadTimer);
  playerLoadTimer = setTimeout(() => { playerLoadingHint.hidden = false; }, 8000);
}
export function clearLoadHint() { clearTimeout(playerLoadTimer); }

export { playerModal, playerFrame, playerVideo, playerViewport, playerNewTab, playerPrevBtn, playerNextBtn,
  playerEpLabel, playerLoading, playerLoadingHint, playerControls, playerProgress,
  playerPlayToggle, playerMuteBtn, playerVolume, playerTime, playerSpeedBtn, playerFullscreenBtn,
  fmtTime, setIcon };
