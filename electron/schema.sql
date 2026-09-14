-- Shodiev POS - ma'lumotlar bazasi tuzilmasi
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============ FILIALLAR ============
CREATE TABLE IF NOT EXISTS filiallar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomi TEXT NOT NULL,
  manzil TEXT DEFAULT '',
  telefon TEXT DEFAULT '',
  aktiv INTEGER NOT NULL DEFAULT 1,
  yaratilgan TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============ FOYDALANUVCHILAR ============
-- rol: 'rahbar' | 'hodim'
-- ruxsatlar: JSON, masalan {"sotuv":1,"kirim":1,"mijozlar":1,"tovarlar":0,"hisobot":0}
CREATE TABLE IF NOT EXISTS foydalanuvchilar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE,
  parol_hash TEXT NOT NULL,
  ism TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'hodim',
  ruxsatlar TEXT NOT NULL DEFAULT '{}',
  aktiv INTEGER NOT NULL DEFAULT 1,
  yaratilgan TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS foydalanuvchi_filial (
  foydalanuvchi_id INTEGER NOT NULL REFERENCES foydalanuvchilar(id) ON DELETE CASCADE,
  filial_id INTEGER NOT NULL REFERENCES filiallar(id) ON DELETE CASCADE,
  PRIMARY KEY (foydalanuvchi_id, filial_id)
);

-- ============ TOVARLAR ============
CREATE TABLE IF NOT EXISTS kategoriyalar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomi TEXT NOT NULL UNIQUE
);

-- blok_soni: 1 blokdagi dona soni (tezkor kiritish uchun). Narx har doim DONA narxi.
-- tan_narx: o'rtacha tan narx (kirim qilinganda avtomatik qayta hisoblanadi)
CREATE TABLE IF NOT EXISTS tovarlar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomi TEXT NOT NULL,
  barcode TEXT,
  kategoriya_id INTEGER REFERENCES kategoriyalar(id) ON DELETE SET NULL,
  blok_soni INTEGER NOT NULL DEFAULT 0,
  sotuv_narx REAL NOT NULL DEFAULT 0,
  tan_narx REAL NOT NULL DEFAULT 0,
  min_qoldiq REAL NOT NULL DEFAULT 0,
  aktiv INTEGER NOT NULL DEFAULT 1,
  yaratilgan TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  yangilangan TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_tovar_barcode ON tovarlar(barcode);
CREATE INDEX IF NOT EXISTS idx_tovar_nomi ON tovarlar(nomi);

-- Qoldiq har bir filial uchun alohida
CREATE TABLE IF NOT EXISTS ombor (
  tovar_id INTEGER NOT NULL REFERENCES tovarlar(id) ON DELETE CASCADE,
  filial_id INTEGER NOT NULL REFERENCES filiallar(id) ON DELETE CASCADE,
  qoldiq REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (tovar_id, filial_id)
);

-- ============ MIJOZLAR VA QARZ ============
CREATE TABLE IF NOT EXISTS mijozlar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ism TEXT NOT NULL,
  telefon TEXT DEFAULT '',
  izoh TEXT DEFAULT '',
  qarz REAL NOT NULL DEFAULT 0,
  aktiv INTEGER NOT NULL DEFAULT 1,
  yaratilgan TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_mijoz_ism ON mijozlar(ism);

-- ============ SOTUV ============
CREATE TABLE IF NOT EXISTS sotuvlar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raqam TEXT NOT NULL,
  filial_id INTEGER NOT NULL REFERENCES filiallar(id),
  foydalanuvchi_id INTEGER NOT NULL REFERENCES foydalanuvchilar(id),
  mijoz_id INTEGER REFERENCES mijozlar(id) ON DELETE SET NULL,
  sana TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  jami REAL NOT NULL DEFAULT 0,
  tan_jami REAL NOT NULL DEFAULT 0,
  naqd REAL NOT NULL DEFAULT 0,
  karta REAL NOT NULL DEFAULT 0,
  terminal REAL NOT NULL DEFAULT 0,
  qarz REAL NOT NULL DEFAULT 0,
  izoh TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sotuv_sana ON sotuvlar(sana);
CREATE INDEX IF NOT EXISTS idx_sotuv_filial ON sotuvlar(filial_id);
CREATE INDEX IF NOT EXISTS idx_sotuv_mijoz ON sotuvlar(mijoz_id);

CREATE TABLE IF NOT EXISTS sotuv_qatorlari (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sotuv_id INTEGER NOT NULL REFERENCES sotuvlar(id) ON DELETE CASCADE,
  tovar_id INTEGER REFERENCES tovarlar(id) ON DELETE SET NULL,
  nomi TEXT NOT NULL,
  miqdor REAL NOT NULL,
  narx REAL NOT NULL,
  tan_narx REAL NOT NULL DEFAULT 0,
  summa REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qator_sotuv ON sotuv_qatorlari(sotuv_id);
CREATE INDEX IF NOT EXISTS idx_qator_tovar ON sotuv_qatorlari(tovar_id);

-- ============ KIRIM (tovar qabul qilish) ============
CREATE TABLE IF NOT EXISTS kirimlar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filial_id INTEGER NOT NULL REFERENCES filiallar(id),
  foydalanuvchi_id INTEGER NOT NULL REFERENCES foydalanuvchilar(id),
  taminotchi TEXT DEFAULT '',
  sana TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  jami REAL NOT NULL DEFAULT 0,
  izoh TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_kirim_sana ON kirimlar(sana);

CREATE TABLE IF NOT EXISTS kirim_qatorlari (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kirim_id INTEGER NOT NULL REFERENCES kirimlar(id) ON DELETE CASCADE,
  tovar_id INTEGER NOT NULL REFERENCES tovarlar(id) ON DELETE CASCADE,
  nomi TEXT NOT NULL,
  miqdor REAL NOT NULL,
  tan_narx REAL NOT NULL,
  summa REAL NOT NULL
);

-- ============ QARZ TO'LOVLARI ============
CREATE TABLE IF NOT EXISTS qarz_tolovlar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mijoz_id INTEGER NOT NULL REFERENCES mijozlar(id) ON DELETE CASCADE,
  filial_id INTEGER NOT NULL REFERENCES filiallar(id),
  foydalanuvchi_id INTEGER NOT NULL REFERENCES foydalanuvchilar(id),
  summa REAL NOT NULL,
  usul TEXT NOT NULL DEFAULT 'naqd',
  sana TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  izoh TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_qarz_mijoz ON qarz_tolovlar(mijoz_id);
CREATE INDEX IF NOT EXISTS idx_qarz_sana ON qarz_tolovlar(sana);

-- ============ TELEGRAM NAVBATI (offline uchun) ============
-- holat: 0 = yuborilmagan, 1 = yuborilgan, 2 = xato (urinishlar tugadi)
CREATE TABLE IF NOT EXISTS telegram_navbat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tur TEXT NOT NULL DEFAULT 'matn',
  matn TEXT NOT NULL DEFAULT '',
  fayl TEXT,
  holat INTEGER NOT NULL DEFAULT 0,
  urinish INTEGER NOT NULL DEFAULT 0,
  xato TEXT DEFAULT '',
  yaratilgan TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  yuborilgan TEXT
);
CREATE INDEX IF NOT EXISTS idx_navbat_holat ON telegram_navbat(holat);

-- ============ SOZLAMALAR ============
CREATE TABLE IF NOT EXISTS sozlamalar (
  kalit TEXT PRIMARY KEY,
  qiymat TEXT NOT NULL DEFAULT ''
);

-- ============ HARAKATLAR JURNALI ============
CREATE TABLE IF NOT EXISTS jurnal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  foydalanuvchi_id INTEGER,
  amal TEXT NOT NULL,
  tafsilot TEXT DEFAULT '',
  sana TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============ KASSA HISOBI (kun yakuni / istalgan payt) ============
CREATE TABLE IF NOT EXISTS kassa_hisob (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filial_id INTEGER NOT NULL REFERENCES filiallar(id),
  foydalanuvchi_id INTEGER NOT NULL REFERENCES foydalanuvchilar(id),
  dan TEXT NOT NULL,
  gacha TEXT NOT NULL,
  kutilgan REAL NOT NULL DEFAULT 0,
  sanalgan REAL NOT NULL DEFAULT 0,
  farq REAL NOT NULL DEFAULT 0,
  chek_soni INTEGER NOT NULL DEFAULT 0,
  izoh TEXT DEFAULT '',
  sana TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_kassa_sana ON kassa_hisob(sana);

-- ============ NARX O'ZGARISHLARI TARIXI ============
-- tur: 'sotuv' | 'tan'
CREATE TABLE IF NOT EXISTS narx_tarix (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tovar_id INTEGER NOT NULL REFERENCES tovarlar(id) ON DELETE CASCADE,
  nomi TEXT NOT NULL,
  tur TEXT NOT NULL DEFAULT 'sotuv',
  eski REAL NOT NULL DEFAULT 0,
  yangi REAL NOT NULL DEFAULT 0,
  sabab TEXT DEFAULT '',
  foydalanuvchi_id INTEGER,
  ism TEXT DEFAULT '',
  sana TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_narx_sana ON narx_tarix(sana);
CREATE INDEX IF NOT EXISTS idx_narx_tovar ON narx_tarix(tovar_id);

-- ============ QARZ TAQSIMOTI ============
-- Har bir to'lov qaysi chekka qancha yozilganini saqlaydi (aniq hisob-kitob uchun)
CREATE TABLE IF NOT EXISTS qarz_taqsim (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tolov_id INTEGER NOT NULL REFERENCES qarz_tolovlar(id) ON DELETE CASCADE,
  sotuv_id INTEGER NOT NULL REFERENCES sotuvlar(id) ON DELETE CASCADE,
  summa REAL NOT NULL,
  sana TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_taqsim_sotuv ON qarz_taqsim(sotuv_id);
CREATE INDEX IF NOT EXISTS idx_taqsim_tolov ON qarz_taqsim(tolov_id);
