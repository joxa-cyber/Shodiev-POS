const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');
const Database = require('better-sqlite3');

let db = null;

function malumotYoli() {
  // Baza foydalanuvchi papkasida saqlanadi: C:\Users\<user>\AppData\Roaming\Shodiev POS\
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'shodiev-pos.db');
}

function parolHash(parol) {
  const tuz = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(parol, tuz, 32).toString('hex');
  return `${tuz}:${hash}`;
}

function parolTekshir(parol, saqlangan) {
  try {
    const [tuz, hash] = String(saqlangan).split(':');
    if (!tuz || !hash) return false;
    const urinish = crypto.scryptSync(parol, tuz, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(urinish, 'hex'));
  } catch {
    return false;
  }
}

function ochish() {
  if (db) return db;
  const yol = malumotYoli();
  db = new Database(yol);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL'); // svet o'chsa ham tugallangan yozuv yo'qolmaydi
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  migratsiya();
  boshlangichMalumot();
  return db;
}

// Yangi versiyalarda qo'shilgan ustunlarni eski bazaga ham qo'shadi
function migratsiya() {
  const yangiUstunlar = [
    ['tovarlar', 'ogoh_sana', "TEXT DEFAULT ''"], // tugash haqida oxirgi ogohlantirish sanasi
    ['sotuvlar', 'qarz_qoldiq', 'REAL NOT NULL DEFAULT 0'], // shu chekdan qancha qarz qolgan
    ['mijozlar', 'avans', 'REAL NOT NULL DEFAULT 0'], // ortiqcha to'langan pul
    ['sotuvlar', 'avans_ishlatildi', 'REAL NOT NULL DEFAULT 0'], // shu chekda ishlatilgan avans
    ['telegram_navbat', 'chat_id', "TEXT DEFAULT ''"], // xabar qaysi chatga ketadi
    // to'lov farqi: manfiy = qo'shib yuborildi, musbat = qaytim olinmadi
    ['sotuvlar', 'yaxlitlash', 'REAL NOT NULL DEFAULT 0'],
  ];
  // Eski yagona shtrix-kodlarni yangi jadvalga ko'chiramiz (bir marta)
  try {
    const bor = db.prepare('SELECT COUNT(*) AS n FROM tovar_barcode').get().n;
    if (bor === 0) {
      const kochirildi = db
        .prepare(
          `INSERT OR IGNORE INTO tovar_barcode (tovar_id, kod)
           SELECT id, TRIM(barcode) FROM tovarlar
           WHERE barcode IS NOT NULL AND TRIM(barcode) <> ''`
        )
        .run();
      if (kochirildi.changes) console.log(`migratsiya: ${kochirildi.changes} ta shtrix-kod ko'chirildi`);
    }
  } catch {}

  for (const [jadval, ustun, tur] of yangiUstunlar) {
    const bor = db.prepare(`PRAGMA table_info(${jadval})`).all().some((c) => c.name === ustun);
    if (!bor) {
      db.exec(`ALTER TABLE ${jadval} ADD COLUMN ${ustun} ${tur}`);
      console.log(`migratsiya: ${jadval}.${ustun} qo'shildi`);
      // eski qarzli cheklar uchun qoldiqni to'ldiramiz
      if (jadval === 'sotuvlar' && ustun === 'qarz_qoldiq') {
        db.exec('UPDATE sotuvlar SET qarz_qoldiq = qarz WHERE qarz > 0');
      }
    }
  }
}

const STANDART_SOZLAMALAR = {
  dokon_nomi: 'SHODIEV OPTOM MARKET',
  dokon_manzil: "9-aylanma yo'li, mo'ljal: Pushkin maktab yoni",
  dokon_telefon: '+998 90 023 26 26',
  chek_pastki_matn: 'Xaridingiz uchun rahmat!',
  chek_logo: '',
  printer_nomi: '',
  chek_eni: '80',
  avto_chop: '1',
  telegram_token: '',
  telegram_chat_id: '',
  telegram_kassa_yuborish: '1',
  telegram_qarz_yuborish: '1',
  telegram_tugash_yuborish: '1',
  telegram_bot_sozlandi: '',
  telegram_chek_yuborish: '1',
  telegram_kirim_yuborish: '1',
  telegram_kunlik_hisobot: '1',
  telegram_hisobot_vaqti: '21:00',
  backup_telegram: '1',
  backup_kunlar: '14',
  joriy_filial: '1',
  fon_rejimi: '1',
  avto_ishga_tushish: '0',
};

function boshlangichMalumot() {
  const sozlamaQoy = db.prepare(
    'INSERT INTO sozlamalar (kalit, qiymat) VALUES (?, ?) ON CONFLICT(kalit) DO NOTHING'
  );
  for (const [k, v] of Object.entries(STANDART_SOZLAMALAR)) sozlamaQoy.run(k, v);

  const filialSoni = db.prepare('SELECT COUNT(*) AS n FROM filiallar').get().n;
  if (filialSoni === 0) {
    db.prepare('INSERT INTO filiallar (id, nomi, manzil, telefon) VALUES (1, ?, ?, ?)').run(
      'Asosiy filial',
      STANDART_SOZLAMALAR.dokon_manzil,
      STANDART_SOZLAMALAR.dokon_telefon
    );
  }

  // standart kategoriyalar
  const katSoni = db.prepare('SELECT COUNT(*) AS n FROM kategoriyalar').get().n;
  if (katSoni === 0) {
    const q = db.prepare('INSERT INTO kategoriyalar (nomi) VALUES (?)');
    for (const k of [
      'Gazli ichimliklar',
      'Gazsiz suv',
      'Gazli suv',
      'Bankali ichimliklar',
      'Energetik',
      'Sharbatlar',
      'Sovuq choy',
      'Boshqa',
    ]) {
      q.run(k);
    }
  }

  const userSoni = db.prepare('SELECT COUNT(*) AS n FROM foydalanuvchilar').get().n;
  if (userSoni === 0) {
    const info = db
      .prepare(
        `INSERT INTO foydalanuvchilar (login, parol_hash, ism, rol, ruxsatlar)
         VALUES (?, ?, ?, 'rahbar', ?)`
      )
      .run('rahbar', parolHash('1234'), 'Rahbar', JSON.stringify(TOLIQ_RUXSAT));
    db.prepare('INSERT INTO foydalanuvchi_filial (foydalanuvchi_id, filial_id) VALUES (?, 1)').run(
      info.lastInsertRowid
    );
  }
}

const TOLIQ_RUXSAT = {
  sotuv: 1,
  kirim: 1,
  tovarlar: 1,
  mijozlar: 1,
  qarz: 1,
  hisobot: 1,
  foydalanuvchilar: 1,
  sozlamalar: 1,
  tan_narx: 1,
};

function baza() {
  if (!db) ochish();
  return db;
}

// --- sozlamalar yordamchilari ---
function sozlama(kalit, standart = '') {
  const r = baza().prepare('SELECT qiymat FROM sozlamalar WHERE kalit = ?').get(kalit);
  return r ? r.qiymat : standart;
}

function sozlamaSaqla(kalit, qiymat) {
  baza()
    .prepare(
      'INSERT INTO sozlamalar (kalit, qiymat) VALUES (?, ?) ON CONFLICT(kalit) DO UPDATE SET qiymat = excluded.qiymat'
    )
    .run(kalit, String(qiymat ?? ''));
}

function hammaSozlama() {
  const rows = baza().prepare('SELECT kalit, qiymat FROM sozlamalar').all();
  const obj = { ...STANDART_SOZLAMALAR };
  for (const r of rows) obj[r.kalit] = r.qiymat;
  return obj;
}

function jurnalYoz(foydalanuvchi_id, amal, tafsilot = '') {
  try {
    baza()
      .prepare('INSERT INTO jurnal (foydalanuvchi_id, amal, tafsilot) VALUES (?, ?, ?)')
      .run(foydalanuvchi_id || null, amal, tafsilot);
  } catch (e) {
    console.error('jurnal xato:', e.message);
  }
}

module.exports = {
  ochish,
  baza,
  malumotYoli,
  parolHash,
  parolTekshir,
  sozlama,
  sozlamaSaqla,
  hammaSozlama,
  jurnalYoz,
  TOLIQ_RUXSAT,
};
