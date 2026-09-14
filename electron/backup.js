// Zaxira nusxa: lokal papkaga + Telegramga (rahbarning botiga fayl sifatida)
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { baza, sozlama, sozlamaSaqla } = require('./db');
const TG = require('./telegram');
const H = require('./hisobot');

function backupPapka() {
  const dir = path.join(app.getPath('userData'), 'backup');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function faylNomi() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `pos-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}.db`;
}

// Baza ishlab turganda ham xavfsiz nusxa oladi (SQLite backup API)
async function nusxaOl(maqsadYol) {
  await baza().backup(maqsadYol);
  return maqsadYol;
}

function eskilarniTozala() {
  const saqlash = Number(sozlama('backup_kunlar', '14')) || 14;
  const dir = backupPapka();
  const fayllar = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  const chegara = Date.now() - saqlash * 24 * 60 * 60 * 1000;
  for (const x of fayllar.slice(3)) {
    if (x.t < chegara) {
      try {
        fs.unlinkSync(path.join(dir, x.f));
      } catch {}
    }
  }
}

async function backupYarat(telegramgaYuborilsinmi = null) {
  const yol = path.join(backupPapka(), faylNomi());
  await nusxaOl(yol);
  eskilarniTozala();

  const tgKerak =
    telegramgaYuborilsinmi === null ? sozlama('backup_telegram', '1') === '1' : telegramgaYuborilsinmi;
  if (tgKerak && TG.sozlanganmi()) {
    const h = H.kunlik();
    const izoh = `💾 Zaxira nusxa · ${H.sanaChiroyli(H.bugun())}\nSavdo: ${H.pul(h.savdo)} so'm · Foyda: ${H.pul(
      h.foyda
    )} so'm`;
    TG.navbatQosh(izoh, 'fayl', yol);
  }
  sozlamaSaqla('oxirgi_backup', new Date().toISOString());
  return yol;
}

// Kuniga bir marta avtomatik zaxira (dastur ochiq bo'lsa)
let timer = null;
function avtoBackupIshgaTushir() {
  if (timer) return;
  const tekshir = async () => {
    try {
      const oxirgi = sozlama('oxirgi_backup', '');
      const kunOtdi = !oxirgi || Date.now() - new Date(oxirgi).getTime() > 20 * 60 * 60 * 1000;
      if (kunOtdi) await backupYarat();
    } catch (e) {
      console.error('backup xato:', e.message);
    }
  };
  setTimeout(tekshir, 60 * 1000); // dastur ochilgandan 1 daqiqa keyin
  timer = setInterval(tekshir, 60 * 60 * 1000); // keyin soatiga bir tekshiradi
}

function backupRoyxati() {
  const dir = backupPapka();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const st = fs.statSync(path.join(dir, f));
      const d = new Date(st.mtimeMs);
      const p2 = (x) => String(x).padStart(2, '0');
      const sana = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(
        d.getMinutes()
      )}`;
      return { nomi: f, yol: path.join(dir, f), hajm: st.size, sana };
    })
    .sort((a, b) => (a.sana < b.sana ? 1 : -1));
}

module.exports = { backupYarat, backupPapka, backupRoyxati, avtoBackupIshgaTushir };
