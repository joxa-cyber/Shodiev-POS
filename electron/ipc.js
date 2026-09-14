// Barcha biznes-mantiq shu yerda. Renderer (UI) faqat shu funksiyalarni chaqiradi.
const { ipcMain, shell, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const DB = require('./db');
const H = require('./hisobot');
const TG = require('./telegram');
const Printer = require('./printer');
const Backup = require('./backup');
const Yangilanish = require('./yangilanish');

let joriy = null; // tizimga kirgan foydalanuvchi

function db() {
  return DB.baza();
}

function talab(shart, xabar) {
  if (!shart) throw new Error(xabar);
}

function kirganmi() {
  talab(joriy, 'Tizimga kiring');
  return joriy;
}

function ruxsat(kalit) {
  const u = kirganmi();
  if (u.rol === 'rahbar') return u;
  talab(u.ruxsatlar && u.ruxsatlar[kalit], "Bu amal uchun ruxsatingiz yo'q");
  return u;
}

function rahbar() {
  const u = kirganmi();
  talab(u.rol === 'rahbar', 'Bu amalni faqat rahbar bajara oladi');
  return u;
}

function filialNomi(id) {
  const r = db().prepare('SELECT nomi FROM filiallar WHERE id = ?').get(id);
  return r ? r.nomi : '-';
}

// Narx o'zgarishini tarixga yozadi (kim, qachon, nimadan nimaga)
function narxLogla(tovar, tur, eski, yangi, sabab = '') {
  const e = Math.round(Number(eski) || 0);
  const y = Math.round(Number(yangi) || 0);
  if (e === y) return;
  db()
    .prepare(
      `INSERT INTO narx_tarix (tovar_id, nomi, tur, eski, yangi, sabab, foydalanuvchi_id, ism)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(tovar.id, tovar.nomi, tur, e, y, sabab, joriy ? joriy.id : null, joriy ? joriy.ism : '');
}

// Sotuvdan keyin tugayotgan tovarlar haqida rahbarga xabar (kuniga bir marta)
function tugayotganlarniTekshir(tovarIdlar, fid) {
  try {
    const kun = H.bugun();
    const ogohlar = [];
    for (const id of tovarIdlar) {
      const t = db()
        .prepare(
          `SELECT t.id, t.nomi, t.min_qoldiq, t.ogoh_sana, COALESCE(o.qoldiq,0) AS qoldiq
           FROM tovarlar t LEFT JOIN ombor o ON o.tovar_id = t.id AND o.filial_id = ?
           WHERE t.id = ?`
        )
        .get(fid, id);
      if (!t || t.min_qoldiq <= 0) continue;
      if (t.qoldiq <= t.min_qoldiq && t.ogoh_sana !== kun) {
        db().prepare('UPDATE tovarlar SET ogoh_sana = ? WHERE id = ?').run(kun, t.id);
        ogohlar.push(t);
      }
    }
    if (ogohlar.length) {
      const l = ['⚠️ <b>Tovar tugayapti</b>', '', `🏪 ${filialNomi(fid)}`, ''];
      for (const t of ogohlar) {
        l.push(
          `• ${t.nomi} — <b>${H.fmtMiqdor(t.qoldiq)} dona</b> qoldi${
            t.qoldiq <= 0 ? ' ❗️' : ` (chegara: ${H.fmtMiqdor(t.min_qoldiq)})`
          }`
        );
      }
      l.push('', '<i>Buyurtma berishni unutmang</i>');
      TG.navbatQosh(l.join('\n'));
    }
  } catch (e) {
    console.error('tugayotgan tekshiruvi:', e.message);
  }
}

/* ===================== QARZ HISOBI =====================
   Qoida: mijozning qarzi = ochiq cheklardagi qoldiqlar yig'indisi − avans (ortiqcha to'lov).
   Har bir to'lov eng eski chekdan boshlab taqsimlanadi va qaysi chekka qancha
   yozilgani `qarz_taqsim` jadvalida saqlanadi. Shuning uchun hisob hech qachon adashmaydi. */

function mijozQarziQayta(mijoz_id) {
  const r = db()
    .prepare('SELECT COALESCE(SUM(qarz_qoldiq),0) AS q FROM sotuvlar WHERE mijoz_id = ? AND qarz_qoldiq > 0')
    .get(mijoz_id);
  const m = db().prepare('SELECT avans FROM mijozlar WHERE id = ?').get(mijoz_id);
  const avans = m ? m.avans : 0;
  const qarz = Math.round((r.q - avans) * 100) / 100;
  db().prepare('UPDATE mijozlar SET qarz = ? WHERE id = ?').run(qarz, mijoz_id);
  return qarz;
}

// To'lovni eng eski cheklardan boshlab taqsimlaydi, ortig'i avansga tushadi
function tolovniTaqsimla(mijoz_id, tolov_id, summa) {
  let qolgan = Math.round(Number(summa) * 100) / 100;
  const ochiqlar = db()
    .prepare('SELECT id, qarz_qoldiq FROM sotuvlar WHERE mijoz_id = ? AND qarz_qoldiq > 0.009 ORDER BY id')
    .all(mijoz_id);
  const yoz = db().prepare('INSERT INTO qarz_taqsim (tolov_id, sotuv_id, summa) VALUES (?,?,?)');
  const kamaytir = db().prepare('UPDATE sotuvlar SET qarz_qoldiq = qarz_qoldiq - ? WHERE id = ?');
  const taqsim = [];
  for (const s of ochiqlar) {
    if (qolgan <= 0.009) break;
    const qism = Math.min(qolgan, s.qarz_qoldiq);
    if (tolov_id) yoz.run(tolov_id, s.id, qism);
    kamaytir.run(qism, s.id);
    qolgan = Math.round((qolgan - qism) * 100) / 100;
    taqsim.push({ sotuv_id: s.id, summa: qism });
  }
  if (qolgan > 0.009) {
    db().prepare('UPDATE mijozlar SET avans = avans + ? WHERE id = ?').run(qolgan, mijoz_id);
  }
  return { taqsim, avansga: qolgan };
}

// Yangi qarzli sotuvda mijozning avansi bo'lsa, avval o'shani ishlatamiz
function avansniIshlat(mijoz_id, sotuv_id) {
  const m = db().prepare('SELECT avans FROM mijozlar WHERE id = ?').get(mijoz_id);
  if (!m || m.avans <= 0.009) return 0;
  const s = db().prepare('SELECT qarz_qoldiq FROM sotuvlar WHERE id = ?').get(sotuv_id);
  const qism = Math.min(m.avans, s.qarz_qoldiq);
  if (qism <= 0.009) return 0;
  db()
    .prepare('UPDATE sotuvlar SET qarz_qoldiq = qarz_qoldiq - ?, avans_ishlatildi = avans_ishlatildi + ? WHERE id = ?')
    .run(qism, qism, sotuv_id);
  db().prepare('UPDATE mijozlar SET avans = avans - ? WHERE id = ?').run(qism, mijoz_id);
  return qism;
}

function foydalanuvchiYuklash(row) {
  const filiallar = db()
    .prepare(
      `SELECT f.id, f.nomi FROM filiallar f
       JOIN foydalanuvchi_filial ff ON ff.filial_id = f.id
       WHERE ff.foydalanuvchi_id = ? AND f.aktiv = 1 ORDER BY f.id`
    )
    .all(row.id);
  let ruxsatlar = {};
  try {
    ruxsatlar = JSON.parse(row.ruxsatlar || '{}');
  } catch {}
  if (row.rol === 'rahbar') ruxsatlar = { ...DB.TOLIQ_RUXSAT };
  return {
    id: row.id,
    login: row.login,
    ism: row.ism,
    rol: row.rol,
    ruxsatlar,
    filiallar: filiallar.length ? filiallar : db().prepare('SELECT id, nomi FROM filiallar WHERE aktiv=1').all(),
  };
}

// ================= AMALLAR =================
const amallar = {
  // ---------- AUTH ----------
  'auth.kirish'({ login, parol }) {
    const row = db()
      .prepare('SELECT * FROM foydalanuvchilar WHERE login = ? AND aktiv = 1')
      .get(String(login || '').trim());
    talab(row, "Login yoki parol noto'g'ri");
    talab(DB.parolTekshir(parol, row.parol_hash), "Login yoki parol noto'g'ri");
    joriy = foydalanuvchiYuklash(row);
    DB.jurnalYoz(joriy.id, 'kirish', joriy.ism);
    return joriy;
  },

  'auth.chiqish'() {
    if (joriy) DB.jurnalYoz(joriy.id, 'chiqish', joriy.ism);
    joriy = null;
    return true;
  },

  'auth.joriy'() {
    return joriy;
  },

  'auth.parolOzgartir'({ eski, yangi }) {
    const u = kirganmi();
    const row = db().prepare('SELECT * FROM foydalanuvchilar WHERE id = ?').get(u.id);
    talab(DB.parolTekshir(eski, row.parol_hash), "Joriy parol noto'g'ri");
    talab(String(yangi || '').length >= 4, "Yangi parol kamida 4 ta belgi bo'lsin");
    db().prepare('UPDATE foydalanuvchilar SET parol_hash = ? WHERE id = ?').run(DB.parolHash(yangi), u.id);
    return true;
  },

  // ---------- FILIALLAR ----------
  'filial.royxat'() {
    return db().prepare('SELECT * FROM filiallar ORDER BY id').all();
  },

  'filial.saqla'(f) {
    rahbar();
    if (f.id) {
      db()
        .prepare('UPDATE filiallar SET nomi=?, manzil=?, telefon=?, aktiv=? WHERE id=?')
        .run(f.nomi, f.manzil || '', f.telefon || '', f.aktiv ? 1 : 0, f.id);
      return f.id;
    }
    const info = db()
      .prepare('INSERT INTO filiallar (nomi, manzil, telefon) VALUES (?,?,?)')
      .run(f.nomi, f.manzil || '', f.telefon || '');
    return info.lastInsertRowid;
  },

  // ---------- FOYDALANUVCHILAR ----------
  'foydalanuvchi.royxat'() {
    rahbar();
    const rows = db().prepare('SELECT * FROM foydalanuvchilar ORDER BY id').all();
    return rows.map((r) => ({
      id: r.id,
      login: r.login,
      ism: r.ism,
      rol: r.rol,
      aktiv: r.aktiv,
      ruxsatlar: JSON.parse(r.ruxsatlar || '{}'),
      filiallar: db()
        .prepare('SELECT filial_id FROM foydalanuvchi_filial WHERE foydalanuvchi_id = ?')
        .all(r.id)
        .map((x) => x.filial_id),
    }));
  },

  'foydalanuvchi.saqla'(u) {
    rahbar();
    talab(u.ism && u.login, "Ism va login to'ldirilsin");
    const tr = db().transaction(() => {
      let id = u.id;
      if (id) {
        db()
          .prepare('UPDATE foydalanuvchilar SET login=?, ism=?, rol=?, ruxsatlar=?, aktiv=? WHERE id=?')
          .run(u.login.trim(), u.ism.trim(), u.rol || 'hodim', JSON.stringify(u.ruxsatlar || {}), u.aktiv ? 1 : 0, id);
        if (u.parol) {
          db().prepare('UPDATE foydalanuvchilar SET parol_hash = ? WHERE id = ?').run(DB.parolHash(u.parol), id);
        }
      } else {
        talab(u.parol && String(u.parol).length >= 4, "Parol kamida 4 ta belgi bo'lsin");
        const info = db()
          .prepare(
            'INSERT INTO foydalanuvchilar (login, parol_hash, ism, rol, ruxsatlar) VALUES (?,?,?,?,?)'
          )
          .run(u.login.trim(), DB.parolHash(u.parol), u.ism.trim(), u.rol || 'hodim', JSON.stringify(u.ruxsatlar || {}));
        id = info.lastInsertRowid;
      }
      db().prepare('DELETE FROM foydalanuvchi_filial WHERE foydalanuvchi_id = ?').run(id);
      const q = db().prepare('INSERT INTO foydalanuvchi_filial (foydalanuvchi_id, filial_id) VALUES (?,?)');
      for (const fid of u.filiallar || []) q.run(id, fid);
      return id;
    });
    try {
      return tr();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw new Error('Bu login band, boshqasini tanlang');
      throw e;
    }
  },

  'foydalanuvchi.ochir'({ id }) {
    rahbar();
    talab(id !== joriy.id, "O'zingizni o'chira olmaysiz");
    db().prepare('UPDATE foydalanuvchilar SET aktiv = 0 WHERE id = ?').run(id);
    return true;
  },

  // ---------- KATEGORIYA ----------
  'kategoriya.royxat'() {
    return db()
      .prepare(
        `SELECT k.*, (SELECT COUNT(*) FROM tovarlar t WHERE t.kategoriya_id = k.id AND t.aktiv = 1) AS tovar_soni
         FROM kategoriyalar k ORDER BY k.nomi`
      )
      .all();
  },

  // tovari yo'q (bo'sh) kategoriyalarni tozalaydi
  'kategoriya.boshlarniOchir'() {
    rahbar();
    const r = db()
      .prepare(
        `DELETE FROM kategoriyalar
         WHERE id NOT IN (SELECT DISTINCT kategoriya_id FROM tovarlar WHERE kategoriya_id IS NOT NULL)`
      )
      .run();
    return { ochirildi: r.changes };
  },
  'kategoriya.saqla'({ id, nomi }) {
    ruxsat('tovarlar');
    if (id) {
      db().prepare('UPDATE kategoriyalar SET nomi=? WHERE id=?').run(nomi, id);
      return id;
    }
    const bor = db().prepare('SELECT id FROM kategoriyalar WHERE nomi = ?').get(nomi);
    if (bor) return bor.id;
    return db().prepare('INSERT INTO kategoriyalar (nomi) VALUES (?)').run(nomi).lastInsertRowid;
  },
  'kategoriya.ochir'({ id, kochir_id = null }) {
    ruxsat('tovarlar');
    const soni = db()
      .prepare('SELECT COUNT(*) AS n FROM tovarlar WHERE kategoriya_id = ? AND aktiv = 1')
      .get(id).n;
    if (soni > 0) {
      // tovarlari bor bo'lsa - boshqa kategoriyaga ko'chiramiz yoki bo'shatamiz
      db().prepare('UPDATE tovarlar SET kategoriya_id = ? WHERE kategoriya_id = ?').run(kochir_id, id);
    }
    db().prepare('DELETE FROM kategoriyalar WHERE id = ?').run(id);
    return { kochirildi: soni };
  },

  // Kategoriyadagi tovarlar (qoldiq va savdosi bilan)
  'kategoriya.tovarlar'({ kategoriya_id, filial_id }) {
    kirganmi();
    const fid = filial_id || Number(DB.sozlama('joriy_filial', '1'));
    return db()
      .prepare(
        `SELECT t.id, t.nomi, t.barcode, t.sotuv_narx, t.tan_narx, COALESCE(o.qoldiq,0) AS qoldiq
         FROM tovarlar t LEFT JOIN ombor o ON o.tovar_id = t.id AND o.filial_id = ?
         WHERE t.aktiv = 1 AND ${kategoriya_id ? 't.kategoriya_id = ?' : 't.kategoriya_id IS NULL'}
         ORDER BY t.nomi`
      )
      .all(...(kategoriya_id ? [fid, kategoriya_id] : [fid]));
  },

  // Bir nechta tovarni bitta kategoriyaga biriktirish
  'kategoriya.biriktir'({ kategoriya_id, tovar_idlar }) {
    ruxsat('tovarlar');
    const q = db().prepare("UPDATE tovarlar SET kategoriya_id = ?, yangilangan = datetime('now','localtime') WHERE id = ?");
    db().transaction(() => {
      for (const id of tovar_idlar || []) q.run(kategoriya_id || null, id);
    })();
    return { biriktirildi: (tovar_idlar || []).length };
  },

  // ---------- TOVARLAR ----------
  'tovar.royxat'({ qidiruv = '', filial_id, kategoriya_id = null, faqatKam = false, limit = 500 } = {}) {
    const u = kirganmi();
    const fid = filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;
    const q = `%${String(qidiruv).trim().toLowerCase()}%`;
    return db()
      .prepare(
        `SELECT t.*, COALESCE(o.qoldiq,0) AS qoldiq, k.nomi AS kategoriya
         FROM tovarlar t
         LEFT JOIN ombor o ON o.tovar_id = t.id AND o.filial_id = @fid
         LEFT JOIN kategoriyalar k ON k.id = t.kategoriya_id
         WHERE t.aktiv = 1
           AND (@q = '%%' OR lower(t.nomi) LIKE @q OR t.barcode LIKE @q)
           ${kategoriya_id ? 'AND t.kategoriya_id = @kategoriya_id' : ''}
           ${faqatKam ? 'AND COALESCE(o.qoldiq,0) <= t.min_qoldiq' : ''}
         ORDER BY t.nomi LIMIT @limit`
      )
      .all({ q, fid, kategoriya_id, limit });
  },

  'tovar.barcode'({ kod, filial_id }) {
    const u = kirganmi();
    const fid = filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;
    return db()
      .prepare(
        `SELECT t.*, COALESCE(o.qoldiq,0) AS qoldiq FROM tovarlar t
         LEFT JOIN ombor o ON o.tovar_id = t.id AND o.filial_id = ?
         WHERE t.barcode = ? AND t.aktiv = 1 LIMIT 1`
      )
      .get(fid, String(kod).trim());
  },

  'tovar.saqla'(t) {
    ruxsat('tovarlar');
    talab(String(t.nomi || '').trim(), 'Tovar nomini kiriting');
    // kategoriya nomi bo'yicha topamiz, bo'lmasa yaratamiz (faqat saqlash paytida!)
    let kategoriya_id = t.kategoriya_id || null;
    const katNomi = String(t.kategoriya || '').trim();
    if (katNomi) {
      const bor = db().prepare('SELECT id FROM kategoriyalar WHERE lower(nomi) = lower(?)').get(katNomi);
      kategoriya_id = bor
        ? bor.id
        : db().prepare('INSERT INTO kategoriyalar (nomi) VALUES (?)').run(katNomi).lastInsertRowid;
    } else if (!t.kategoriya && t.id) {
      kategoriya_id = null;
    }
    const maydonlar = {
      nomi: String(t.nomi).trim(),
      barcode: t.barcode ? String(t.barcode).trim() : null,
      kategoriya_id,
      blok_soni: Number(t.blok_soni) || 0,
      sotuv_narx: Number(t.sotuv_narx) || 0,
      min_qoldiq: Number(t.min_qoldiq) || 0,
    };
    if (t.id) {
      const tanNarxQismi = t.tan_narx !== undefined && t.tan_narx !== '' ? ', tan_narx = @tan_narx' : '';
      const eskiT = db().prepare('SELECT * FROM tovarlar WHERE id = ?').get(t.id);
      if (eskiT) {
        narxLogla(eskiT, 'sotuv', eskiT.sotuv_narx, maydonlar.sotuv_narx, "qo'lda o'zgartirildi");
        if (tanNarxQismi) narxLogla(eskiT, 'tan', eskiT.tan_narx, Number(t.tan_narx) || 0, "qo'lda o'zgartirildi");
      }
      db()
        .prepare(
          `UPDATE tovarlar SET nomi=@nomi, barcode=@barcode, kategoriya_id=@kategoriya_id,
             blok_soni=@blok_soni, sotuv_narx=@sotuv_narx, min_qoldiq=@min_qoldiq${tanNarxQismi},
             yangilangan=datetime('now','localtime')
           WHERE id=@id`
        )
        .run({ ...maydonlar, tan_narx: Number(t.tan_narx) || 0, id: t.id });
      return t.id;
    }
    const info = db()
      .prepare(
        `INSERT INTO tovarlar (nomi, barcode, kategoriya_id, blok_soni, sotuv_narx, tan_narx, min_qoldiq)
         VALUES (@nomi, @barcode, @kategoriya_id, @blok_soni, @sotuv_narx, @tan_narx, @min_qoldiq)`
      )
      .run({ ...maydonlar, tan_narx: Number(t.tan_narx) || 0 });
    // Boshlang'ich qoldiq kirim hujjati sifatida yoziladi - shunda hisobotlarda
    // ham, ombor qiymatida ham to'g'ri ko'rinadi va tozalashda yo'qolmaydi.
    const fid = t.filial_id || (joriy.filiallar[0] && joriy.filiallar[0].id) || 1;
    const tovarId = info.lastInsertRowid;
    const qoldiq = Number(t.qoldiq) || 0;
    if (qoldiq > 0) {
      const tanNarx = Number(t.tan_narx) || 0;
      const summa = qoldiq * tanNarx;
      const kirimId = db()
        .prepare('INSERT INTO kirimlar (filial_id, foydalanuvchi_id, taminotchi, jami, izoh) VALUES (?,?,?,?,?)')
        .run(fid, joriy.id, t.taminotchi || '', summa, "Boshlang'ich qoldiq").lastInsertRowid;
      db()
        .prepare(
          'INSERT INTO kirim_qatorlari (kirim_id, tovar_id, nomi, miqdor, tan_narx, summa) VALUES (?,?,?,?,?,?)'
        )
        .run(kirimId, tovarId, maydonlar.nomi, qoldiq, tanNarx, summa);
      db()
        .prepare('INSERT INTO ombor (tovar_id, filial_id, qoldiq) VALUES (?,?,?)')
        .run(tovarId, fid, qoldiq);
    }
    return tovarId;
  },

  // rahbar tezkor narx o'zgartirishi uchun
  'tovar.narx'({ id, sotuv_narx }) {
    rahbar();
    const t = db().prepare('SELECT * FROM tovarlar WHERE id = ?').get(id);
    if (t) narxLogla(t, 'sotuv', t.sotuv_narx, sotuv_narx, 'tezkor o\'zgartirish');
    db()
      .prepare("UPDATE tovarlar SET sotuv_narx = ?, yangilangan = datetime('now','localtime') WHERE id = ?")
      .run(Number(sotuv_narx) || 0, id);
    return true;
  },

  'tovar.qoldiqTuzat'({ tovar_id, filial_id, qoldiq, izoh = '' }) {
    const u = ruxsat('tovarlar');
    const fid = filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;
    const t = db().prepare('SELECT * FROM tovarlar WHERE id = ?').get(tovar_id);
    const eski = (db().prepare('SELECT qoldiq FROM ombor WHERE tovar_id=? AND filial_id=?').get(tovar_id, fid) || {
      qoldiq: 0,
    }).qoldiq;
    db()
      .prepare(
        `INSERT INTO ombor (tovar_id, filial_id, qoldiq) VALUES (?,?,?)
         ON CONFLICT(tovar_id, filial_id) DO UPDATE SET qoldiq = excluded.qoldiq`
      )
      .run(tovar_id, fid, Number(qoldiq) || 0);
    DB.jurnalYoz(u.id, 'qoldiq_tuzatish', `tovar=${tovar_id} ${eski} -> ${qoldiq} ${izoh}`);
    // rahbar bilib tursin
    if (u.rol !== 'rahbar' && t) {
      TG.navbatQosh(
        `✏️ <b>Qoldiq qo'lda o'zgartirildi</b>\n\n🏪 ${filialNomi(fid)}\n👤 ${u.ism}\n\n${t.nomi}\n${H.fmtMiqdor(
          eski
        )} → <b>${H.fmtMiqdor(Number(qoldiq) || 0)} dona</b>`
      );
    }
    return true;
  },

  'tovar.ochir'({ id }) {
    rahbar();
    db().prepare('UPDATE tovarlar SET aktiv = 0 WHERE id = ?').run(id);
    return true;
  },

  // ---------- MIJOZLAR ----------
  'mijoz.royxat'({ qidiruv = '', faqatQarzdor = false } = {}) {
    kirganmi();
    const q = `%${String(qidiruv).trim().toLowerCase()}%`;
    return db()
      .prepare(
        `SELECT * FROM mijozlar WHERE aktiv = 1
           AND (@q = '%%' OR lower(ism) LIKE @q OR telefon LIKE @q)
           ${faqatQarzdor ? 'AND qarz > 0.4' : ''}
         ORDER BY qarz DESC, ism LIMIT 300`
      )
      .all({ q });
  },

  'mijoz.saqla'(m) {
    ruxsat('mijozlar');
    talab(String(m.ism || '').trim(), 'Mijoz ismini kiriting');
    if (m.id) {
      db()
        .prepare('UPDATE mijozlar SET ism=?, telefon=?, izoh=? WHERE id=?')
        .run(m.ism.trim(), m.telefon || '', m.izoh || '', m.id);
      return m.id;
    }
    return db()
      .prepare('INSERT INTO mijozlar (ism, telefon, izoh) VALUES (?,?,?)')
      .run(m.ism.trim(), m.telefon || '', m.izoh || '').lastInsertRowid;
  },

  'mijoz.ochir'({ id }) {
    rahbar();
    db().prepare('UPDATE mijozlar SET aktiv = 0 WHERE id = ?').run(id);
    return true;
  },

  'mijoz.tarix'({ id }) {
    kirganmi();
    const sotuvlar = db()
      .prepare(
        `SELECT s.*, f.ism AS hodim FROM sotuvlar s
         LEFT JOIN foydalanuvchilar f ON f.id = s.foydalanuvchi_id
         WHERE s.mijoz_id = ? ORDER BY s.id DESC LIMIT 100`
      )
      .all(id);
    const tolovlar = db()
      .prepare(
        `SELECT q.*, f.ism AS hodim FROM qarz_tolovlar q
         LEFT JOIN foydalanuvchilar f ON f.id = q.foydalanuvchi_id
         WHERE q.mijoz_id = ? ORDER BY q.id DESC LIMIT 100`
      )
      .all(id);
    const mijoz = db().prepare('SELECT * FROM mijozlar WHERE id = ?').get(id);
    return { mijoz, sotuvlar, tolovlar };
  },

  // ---------- QARZ TO'LOVI ----------
  'qarz.tolov'({ mijoz_id, summa, usul = 'naqd', filial_id, izoh = '' }) {
    const u = ruxsat('qarz');
    const s = Number(summa) || 0;
    talab(s > 0, "Summa noto'g'ri");
    const mijoz = db().prepare('SELECT * FROM mijozlar WHERE id = ?').get(mijoz_id);
    talab(mijoz, 'Mijoz topilmadi');
    const fid = filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;

    const natija = db().transaction(() => {
      const tolovId = db()
        .prepare(
          'INSERT INTO qarz_tolovlar (mijoz_id, filial_id, foydalanuvchi_id, summa, usul, izoh) VALUES (?,?,?,?,?,?)'
        )
        .run(mijoz_id, fid, u.id, s, usul, izoh).lastInsertRowid;
      const t = tolovniTaqsimla(mijoz_id, tolovId, s);
      const qoldiq = mijozQarziQayta(mijoz_id);
      return { qoldiq, ...t };
    })();

    TG.navbatQosh(TG.qarzTolovXabari(mijoz.ism, s, usul, natija.qoldiq, filialNomi(fid), u.ism));
    DB.jurnalYoz(u.id, 'qarz_tolovi', `${mijoz.ism}: ${s} (${usul}), qoldiq ${natija.qoldiq}`);
    return natija;
  },

  // Mijozning qarzi qaysi cheklardan, qaysi tovarlardan iboratligi
  'qarz.tafsilot'({ mijoz_id }) {
    kirganmi();
    const mijoz = db().prepare('SELECT * FROM mijozlar WHERE id = ?').get(mijoz_id);
    talab(mijoz, 'Mijoz topilmadi');

    const cheklar = db()
      .prepare(
        `SELECT s.id, s.raqam, s.sana, s.jami, s.qarz, s.qarz_qoldiq, f.ism AS hodim
         FROM sotuvlar s LEFT JOIN foydalanuvchilar f ON f.id = s.foydalanuvchi_id
         WHERE s.mijoz_id = ? AND s.qarz > 0 ORDER BY s.id DESC`
      )
      .all(mijoz_id);

    for (const c of cheklar) {
      c.tolangan = Math.round((c.qarz - c.qarz_qoldiq) * 100) / 100;
      c.qatorlar = db()
        .prepare('SELECT nomi, miqdor, narx, summa FROM sotuv_qatorlari WHERE sotuv_id = ?')
        .all(c.id);
      c.tolovlar = db()
        .prepare(
          `SELECT t.sana, t.usul, q.summa, f.ism FROM qarz_taqsim q
           JOIN qarz_tolovlar t ON t.id = q.tolov_id
           LEFT JOIN foydalanuvchilar f ON f.id = t.foydalanuvchi_id
           WHERE q.sotuv_id = ? ORDER BY q.id`
        )
        .all(c.id);
      // qarz qaysi tovarlarga to'g'ri kelishini nisbat bo'yicha ko'rsatamiz
      const qarzUlushi = c.jami > 0 ? c.qarz_qoldiq / c.jami : 0;
      for (const q of c.qatorlar) {
        q.qarzdagi_miqdor = Math.round(q.miqdor * qarzUlushi * 10) / 10;
        q.qarzdagi_summa = Math.round(q.summa * qarzUlushi);
      }
    }

    const tolovlar = db()
      .prepare(
        `SELECT t.*, f.ism AS hodim FROM qarz_tolovlar t
         LEFT JOIN foydalanuvchilar f ON f.id = t.foydalanuvchi_id
         WHERE t.mijoz_id = ? ORDER BY t.id DESC LIMIT 100`
      )
      .all(mijoz_id);

    // eng ko'p qarzga olingan tovarlar
    const tovarlar = db()
      .prepare(
        `SELECT q.nomi, SUM(q.miqdor) AS miqdor, SUM(q.summa) AS summa
         FROM sotuv_qatorlari q JOIN sotuvlar s ON s.id = q.sotuv_id
         WHERE s.mijoz_id = ? AND s.qarz > 0
         GROUP BY q.nomi ORDER BY summa DESC`
      )
      .all(mijoz_id);

    return {
      mijoz,
      cheklar,
      tolovlar,
      tovarlar,
      jami_qarz: cheklar.reduce((s, c) => s + c.qarz, 0),
      jami_tolangan: cheklar.reduce((s, c) => s + c.tolangan, 0),
      qoldiq: mijoz.qarz,
    };
  },

  // Hisob-kitobni tekshirib, kerak bo'lsa to'g'rilaydi
  'qarz.tekshir'() {
    rahbar();
    const mijozlar = db().prepare('SELECT id, ism, qarz FROM mijozlar').all();
    const tuzatilgan = [];
    for (const m of mijozlar) {
      const eski = m.qarz;
      const yangi = mijozQarziQayta(m.id);
      if (Math.abs(eski - yangi) > 0.5) tuzatilgan.push({ ism: m.ism, eski, yangi });
    }
    return { tekshirildi: mijozlar.length, tuzatilgan };
  },

  // ---------- SOTUV ----------
  'sotuv.yarat'(data) {
    const u = ruxsat('sotuv');
    const fid = data.filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;
    const qatorlar = (data.qatorlar || []).filter((q) => Number(q.miqdor) > 0);
    talab(qatorlar.length, "Savat bo'sh");

    const naqd = Number(data.naqd) || 0;
    const karta = Number(data.karta) || 0;
    const terminal = Number(data.terminal) || 0;
    const qarz = Number(data.qarz) || 0;
    const jami = qatorlar.reduce((s, q) => s + Number(q.miqdor) * Number(q.narx), 0);
    const tolangan = naqd + karta + terminal + qarz;
    talab(Math.abs(tolangan - jami) < 1, "To'lov summasi jami summaga teng emas");
    if (qarz > 0) talab(data.mijoz_id, 'Qarzga sotish uchun mijozni tanlang');

    const natija = db().transaction(() => {
      const kun = H.bugun();
      const soni =
        db()
          .prepare("SELECT COUNT(*) AS n FROM sotuvlar WHERE substr(sana,1,10) = ? AND filial_id = ?")
          .get(kun, fid).n + 1;
      const raqam = `${kun.replace(/-/g, '')}-${String(soni).padStart(4, '0')}`;

      let tanJami = 0;
      const tayyorQatorlar = qatorlar.map((q) => {
        const t = q.tovar_id ? db().prepare('SELECT * FROM tovarlar WHERE id = ?').get(q.tovar_id) : null;
        const tanNarx = t ? t.tan_narx : 0;
        const miqdor = Number(q.miqdor);
        const narx = Number(q.narx);
        tanJami += tanNarx * miqdor;
        return {
          tovar_id: q.tovar_id || null,
          nomi: q.nomi || (t ? t.nomi : 'Tovar'),
          miqdor,
          narx,
          tan_narx: tanNarx,
          summa: miqdor * narx,
          blok_soni: t ? t.blok_soni : 0,
        };
      });

      const info = db()
        .prepare(
          `INSERT INTO sotuvlar (raqam, filial_id, foydalanuvchi_id, mijoz_id, jami, tan_jami, naqd, karta, terminal, qarz, qarz_qoldiq, izoh)
           VALUES (@raqam, @filial_id, @foydalanuvchi_id, @mijoz_id, @jami, @tan_jami, @naqd, @karta, @terminal, @qarz, @qarz, @izoh)`
        )
        .run({
          raqam,
          filial_id: fid,
          foydalanuvchi_id: u.id,
          mijoz_id: data.mijoz_id || null,
          jami,
          tan_jami: tanJami,
          naqd,
          karta,
          terminal,
          qarz,
          izoh: data.izoh || '',
        });
      const sotuvId = info.lastInsertRowid;

      const qQator = db().prepare(
        'INSERT INTO sotuv_qatorlari (sotuv_id, tovar_id, nomi, miqdor, narx, tan_narx, summa) VALUES (?,?,?,?,?,?,?)'
      );
      const qOmbor = db().prepare(
        `INSERT INTO ombor (tovar_id, filial_id, qoldiq) VALUES (?,?,?)
         ON CONFLICT(tovar_id, filial_id) DO UPDATE SET qoldiq = qoldiq + excluded.qoldiq`
      );
      for (const q of tayyorQatorlar) {
        qQator.run(sotuvId, q.tovar_id, q.nomi, q.miqdor, q.narx, q.tan_narx, q.summa);
        if (q.tovar_id) qOmbor.run(q.tovar_id, fid, -q.miqdor);
      }

      if (qarz > 0 && data.mijoz_id) {
        avansniIshlat(data.mijoz_id, sotuvId); // oldin ortiqcha to'lagan bo'lsa, hisobga olamiz
        mijozQarziQayta(data.mijoz_id);
      }

      const sotuv = db().prepare('SELECT * FROM sotuvlar WHERE id = ?').get(sotuvId);
      return { sotuv, qatorlar: tayyorQatorlar };
    })();

    const mijoz = data.mijoz_id ? db().prepare('SELECT * FROM mijozlar WHERE id = ?').get(data.mijoz_id) : null;

    // Telegram (navbatga tushadi - internet bo'lmasa keyin yuboriladi)
    if (DB.sozlama('telegram_chek_yuborish', '1') === '1') {
      TG.navbatQosh(
        TG.chekXabari(natija.sotuv, natija.qatorlar, filialNomi(fid), u.ism, mijoz ? mijoz.ism : null)
      );
    }

    // Chek chop etish
    let chopXato = null;
    if (data.chopEt !== false && DB.sozlama('avto_chop', '1') === '1') {
      Printer.chekChop(natija.sotuv, natija.qatorlar, {
        hodim: u.ism,
        mijoz: mijoz ? mijoz.ism : null,
        qaytim: Number(data.qaytim) || 0,
        mijoz_qarzi: mijoz ? mijoz.qarz : 0,
      }).catch((e) => {
        chopXato = e.message;
        console.error('chop xato:', e.message);
      });
    }

    // tugayotgan tovarlar haqida rahbarni ogohlantirish
    tugayotganlarniTekshir(
      natija.qatorlar.map((q) => q.tovar_id).filter(Boolean),
      fid
    );

    return { id: natija.sotuv.id, raqam: natija.sotuv.raqam, jami, chopXato };
  },

  'sotuv.qaytaChop'({ id }) {
    const u = kirganmi();
    const sotuv = db().prepare('SELECT * FROM sotuvlar WHERE id = ?').get(id);
    talab(sotuv, 'Chek topilmadi');
    const qatorlar = db()
      .prepare(
        `SELECT q.*, COALESCE(t.blok_soni,0) AS blok_soni FROM sotuv_qatorlari q
         LEFT JOIN tovarlar t ON t.id = q.tovar_id WHERE q.sotuv_id = ?`
      )
      .all(id);
    const hodim = db().prepare('SELECT ism FROM foydalanuvchilar WHERE id = ?').get(sotuv.foydalanuvchi_id);
    const mijoz = sotuv.mijoz_id ? db().prepare('SELECT * FROM mijozlar WHERE id = ?').get(sotuv.mijoz_id) : null;
    return Printer.chekChop(sotuv, qatorlar, {
      hodim: hodim ? hodim.ism : '',
      mijoz: mijoz ? mijoz.ism : null,
      mijoz_qarzi: mijoz ? mijoz.qarz : 0,
    });
  },

  'sotuv.royxat'({ dan, gacha, filial_id, mijoz_id, foydalanuvchi_id, limit = 200 } = {}) {
    kirganmi();
    const p = {
      dan: dan || '2000-01-01',
      gacha: (gacha || H.bugun()) + ' 23:59:59',
      filial_id: filial_id || null,
      mijoz_id: mijoz_id || null,
      foydalanuvchi_id: foydalanuvchi_id || null,
      limit,
    };
    return db()
      .prepare(
        `SELECT s.*, f.ism AS hodim, m.ism AS mijoz FROM sotuvlar s
         LEFT JOIN foydalanuvchilar f ON f.id = s.foydalanuvchi_id
         LEFT JOIN mijozlar m ON m.id = s.mijoz_id
         WHERE s.sana >= @dan AND s.sana <= @gacha
           ${filial_id ? 'AND s.filial_id = @filial_id' : ''}
           ${mijoz_id ? 'AND s.mijoz_id = @mijoz_id' : ''}
           ${foydalanuvchi_id ? 'AND s.foydalanuvchi_id = @foydalanuvchi_id' : ''}
         ORDER BY s.id DESC LIMIT @limit`
      )
      .all(p);
  },

  // Bir kunlik savdo - cheklar va ularning tarkibi bilan birga (Savdo bo'limi uchun)
  'sotuv.kunlik'({ sana, filial_id, foydalanuvchi_id } = {}) {
    const u = kirganmi();
    const kun = sana || H.bugun();
    const p = {
      dan: kun + ' 00:00:00',
      gacha: kun + ' 23:59:59',
      filial_id: filial_id || null,
      foydalanuvchi_id: foydalanuvchi_id || null,
    };
    const cheklar = db()
      .prepare(
        `SELECT s.*, f.ism AS hodim, m.ism AS mijoz FROM sotuvlar s
         LEFT JOIN foydalanuvchilar f ON f.id = s.foydalanuvchi_id
         LEFT JOIN mijozlar m ON m.id = s.mijoz_id
         WHERE s.sana >= @dan AND s.sana <= @gacha
           ${filial_id ? 'AND s.filial_id = @filial_id' : ''}
           ${foydalanuvchi_id ? 'AND s.foydalanuvchi_id = @foydalanuvchi_id' : ''}
         ORDER BY s.id DESC`
      )
      .all(p);

    const qatorlar = db()
      .prepare(
        `SELECT q.* FROM sotuv_qatorlari q JOIN sotuvlar s ON s.id = q.sotuv_id
         WHERE s.sana >= @dan AND s.sana <= @gacha
           ${filial_id ? 'AND s.filial_id = @filial_id' : ''}
           ${foydalanuvchi_id ? 'AND s.foydalanuvchi_id = @foydalanuvchi_id' : ''}`
      )
      .all(p);

    const xarita = new Map();
    for (const q of qatorlar) {
      if (!xarita.has(q.sotuv_id)) xarita.set(q.sotuv_id, []);
      xarita.get(q.sotuv_id).push(q);
    }
    const foydaKoradi = u.rol === 'rahbar' || u.ruxsatlar.hisobot;
    for (const c of cheklar) {
      c.qatorlar = xarita.get(c.id) || [];
      if (!foydaKoradi) {
        delete c.tan_jami;
        for (const q of c.qatorlar) delete q.tan_narx;
      }
    }

    // shu kundagi tovarlar kesimi
    const tovarlar = db()
      .prepare(
        `SELECT q.nomi, SUM(q.miqdor) AS miqdor, SUM(q.summa) AS summa
         FROM sotuv_qatorlari q JOIN sotuvlar s ON s.id = q.sotuv_id
         WHERE s.sana >= @dan AND s.sana <= @gacha
           ${filial_id ? 'AND s.filial_id = @filial_id' : ''}
         GROUP BY q.nomi ORDER BY summa DESC`
      )
      .all(p);

    const jami = {
      chek_soni: cheklar.length,
      savdo: cheklar.reduce((s, c) => s + c.jami, 0),
      naqd: cheklar.reduce((s, c) => s + c.naqd, 0),
      karta: cheklar.reduce((s, c) => s + c.karta, 0),
      terminal: cheklar.reduce((s, c) => s + c.terminal, 0),
      qarz: cheklar.reduce((s, c) => s + c.qarz, 0),
      foyda: foydaKoradi ? cheklar.reduce((s, c) => s + (c.jami - (c.tan_jami || 0)), 0) : null,
    };

    return { sana: kun, cheklar, tovarlar, jami };
  },

  'sotuv.bitta'({ id }) {
    kirganmi();
    const sotuv = db()
      .prepare(
        `SELECT s.*, f.ism AS hodim, m.ism AS mijoz FROM sotuvlar s
         LEFT JOIN foydalanuvchilar f ON f.id = s.foydalanuvchi_id
         LEFT JOIN mijozlar m ON m.id = s.mijoz_id WHERE s.id = ?`
      )
      .get(id);
    const qatorlar = db().prepare('SELECT * FROM sotuv_qatorlari WHERE sotuv_id = ?').all(id);
    return { sotuv, qatorlar };
  },

  // Faqat rahbar: xato chekni bekor qilish (tovar omborga qaytadi)
  'sotuv.bekor'({ id, sabab = '' }) {
    const u = rahbar();
    const sotuv = db().prepare('SELECT * FROM sotuvlar WHERE id = ?').get(id);
    talab(sotuv, 'Chek topilmadi');
    db().transaction(() => {
      const qatorlar = db().prepare('SELECT * FROM sotuv_qatorlari WHERE sotuv_id = ?').all(id);
      const qOmbor = db().prepare(
        `INSERT INTO ombor (tovar_id, filial_id, qoldiq) VALUES (?,?,?)
         ON CONFLICT(tovar_id, filial_id) DO UPDATE SET qoldiq = qoldiq + excluded.qoldiq`
      );
      for (const q of qatorlar) if (q.tovar_id) qOmbor.run(q.tovar_id, sotuv.filial_id, q.miqdor);
      if (sotuv.mijoz_id) {
        // bu chekka yozilgan to'lovlar bekor bo'ladi - ular mijozning avansiga qaytadi
        const qaytgan =
          db().prepare('SELECT COALESCE(SUM(summa),0) AS s FROM qarz_taqsim WHERE sotuv_id = ?').get(id).s +
          (sotuv.avans_ishlatildi || 0);
        if (qaytgan > 0) {
          db().prepare('UPDATE mijozlar SET avans = avans + ? WHERE id = ?').run(qaytgan, sotuv.mijoz_id);
        }
        db().prepare('DELETE FROM qarz_taqsim WHERE sotuv_id = ?').run(id);
      }
      db().prepare('DELETE FROM sotuvlar WHERE id = ?').run(id);
      if (sotuv.mijoz_id) mijozQarziQayta(sotuv.mijoz_id);
    })();
    DB.jurnalYoz(u.id, 'sotuv_bekor', `chek=${sotuv.raqam} summa=${sotuv.jami} sabab=${sabab}`);
    TG.navbatQosh(
      `❌ <b>Chek bekor qilindi</b>\n\nChek №${sotuv.raqam}\nSumma: ${H.pul(sotuv.jami)} so'm\nBekor qildi: ${u.ism}${
        sabab ? '\nSabab: ' + sabab : ''
      }`
    );
    return true;
  },

  // ---------- KIRIM ----------
  'kirim.yarat'(data) {
    const u = ruxsat('kirim');
    const fid = data.filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;
    const qatorlar = (data.qatorlar || []).filter((q) => Number(q.miqdor) > 0 && q.tovar_id);
    talab(qatorlar.length, "Ro'yxat bo'sh");

    const natija = db().transaction(() => {
      const jami = qatorlar.reduce((s, q) => s + Number(q.miqdor) * Number(q.tan_narx), 0);
      const info = db()
        .prepare('INSERT INTO kirimlar (filial_id, foydalanuvchi_id, taminotchi, jami, izoh) VALUES (?,?,?,?,?)')
        .run(fid, u.id, data.taminotchi || '', jami, data.izoh || '');
      const kirimId = info.lastInsertRowid;

      const qQator = db().prepare(
        'INSERT INTO kirim_qatorlari (kirim_id, tovar_id, nomi, miqdor, tan_narx, summa) VALUES (?,?,?,?,?,?)'
      );
      const qOmbor = db().prepare(
        `INSERT INTO ombor (tovar_id, filial_id, qoldiq) VALUES (?,?,?)
         ON CONFLICT(tovar_id, filial_id) DO UPDATE SET qoldiq = qoldiq + excluded.qoldiq`
      );
      const tayyor = [];
      for (const q of qatorlar) {
        const t = db().prepare('SELECT * FROM tovarlar WHERE id = ?').get(q.tovar_id);
        const miqdor = Number(q.miqdor);
        const tanNarx = Number(q.tan_narx) || 0;

        // O'rtacha tan narxni qayta hisoblash
        const joriyQoldiq = Math.max(
          0,
          (db().prepare('SELECT qoldiq FROM ombor WHERE tovar_id=? AND filial_id=?').get(q.tovar_id, fid) || {
            qoldiq: 0,
          }).qoldiq
        );
        const yangiTan =
          joriyQoldiq + miqdor > 0
            ? (joriyQoldiq * (t.tan_narx || 0) + miqdor * tanNarx) / (joriyQoldiq + miqdor)
            : tanNarx;

        narxLogla(t, 'tan', t.tan_narx, yangiTan, `kirim: ${H.fmtMiqdor(miqdor)} dona × ${H.pul(tanNarx)}`);
        db()
          .prepare("UPDATE tovarlar SET tan_narx = ?, yangilangan = datetime('now','localtime') WHERE id = ?")
          .run(Math.round(yangiTan * 100) / 100, q.tovar_id);

        // yangi sotuv narxi ham berilgan bo'lsa
        if (q.sotuv_narx && Number(q.sotuv_narx) > 0 && Number(q.sotuv_narx) !== t.sotuv_narx) {
          narxLogla(t, 'sotuv', t.sotuv_narx, Number(q.sotuv_narx), 'kirim paytida');
          db().prepare('UPDATE tovarlar SET sotuv_narx = ? WHERE id = ?').run(Number(q.sotuv_narx), q.tovar_id);
        }

        qQator.run(kirimId, q.tovar_id, t.nomi, miqdor, tanNarx, miqdor * tanNarx);
        qOmbor.run(q.tovar_id, fid, miqdor);
        tayyor.push({ nomi: t.nomi, miqdor, tan_narx: tanNarx, summa: miqdor * tanNarx });
      }
      const kirim = db().prepare('SELECT * FROM kirimlar WHERE id = ?').get(kirimId);
      return { kirim, qatorlar: tayyor };
    })();

    if (DB.sozlama('telegram_kirim_yuborish', '1') === '1') {
      TG.navbatQosh(TG.kirimXabari(natija.kirim, natija.qatorlar, filialNomi(fid), u.ism));
    }
    return { id: natija.kirim.id, jami: natija.kirim.jami };
  },

  'kirim.royxat'({ dan, gacha, filial_id, limit = 100 } = {}) {
    kirganmi();
    return db()
      .prepare(
        `SELECT k.*, f.ism AS hodim FROM kirimlar k
         LEFT JOIN foydalanuvchilar f ON f.id = k.foydalanuvchi_id
         WHERE k.sana >= @dan AND k.sana <= @gacha ${filial_id ? 'AND k.filial_id = @filial_id' : ''}
         ORDER BY k.id DESC LIMIT @limit`
      )
      .all({
        dan: dan || '2000-01-01',
        gacha: (gacha || H.bugun()) + ' 23:59:59',
        filial_id: filial_id || null,
        limit,
      });
  },

  'kirim.bitta'({ id }) {
    kirganmi();
    return {
      kirim: db().prepare('SELECT * FROM kirimlar WHERE id = ?').get(id),
      qatorlar: db().prepare('SELECT * FROM kirim_qatorlari WHERE kirim_id = ?').all(id),
    };
  },

  // ---------- KASSA HISOBI ----------
  // Oxirgi hisobdan hozirgacha kassada qancha naqd bo'lishi kerakligini ko'rsatadi
  'kassa.holat'({ filial_id } = {}) {
    const u = ruxsat('sotuv');
    const fid = filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;
    const oxirgi = db()
      .prepare('SELECT * FROM kassa_hisob WHERE filial_id = ? ORDER BY id DESC LIMIT 1')
      .get(fid);
    const dan = oxirgi ? oxirgi.gacha : H.bugun() + ' 00:00:00';
    const gacha = H.hozir();

    const sotuv = db()
      .prepare(
        `SELECT COUNT(*) AS chek_soni, COALESCE(SUM(naqd),0) AS naqd,
                COALESCE(SUM(karta),0) AS karta, COALESCE(SUM(terminal),0) AS terminal,
                COALESCE(SUM(qarz),0) AS qarz, COALESCE(SUM(jami),0) AS jami
         FROM sotuvlar WHERE filial_id = ? AND sana > ? AND sana <= ?`
      )
      .get(fid, dan, gacha);
    const qarzTolov = db()
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN usul='naqd' THEN summa ELSE 0 END),0) AS naqd,
                COALESCE(SUM(summa),0) AS jami
         FROM qarz_tolovlar WHERE filial_id = ? AND sana > ? AND sana <= ?`
      )
      .get(fid, dan, gacha);

    return {
      dan,
      gacha,
      oxirgi_hisob: oxirgi ? { sana: oxirgi.sana, farq: oxirgi.farq, sanalgan: oxirgi.sanalgan } : null,
      chek_soni: sotuv.chek_soni,
      savdo: sotuv.jami,
      sotuv_naqd: sotuv.naqd,
      qarz_tolov_naqd: qarzTolov.naqd,
      kutilgan_naqd: sotuv.naqd + qarzTolov.naqd,
      karta: sotuv.karta,
      terminal: sotuv.terminal,
      qarz: sotuv.qarz,
    };
  },

  'kassa.yopish'({ filial_id, sanalgan, izoh = '' }) {
    const u = ruxsat('sotuv');
    const fid = filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;
    const holat = amallar['kassa.holat']({ filial_id: fid });
    const s = Number(sanalgan) || 0;
    const farq = s - holat.kutilgan_naqd;

    db()
      .prepare(
        `INSERT INTO kassa_hisob (filial_id, foydalanuvchi_id, dan, gacha, kutilgan, sanalgan, farq, chek_soni, izoh)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(fid, u.id, holat.dan, holat.gacha, holat.kutilgan_naqd, s, farq, holat.chek_soni, izoh);

    const belgi = Math.abs(farq) < 1 ? '✅' : farq > 0 ? '🟡' : '🔴';
    TG.navbatQosh(
      [
        `${belgi} <b>Kassa hisobi</b>`,
        '',
        `🏪 ${filialNomi(fid)}`,
        `👤 ${u.ism}`,
        `🕐 ${H.sanaChiroyli(holat.dan.slice(0, 10))} ${holat.dan.slice(11, 16)} — ${holat.gacha.slice(11, 16)}`,
        '',
        `🧾 Cheklar: ${holat.chek_soni} ta · Savdo: ${H.pul(holat.savdo)}`,
        '',
        `💵 Kassada bo'lishi kerak: <b>${H.pul(holat.kutilgan_naqd)}</b>`,
        `🔢 Sanab chiqildi: <b>${H.pul(s)}</b>`,
        `${belgi} Farq: <b>${farq > 0 ? '+' : ''}${H.pul(farq)} so'm</b>` +
          (Math.abs(farq) < 1 ? ' — to\'g\'ri' : farq > 0 ? ' — ortiqcha' : ' — kam'),
        izoh ? `\n📝 ${izoh}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
    DB.jurnalYoz(u.id, 'kassa_hisobi', `kutilgan=${holat.kutilgan_naqd} sanalgan=${s} farq=${farq}`);
    return { kutilgan: holat.kutilgan_naqd, sanalgan: s, farq };
  },

  'kassa.tarix'({ filial_id, limit = 50 } = {}) {
    kirganmi();
    return db()
      .prepare(
        `SELECT k.*, f.ism AS hodim FROM kassa_hisob k
         LEFT JOIN foydalanuvchilar f ON f.id = k.foydalanuvchi_id
         ${filial_id ? 'WHERE k.filial_id = @filial_id' : ''}
         ORDER BY k.id DESC LIMIT @limit`
      )
      .all({ filial_id: filial_id || null, limit });
  },

  // ---------- HISOBOTLAR ----------
  'hisobot.oraliq'({ dan, gacha, filial_id }) {
    ruxsat('hisobot');
    return H.oraliq(dan || H.bugun(), gacha || H.bugun(), filial_id || null);
  },

  'hisobot.panel'({ filial_id } = {}) {
    const u = kirganmi();
    const fid = filial_id || null;
    const bugun = H.kunlik(H.bugun(), fid);
    const rahbarmi = u.rol === 'rahbar' || u.ruxsatlar.hisobot;
    const natija = {
      bugun: {
        savdo: bugun.savdo,
        chek_soni: bugun.chek_soni,
        naqd: bugun.kassa_naqd,
        karta: bugun.kassa_karta,
        terminal: bugun.kassa_terminal,
        qarz: bugun.qarz,
        foyda: rahbarmi ? bugun.foyda : null,
      },
      top: bugun.top.slice(0, 5),
    };
    if (rahbarmi) {
      natija.hafta = H.haftalik(fid);
      natija.oy = H.oylik(fid);
      const qarzdorlar = H.qarzdorlar();
      natija.qarz_jami = qarzdorlar.reduce((s, r) => s + r.qarz, 0);
      natija.qarzdor_soni = qarzdorlar.length;
      const kam = H.qoldiqlar(fid || Number(DB.sozlama('joriy_filial', '1')), true);
      natija.kam_tovar = kam.slice(0, 20);
      const ombor = H.qoldiqlar(fid || Number(DB.sozlama('joriy_filial', '1')));
      natija.ombor_qiymati = ombor.reduce((s, r) => s + r.ombor_summa, 0);
    }
    return natija;
  },

  // Oxirgi N kunlik savdo/foyda - panel grafigi uchun
  'hisobot.grafik'({ kunlar = 30, filial_id } = {}) {
    ruxsat('hisobot');
    const dan = H.sanaQoshish(H.bugun(), -(kunlar - 1));
    const h = H.oraliq(dan, H.bugun(), filial_id || null);
    const xarita = new Map(h.kunlar.map((k) => [k.kun, k]));
    const natija = [];
    for (let i = 0; i < kunlar; i++) {
      const kun = H.sanaQoshish(dan, i);
      const k = xarita.get(kun);
      natija.push({ kun, savdo: k ? k.savdo : 0, foyda: k ? k.foyda : 0, chek: k ? k.chek : 0 });
    }
    return natija;
  },

  // Narx o'zgarishlari va muhim amallar jurnali
  'hisobot.narxTarix'({ dan, gacha, tovar_id, limit = 300 } = {}) {
    ruxsat('hisobot');
    return db()
      .prepare(
        `SELECT * FROM narx_tarix
         WHERE sana >= @dan AND sana <= @gacha ${tovar_id ? 'AND tovar_id = @tovar_id' : ''}
         ORDER BY id DESC LIMIT @limit`
      )
      .all({
        dan: dan || '2000-01-01',
        gacha: (gacha || H.bugun()) + ' 23:59:59',
        tovar_id: tovar_id || null,
        limit,
      });
  },

  'hisobot.jurnal'({ dan, gacha, limit = 300 } = {}) {
    rahbar();
    return db()
      .prepare(
        `SELECT j.*, f.ism FROM jurnal j LEFT JOIN foydalanuvchilar f ON f.id = j.foydalanuvchi_id
         WHERE j.sana >= @dan AND j.sana <= @gacha AND j.amal NOT IN ('kirish','chiqish')
         ORDER BY j.id DESC LIMIT @limit`
      )
      .all({ dan: dan || '2000-01-01', gacha: (gacha || H.bugun()) + ' 23:59:59', limit });
  },

  // Kategoriyalar kesimida savdo
  'hisobot.kategoriya'({ dan, gacha, filial_id } = {}) {
    ruxsat('hisobot');
    const p = {
      dan: dan || H.bugun(),
      gacha: (gacha || H.bugun()) + ' 23:59:59',
      filial_id: filial_id || null,
    };
    return db()
      .prepare(
        `SELECT COALESCE(k.nomi, 'Kategoriyasiz') AS kategoriya,
                COUNT(DISTINCT s.id) AS chek,
                SUM(q.miqdor) AS miqdor,
                SUM(q.summa) AS savdo,
                SUM(q.summa - q.tan_narx * q.miqdor) AS foyda
         FROM sotuv_qatorlari q
         JOIN sotuvlar s ON s.id = q.sotuv_id
         LEFT JOIN tovarlar t ON t.id = q.tovar_id
         LEFT JOIN kategoriyalar k ON k.id = t.kategoriya_id
         WHERE s.sana >= @dan AND s.sana <= @gacha ${filial_id ? 'AND s.filial_id = @filial_id' : ''}
         GROUP BY kategoriya ORDER BY savdo DESC`
      )
      .all(p);
  },

  // Har bir tovar bo'yicha tahlil: qancha sotildi, qancha foyda, oxirgi sotuv
  'hisobot.tovarTahlil'({ dan, gacha, filial_id } = {}) {
    ruxsat('hisobot');
    const d = dan || H.sanaQoshish(H.bugun(), -29);
    const g = (gacha || H.bugun()) + ' 23:59:59';
    const kunSoni = Math.max(1, Math.round((new Date(g) - new Date(d + ' 00:00:00')) / 86400000) + 1);
    const fid = filial_id || Number(DB.sozlama('joriy_filial', '1'));

    const rows = db()
      .prepare(
        `SELECT t.id, t.nomi, k.nomi AS kategoriya, t.sotuv_narx, t.tan_narx,
                COALESCE(o.qoldiq,0) AS qoldiq,
                COALESCE(x.miqdor,0) AS sotilgan,
                COALESCE(x.savdo,0) AS savdo,
                COALESCE(x.foyda,0) AS foyda,
                COALESCE(x.chek,0) AS chek,
                x.oxirgi
         FROM tovarlar t
         LEFT JOIN kategoriyalar k ON k.id = t.kategoriya_id
         LEFT JOIN ombor o ON o.tovar_id = t.id AND o.filial_id = @fid
         LEFT JOIN (
           SELECT q.tovar_id,
                  SUM(q.miqdor) AS miqdor,
                  SUM(q.summa) AS savdo,
                  SUM(q.summa - q.tan_narx * q.miqdor) AS foyda,
                  COUNT(DISTINCT q.sotuv_id) AS chek,
                  MAX(s.sana) AS oxirgi
           FROM sotuv_qatorlari q JOIN sotuvlar s ON s.id = q.sotuv_id
           WHERE s.sana >= @dan AND s.sana <= @gacha
                 ${filial_id ? 'AND s.filial_id = @fid' : ''}
           GROUP BY q.tovar_id
         ) x ON x.tovar_id = t.id
         WHERE t.aktiv = 1
         ORDER BY savdo DESC`
      )
      .all({ dan: d, gacha: g, fid });

    return rows.map((r) => ({
      ...r,
      kunlik_ortacha: Math.round((r.sotilgan / kunSoni) * 100) / 100,
      // shu tezlikda qoldiq necha kunga yetadi
      yetadi_kun: r.sotilgan > 0 ? Math.round(r.qoldiq / (r.sotilgan / kunSoni)) : null,
      kun_soni: kunSoni,
    }));
  },

  // Bitta tovarning kunlik / oylik dinamikasi
  'hisobot.tovarTarix'({ tovar_id, kunlar = 30, oylik = false, filial_id } = {}) {
    ruxsat('hisobot');
    const dan = oylik ? H.sanaQoshish(H.bugun(), -365) : H.sanaQoshish(H.bugun(), -(kunlar - 1));
    const guruh = oylik ? "substr(s.sana,1,7)" : 'substr(s.sana,1,10)';
    const rows = db()
      .prepare(
        `SELECT ${guruh} AS kun, SUM(q.miqdor) AS miqdor, SUM(q.summa) AS savdo,
                SUM(q.summa - q.tan_narx * q.miqdor) AS foyda, COUNT(DISTINCT s.id) AS chek
         FROM sotuv_qatorlari q JOIN sotuvlar s ON s.id = q.sotuv_id
         WHERE q.tovar_id = @tovar_id AND s.sana >= @dan
               ${filial_id ? 'AND s.filial_id = @filial_id' : ''}
         GROUP BY kun ORDER BY kun`
      )
      .all({ tovar_id, dan, filial_id: filial_id || null });

    if (oylik) return rows.map((r) => ({ ...r, savdo: r.savdo, kun: r.kun }));

    // bo'sh kunlarni ham to'ldiramiz (grafik uzilmasligi uchun)
    const xarita = new Map(rows.map((r) => [r.kun, r]));
    const natija = [];
    for (let i = 0; i < kunlar; i++) {
      const kun = H.sanaQoshish(dan, i);
      const r = xarita.get(kun);
      natija.push({ kun, miqdor: r ? r.miqdor : 0, savdo: r ? r.savdo : 0, foyda: r ? r.foyda : 0, chek: r ? r.chek : 0 });
    }
    return natija;
  },

  // Ta'minotchilar kesimi
  'hisobot.taminotchilar'({ dan, gacha, filial_id } = {}) {
    ruxsat('hisobot');
    const p = {
      dan: dan || '2000-01-01',
      gacha: (gacha || H.bugun()) + ' 23:59:59',
      filial_id: filial_id || null,
    };
    const royxat = db()
      .prepare(
        `SELECT CASE WHEN k.taminotchi = '' OR k.taminotchi IS NULL THEN 'Ko''rsatilmagan' ELSE k.taminotchi END AS taminotchi,
                COUNT(*) AS kirim_soni,
                SUM(k.jami) AS jami,
                MAX(k.sana) AS oxirgi
         FROM kirimlar k
         WHERE k.sana >= @dan AND k.sana <= @gacha ${filial_id ? 'AND k.filial_id = @filial_id' : ''}
         GROUP BY taminotchi ORDER BY jami DESC`
      )
      .all(p);

    for (const t of royxat) {
      t.tovarlar = db()
        .prepare(
          `SELECT kq.nomi, SUM(kq.miqdor) AS miqdor, SUM(kq.summa) AS summa,
                  AVG(kq.tan_narx) AS ortacha_narx
           FROM kirim_qatorlari kq JOIN kirimlar k ON k.id = kq.kirim_id
           WHERE k.sana >= @dan AND k.sana <= @gacha
                 AND (CASE WHEN k.taminotchi = '' OR k.taminotchi IS NULL THEN 'Ko''rsatilmagan' ELSE k.taminotchi END) = @nomi
                 ${filial_id ? 'AND k.filial_id = @filial_id' : ''}
           GROUP BY kq.nomi ORDER BY summa DESC`
        )
        .all({ ...p, nomi: t.taminotchi });
    }

    // shu davrda sotilgan tovarlarning tan narxi (ya'ni qancha tovar pulga aylandi)
    const sotilgan = db()
      .prepare(
        `SELECT COALESCE(SUM(s.tan_jami),0) AS tan, COALESCE(SUM(s.jami),0) AS savdo
         FROM sotuvlar s WHERE s.sana >= @dan AND s.sana <= @gacha
         ${filial_id ? 'AND s.filial_id = @filial_id' : ''}`
      )
      .get(p);

    return {
      royxat,
      jami_xarid: royxat.reduce((s, t) => s + t.jami, 0),
      sotilgan_tan: sotilgan.tan,
      savdo: sotilgan.savdo,
    };
  },

  'hisobot.qoldiq'({ filial_id, faqatKam = false }) {
    ruxsat('hisobot');
    return H.qoldiqlar(filial_id || Number(DB.sozlama('joriy_filial', '1')), faqatKam);
  },

  'hisobot.qarzdorlar'() {
    kirganmi();
    return H.qarzdorlar();
  },

  // ---------- SOZLAMALAR ----------
  'sozlama.hammasi'() {
    const s = DB.hammaSozlama();
    if (!joriy || joriy.rol !== 'rahbar') {
      // xodimga maxfiy ma'lumot ko'rsatilmaydi
      s.telegram_token = s.telegram_token ? '***' : '';
      s.telegram_chat_id = s.telegram_chat_id ? '***' : '';
    }
    return s;
  },

  'sozlama.saqla'(obj) {
    rahbar();
    for (const [k, v] of Object.entries(obj)) DB.sozlamaSaqla(k, v);
    return true;
  },

  // ---------- PRINTER ----------
  async 'printer.royxat'() {
    kirganmi();
    return Printer.printerlarRoyxati();
  },

  async 'printer.sinov'() {
    kirganmi();
    const namunaSotuv = {
      raqam: 'SINOV-001',
      sana: new Date().toISOString().slice(0, 19).replace('T', ' '),
      jami: 184000,
      naqd: 100000,
      karta: 0,
      terminal: 84000,
      qarz: 0,
    };
    const namunaQatorlar = [
      { nomi: 'Pepsi 1.5L', miqdor: 12, narx: 12000, summa: 144000, blok_soni: 6 },
      { nomi: "Qarshi suv gazsiz 1L", miqdor: 8, narx: 5000, summa: 40000, blok_soni: 0 },
    ];
    await Printer.chekChop(namunaSotuv, namunaQatorlar, { hodim: joriy.ism });
    return true;
  },

  // ---------- TELEGRAM ----------
  async 'telegram.sinov'() {
    rahbar();
    await TG.sinov();
    return true;
  },

  'telegram.holat'() {
    kirganmi();
    return TG.navbatHolati();
  },

  async 'telegram.chatIdTop'() {
    rahbar();
    // Bot bilan yozishgan oxirgi odamning chat_id sini topish
    const updates = await TG.apiChaqir('getUpdates', { timeout: 0 }, 15000);
    const chatlar = [];
    for (const u of updates) {
      const m = u.message;
      if (m && m.chat && !chatlar.find((c) => c.id === m.chat.id)) {
        chatlar.push({
          id: m.chat.id,
          ism: [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') || m.chat.title || '',
          username: m.chat.username || '',
        });
      }
    }
    return chatlar;
  },

  // ---------- BACKUP ----------
  async 'backup.yarat'({ telegramga = true } = {}) {
    rahbar();
    const yol = await Backup.backupYarat(telegramga);
    return yol;
  },

  'backup.royxat'() {
    rahbar();
    return Backup.backupRoyxati();
  },

  'backup.papkaOch'() {
    rahbar();
    shell.openPath(Backup.backupPapka());
    return true;
  },

  // ---------- DEMO VA TOZALASH (faqat rahbar) ----------
  'tizim.demoQosh'({ filial_id } = {}) {
    const u = rahbar();
    const fid = filial_id || (u.filiallar[0] && u.filiallar[0].id) || 1;

    // [nomi, kategoriya, blokdagi dona, sotuv narxi, foyda (sotuv - tan), qoldiq, shtrix-kod]
    const DEMO = [
      ['Pepsi 1.5L', 'Gazli ichimliklar', 6, 12000, 1000, 180, '4870204391234'],
      ['Pepsi 0.5L', 'Gazli ichimliklar', 12, 6000, 500, 240, '4870204391241'],
      ['Pepsi 0.33L bankali', 'Bankali ichimliklar', 24, 7000, 700, 288, '4870204391258'],
      ['Coca-Cola 2L', 'Gazli ichimliklar', 6, 18000, 1000, 120, '5449000000996'],
      ['Coca-Cola 1L', 'Gazli ichimliklar', 12, 11000, 800, 144, '5449000054227'],
      ['Coca-Cola 0.33L bankali', 'Bankali ichimliklar', 24, 7500, 700, 240, '5449000214911'],
      ['Fanta 2L', 'Gazli ichimliklar', 6, 17000, 1000, 96, '5449000011527'],
      ['Fanta 0.33L bankali', 'Bankali ichimliklar', 24, 7500, 700, 192, '5449000267412'],
      ['Sprite 1.5L', 'Gazli ichimliklar', 6, 13000, 900, 120, '5449000234567'],
      ['Qarshi suv gazli 1L', 'Gazli suv', 12, 5000, 500, 300, '4780015551234'],
      ['Qarshi suv gazsiz 1L', 'Gazsiz suv', 12, 5000, 500, 300, '4780015551241'],
      ['Hydrolife 5L', 'Gazsiz suv', 4, 14000, 1000, 80, ''],
      ['Nestle Pure Life 0.5L', 'Gazsiz suv', 24, 3500, 500, 480, ''],
      ['Toshkent suv 19L', 'Gazsiz suv', 1, 25000, 1000, 40, ''],
      ['Fusetea limon 1L', 'Sovuq choy', 12, 11000, 800, 144, ''],
      ['Fusetea shaftoli 1L', 'Sovuq choy', 12, 11000, 800, 144, ''],
      ['Red Bull 0.25L', 'Energetik', 24, 18000, 1000, 96, ''],
      ['Gorilla 0.45L', 'Energetik', 12, 15000, 1000, 72, ''],
      ['Dolce olma sharbati 1L', 'Sharbatlar', 12, 13000, 900, 96, ''],
      ['Dolce anor sharbati 1L', 'Sharbatlar', 12, 14000, 1000, 96, ''],
    ];

    const natija = db().transaction(() => {
      const katQoy = db().prepare('INSERT INTO kategoriyalar (nomi) VALUES (?)');
      const katTop = db().prepare('SELECT id FROM kategoriyalar WHERE lower(nomi) = lower(?)');
      const tovarBor = db().prepare('SELECT id FROM tovarlar WHERE lower(nomi) = lower(?)');
      const tovarQoy = db().prepare(
        `INSERT INTO tovarlar (nomi, barcode, kategoriya_id, blok_soni, sotuv_narx, tan_narx, min_qoldiq)
         VALUES (?,?,?,?,?,?,?)`
      );
      const omborQoy = db().prepare(
        `INSERT INTO ombor (tovar_id, filial_id, qoldiq) VALUES (?,?,?)
         ON CONFLICT(tovar_id, filial_id) DO UPDATE SET qoldiq = qoldiq + excluded.qoldiq`
      );
      let qoshildi = 0;
      const kirimQatorlari = [];
      for (const [nomi, kat, blok, narx, foyda, qoldiq, bc] of DEMO) {
        if (tovarBor.get(nomi)) continue;
        let k = katTop.get(kat);
        if (!k) k = { id: katQoy.run(kat).lastInsertRowid };
        const tan = narx - foyda;
        const id = tovarQoy.run(nomi, bc || null, k.id, blok, narx, tan, Math.max(6, blok)).lastInsertRowid;
        omborQoy.run(id, fid, qoldiq);
        kirimQatorlari.push({ tovar_id: id, nomi, miqdor: qoldiq, tan_narx: tan, summa: qoldiq * tan });
        qoshildi++;
      }

      // kirim hujjati sifatida ham yozib qo'yamiz (hisobotlar to'g'ri chiqishi uchun)
      if (kirimQatorlari.length) {
        const jami = kirimQatorlari.reduce((s, x) => s + x.summa, 0);
        const kid = db()
          .prepare('INSERT INTO kirimlar (filial_id, foydalanuvchi_id, taminotchi, jami, izoh) VALUES (?,?,?,?,?)')
          .run(fid, u.id, 'Demo baza', jami, 'Test uchun qo\'shilgan demo tovarlar').lastInsertRowid;
        const q = db().prepare(
          'INSERT INTO kirim_qatorlari (kirim_id, tovar_id, nomi, miqdor, tan_narx, summa) VALUES (?,?,?,?,?,?)'
        );
        for (const x of kirimQatorlari) q.run(kid, x.tovar_id, x.nomi, x.miqdor, x.tan_narx, x.summa);
      }

      // demo mijozlar
      const mijozBor = db().prepare('SELECT id FROM mijozlar WHERE lower(ism) = lower(?)');
      const mijozQoy = db().prepare('INSERT INTO mijozlar (ism, telefon, izoh) VALUES (?,?,?)');
      for (const [ism, tel, izoh] of [
        ["Alisher aka (Chorsu do'kon)", '+998 90 111 22 33', 'Doimiy mijoz'],
        ['Sardor kafe', '+998 91 222 33 44', ''],
        ['Nodira opa (magazin)', '+998 93 333 44 55', ''],
      ]) {
        if (!mijozBor.get(ism)) mijozQoy.run(ism, tel, izoh);
      }
      return qoshildi;
    })();

    DB.jurnalYoz(u.id, 'demo_qoshildi', `${natija} ta tovar`);
    return { qoshildi: natija };
  },

  // Sotuvlarni tozalaydi: tovarlar, narxlar va kirimlar joyida qoladi
  'tizim.sotuvlarniTozala'() {
    const u = rahbar();
    const natija = db().transaction(() => {
      const soni = db().prepare('SELECT COUNT(*) AS n FROM sotuvlar').get().n;
      db().prepare('DELETE FROM sotuv_qatorlari').run();
      db().prepare('DELETE FROM sotuvlar').run();
      db().prepare('DELETE FROM qarz_taqsim').run();
      db().prepare('DELETE FROM qarz_tolovlar').run();
      db().prepare('UPDATE mijozlar SET qarz = 0, avans = 0').run();
      db().prepare('DELETE FROM telegram_navbat WHERE holat = 0').run();
      // qoldiqni kirimlar bo'yicha qayta hisoblaymiz
      db().prepare('DELETE FROM ombor').run();
      db()
        .prepare(
          `INSERT INTO ombor (tovar_id, filial_id, qoldiq)
           SELECT kq.tovar_id, k.filial_id, SUM(kq.miqdor)
           FROM kirim_qatorlari kq JOIN kirimlar k ON k.id = kq.kirim_id
           GROUP BY kq.tovar_id, k.filial_id`
        )
        .run();
      return soni;
    })();
    DB.jurnalYoz(u.id, 'sotuvlar_tozalandi', `${natija} ta chek`);
    return { ochirildi: natija };
  },

  // Hamma ma'lumotni tozalaydi (haqiqiy ishni boshlashdan oldin)
  'tizim.hammasiniTozala'() {
    const u = rahbar();
    db().transaction(() => {
      for (const j of [
        'sotuv_qatorlari',
        'qarz_taqsim',
        'sotuvlar',
        'qarz_tolovlar',
        'kirim_qatorlari',
        'kirimlar',
        'ombor',
        'tovarlar',
        'mijozlar',
        'telegram_navbat',
        'jurnal',
      ]) {
        db().prepare(`DELETE FROM ${j}`).run();
      }
    })();
    DB.jurnalYoz(u.id, 'hammasi_tozalandi', '');
    return true;
  },

  // ---------- YANGILANISH ----------
  'yangilanish.holat'() {
    return Yangilanish.joriyHolat();
  },

  async 'yangilanish.tekshir'() {
    kirganmi();
    await Yangilanish.tekshir();
    return Yangilanish.joriyHolat();
  },

  'yangilanish.ornat'() {
    kirganmi();
    return Yangilanish.ornat();
  },

  // ---------- TIZIM ----------
  'tizim.malumot'() {
    return {
      versiya: app.getVersion(),
      baza_yoli: DB.malumotYoli(),
      hujjatlar: app.getPath('userData'),
    };
  },
};

function royxatgaOlish() {
  ipcMain.handle('amal', async (_e, nom, arg) => {
    try {
      const f = amallar[nom];
      if (!f) throw new Error("Noma'lum amal: " + nom);
      const natija = await f(arg || {});
      return { ok: true, natija };
    } catch (e) {
      console.error(`[${nom}]`, e);
      return { ok: false, xato: e.message || String(e) };
    }
  });
}

module.exports = { royxatgaOlish, amallar };
