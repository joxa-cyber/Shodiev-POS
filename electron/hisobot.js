// Hisobotlar - ham UI, ham Telegram bot shu modulni ishlatadi
const { baza, sozlama } = require('./db');

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
      `SELECT SUM(CASE WHEN tur = 'qaytarish' THEN 0 ELSE 1 END) AS chek_soni,
              COALESCE(SUM(CASE WHEN tur = 'qaytarish' THEN 1 ELSE 0 END),0) AS qaytarish_soni,
              COALESCE(SUM(CASE WHEN tur = 'qaytarish' THEN -jami ELSE 0 END),0) AS qaytarish_summa,
              COALESCE(SUM(jami),0) AS savdo,
              COALESCE(SUM(jami - tan_jami),0) AS foyda,
              COALESCE(SUM(naqd),0) AS naqd,
              COALESCE(SUM(karta),0) AS karta,
              COALESCE(SUM(terminal),0) AS terminal,
              COALESCE(SUM(qarz),0) AS qarz,
              COALESCE(SUM(yaxlitlash),0) AS yaxlitlash,
              COALESCE(SUM(CASE WHEN yaxlitlash < 0 THEN 1 ELSE 0 END),0) AS qoshib_soni,
              COALESCE(SUM(CASE WHEN yaxlitlash > 0 THEN 1 ELSE 0 END),0) AS qaytimsiz_soni
       FROM sotuvlar WHERE sana >= @dan AND sana <= @gacha${filialShart}`
    )
    .get(p);

  // Tovar chiqimi: qancha dona chiqdi va tan narxda qancha
  const chiqim = db
    .prepare(
      `SELECT COALESCE(SUM(q.miqdor),0) AS dona,
              COUNT(DISTINCT q.tovar_id) AS turlar,
              COALESCE(SUM(q.tan_narx * q.miqdor),0) AS tan_qiymati
       FROM sotuv_qatorlari q JOIN sotuvlar s ON s.id = q.sotuv_id
       WHERE s.sana >= @dan AND s.sana <= @gacha${filial_id ? ' AND s.filial_id = @filial_id' : ''}`
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
              SUM(q.summa - q.tan_narx * q.miqdor) AS foyda,
              COALESCE(MAX(t.blok_soni), 0) AS blok_soni
       FROM sotuv_qatorlari q
       JOIN sotuvlar s ON s.id = q.sotuv_id
       LEFT JOIN tovarlar t ON t.id = q.tovar_id
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
    chiqim_dona: chiqim.dona,
    chiqim_turlar: chiqim.turlar,
    chiqim_tan: chiqim.tan_qiymati,
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

  // Ma'lumotlar tozalangan bo'lsa - buni aytib qo'yamiz
  const tozalangan = sozlama('tozalangan_sana', '');
  if (tozalangan && tozalangan.slice(0, 10) >= h.dan) {
    l.push('');
    l.push(
      `ℹ️ <i>Ma'lumotlar ${sanaChiroyli(tozalangan.slice(0, 10))} ${tozalangan.slice(11, 16)} da ` +
        `tozalangan — undan oldingi savdolar hisobda yo'q.</i>`
    );
  }

  // Savdo bo'lmagan bo'lsa - qisqa va tushunarli javob
  if (!h.chek_soni && !h.kirim_soni && !h.qarz_tolov) {
    l.push('');
    l.push('Bu davrda savdo qayd etilmagan.');
    if (tozalangan) {
      l.push('');
      l.push(
        "<i>Dasturda ma'lumotlar yaqinda tozalangan. Yangi savdolar kiritilishi bilan " +
          'hisobotlar odatdagidek to\'ldirilib boradi.</i>'
      );
    }
    return l.join('\n');
  }

  l.push('');
  l.push(`🧾 Cheklar: <b>${h.chek_soni} ta</b>`);
  l.push(`💵 Savdo: <b>${pul(h.savdo)} so'm</b>`);
  if (h.qaytarish_soni > 0) {
    l.push(`↩️ Qaytarilgan: <b>${pul(h.qaytarish_summa)} so'm</b> (${h.qaytarish_soni} ta) — savdodan ayirilgan`);
  }
  l.push(`📈 Foyda: <b>${pul(h.foyda)} so'm</b>`);
  l.push('');
  l.push('<b>To\'lovlar:</b>');
  l.push(`  💵 Naqd: ${pul(h.naqd)}`);
  l.push(`  💳 Karta: ${pul(h.karta)}`);
  l.push(`  🏧 Terminal: ${pul(h.terminal)}`);
  if (h.qarz > 0) l.push(`  📝 Qarzga: ${pul(h.qarz)}`);
  if (h.qarz_tolov > 0) l.push(`  ✅ Qarz to'lovi: ${pul(h.qarz_tolov)}`);
  if (h.yaxlitlash) {
    const qoshib = h.qoshib_soni ? `qo'shib yuborildi ${h.qoshib_soni} ta` : '';
    const qaytimsiz = h.qaytimsiz_soni ? `qaytim olinmadi ${h.qaytimsiz_soni} ta` : '';
    l.push(
      `  ⚖️ To'lov farqi: ${h.yaxlitlash > 0 ? '+' : ''}${pul(h.yaxlitlash)}` +
        (qoshib || qaytimsiz ? ` (${[qoshib, qaytimsiz].filter(Boolean).join(', ')})` : '')
    );
  }
  l.push('');
  l.push(`💰 <b>Jami tushum: ${pul(h.kassa_naqd + h.kassa_karta + h.kassa_terminal)} so'm</b>`);
  l.push(`  💵 Kassada (naqd pul): <b>${pul(h.kassa_naqd)} so'm</b>`);
  const bank = h.kassa_karta + h.kassa_terminal;
  if (bank > 0) l.push(`  🏦 Bankda (karta + terminal): <b>${pul(bank)} so'm</b>`);
  l.push('');
  l.push(
    `📤 Tovar chiqimi: <b>${fmtMiqdor(h.chiqim_dona)} dona</b>` +
      (h.chiqim_turlar ? ` · ${h.chiqim_turlar} xil tovar` : '')
  );
  if (h.chiqim_tan) l.push(`     <i>tan narxda ${pul(h.chiqim_tan)} so'm</i>`);
  if (h.kirim_soni > 0) {
    l.push(`📥 Tovar kirimi: <b>${pul(h.kirim_jami)} so'm</b> (${h.kirim_soni} ta hujjat)`);
  }
  if (h.top && h.top.length) {
    l.push('');
    l.push("<b>Eng ko'p sotilganlar:</b>");
    h.top.slice(0, 7).forEach((t, i) => {
      l.push(`  ${i + 1}. ${t.nomi}`);
      l.push(`      ${blokDona(t.miqdor, t.blok_soni)} · ${pul(t.summa)}`);
    });
  }
  return l.join('\n');
}

// Miqdorni blok va dona ko'rinishida yozadi: 26 dona, blokda 24 ta bo'lsa -> "1 blok 2 dona"
function blokDona(miqdor, blok_soni) {
  const m = Number(miqdor) || 0;
  const b = Number(blok_soni) || 0;
  if (b <= 1 || m < b) return `${fmtMiqdor(m)} dona`;
  const bloklar = Math.floor(m / b);
  const qoldiq = Math.round((m - bloklar * b) * 100) / 100;
  return qoldiq > 0
    ? `${bloklar} blok ${fmtMiqdor(qoldiq)} dona (${fmtMiqdor(m)})`
    : `${bloklar} blok (${fmtMiqdor(m)} dona)`;
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
  blokDona,
  sanaChiroyli,
};
