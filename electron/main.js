const { app, BrowserWindow, Menu, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const DB = require('./db');
const IPC = require('./ipc');
const TG = require('./telegram');
const Backup = require('./backup');
const Yangilanish = require('./yangilanish');

const DEV = !app.isPackaged;
let asosiyOyna = null;

// Bitta nusxa ishlasin (ikki marta ochilmasin)
const qulf = app.requestSingleInstanceLock();
if (!qulf) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (asosiyOyna) {
      if (asosiyOyna.isMinimized()) asosiyOyna.restore();
      asosiyOyna.focus();
    }
  });
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

  asosiyOyna.once('ready-to-show', () => {
    asosiyOyna.maximize();
    asosiyOyna.show();
  });

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
  Yangilanish.ishgaTushir(asosiyOyna);

  // F12 - dasturchi paneli (muammo bo'lganda tekshirish uchun)
  globalShortcut.register('F12', () => {
    if (asosiyOyna) asosiyOyna.webContents.toggleDevTools();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) oynaYarat();
  });
});

app.on('window-all-closed', async () => {
  try {
    // yopishdan oldin oxirgi zaxira va navbatni yuborishga urinamiz
    await TG.navbatniYubor();
  } catch {}
  TG.toxtat();
  app.quit();
});

process.on('uncaughtException', (e) => {
  console.error('KUTILMAGAN XATO:', e);
});
