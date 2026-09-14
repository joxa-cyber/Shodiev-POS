// Backend bilan aloqa + yordamchi funksiyalar
export const amal = (nom, arg) => window.pos.amal(nom, arg);

export function pul(n) {
  const son = Math.round(Number(n) || 0);
  return son.toLocaleString('ru-RU').replace(/ /g, ' ');
}

export function miqdorFmt(n) {
  const x = Number(n) || 0;
  return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
}

export function bugun() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sanaQoshish(sana, kun) {
  const d = new Date(sana + 'T00:00:00');
  d.setDate(d.getDate() + kun);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function oyBoshi() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
}

export function sanaChiroyli(s) {
  if (!s) return '';
  const kun = s.slice(0, 10).split('-');
  return `${kun[2]}.${kun[1]}.${kun[0]}`;
}

export function vaqtChiroyli(s) {
  if (!s) return '';
  return `${sanaChiroyli(s)} ${s.slice(11, 16)}`;
}
