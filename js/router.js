// Hash router: #/ (liste, filtreler querystring'de), #/anime/<slug> ve #/yasal.
import { jumpTo } from './util.js';
import { parseListHash, restoreListScroll } from './state.js';
import { playerModal, closePlayerModal } from './player.js';
import { renderList } from './views/list.js';
import { renderDetail } from './views/detail.js';
import { renderLegal } from './views/legal.js';

// Detay sayfası veriyi asenkron yüklüyor; bu sayaç, kullanıcı beklerken başka rotaya geçtiğinde
// geç gelen yanıtın ekrana çizilmesini engelliyor.
let routeToken = 0;
export const getRouteToken = () => routeToken;

function route() {
  const token = ++routeToken;
  if (!playerModal.hidden) closePlayerModal(); // geri tuşuyla sayfa değişince modal açık kalmasın
  const hash = location.hash || '#/';
  if (hash === '#/yasal') { renderLegal(); jumpTo(0); return; }
  const m = hash.match(/^#\/anime\/(.+)$/);
  if (m) { renderDetail(decodeURIComponent(m[1]), token); jumpTo(0); return; }
  parseListHash(hash);
  renderList();
  restoreListScroll(); // listeye geri dönüldüyse eski kaydırma konumu, değilse başa
}


export { route };
