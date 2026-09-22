// Yatay kart şeritlerinin ok düğmeleri. Ana sayfa keşif şeritleri (§6.2) ve detay sayfasındaki
// "Benzer animeler" (§6.5) aynı işaretlemeyi kullanıyor.
export function wireSeritler(kok) {
  kok.querySelectorAll('.serit-sar').forEach(sar => {
    const serit = sar.querySelector('.recent-grid');
    const sol = sar.querySelector('.serit-ok-sol');
    const sag = sar.querySelector('.serit-ok-sag');
    const tazele = () => {
      const tasma = serit.scrollWidth - serit.clientWidth;
      if (tasma < 8) { sol.hidden = true; sag.hidden = true; return; }
      sol.hidden = serit.scrollLeft < 8;
      sag.hidden = serit.scrollLeft > tasma - 8;
    };
    // bir ekran dolusu kadar kaydır, son kartı yarım bırakmamak için bir kart payı bırak
    const adim = () => Math.max(160, serit.clientWidth - 160);
    sol.addEventListener('click', () => serit.scrollBy({ left: -adim(), behavior: 'smooth' }));
    sag.addEventListener('click', () => serit.scrollBy({ left: adim(), behavior: 'smooth' }));
    serit.addEventListener('scroll', tazele, { passive: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(tazele).observe(serit);
    tazele();
  });
}
