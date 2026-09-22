// Bölüm oynatıcı modalının kabuğu: açma/kapama, bölümler arası gezinme ve bölüm link listesi.
// Asıl oynatma (resolver + HLS) player-video.js'te.
import { esc } from './util.js';
import { app } from './dom.js';
import { getEpReverse } from './store.js';
import { OLU, directParams, epLinksHtml } from './links.js';
import { playerModal, playerFrame, playerVideo, playerNewTab, playerPrevBtn, playerNextBtn,
  playerEpLabel, playerLoading, playerLoadingHint, playerControls,
  startLoadHint, clearLoadHint } from './player-dom.js';
import { playDirect, stopVideo, bumpDirectToken, videoKlavye, kontrolleriGoster } from './player-video.js';

let currentEpisodes = [];
let currentEpIndex = null;

function openPlayerModal(url, epIndex = null, direct = null) {
  clearLoadHint();
  playerLoadingHint.hidden = true;
  playerLoading.hidden = false;
  stopVideo();
  playerVideo.hidden = !direct;
  playerFrame.hidden = !!direct;
  playerControls.hidden = !direct;
  playerFrame.src = direct ? 'about:blank' : url;
  playerNewTab.href = url;
  if (direct) playDirect(direct, url);
  playerModal.hidden = false;
  currentEpIndex = epIndex;
  const ep = epIndex != null ? currentEpisodes[epIndex] : null;
  playerEpLabel.textContent = ep ? `${epIndex + 1} / ${currentEpisodes.length}` : '';
  syncEpNavButtons();
  startLoadHint();
}

playerFrame.addEventListener('load', () => { if (playerFrame.hidden) return; playerLoading.hidden = true; clearLoadHint(); });

function closePlayerModal() {
  playerModal.hidden = true;
  bumpDirectToken();
  stopVideo();
  playerFrame.src = 'about:blank';
  clearLoadHint();
}

// modalı kapatıp ilgili bölümü listede açar; hangi linke tıklanacağına kullanıcı kendi karar versin diye
// otomatik bir link seçip oynatmıyoruz.
function jumpToEpisode(i) {
  const epEl = app.querySelector(`.ep[data-i="${i}"]`);
  if (!epEl) return;
  const g = epEl.closest('.ep-group'); if (g) g.open = true;
  openEpisode(epEl);
  epEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const d = directBtnOf(epEl);
  if (d) { d.click(); return; } // reklamsız link varsa modal kapanmadan sonraki bölüme geçer
  closePlayerModal();
}

function wireEmbedButtons(container, epIndex) {
  container.querySelectorAll('[data-embed-url]').forEach(b => {
    const direct = b.dataset.directPlayer ? { player: b.dataset.directPlayer, params: b.dataset.directParams } : null;
    b.addEventListener('click', () => openPlayerModal(b.dataset.embedUrl, epIndex, direct));
  });
}

// bölümü açar; birden fazla fansub varsa önce fansub seçtirir, playerlar seçimden sonra gösterilir
// (renderDetail'deki ep-head handler'ıyla paylaşılır).
function openEpisode(epEl) {
  epEl.classList.add('open');
  const linksEl = epEl.querySelector('.ep-links');
  if (linksEl.dataset.filled) return;
  linksEl.dataset.filled = '1';
  const i = Number(epEl.dataset.i);
  const ep = currentEpisodes[i];
  const links = ep.links;

  // Ölü linkler veride tek bir sayıya indirgeniyor (bkz. scripts/trim-b.js, GELISTIRME-PLANI §3.2):
  // ekranı üstü çizili butonlarla doldurmak yerine tek satırda kaç tanesinin öldüğü yazılıyor.
  const oluNot = ep.olu
    ? `<p class="ep-olu">${ep.olu} arşiv linki artık çalışmıyor <span class="meta">(turkanime sunucusu gerekiyordu)</span></p>`
    : '';

  const groups = new Map();
  links.forEach(l => {
    const name = l.fansub || 'Bilinmeyen';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(l);
  });

  if (groups.size <= 1) {
    linksEl.innerHTML = `<div class="fansub-players">${epLinksHtml(links)}</div>${oluNot}`;
    wireEmbedButtons(linksEl, i);
    return;
  }

  const chipsHtml = [...groups.entries()].map(([name, groupLinks]) => {
    const empty = groupLinks.every(l => OLU(l.tip));
    return `<button type="button" class="fansub-chip${empty ? ' fansub-chip-empty' : ''}" data-fansub="${esc(name)}">${esc(name)}<span class="meta">${groupLinks.length}</span></button>`;
  }).join('');
  linksEl.innerHTML = `<div class="fansub-chips">${chipsHtml}</div><div class="fansub-players"></div>${oluNot}`;
  const playersEl = linksEl.querySelector('.fansub-players');
  linksEl.querySelectorAll('.fansub-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      linksEl.querySelectorAll('.fansub-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      playersEl.innerHTML = epLinksHtml(groups.get(chip.dataset.fansub));
      wireEmbedButtons(playersEl, i);
    });
  });
  // reklamsız linki olan ilk fansub otomatik seçilir ki önerilen buton hemen görünsün
  const preferred = [...groups.entries()].find(([, ls]) => ls.some(l => !OLU(l.tip) && directParams(l)));
  if (preferred) linksEl.querySelector(`.fansub-chip[data-fansub="${CSS.escape(preferred[0])}"]`).click();
}

// ileri/geri butonlarının durumunu ve "hangi bölüme gider" başlığını tazeler
function syncEpNavButtons() {
  for (const [btn, dir, ad] of [[playerPrevBtn, -1, 'Önceki'], [playerNextBtn, 1, 'Sonraki']]) {
    const i = neighborEp(dir);
    btn.disabled = !hasEp(i);
    btn.title = btn.disabled ? `${ad} bölüm yok` : `${ad}: ${currentEpisodes[i].ad}`;
  }
}

const directBtnOf = epEl => epEl.querySelector('.link-btn.direct');

document.getElementById('player-modal-close').addEventListener('click', closePlayerModal);
document.getElementById('player-modal-backdrop').addEventListener('click', closePlayerModal);
// "Önceki"/"Sonraki" ekrandaki sırayı izler: liste tersten gösteriliyorsa (epReverse) "Sonraki"
// veri dizisinde bir geriye gider, böylece buton yönü listede gördüğün yönle aynı olur.
const epStep = () => (getEpReverse() ? -1 : 1);
const neighborEp = dir => currentEpIndex == null ? -1 : currentEpIndex + dir * epStep();
const hasEp = i => i >= 0 && i < currentEpisodes.length;
playerPrevBtn.addEventListener('click', () => { const i = neighborEp(-1); if (hasEp(i)) jumpToEpisode(i); });
playerNextBtn.addEventListener('click', () => { const i = neighborEp(1); if (hasEp(i)) jumpToEpisode(i); });

// Klavye: reklamsız <video> açıkken ok tuşları videoyu sarıyor (bkz. videoKlavye); bölüm
// değiştirmek için N/P ya da Shift+Ok. iframe embed'de ok tuşları yine bölüm değiştiriyor.
window.addEventListener('keydown', e => {
  if (playerModal.hidden) return;
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return; // metin kutusuna yazılıyorsa karışma
  if (e.key === 'Escape') { closePlayerModal(); return; }

  const k = e.key.toLowerCase();
  const oncekiBolum = k === 'p' || (e.shiftKey && e.key === 'ArrowLeft');
  const sonrakiBolum = k === 'n' || (e.shiftKey && e.key === 'ArrowRight');
  if (oncekiBolum) { e.preventDefault(); playerPrevBtn.click(); return; }
  if (sonrakiBolum) { e.preventDefault(); playerNextBtn.click(); return; }

  if (videoKlavye(e)) { e.preventDefault(); kontrolleriGoster(); return; }
  // iframe modunda video kısayolu yok; ok tuşları bölüm değiştirmeye devam etsin
  if (e.key === 'ArrowLeft') playerPrevBtn.click();
  else if (e.key === 'ArrowRight') playerNextBtn.click();
});


// Detay sayfası bölüm listesini çizerken buraya veriyor; gezinme bu diziye göre yürüyor.
export function setCurrentEpisodes(eps) { currentEpisodes = eps; }
export const getCurrentEpisodes = () => currentEpisodes;

export { openPlayerModal, closePlayerModal, openEpisode, wireEmbedButtons, syncEpNavButtons, playerModal, directBtnOf };
