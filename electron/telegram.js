// Telegram bot - cheklarni yuborish, hisobotlar, zaxira nusxa
// Internet yo'q bo'lsa xabarlar navbatda turadi va internet kelganda yuboriladi.
const fs = require('fs');
const path = require('path');
const { baza, sozlama } = require('./db');
const H = require('./hisobot');

let navbatTimer = null;
let pollTimer = null;
let oxirgiUpdateId = 0;
let yuborilmoqda = false;

function token() {
  return sozlama('telegram_token', '').trim();
}
function chatId() {
  return sozlama('telegram_chat_id', '').trim();
}
function sozlanganmi() {
  return Boolean(token() && chatId());
}

async function apiChaqir(metod, data, timeoutMs = 20000) {
  const t = token();
  if (!t) throw new Error('Telegram token kiritilmagan');
  const ctrl = new AbortController();
  const vaqt = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.telegram.org/bot${t}/${metod}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: ctrl.signal,
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.description || 'Telegram xatosi');
    return j.result;
  } finally {
    clearTimeout(vaqt);
  }
}

async function faylYubor(yol, izoh = '') {
  const t = token();
  if (!t) throw new Error('Telegram token kiritilmagan');
  const buf = fs.readFileSync(yol);
  const form = new FormData();
  form.append('chat_id', chatId());
  form.append('caption', izoh);
  form.append('document', new Blob([buf]), path.basename(yol));
  const res = await fetch(`https://api.telegram.org/bot${t}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.description || 'Telegram xatosi');
  return j.result;
}

// --- NAVBAT ---
function navbatQosh(matn, tur = 'matn', fayl = null) {
  baza()
    .prepare('INSERT INTO telegram_navbat (tur, matn, fayl) VALUES (?, ?, ?)')
    .run(tur, matn, fayl);
  setTimeout(navbatniYubor, 200); // darhol urinib ko'ramiz
}

async function navbatniYubor() {
  if (yuborilmoqda || !sozlanganmi()) return;
  yuborilmoqda = true;
  const db = baza();
  try {
    const qatorlar = db
      .prepare(
        `SELECT * FROM telegram_navbat WHERE holat = 0 AND urinish < 200
         ORDER BY id LIMIT 20`
      )
      .all();
    for (const q of qatorlar) {
      try {
        if (q.tur === 'fayl' && q.fayl) {
          await faylYubor(q.fayl, q.matn);
        } else {
          await apiChaqir('sendMessage', {
            chat_id: chatId(),
            text: q.matn,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          });
        }
        db.prepare(
          "UPDATE telegram_navbat SET holat = 1, yuborilgan = datetime('now','localtime') WHERE id = ?"
        ).run(q.id);
      } catch (e) {
        db.prepare('UPDATE telegram_navbat SET urinish = urinish + 1, xato = ? WHERE id = ?').run(
          String(e.message).slice(0, 300),
          q.id
        );
        break; // internet yo'q bo'lsa qolganini keyingi urinishda yuboramiz
      }
    }
  } catch (e) {
    console.error('navbat xato:', e.message);
  } finally {
    yuborilmoqda = false;
  }
}

function navbatHolati() {
  const db = baza();
  const r = db
    .prepare(
      `SELECT
        SUM(CASE WHEN holat = 0 THEN 1 ELSE 0 END) AS kutmoqda,
        SUM(CASE WHEN holat = 1 THEN 1 ELSE 0 END) AS yuborilgan
       FROM telegram_navbat`
    )
    .get();
  return { kutmoqda: r.kutmoqda || 0, yuborilgan: r.yuborilgan || 0, sozlangan: sozlanganmi() };
}

// --- XABAR SHABLONLARI ---
function chekXabari(sotuv, qatorlar, filialNomi, hodimIsmi, mijoz) {
  const l = [];
  l.push('🧾 <b>Yangi sotuv!</b>');
  l.push('');
  l.push(`🏪 ${filialNomi}`);
  l.push(`👤 ${hodimIsmi}`);
  if (mijoz) l.push(`🙍 Mijoz: ${mijoz}`);
  l.push('');
  l.push('<b>Sotuv:</b>');
  for (const q of qatorlar) {
    l.push(`• ${q.nomi} — ${H.fmtMiqdor(q.miqdor)} dona · ${H.pul(q.summa)}`);
  }
  l.push('');
  l.push(`💰 <b>Jami: ${H.pul(sotuv.jami)} so'm</b>`);
  const tolovlar = [];
  if (sotuv.naqd > 0) tolovlar.push(`Naqd ${H.pul(sotuv.naqd)}`);
  if (sotuv.karta > 0) tolovlar.push(`Karta ${H.pul(sotuv.karta)}`);
  if (sotuv.terminal > 0) tolovlar.push(`Terminal ${H.pul(sotuv.terminal)}`);
  if (sotuv.qarz > 0) tolovlar.push(`Qarz ${H.pul(sotuv.qarz)}`);
  l.push(`💵 To'lov: ${tolovlar.join(' + ') || '-'}`);
  l.push('');
  l.push(
    `<i>${H.sanaChiroyli(sotuv.sana.slice(0, 10))} ${sotuv.sana.slice(11, 19)} · chek №${sotuv.raqam}</i>`
  );
  return l.join('\n');
}

function kirimXabari(kirim, qatorlar, filialNomi, hodimIsmi) {
  const l = [];
  l.push('📥 <b>Yangi kirim (tovar qabul qilindi)</b>');
  l.push('');
  l.push(`🏪 ${filialNomi}`);
  l.push(`👤 Kiritdi: ${hodimIsmi}`);
  if (kirim.taminotchi) l.push(`🚚 Ta'minotchi: ${kirim.taminotchi}`);
  l.push('');
  for (const q of qatorlar) {
    l.push(`• ${q.nomi} — ${H.fmtMiqdor(q.miqdor)} dona × ${H.pul(q.tan_narx)} = ${H.pul(q.summa)}`);
  }
  l.push('');
  l.push(`💰 <b>Jami: ${H.pul(kirim.jami)} so'm</b>`);
  l.push(`<i>${H.sanaChiroyli(kirim.sana.slice(0, 10))} ${kirim.sana.slice(11, 19)}</i>`);
  return l.join('\n');
}

function qarzTolovXabari(mijoz, summa, usul, qoldiq, filialNomi, hodimIsmi) {
  return [
    "✅ <b>Qarz to'lovi</b>",
    '',
    `🏪 ${filialNomi}`,
    `👤 Qabul qildi: ${hodimIsmi}`,
    `🙍 Mijoz: ${mijoz}`,
    '',
    `💵 To'landi: <b>${H.pul(summa)} so'm</b> (${usul})`,
    `📝 Qolgan qarz: <b>${H.pul(qoldiq)} so'm</b>`,
  ].join('\n');
}

// --- BOT BUYRUQLARI (faqat rahbarning chat_id siga javob beradi) ---
const KLAVIATURA = {
  keyboard: [
    [{ text: '📊 Bugun' }, { text: '📅 Hafta' }],
    [{ text: '🗓 Oy' }, { text: '📈 Jami' }],
    [{ text: '📦 Qoldiq' }, { text: '📝 Qarzdorlar' }],
    [{ text: '🏆 Top tovarlar' }, { text: 'ℹ️ Holat' }],
  ],
  resize_keyboard: true,
};

async function javobYubor(matn, klaviatura = true) {
  await apiChaqir('sendMessage', {
    chat_id: chatId(),
    text: matn,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(klaviatura ? { reply_markup: KLAVIATURA } : {}),
  });
}

async function buyruqniBajar(matn) {
  const m = (matn || '').trim().toLowerCase();
  const db = baza();

  if (m === '/start' || m.includes('holat')) {
    const n = navbatHolati();
    const filial = db
      .prepare('SELECT nomi FROM filiallar WHERE id = ?')
      .get(Number(sozlama('joriy_filial', '1')));
    await javobYubor(
      [
        '👋 Assalomu alaykum!',
        `<b>${sozlama('dokon_nomi')}</b> hisobot boti.`,
        '',
        `🏪 Filial: ${filial ? filial.nomi : '-'}`,
        `📨 Yuborilgan xabarlar: ${n.yuborilgan}`,
        `⏳ Navbatda: ${n.kutmoqda}`,
        '',
        'Pastdagi tugmalardan foydalaning.',
      ].join('\n')
    );
    return;
  }
  if (m.includes('bugun')) {
    await javobYubor(H.hisobotMatn('Bugungi hisobot', H.kunlik()));
    return;
  }
  if (m.includes('hafta')) {
    await javobYubor(H.hisobotMatn('Haftalik hisobot (7 kun)', H.haftalik()));
    return;
  }
  if (m.includes('oy')) {
    await javobYubor(H.hisobotMatn('Oylik hisobot', H.oylik()));
    return;
  }
  if (m.includes('jami')) {
    await javobYubor(H.hisobotMatn('Umumiy hisobot', H.jamiHisobot()));
    return;
  }
  if (m.includes('qoldiq')) {
    const filial_id = Number(sozlama('joriy_filial', '1'));
    const rows = H.qoldiqlar(filial_id).filter((r) => r.qoldiq > 0);
    const jami = rows.reduce((s, r) => s + r.ombor_summa, 0);
    const kam = H.qoldiqlar(filial_id, true);
    const l = [
      "📦 <b>Ombor qoldig'i</b>",
      '',
      `Tovar turlari: ${rows.length} ta`,
      `Ombor qiymati: <b>${H.pul(jami)} so'm</b>`,
      '',
    ];
    if (kam.length) {
      l.push(`⚠️ <b>Tugayotgan tovarlar (${kam.length} ta):</b>`);
      kam.slice(0, 20).forEach((r) => l.push(`• ${r.nomi} — ${H.fmtMiqdor(r.qoldiq)} dona`));
    } else {
      l.push("✅ Tugayotgan tovar yo'q");
    }
    await javobYubor(l.join('\n'));
    return;
  }
  if (m.includes('qarz')) {
    const rows = H.qarzdorlar();
    const jami = rows.reduce((s, r) => s + r.qarz, 0);
    const l = [
      '📝 <b>Qarzdorlar</b>',
      '',
      `Jami: <b>${H.pul(jami)} so'm</b> (${rows.length} mijoz)`,
      '',
    ];
    rows
      .slice(0, 30)
      .forEach((r, i) =>
        l.push(`${i + 1}. ${r.ism}${r.telefon ? ' · ' + r.telefon : ''} — <b>${H.pul(r.qarz)}</b>`)
      );
    if (!rows.length) l.push("✅ Qarzdor yo'q");
    await javobYubor(l.join('\n'));
    return;
  }
  if (m.includes('top')) {
    const h = H.oylik();
    const l = ["🏆 <b>Eng ko'p sotilgan tovarlar (shu oy)</b>", ''];
    h.top.forEach((t, i) =>
      l.push(
        `${i + 1}. ${t.nomi}\n    ${H.fmtMiqdor(t.miqdor)} dona · ${H.pul(t.summa)} · foyda ${H.pul(t.foyda)}`
      )
    );
    if (!h.top.length) l.push("Ma'lumot yo'q");
    await javobYubor(l.join('\n'));
    return;
  }
  await javobYubor('Tushunmadim. Pastdagi tugmalardan birini tanlang.');
}

async function yangilanishlarniOl() {
  if (!sozlanganmi()) return;
  try {
    const updates = await apiChaqir(
      'getUpdates',
      { offset: oxirgiUpdateId + 1, timeout: 0, allowed_updates: ['message'] },
      15000
    );
    for (const u of updates) {
      oxirgiUpdateId = Math.max(oxirgiUpdateId, u.update_id);
      const msg = u.message;
      if (!msg || !msg.text) continue;
      if (String(msg.chat.id) !== chatId()) continue; // faqat rahbar
      await buyruqniBajar(msg.text);
    }
  } catch (e) {
    // internet yo'q - jim o'tamiz, keyingi urinishda qayta uriniladi
  }
}

// --- KUNLIK AVTOMATIK HISOBOT ---
let oxirgiKunlikHisobot = '';
function kunlikHisobotTekshir() {
  if (sozlama('telegram_kunlik_hisobot', '1') !== '1') return;
  const vaqt = sozlama('telegram_hisobot_vaqti', '21:00');
  const d = new Date();
  const hozir = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const kun = H.bugun();
  if (hozir === vaqt && oxirgiKunlikHisobot !== kun) {
    oxirgiKunlikHisobot = kun;
    navbatQosh(H.hisobotMatn('Kunlik yakuniy hisobot', H.kunlik(kun)));
  }
}

function ishgaTushir() {
  if (navbatTimer) return;
  navbatTimer = setInterval(() => {
    navbatniYubor();
    kunlikHisobotTekshir();
  }, 7000);
  pollTimer = setInterval(yangilanishlarniOl, 3000);
}

function toxtat() {
  clearInterval(navbatTimer);
  clearInterval(pollTimer);
  navbatTimer = pollTimer = null;
}

async function sinov() {
  if (!sozlanganmi()) throw new Error('Token yoki Chat ID kiritilmagan');
  await apiChaqir('sendMessage', {
    chat_id: chatId(),
    text: `✅ <b>Ulanish muvaffaqiyatli!</b>\n\n${sozlama('dokon_nomi')} POS tizimi botga ulandi.`,
    parse_mode: 'HTML',
    reply_markup: KLAVIATURA,
  });
  return true;
}

module.exports = {
  navbatQosh,
  navbatniYubor,
  navbatHolati,
  chekXabari,
  kirimXabari,
  qarzTolovXabari,
  faylYubor,
  ishgaTushir,
  toxtat,
  sinov,
  sozlanganmi,
  apiChaqir,
};
