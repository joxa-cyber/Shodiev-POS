// Hisobotlar - ham UI, ham Telegram bot shu modulni ishlatadi
const { baza } = require('./db');

function pul(n) {
  const son = Math.round(Number(n) || 0);
  return son.toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
}

function bugun() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Mahalliy vaqt: 'YYYY-MM-DD HH:MM:SS' (toISOString UTC qaytaradi - ishlatmaymiz!)
function hozir() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
}

function sanaQoshish(sana, kun) {
  const d = new Date(sana + 'T00:00:00');
  d.setDate(d.getDate() + kun);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function oyBoshi() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
}

// dan/gacha: 'YYYY-MM-DD' (ikkalasi ham kiritiladi)
function oraliq(dan, gacha, filial_id = null) {
  const db = baza();
  const g = gacha + ' 23:59:59';
  const filialShart = filial_id ? ' AND filial_id = @filial_id' : '';
  const p = { dan, gacha: g, filial_id };

  const savdo = db
    .prepare(
      `SELECT COUNT(*) AS chek_soni,
              COALESCE(SUM(jami),0) AS savdo,
              COALESCE(SUM(jami - tan_jami),0) AS foyda,
              COALESCE(SUM(naqd),0) AS naqd,
              COALESCE(SUM(karta),0) AS karta,
              COALESCE(SUM(terminal),0) AS terminal,
              COALESCE(SUM(qarz),0) AS qarz
       FROM sotuvlar WHERE sana >= @dan AND sana <= @gacha${filialShart}`
    )
    .get(p);

  const qarzTolov = db
    .prepare(
      `SELECT COALESCE(SUM(summa),0) AS jami,
              COALESCE(SUM(CASE WHEN usul='naqd' THEN summa ELSE 0 END),0) AS naqd,
              COALESCE(SUM(CASE WHEN usul='karta' THEN summa ELSE 0 END),0) AS karta,
              COALESCE(SUM(CASE WHEN usul='terminal' THEN summa ELSE 0 END),0) AS terminal
       FROM qarz_tolovlar WHERE sana >= @dan AND sana <= @gacha${filialShart}`
    )
    .get(p);

  const kirim = db
    .prepare(
      `SELECT COALESCE(SUM(jami),0) AS jami, COUNT(*) AS soni
       FROM kirimlar WHERE sana >= @dan AND sana <= @gacha${filialShart}`
    )
    .get(p);

  const topTovar = db
    .prepare(
      `SELECT q.nomi,
              SUM(q.miqdor) AS miqdor,
              SUM(q.summa) AS summa,
              SUM(q.summa - q.tan_narx * q.miqdor) AS foyda
       FROM sotuv_qatorlari q JOIN sotuvlar s ON s.id = q.sotuv_id
       WHERE s.sana >= @dan AND s.sana <= @gacha${filial_id ? ' AND s.filial_id = @filial_id' : ''}
       GROUP BY q.nomi ORDER BY miqdor DESC LIMIT 10`
    )
    .all(p);

  const kunlar = db
    .prepare(
      `SELECT substr(sana,1,10) AS kun,
              COALESCE(SUM(jami),0) AS savdo,
              COALESCE(SUM(jami - tan_jami),0) AS foyda,
              COUNT(*) AS chek
       FROM sotuvlar WHERE sana >= @dan AND sana <= @gacha${filialShart}
       GROUP BY kun ORDER BY kun`
    )
    .all(p);

  const hodimlar = db
    .prepare(
      `SELECT f.ism, COUNT(*) AS chek, COALESCE(SUM(s.jami),0) AS savdo,
              COALESCE(SUM(s.jami - s.tan_jami),0) AS foyda
       FROM sotuvlar s JOIN foydalanuvchilar f ON f.id = s.foydalanuvchi_id
       WHERE s.sana >= @dan AND s.sana <= @gacha${filial_id ? ' AND s.filial_id = @filial_id' : ''}
       GROUP BY f.id ORDER BY savdo DESC`
    )
    .all(p);

  return {
    dan,
    gacha,
    ...savdo,
    // kassaga tushgan haqiqiy pul (sotuvdan + qarz to'lovlaridan)
    kassa_naqd: savdo.naqd + qarzTolov.naqd,
    kassa_karta: savdo.karta + qarzTolov.karta,
    kassa_terminal: savdo.terminal + qarzTolov.terminal,
    qarz_tolov: qarzTolov.jami,
    kirim_jami: kirim.jami,
    kirim_soni: kirim.soni,
    top: topTovar,
    kunlar,
    hodimlar,
  };
}

function kunlik(sana = bugun(), filial_id = null) {
  return oraliq(sana, sana, filial_id);
}

function haftalik(filial_id = null) {
  return oraliq(sanaQoshish(bugun(), -6), bugun(), filial_id);
}

function oylik(filial_id = null) {
  return oraliq(oyBoshi(), bugun(), filial_id);
}

function jamiHisobot(filial_id = null) {
  return oraliq('2000-01-01', bugun(), filial_id);
}

function qoldiqlar(filial_id, faqatKam = false) {
  const db = baza();
  return db
    .prepare(
      `SELECT t.id, t.nomi, t.barcode, t.blok_soni, t.sotuv_narx, t.tan_narx, t.min_qoldiq,
              COALESCE(o.qoldiq,0) AS qoldiq,
              COALESCE(o.qoldiq,0) * t.tan_narx AS ombor_summa
       FROM tovarlar t
       LEFT JOIN ombor o ON o.tovar_id = t.id AND o.filial_id = ?
       WHERE t.aktiv = 1 ${faqatKam ? 'AND COALESCE(o.qoldiq,0) <= t.min_qoldiq' : ''}
       ORDER BY t.nomi`
    )
    .all(filial_id);
}

// Kassada qancha naqd bo'lishi kerak (oxirgi sanoqdan beri) - bot uchun
function kassaXulosa(filial_id) {
  const db = baza();
  const fid = filial_id || 1;
  const oxirgi = db.prepare('SELECT * FROM kassa_hisob WHERE filial_id = ? ORDER BY id DESC LIMIT 1').get(fid);
  const dan = oxirgi ? oxirgi.gacha : bugun() + ' 00:00:00';
  const gacha = hozir();
  const s = db
    .prepare(
      `SELECT COUNT(*) AS chek, COALESCE(SUM(naqd),0) AS naqd, COALESCE(SUM(jami),0) AS jami,
              COALESCE(SUM(karta),0) AS karta, COALESCE(SUM(terminal),0) AS terminal
       FROM sotuvlar WHERE filial_id = ? AND sana > ? AND sana <= ?`
    )
    .get(fid, dan, gacha);
  const q = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN usul='naqd' THEN summa ELSE 0 END),0) AS naqd
       FROM qarz_tolovlar WHERE filial_id = ? AND sana > ? AND sana <= ?`
    )
    .get(fid, dan, gacha);
  return {
    dan,
    gacha,
    oxirgi,
    chek: s.chek,
    savdo: s.jami,
    karta: s.karta,
    terminal: s.terminal,
    kutilgan: s.naqd + q.naqd,
  };
}

function qarzdorlar() {
  return baza()
    .prepare(
      `SELECT id, ism, telefon, qarz FROM mijozlar
       WHERE aktiv = 1 AND qarz > 0.4 ORDER BY qarz DESC`
    )
    .all();
}

// --- Telegram uchun matnli hisobot ---
function hisobotMatn(sarlavha, h) {
  const l = [];
  l.push(`📊 <b>${sarlavha}</b>`);
  l.push(`<i>${h.dan === h.gacha ? sanaChiroyli(h.dan) : sanaChiroyli(h.dan) + ' — ' + sanaChiroyli(h.gacha)}</i>`);
  l.push('');
  l.push(`🧾 Cheklar: <b>${h.chek_soni} ta</b>`);
  l.push(`💵 Savdo: <b>${pul(h.savdo)} so'm</b>`);
  l.push(`📈 Foyda: <b>${pul(h.foyda)} so'm</b>`);
  l.push('');
  l.push('<b>To\'lovlar:</b>');
  l.push(`  💵 Naqd: ${pul(h.naqd)}`);
  l.push(`  💳 Karta: ${pul(h.karta)}`);
  l.push(`  🏧 Terminal: ${pul(h.terminal)}`);
  if (h.qarz > 0) l.push(`  📝 Qarzga: ${pul(h.qarz)}`);
  if (h.qarz_tolov > 0) l.push(`  ✅ Qarz to'lovi: ${pul(h.qarz_tolov)}`);
  l.push('');
  l.push(`💰 <b>Kassaga tushdi: ${pul(h.kassa_naqd + h.kassa_karta + h.kassa_terminal)} so'm</b>`);
  if (h.kirim_soni > 0) l.push(`📥 Tovar kirimi: ${pul(h.kirim_jami)} so'm (${h.kirim_soni} ta)`);
  if (h.top && h.top.length) {
    l.push('');
    l.push("<b>Eng ko'p sotilganlar:</b>");
    h.top.slice(0, 5).forEach((t, i) => {
      l.push(`  ${i + 1}. ${t.nomi} — ${fmtMiqdor(t.miqdor)} dona · ${pul(t.summa)}`);
    });
  }
  return l.join('\n');
}

function fmtMiqdor(n) {
  const x = Number(n) || 0;
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function sanaChiroyli(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

module.exports = {
  pul,
  bugun,
  hozir,
  oyBoshi,
  sanaQoshish,
  oraliq,
  kunlik,
  haftalik,
  oylik,
  jamiHisobot,
  qoldiqlar,
  qarzdorlar,
  kassaXulosa,
  hisobotMatn,
  fmtMiqdor,
  sanaChiroyli,
};
