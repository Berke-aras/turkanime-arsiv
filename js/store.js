// localStorage'da tutulan kullanıcı tercihleri: favoriler, son bakılanlar, bölüm sırası.
import { readLS, writeLS } from './util.js';

const favs = new Set(readLS('ta_favs', []));
const isFav = slug => favs.has(slug);
const favLabel = slug => isFav(slug) ? 'Favorilerden çıkar' : 'Favorilere ekle';
function toggleFav(slug) { favs.has(slug) ? favs.delete(slug) : favs.add(slug); writeLS('ta_favs', [...favs]); }

let recent = readLS('ta_recent', []);
let epReverse = readLS('ta_eprev', false);
function pushRecent(slug) { recent = [slug, ...recent.filter(s => s !== slug)].slice(0, 16); writeLS('ta_recent', recent); }

// epReverse birden çok modülden okunup yazıldığı için erişimciyle veriliyor (canlı bağlama).
export const getEpReverse = () => epReverse;
export function setEpReverse(v) { epReverse = v; writeLS('ta_eprev', epReverse); }
export const getRecent = () => recent;

export { favs, isFav, favLabel, toggleFav, pushRecent };
