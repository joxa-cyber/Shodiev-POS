const { app, BrowserWindow, Menu, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const DB = require('./db');
const IPC = require('./ipc');
const TG = require('./telegram');
const Backup = require('./backup');
const Yangilanish = require('./yangilanish');
const TrayModul = require('./tray');

const DEV = !app.isPackaged;
let asosiyOyna = null;

// Bitta nusxa ishlasin (ikki marta ochilmasin)
const qulf = app.requestSingleInstanceLock();
if (!qulf) {
  app.quit();
} else {
  app.on('second-instance', () => {
    oynaniKorsat();
  });
}

// Oynani ko'rsatish (traydan yoki ikkinchi nusxa ochilganda)
function oynaniKorsat() {
  if (!asosiyOyna) {
    oynaYarat();
    asosiyOyna.once('ready-to-show', () => {
      asosiyOyna.maximize();
      asosiyOyna.show();
    });
    return;
  }
  if (!asosiyOyna.isVisible()) asosiyOyna.show();
  if (asosiyOyna.isMinimized()) asosiyOyna.restore();
  asosiyOyna.focus();
}

function oynaYarat() {
  asosiyOyna = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    show: false,
    backgroundColor: '#0f172a',
    title: 'Shodiev POS',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  Menu.setApplicationMenu(null);

  if (DEV) {
    asosiyOyna.loadURL('http://localhost:5180');
  } else {
    asosiyOyna.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  const fondaOchildi = process.argv.includes('--fon');
  asosiyOyna.once('ready-to-show', () => {
    if (fondaOchildi) return; // kompyuter yoqilganda jimgina fonda turadi
    asosiyOyna.maximize();
    asosiyOyna.show();
  });

  TrayModul.yopishniUshla(asosiyOyna);

  asosiyOyna.on('closed', () => {
    asosiyOyna = null;
  });
}

app.whenReady().then(() => {
  DB.ochish();
  IPC.royxatgaOlish();
  TG.ishgaTushir();
  Backup.avtoBackupIshgaTushir();
  oynaYarat();
  TrayModul.ishgaTushir(oynaniKorsat);
  Yangilanish.ishgaTushir(asosiyOyna);

  // F12 - dasturchi paneli (muammo bo'lganda tekshirish uchun)
  globalShortcut.register('F12', () => {
    if (asosiyOyna) asosiyOyna.webContents.toggleDevTools();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) oynaYarat();
  });
});

// Oyna yopilganda dastur fon rejimida qolishi mumkin (Telegram bot ishlashi uchun)
app.on('window-all-closed', async () => {
  if (DB.sozlama('fon_rejimi', '1') === '1' && !TrayModul.chiqishBelgisi()) {
    return; // trayda ishlashda davom etamiz
  }
  try {
    await TG.navbatniYubor();
  } catch {}
  TG.toxtat();
  app.quit();
});

app.on('before-quit', () => {
  TrayModul.chiqishniBelgila();
});

process.on('uncaughtException', (e) => {
  console.error('KUTILMAGAN XATO:', e);
});
