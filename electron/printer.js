// Chek chop etish - Windows drayveri orqali (XP-80T va boshqa termal printerlar)
// HTML sifatida chop etamiz, shuning uchun o'zbek harflari (o', g') to'g'ri chiqadi.
const { BrowserWindow } = require('electron');
const { sozlama } = require('./db');
const H = require('./hisobot');
const STANDART_LOGO = require('./logo');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function chekHtml(sotuv, qatorlar, qosh = {}) {
  const eni = Number(sozlama('chek_eni', '80')) === 58 ? 48 : 72; // mm (chop maydoni)
  const logo = sozlama('chek_logo', '') || STANDART_LOGO;
  const nomi = sozlama('dokon_nomi', '');
  const manzil = sozlama('dokon_manzil', '');
  const telefon = sozlama('dokon_telefon', '');
  const pastki = sozlama('chek_pastki_matn', '');

  const sana = sotuv.sana || '';
  const kun = H.sanaChiroyli(sana.slice(0, 10));
  const soat = sana.slice(11, 19);

  const qatorHtml = qatorlar
    .map((q) => {
      const blok =
        q.blok_soni > 1 && q.miqdor >= q.blok_soni
          ? ` <span class="kul">(${H.fmtMiqdor(Math.floor(q.miqdor / q.blok_soni))} blok)</span>`
          : '';
      return `<tr class="mahsulot">
        <td colspan="2" class="nom">${esc(q.nomi)}${blok}</td>
      </tr>
      <tr class="mahsulot">
        <td class="hisob">${H.fmtMiqdor(q.miqdor)} x ${H.pul(q.narx)}</td>
        <td class="summa">${H.pul(q.summa)}</td>
      </tr>`;
    })
    .join('');

  const tolovQator = [];
  if (sotuv.naqd > 0) tolovQator.push(['Naqd', sotuv.naqd]);
  if (sotuv.karta > 0) tolovQator.push(['Karta', sotuv.karta]);
  if (sotuv.terminal > 0) tolovQator.push(['Terminal', sotuv.terminal]);
  if (sotuv.qarz > 0) tolovQator.push(['QARZGA', sotuv.qarz]);

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page { size: ${eni}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: ${eni}mm; margin: 0; padding: 2mm 1mm 4mm;
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 11.5px; line-height: 1.35; color: #000;
    -webkit-print-color-adjust: exact;
  }
  .markaz { text-align: center; }
  .logo { max-width: 62mm; max-height: 22mm; display: block; margin: 0 auto 2mm; filter: grayscale(1) contrast(1.6); }
  .dokon { font-size: 17px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
  .chiziq { border-top: 1px dashed #000; margin: 2mm 0; }
  .qalin-chiziq { border-top: 2px solid #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 0; }
  .nom { font-weight: 700; padding-top: 1.2mm; }
  .hisob { color: #000; padding-left: 2mm; }
  .summa { text-align: right; font-weight: 700; white-space: nowrap; }
  .kul { font-weight: 400; }
  .jami-qator td { font-size: 15px; font-weight: 800; padding: 1mm 0; }
  .tolov td { padding: 0.3mm 0; }
  .past { font-size: 11px; margin-top: 1mm; }
  .raqam { font-size: 10.5px; }
</style></head>
<body>
  <div class="markaz">
    ${logo ? `<img class="logo" src="${logo}">` : `<div class="dokon">${esc(nomi)}</div>`}
  </div>
  <div class="chiziq"></div>
  <table class="raqam">
    <tr><td>${kun}</td><td class="summa" style="font-weight:400">${soat}</td></tr>
    <tr><td>Chek №${esc(sotuv.raqam)}</td><td class="summa" style="font-weight:400">${esc(qosh.hodim || '')}</td></tr>
    ${qosh.mijoz ? `<tr><td colspan="2">Mijoz: ${esc(qosh.mijoz)}</td></tr>` : ''}
  </table>
  <div class="chiziq"></div>
  <table>${qatorHtml}</table>
  <div class="qalin-chiziq"></div>
  <table>
    ${
      sotuv.yaxlitlash
        ? `<tr class="tolov"><td>Tovarlar summasi</td><td class="summa" style="font-weight:400">${H.pul(
            sotuv.jami - sotuv.yaxlitlash
          )}</td></tr>
           <tr class="tolov"><td>${
             sotuv.yaxlitlash < 0 ? "Qo'shib yuborildi" : 'Qaytim olinmadi'
           }</td><td class="summa" style="font-weight:400">${
            sotuv.yaxlitlash > 0 ? '+' : ''
          }${H.pul(sotuv.yaxlitlash)}</td></tr>`
        : ''
    }
    <tr class="jami-qator"><td>JAMI</td><td class="summa">${H.pul(sotuv.jami)}</td></tr>
    ${tolovQator
      .map((t) => `<tr class="tolov"><td>${t[0]}</td><td class="summa" style="font-weight:400">${H.pul(t[1])}</td></tr>`)
      .join('')}
    ${
      qosh.qaytim > 0
        ? `<tr class="tolov"><td>Qaytim</td><td class="summa">${H.pul(qosh.qaytim)}</td></tr>`
        : ''
    }
    ${
      qosh.mijoz_qarzi !== undefined && qosh.mijoz_qarzi > 0
        ? `<tr class="tolov"><td>Umumiy qarz</td><td class="summa">${H.pul(qosh.mijoz_qarzi)}</td></tr>`
        : ''
    }
  </table>
  <div class="chiziq"></div>
  <div class="markaz past">
    ${esc(manzil)}<br>
    ${esc(telefon)}
    ${pastki ? `<div style="margin-top:1.5mm;font-weight:700">${esc(pastki)}</div>` : ''}
  </div>
</body></html>`;
}

// HTML ni yashirin oynada ochib, printerga yuboramiz
async function html_chop(html, nusxa = 1) {
  const printerNomi = sozlama('printer_nomi', '').trim();
  const win = new BrowserWindow({
    show: false,
    width: 400,
    height: 900,
    webPreferences: { offscreen: true, javascript: true },
  });

  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    // kontent balandligini o'lchaymiz - ortiqcha qog'oz chiqmasligi uchun
    const balandlikPx = await win.webContents.executeJavaScript(
      'document.body.scrollHeight', true
    );
    const balandlikMikron = Math.max(40000, Math.round((balandlikPx / 96) * 25400) + 4000);
    const eniMm = Number(sozlama('chek_eni', '80')) === 58 ? 58 : 80;

    for (let i = 0; i < nusxa; i++) {
      await new Promise((resolve, reject) => {
        win.webContents.print(
          {
            silent: true,
            printBackground: true,
            ...(printerNomi ? { deviceName: printerNomi } : {}),
            margins: { marginType: 'none' },
            pageSize: { width: eniMm * 1000, height: balandlikMikron },
            copies: 1,
          },
          (muvaffaqiyat, xato) => {
            if (!muvaffaqiyat) reject(new Error(xato || 'Chop etib bolmadi'));
            else resolve();
          }
        );
      });
    }
    return true;
  } finally {
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy();
    }, 1500);
  }
}


// Qaytarish cheki: nima qaytgani va chekda nima qolgani
function qaytarishHtml(q, qatorlar, qosh = {}) {
  const eni = Number(sozlama('chek_eni', '80')) === 58 ? 48 : 72;
  const logo = sozlama('chek_logo', '') || STANDART_LOGO;
  const nomi = sozlama('dokon_nomi', '');
  const manzil = sozlama('dokon_manzil', '');
  const telefon = sozlama('dokon_telefon', '');

  const sana = q.sana || '';
  const kun = H.sanaChiroyli(sana.slice(0, 10));
  const soat = sana.slice(11, 19);
  const summa = Math.abs(q.jami);
  const asos = qosh.asos || {};

  const qatorHtml = qatorlar
    .map(
      (x) => `<tr class="mahsulot"><td colspan="2" class="nom">${esc(x.nomi)}</td></tr>
      <tr class="mahsulot">
        <td class="hisob">${H.fmtMiqdor(Math.abs(x.miqdor))} x ${H.pul(x.narx)}</td>
        <td class="summa">${H.pul(Math.abs(x.summa))}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page { size: ${eni}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${eni}mm; margin: 0; padding: 2mm 1mm 4mm;
    font-family: "Segoe UI", Arial, sans-serif; font-size: 11.5px; line-height: 1.35; color: #000; }
  .markaz { text-align: center; }
  .logo { max-width: 62mm; max-height: 22mm; display: block; margin: 0 auto 2mm; filter: grayscale(1) contrast(1.6); }
  .dokon { font-size: 17px; font-weight: 800; text-transform: uppercase; }
  .sarlavha { font-size: 15px; font-weight: 800; letter-spacing: 1px; margin: 1mm 0; }
  .chiziq { border-top: 1px dashed #000; margin: 2mm 0; }
  .qalin-chiziq { border-top: 2px solid #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 0; }
  .nom { font-weight: 700; padding-top: 1.2mm; }
  .hisob { padding-left: 2mm; }
  .summa { text-align: right; font-weight: 700; white-space: nowrap; }
  .jami-qator td { font-size: 15px; font-weight: 800; padding: 1mm 0; }
  .tolov td { padding: 0.3mm 0; }
  .past { font-size: 11px; margin-top: 1mm; }
  .raqam { font-size: 10.5px; }
</style></head>
<body>
  <div class="markaz">
    ${logo ? `<img class="logo" src="${logo}">` : `<div class="dokon">${esc(nomi)}</div>`}
    <div class="sarlavha">QAYTARISH CHEKI</div>
  </div>
  <div class="chiziq"></div>
  <table class="raqam">
    <tr><td>${kun}</td><td class="summa" style="font-weight:400">${soat}</td></tr>
    <tr><td>Qaytarish №${esc(q.raqam)}</td><td class="summa" style="font-weight:400">${esc(qosh.hodim || '')}</td></tr>
    ${asos.raqam ? `<tr><td colspan="2">Asos: chek №${esc(asos.raqam)}</td></tr>` : ''}
    ${qosh.mijoz ? `<tr><td colspan="2">Mijoz: ${esc(qosh.mijoz)}</td></tr>` : ''}
  </table>
  <div class="chiziq"></div>
  <div style="font-weight:700">QAYTARILDI:</div>
  <table>${qatorHtml}</table>
  <div class="qalin-chiziq"></div>
  <table>
    <tr class="jami-qator"><td>QAYTARILDI</td><td class="summa">${H.pul(summa)}</td></tr>
    <tr class="tolov"><td>${esc(qosh.usul || '')}</td><td class="summa" style="font-weight:400">${H.pul(summa)}</td></tr>
  </table>
  <div class="chiziq"></div>
  <table class="raqam">
    ${asos.jami !== undefined ? `<tr><td>Chek summasi edi</td><td class="summa" style="font-weight:400">${H.pul(asos.jami)}</td></tr>` : ''}
    ${qosh.qolgan !== undefined ? `<tr><td><b>Chekda qoldi</b></td><td class="summa">${H.pul(Math.max(0, qosh.qolgan))}</td></tr>` : ''}
  </table>
  <div class="chiziq"></div>
  <div class="markaz past">
    ${esc(manzil)}<br>
    ${esc(telefon)}
  </div>
</body></html>`;
}

async function qaytarishChop(q, qatorlar, qosh = {}) {
  return html_chop(qaytarishHtml(q, qatorlar, qosh), 1);
}

async function chekChop(sotuv, qatorlar, qosh = {}) {
  return html_chop(chekHtml(sotuv, qatorlar, qosh), 1);
}

async function printerlarRoyxati() {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    const list = await win.webContents.getPrintersAsync();
    return list.map((p) => ({ nomi: p.name, tavsif: p.displayName, standart: p.isDefault }));
  } finally {
    win.destroy();
  }
}

module.exports = { chekChop, chekHtml, qaytarishChop, qaytarishHtml, html_chop, printerlarRoyxati };
