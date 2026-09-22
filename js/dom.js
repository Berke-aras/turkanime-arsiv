// Uygulama kabuğundaki sabit DOM referansları.
const app = document.getElementById('app');
const searchEl = document.getElementById('search');
// içerik her değiştiğinde animasyonu baştan tetiklemek için class'ı kaldırıp reflow ile yeniden ekliyoruz.
function fadeApp() { app.classList.remove('fade-in'); void app.offsetWidth; app.classList.add('fade-in'); }

export { app, searchEl, fadeApp };
