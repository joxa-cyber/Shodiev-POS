// Avtomatik yangilanish: yangi versiya chiqsa dastur o'zi yuklab oladi
// va foydalanuvchi qulay paytda "Yangilash" tugmasini bosadi.
const { app, dialog } = require('electron');

let autoUpdater = null;
let holat = { tekshirilmoqda: false, yangi: null, yuklandi: false, foiz: 0, xato: null };
let oyna = null;

function xabarYubor() {
  if (oyna && !oyna.isDestroyed()) {
    oyna.webContents.send('yangilanish', holat);
  }
}

function ishgaTushir(asosiyOyna) {
  oyna = asosiyOyna;
  if (!app.isPackaged) return; // faqat o'rnatilgan dasturda ishlaydi

  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    holat = { ...holat, tekshirilmoqda: true, xato: null };
    xabarYubor();
  });
  autoUpdater.on('update-available', (info) => {
    holat = { ...holat, tekshirilmoqda: false, yangi: info.version, yuklandi: false, foiz: 0 };
    xabarYubor();
  });
  autoUpdater.on('update-not-available', () => {
    holat = { ...holat, tekshirilmoqda: false, yangi: null };
    xabarYubor();
  });
  autoUpdater.on('download-progress', (p) => {
    holat = { ...holat, foiz: Math.round(p.percent) };
    xabarYubor();
  });
  autoUpdater.on('update-downloaded', (info) => {
    holat = { ...holat, yuklandi: true, yangi: info.version, foiz: 100 };
    xabarYubor();
  });
  autoUpdater.on('error', (e) => {
    holat = { ...holat, tekshirilmoqda: false, xato: String(e && e.message ? e.message : e) };
    xabarYubor();
  });

  // dastur ochilgandan 30 soniya keyin va har 4 soatda tekshiradi
  setTimeout(tekshir, 30000);
  setInterval(tekshir, 4 * 60 * 60 * 1000);
}

function tekshir() {
  if (!autoUpdater) return Promise.resolve(holat);
  return autoUpdater.checkForUpdates().catch((e) => {
    holat = { ...holat, tekshirilmoqda: false, xato: String(e.message || e) };
    xabarYubor();
  });
}

function ornat() {
  if (!autoUpdater || !holat.yuklandi) return false;
  // savdo yarim qolmasligi uchun foydalanuvchi o'zi bosadi
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
}

function joriyHolat() {
  return { ...holat, versiya: app.getVersion(), paketlangan: app.isPackaged };
}

module.exports = { ishgaTushir, tekshir, ornat, joriyHolat };
