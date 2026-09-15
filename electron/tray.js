// Dastur oynasi yopilganda ham fon rejimida ishlashda davom etadi:
// Telegram bot javob beradi, xabarlar yuboriladi, zaxira nusxa olinadi.
const { app, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const { sozlama, sozlamaSaqla } = require('./db');
const TG = require('./telegram');
const H = require('./hisobot');

let tray = null;
let oynaOch = null;
let haqiqiyChiqish = false;

function ikonka() {
  const yol = path.join(__dirname, '..', 'assets', 'icon.png');
  const rasm = nativeImage.createFromPath(yol);
  return rasm.isEmpty() ? undefined : rasm.resize({ width: 16, height: 16 });
}

function menyuYangila() {
  if (!tray) return;
  let holat = 'Telegram sozlanmagan';
  try {
    const n = TG.navbatHolati();
    holat = !n.sozlangan
      ? 'Telegram: sozlanmagan'
      : n.kutmoqda > 0
      ? `Telegram: ${n.kutmoqda} ta xabar navbatda`
      : `Telegram: ulangan (${n.chatlar} ta chat)`;
  } catch {}

  let bugun = '';
  try {
    const h = H.kunlik();
    bugun = `Bugun: ${H.pul(h.savdo)} so'm · ${h.chek_soni} ta chek`;
  } catch {}

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Shodiev POS', enabled: false },
      { type: 'separator' },
      { label: bugun || 'Ma\'lumot yuklanmoqda...', enabled: false },
      { label: holat, enabled: false },
      { type: 'separator' },
      { label: 'Dasturni ochish', click: () => oynaOch && oynaOch() },
      {
        label: 'Fon rejimini yoqish',
        type: 'checkbox',
        checked: sozlama('fon_rejimi', '1') === '1',
        click: (m) => {
          sozlamaSaqla('fon_rejimi', m.checked ? '1' : '0');
          menyuYangila();
        },
      },
      {
        label: 'Kompyuter yoqilganda avtomatik ishga tushsin',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (m) => avtoIshgaTushirish(m.checked),
      },
      { type: 'separator' },
      {
        label: 'Butunlay chiqish',
        click: () => {
          haqiqiyChiqish = true;
          app.quit();
        },
      },
    ])
  );
  tray.setToolTip(`Shodiev POS${bugun ? ' — ' + bugun : ''}`);
}

function avtoIshgaTushirish(yoqilsinmi) {
  app.setLoginItemSettings({
    openAtLogin: yoqilsinmi,
    // fon rejimida ochilsin - oyna chiqmaydi
    args: yoqilsinmi ? ['--fon'] : [],
  });
  sozlamaSaqla('avto_ishga_tushish', yoqilsinmi ? '1' : '0');
  menyuYangila();
}

function ishgaTushir(oynaniOchishFunksiyasi) {
  oynaOch = oynaniOchishFunksiyasi;
  if (tray) return tray;
  try {
    tray = new Tray(ikonka());
    menyuYangila();
    tray.on('double-click', () => oynaOch && oynaOch());
    setInterval(menyuYangila, 60000);
  } catch (e) {
    console.error('tray xato:', e.message);
  }
  return tray;
}

// Oyna yopilganda: fon rejimi yoqilgan bo'lsa yashiramiz
function yopishniUshla(oyna) {
  oyna.on('close', (e) => {
    if (haqiqiyChiqish || sozlama('fon_rejimi', '1') !== '1') return;
    e.preventDefault();
    oyna.hide();
    if (sozlama('fon_ogohlantirildi', '') !== '1') {
      sozlamaSaqla('fon_ogohlantirildi', '1');
      try {
        new Notification({
          title: 'Shodiev POS fon rejimida',
          body:
            'Dastur soat yonidagi belgida ishlashda davom etmoqda. ' +
            'Telegram bot javob beradi va savdo xabarlari yuboriladi.\n' +
            'Butunlay yopish: belgini o\'ng tugma bilan bosing → «Butunlay chiqish».',
        }).show();
      } catch {}
    }
    menyuYangila();
  });
}

function chiqishBelgisi() {
  return haqiqiyChiqish;
}

function chiqishniBelgila() {
  haqiqiyChiqish = true;
}

module.exports = { ishgaTushir, yopishniUshla, menyuYangila, avtoIshgaTushirish, chiqishBelgisi, chiqishniBelgila };
