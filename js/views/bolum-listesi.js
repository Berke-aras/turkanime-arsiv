// Detay sayfasının bölüm listesi işaretlemesi. Liste ve ızgara (§6.4) görünümlerinin ikisini de
// aynı DOM besliyor; izlendi işareti (§7.2) burada basılıyor.
import { esc, ic } from '../util.js';
import { izlendiMi } from '../progress.js';
import { getEpReverse } from '../store.js';

  // link butonları binlerce olabildiğinden (ör. One Piece: 1166 bölüm/~27000 link),
  // baştan basmak yerine bölüm ilk açıldığında dolduruluyor (bkz. aşağıdaki ep-head handler'ı).
  // Aynı DOM iki görünümü de besliyor (§6.4): liste modunda tam başlık, ızgara modunda yalnız
  // bölüm numarası görünür; hangisinin görüneceğine CSS karar veriyor. Açılan bölüm ızgarada
  // tüm satırı kaplar (grid-column:1/-1), böylece link listesi yine tam genişlikte çıkar.
function epItemHtml(episodes, slug, i) {
  const ep = episodes[i];
  const empty = !ep.links.length;
  const kisa = ep.no != null ? String(ep.no) : '•';
  const izlendi = izlendiMi(slug, i);
  return `
  <div class="ep${empty ? ' ep-empty' : ''}${izlendi ? ' ep-izlendi' : ''}" data-i="${i}">
    <div class="ep-head">
      <span class="ep-arrow">${ic('chevron-right')}</span>
      <span class="ep-kisa" aria-hidden="true">${esc(kisa)}</span>
      <span class="ep-ad">${esc(ep.ad)}</span>
      <span class="meta">${empty ? 'çalışan link yok' : `${ep.links.length} link`}</span>
      <button type="button" class="ep-izle" data-i="${i}"
        title="İzlendi olarak işaretle (Shift ile buraya kadar hepsi)"
        aria-label="İzlendi olarak işaretle">${ic('check')}</button>
    </div>
    <div class="ep-links"></div>
  </div>`;
}
// uzun serilerde (100+) bölümler 50'lik katlanır gruplara bölünüyor; sadece ilk grup açık gelir
const EP_GROUP = 50;
export function epListHtml(episodes, slug) {
  let order = episodes.map((_, i) => i);
  if (getEpReverse()) order.reverse();
  const kutular = g => `<div class="ep-kutular">${g.map(i => epItemHtml(episodes, slug, i)).join('')}</div>`;
  if (order.length <= 100) return kutular(order);
  const groups = [];
  for (let k = 0; k < order.length; k += EP_GROUP) groups.push(order.slice(k, k + EP_GROUP));
  return groups.map((g, gi) => `
    <details class="ep-group"${gi === 0 ? ' open' : ''}>
      <summary>${g[0] + 1}–${g[g.length - 1] + 1}<span class="meta">${g.length} bölüm</span></summary>
      ${kutular(g)}
    </details>`).join('');
}
