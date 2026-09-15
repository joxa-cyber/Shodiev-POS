// Telegram bot - cheklar, hisobotlar, ogohlantirishlar va zaxira nusxa.
// Bir nechta chatga (rahbarning shaxsiy chati + guruh) bir vaqtda yuboradi.
// Internet yo'q bo'lsa xabarlar navbatda turadi va internet kelganda yuboriladi.
const fs = require('fs');
const path = require('path');
const { baza, sozlama, sozlamaSaqla } = require('./db');
const H = require('./hisobot');

let navbatTimer = null;
let pollTimer = null;
let oxirgiUpdateId = 0;
let yuborilmoqda = false;
let birinchiSorov = true; // dastur yopiq paytdagi eski buyruqlarga javob bermaymiz
let conflictOgohlantirildi = false;

/* ============ ASOSIY YORDAMCHILAR ============ */

function token() {
  return sozlama('telegram_token', '').trim();
}

// Chat ID lar vergul, probel yoki yangi qator bilan ajratilishi mumkin
function chatlar() {
  return sozlama('telegram_chat_id', '')
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Botga yozgan chatlarni eslab qolamiz - sozlamalar oynasida ro'yxat bo'lib chiqadi
function korilganChatQoy(chat) {
  if (!chat) return;
  try {
    const royxat = JSON.parse(sozlama('telegram_korilgan', '[]') || '[]');
    const id = String(chat.id);
    const nomi =
      chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || id;
    const bor = royxat.find((x) => x.id === id);
    if (bor) {
      bor.nomi = nomi;
      bor.vaqt = Date.now();
    } else {
      royxat.push({ id, nomi, turi: chat.type, username: chat.username || '', vaqt: Date.now() });
    }
    // oxirgi 20 tasini saqlaymiz
    royxat.sort((a, b) => b.vaqt - a.vaqt);
    sozlamaSaqla('telegram_korilgan', JSON.stringify(royxat.slice(0, 20)));
  } catch {}
}

function korilganChatlar() {
  try {
    return JSON.parse(sozlama('telegram_korilgan', '[]') || '[]');
  } catch {
    return [];
  }
}

function sozlanganmi() {
  return Boolean(token() && chatlar().length);
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

async function faylYubor(chat_id, yol, izoh = '') {
  const t = token();
  if (!t) throw new Error('Telegram token kiritilmagan');
  const buf = fs.readFileSync(yol);
  const form = new FormData();
  form.append('chat_id', chat_id);
  form.append('caption', izoh);
  form.append('document', new Blob([buf]), path.basename(yol));
  const res = await fetch(`https://api.telegram.org/bot${t}/sendDocument`, { method: 'POST', body: form });
  const j = await res.json();
  if (!j.ok) throw new Error(j.description || 'Telegram xatosi');
  return j.result;
}

/* ============ NAVBAT ============ */

// Har bir chat uchun alohida yozuv - biri yuborilmasa ikkinchisi to'xtamaydi
function navbatQosh(matn, tur = 'matn', fayl = null) {
  const q = baza().prepare('INSERT INTO telegram_navbat (tur, matn, fayl, chat_id) VALUES (?,?,?,?)');
  const royxat = chatlar();
  if (!royxat.length) {
    q.run(tur, matn, fayl, ''); // sozlanmagan bo'lsa ham saqlaymiz, keyin yuboriladi
    return;
  }
  for (const c of royxat) q.run(tur, matn, fayl, c);
  setTimeout(navbatniYubor, 200);
}

async function navbatniYubor() {
  if (yuborilmoqda || !sozlanganmi()) return;
  yuborilmoqda = true;
  const db = baza();
  try {
    // chat_id si bo'sh eski yozuvlarni birinchi chatga biriktiramiz
    const birinchi = chatlar()[0];
    db.prepare("UPDATE telegram_navbat SET chat_id = ? WHERE (chat_id IS NULL OR chat_id = '') AND holat = 0").run(
      birinchi
    );

    const qatorlar = db
      .prepare('SELECT * FROM telegram_navbat WHERE holat = 0 AND urinish < 200 ORDER BY id LIMIT 30')
      .all();

    for (const q of qatorlar) {
      try {
        if (q.tur === 'fayl' && q.fayl) {
          await faylYubor(q.chat_id, q.fayl, q.matn);
        } else {
          await apiChaqir('sendMessage', {
            chat_id: q.chat_id,
            text: q.matn,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          });
        }
        db.prepare(
          "UPDATE telegram_navbat SET holat = 1, yuborilgan = datetime('now','localtime') WHERE id = ?"
        ).run(q.id);
      } catch (e) {
        const xato = String(e.message || e);
        db.prepare('UPDATE telegram_navbat SET urinish = urinish + 1, xato = ? WHERE id = ?').run(
          xato.slice(0, 300),
          q.id
        );
        // chat topilmasa (guruhdan chiqarilgan, bloklangan) - qayta urinmaymiz
        if (/chat not found|bot was blocked|kicked|deactivated/i.test(xato)) {
          db.prepare('UPDATE telegram_navbat SET holat = 2 WHERE id = ?').run(q.id);
          continue;
        }
        break; // internet yo'q - keyingi urinishda davom etamiz
      }
    }
  } catch (e) {
    console.error('navbat xato:', e.message);
  } finally {
    yuborilmoqda = false;
  }
}

function navbatHolati() {
  const r = baza()
    .prepare(
      `SELECT
        SUM(CASE WHEN holat = 0 THEN 1 ELSE 0 END) AS kutmoqda,
        SUM(CASE WHEN holat = 1 THEN 1 ELSE 0 END) AS yuborilgan,
        SUM(CASE WHEN holat = 2 THEN 1 ELSE 0 END) AS xato
       FROM telegram_navbat`
    )
    .get();
  return {
    kutmoqda: r.kutmoqda || 0,
    yuborilgan: r.yuborilgan || 0,
    xato: r.xato || 0,
    sozlangan: sozlanganmi(),
    chatlar: chatlar().length,
  };
}

/* ============ XABAR SHABLONLARI ============ */

function chekXabari(sotuv, qatorlar, filialNomi, hodimIsmi, mijoz) {
  const l = ['🧾 <b>Yangi sotuv!</b>', '', `🏪 ${filialNomi}`, `👤 ${hodimIsmi}`];
  if (mijoz) l.push(`🙍 Mijoz: ${mijoz}`);
  l.push('', '<b>Sotuv:</b>');
  for (const q of qatorlar) l.push(`• ${q.nomi} — ${H.fmtMiqdor(q.miqdor)} dona · ${H.pul(q.summa)}`);
  l.push('', `💰 <b>Jami: ${H.pul(sotuv.jami)} so'm</b>`);
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
  const l = ['📥 <b>Yangi kirim (tovar qabul qilindi)</b>', '', `🏪 ${filialNomi}`, `👤 Kiritdi: ${hodimIsmi}`];
  if (kirim.taminotchi) l.push(`🚚 Ta'minotchi: ${kirim.taminotchi}`);
  l.push('');
  for (const q of qatorlar) {
    l.push(`• ${q.nomi} — ${H.fmtMiqdor(q.miqdor)} dona × ${H.pul(q.tan_narx)} = ${H.pul(q.summa)}`);
  }
  l.push('', `💰 <b>Jami: ${H.pul(kirim.jami)} so'm</b>`);
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
    qoldiq > 0.4
      ? `📝 Qolgan qarz: <b>${H.pul(qoldiq)} so'm</b>`
      : qoldiq < -0.4
      ? `💚 Qarz yopildi, <b>${H.pul(-qoldiq)} so'm</b> avans qoldi`
      : '💚 <b>Qarz to\'liq yopildi</b>',
  ].join('\n');
}

/* ============ BOT MENYUSI (inline tugmalar) ============ */

const MENYU = {
  inline_keyboard: [
    [
      { text: '📊 Bugun', callback_data: 'bugun' },
      { text: '📅 Kecha', callback_data: 'kecha' },
    ],
    [
      { text: '🗓 Hafta', callback_data: 'hafta' },
      { text: '📆 Oy', callback_data: 'oy' },
      { text: '📈 Jami', callback_data: 'jami' },
    ],
    [
      { text: '💰 Kassa', callback_data: 'kassa' },
      { text: '📦 Qoldiq', callback_data: 'qoldiq' },
    ],
    [
      { text: '⚠️ Tugayotgan', callback_data: 'tugayotgan' },
      { text: '🏆 Top tovarlar', callback_data: 'top' },
    ],
    [
      { text: '📝 Qarzdorlar', callback_data: 'qarzlar' },
      { text: 'ℹ️ Holat', callback_data: 'holat' },
    ],
  ],
};

// Pastda doim turadigan tugmalar (yozish shart emas)
const TUGMALAR = {
  keyboard: [
    [{ text: '📊 Bugun' }, { text: '📅 Kecha' }],
    [{ text: '🗓 Hafta' }, { text: '📆 Oy' }],
    [{ text: '💰 Kassa' }, { text: '📦 Qoldiq' }],
    [{ text: '⚠️ Tugayotgan' }, { text: '📝 Qarzdorlar' }],
    [{ text: '🏆 Top tovarlar' }, { text: '📈 Jami' }],
    [{ text: 'ℹ️ Holat' }, { text: '🏠 Menyu' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: "Bo'limni tanlang yoki tugmani bosing",
};

const ORTGA = (kalit) => ({
  inline_keyboard: [
    [
      { text: '🔄 Yangilash', callback_data: kalit },
      { text: '⬅️ Menyu', callback_data: 'menyu' },
    ],
  ],
});

/* ============ HISOBOT MATNLARI ============ */

function filialId() {
  return Number(sozlama('joriy_filial', '1')) || 1;
}

function menyuMatni() {
  const n = navbatHolati();
  const h = H.kunlik();
  return [
    `🏪 <b>${sozlama('dokon_nomi')}</b>`,
    '',
    `Bugun: <b>${H.pul(h.savdo)} so'm</b> · ${h.chek_soni} ta chek`,
    '',
    'Kerakli bo\'limni tanlang:',
    n.kutmoqda > 0 ? `\n<i>⏳ ${n.kutmoqda} ta xabar navbatda (internet tiklanishi kutilmoqda)</i>` : '',
  ]
    .filter((x) => x !== '')
    .join('\n');
}

function qoldiqMatni() {
  const fid = filialId();
  const rows = H.qoldiqlar(fid).filter((r) => r.qoldiq > 0);
  const jami = rows.reduce((s, r) => s + r.ombor_summa, 0);
  const eng = [...rows].sort((a, b) => b.ombor_summa - a.ombor_summa).slice(0, 10);
  const l = [
    "📦 <b>Ombor qoldig'i</b>",
    '',
    `Tovar turlari: <b>${rows.length} ta</b>`,
    `Ombor qiymati: <b>${H.pul(jami)} so'm</b> (tan narxda)`,
    '',
    '<b>Eng ko\'p pul turgan tovarlar:</b>',
  ];
  eng.forEach((r, i) =>
    l.push(`${i + 1}. ${r.nomi} — ${H.fmtMiqdor(r.qoldiq)} dona · ${H.pul(r.ombor_summa)}`)
  );
  if (!rows.length) l.push("Omborda tovar yo'q");
  return l.join('\n');
}

function tugayotganMatni() {
  const kam = H.qoldiqlar(filialId(), true);
  const l = ['⚠️ <b>Tugayotgan tovarlar</b>', ''];
  if (!kam.length) {
    l.push("✅ Hammasi yetarli, tugayotgan tovar yo'q");
  } else {
    const tugagan = kam.filter((t) => t.qoldiq <= 0);
    const kamayib = kam.filter((t) => t.qoldiq > 0);
    if (tugagan.length) {
      l.push(`❗️ <b>Tugagan (${tugagan.length} ta):</b>`);
      tugagan.slice(0, 20).forEach((t) => l.push(`• ${t.nomi}`));
      l.push('');
    }
    if (kamayib.length) {
      l.push(`🟡 <b>Kamayib qolgan (${kamayib.length} ta):</b>`);
      kamayib.slice(0, 25).forEach((t) => l.push(`• ${t.nomi} — ${H.fmtMiqdor(t.qoldiq)} dona`));
    }
    l.push('', '<i>Buyurtma berishni unutmang</i>');
  }
  return l.join('\n');
}

function qarzlarMatni() {
  const rows = H.qarzdorlar();
  const jami = rows.reduce((s, r) => s + r.qarz, 0);
  const l = ['📝 <b>Qarzdorlar</b>', '', `Umumiy qarz: <b>${H.pul(jami)} so'm</b>`, `Mijozlar: ${rows.length} ta`, ''];
  rows
    .slice(0, 30)
    .forEach((r, i) => l.push(`${i + 1}. ${r.ism}${r.telefon ? ' · ' + r.telefon : ''}\n     <b>${H.pul(r.qarz)} so'm</b>`));
  if (!rows.length) l.push("✅ Qarzdor yo'q");
  return l.join('\n');
}

function topMatni() {
  const h = H.oylik();
  const l = ["🏆 <b>Eng ko'p sotilgan tovarlar</b>", `<i>${H.sanaChiroyli(h.dan)} — ${H.sanaChiroyli(h.gacha)}</i>`, ''];
  h.top.forEach((t, i) =>
    l.push(`${i + 1}. <b>${t.nomi}</b>\n     ${H.fmtMiqdor(t.miqdor)} dona · ${H.pul(t.summa)} · foyda ${H.pul(t.foyda)}`)
  );
  if (!h.top.length) l.push("Bu oyda savdo bo'lmagan");
  return l.join('\n');
}

function kassaMatni() {
  const k = H.kassaXulosa(filialId());
  const l = [
    '💰 <b>Kassa holati</b>',
    '',
    k.oxirgi
      ? `Oxirgi sanoq: ${H.sanaChiroyli(k.oxirgi.sana.slice(0, 10))} ${k.oxirgi.sana.slice(11, 16)}` +
        (Math.abs(k.oxirgi.farq) > 0.5
          ? ` · farq <b>${k.oxirgi.farq > 0 ? '+' : ''}${H.pul(k.oxirgi.farq)}</b>`
          : ' · farqsiz ✅')
      : "Hali kassa sanalmagan (kun boshidan hisoblanmoqda)",
    '',
    `🧾 Cheklar: ${k.chek} ta · Savdo: <b>${H.pul(k.savdo)}</b>`,
    `💳 Karta: ${H.pul(k.karta)} · 🏧 Terminal: ${H.pul(k.terminal)}`,
    '',
    `💵 <b>Kassada bo'lishi kerak: ${H.pul(k.kutilgan)} so'm</b>`,
    '',
    '<i>Naqd pul: sotuvdan + qarz to\'lovlaridan</i>',
  ];
  return l.join('\n');
}

function holatMatni() {
  const n = navbatHolati();
  const db = baza();
  const filial = db.prepare('SELECT nomi FROM filiallar WHERE id = ?').get(filialId());
  const tovarSoni = db.prepare('SELECT COUNT(*) AS n FROM tovarlar WHERE aktiv = 1').get().n;
  const mijozSoni = db.prepare('SELECT COUNT(*) AS n FROM mijozlar WHERE aktiv = 1').get().n;
  const oxirgiSotuv = db.prepare('SELECT sana FROM sotuvlar ORDER BY id DESC LIMIT 1').get();
  const oxirgiBackup = sozlama('oxirgi_backup', '');
  return [
    'ℹ️ <b>Tizim holati</b>',
    '',
    `🏪 ${sozlama('dokon_nomi')}`,
    `📍 Filial: ${filial ? filial.nomi : '-'}`,
    '',
    `📦 Tovarlar: ${tovarSoni} ta`,
    `🙍 Mijozlar: ${mijozSoni} ta`,
    oxirgiSotuv
      ? `🧾 Oxirgi sotuv: ${H.sanaChiroyli(oxirgiSotuv.sana.slice(0, 10))} ${oxirgiSotuv.sana.slice(11, 16)}`
      : "🧾 Hali sotuv bo'lmagan",
    '',
    `📨 Yuborilgan xabarlar: ${n.yuborilgan}`,
    `⏳ Navbatda: ${n.kutmoqda}`,
    `💬 Ulangan chatlar: ${n.chatlar} ta`,
    oxirgiBackup ? `💾 Oxirgi zaxira: ${H.sanaChiroyli(oxirgiBackup.slice(0, 10))}` : '💾 Zaxira hali olinmagan',
  ].join('\n');
}

// Callback yoki buyruqqa mos matn
function javobMatni(kalit) {
  switch (kalit) {
    case 'menyu':
      return menyuMatni();
    case 'bugun':
      return H.hisobotMatn('Bugungi hisobot', H.kunlik());
    case 'kecha': {
      const k = H.sanaQoshish(H.bugun(), -1);
      return H.hisobotMatn('Kechagi hisobot', H.kunlik(k));
    }
    case 'hafta':
      return H.hisobotMatn('Haftalik hisobot (7 kun)', H.haftalik());
    case 'oy':
      return H.hisobotMatn('Oylik hisobot', H.oylik());
    case 'jami':
      return H.hisobotMatn('Umumiy hisobot', H.jamiHisobot());
    case 'kassa':
      return kassaMatni();
    case 'qoldiq':
      return qoldiqMatni();
    case 'tugayotgan':
      return tugayotganMatni();
    case 'qarzlar':
      return qarzlarMatni();
    case 'top':
      return topMatni();
    case 'holat':
      return holatMatni();
    default:
      return null;
  }
}

/* ============ BUYRUQLAR VA TUGMALAR ============ */

const BUYRUQLAR = [
  { command: 'menyu', description: 'Asosiy menyu' },
  { command: 'bugun', description: 'Bugungi savdo va foyda' },
  { command: 'kecha', description: 'Kechagi hisobot' },
  { command: 'hafta', description: 'Oxirgi 7 kunlik hisobot' },
  { command: 'oy', description: 'Shu oylik hisobot' },
  { command: 'jami', description: 'Butun davr uchun hisobot' },
  { command: 'kassa', description: "Kassada qancha naqd bo'lishi kerak" },
  { command: 'qoldiq', description: "Ombor qoldig'i va qiymati" },
  { command: 'tugayotgan', description: 'Tugayotgan tovarlar' },
  { command: 'qarzlar', description: 'Qarzdor mijozlar' },
  { command: 'top', description: "Eng ko'p sotilgan tovarlar" },
  { command: 'holat', description: 'Tizim holati' },
];

const MATN_KALIT = [
  ['bugun', /bugun/i],
  ['kecha', /kecha/i],
  ['hafta', /hafta/i],
  ['oy', /\boy\b|oylik/i],
  ['jami', /jami|umumiy/i],
  ['kassa', /kassa/i],
  ['qoldiq', /qoldiq|ombor/i],
  ['tugayotgan', /tugay|tugagan/i],
  ['qarzlar', /qarz/i],
  ['top', /top|ko'p sotilgan/i],
  ['holat', /holat|status/i],
  ['menyu', /menyu|boshla|start/i],
];

function kalitniTop(matn) {
  const m = (matn || '').trim().toLowerCase().replace(/@[\w_]+/g, '');
  if (m.startsWith('/')) {
    const b = m.slice(1).split(/[\s@]/)[0];
    if (b === 'start') return 'menyu';
    if (BUYRUQLAR.some((x) => x.command === b)) return b;
  }
  for (const [kalit, re] of MATN_KALIT) if (re.test(m)) return kalit;
  return null;
}

async function xabarYubor(chat_id, matn, klaviatura) {
  return apiChaqir('sendMessage', {
    chat_id,
    text: matn,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(klaviatura ? { reply_markup: klaviatura } : {}),
  });
}

async function yangilanishlarniOl() {
  if (!sozlanganmi()) return;
  try {
    const updates = await apiChaqir(
      'getUpdates',
      { offset: oxirgiUpdateId + 1, timeout: 0, allowed_updates: ['message', 'callback_query'] },
      15000
    );
    const ruxsat = chatlar();

    // Dastur yopiq turganda yozilgan eski buyruqlarga javob bermaymiz
    if (birinchiSorov) {
      birinchiSorov = false;
      if (updates.length) {
        oxirgiUpdateId = Math.max(...updates.map((u) => u.update_id));
        const eskiSoni = updates.filter((u) => {
          const vaqt = (u.message && u.message.date) || 0;
          return Date.now() / 1000 - vaqt > 600;
        }).length;
        if (eskiSoni === updates.length) return; // hammasi eski - o'tkazib yuboramiz
      }
    }

    for (const u of updates) {
      oxirgiUpdateId = Math.max(oxirgiUpdateId, u.update_id);

      // --- tugma bosilgan ---
      if (u.callback_query) {
        const cq = u.callback_query;
        korilganChatQoy(cq.message.chat);
        const chatId = String(cq.message.chat.id);
        try {
          await apiChaqir('answerCallbackQuery', { callback_query_id: cq.id });
        } catch {}
        if (!ruxsat.includes(chatId)) continue;
        const kalit = cq.data;
        const matn = javobMatni(kalit);
        if (!matn) continue;
        try {
          await apiChaqir('editMessageText', {
            chat_id: chatId,
            message_id: cq.message.message_id,
            text: matn,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: kalit === 'menyu' ? MENYU : ORTGA(kalit),
          });
        } catch (e) {
          // xabar o'zgarmagan bo'lsa Telegram xato beradi - e'tiborsiz qoldiramiz
          if (!/not modified/i.test(String(e.message))) throw e;
        }
        continue;
      }

      // --- oddiy xabar / buyruq ---
      const msg = u.message;
      if (!msg) continue;
      korilganChatQoy(msg.chat);
      if (!msg.text) continue;
      const chatId = String(msg.chat.id);
      if (!ruxsat.includes(chatId)) {
        // notanish chat - faqat bir marta javob beramiz
        if (/^\/start/.test(msg.text)) {
          await xabarYubor(
            chatId,
            [
              '🔒 <b>Bu bot yopiq</b>',
              '',
              `Bu — «${sozlama('dokon_nomi')}» ichki hisobot boti.`,
              '',
              `Agar sizga kerak bo'lsa, rahbarga shu raqamni ayting:\n<code>${chatId}</code>`,
            ].join('\n')
          );
        }
        continue;
      }

      const kalit = kalitniTop(msg.text);
      if (!kalit) {
        await xabarYubor(
          chatId,
          'Tushunmadim 🤔\nPastdagi tugmalardan birini bosing yoki /menyu deb yozing.',
          TUGMALAR
        );
        continue;
      }
      if (kalit === 'menyu') {
        // menyu bosilganda doimiy tugmalarni ham o'rnatamiz
        await xabarYubor(chatId, javobMatni('menyu'), TUGMALAR);
        await xabarYubor(chatId, 'Yoki shu tugmalardan tanlang 👇', MENYU);
      } else {
        await xabarYubor(chatId, javobMatni(kalit), ORTGA(kalit));
      }
    }
  } catch (e) {
    // 409 = boshqa nusxa ham shu bot bilan ishlayapti
    if (/conflict|terminated by other/i.test(String(e.message)) && !conflictOgohlantirildi) {
      conflictOgohlantirildi = true;
      console.error('Telegram: bot boshqa joyda ham ishlayapti (409). Faqat bitta nusxa ishlashi kerak.');
    }
    // internet yo'q yoki token xato - jim o'tamiz, keyingi urinishda qayta uriniladi
  }
}

/* ============ BOTNI SOZLASH (buyruqlar menyusi, tavsif) ============ */

async function botniSozla(majburiy = false) {
  if (!token()) return false;
  const belgi = token().slice(-8);
  if (!majburiy && sozlama('telegram_bot_sozlandi', '') === belgi) return false;
  try {
    await apiChaqir('setMyCommands', { commands: BUYRUQLAR });
    await apiChaqir('setMyShortDescription', {
      short_description: `${sozlama('dokon_nomi')} — savdo hisobotlari`,
    });
    await apiChaqir('setMyDescription', {
      description:
        `${sozlama('dokon_nomi')} savdo tizimining rasmiy boti.\n\n` +
        'Har bir sotuv, kirim va qarz to\'lovi haqida darhol xabar beradi. ' +
        'Kunlik, haftalik va oylik hisobotlarni, ombor qoldig\'ini va qarzdorlarni ko\'rsatadi.\n\n' +
        'Bot yopiq — faqat ruxsat berilgan chatlarga javob beradi.',
    });
    await apiChaqir('setChatMenuButton', { menu_button: { type: 'commands' } });
    sozlamaSaqla('telegram_bot_sozlandi', belgi);
    console.log('Telegram bot sozlandi (buyruqlar, tavsif, menyu tugmasi)');
    return true;
  } catch (e) {
    console.error('bot sozlashda xato:', e.message);
    return false;
  }
}

/* ============ KUNLIK AVTOMATIK HISOBOT ============ */

let oxirgiKunlikHisobot = '';
function kunlikHisobotTekshir() {
  if (sozlama('telegram_kunlik_hisobot', '1') !== '1') return;
  const vaqt = sozlama('telegram_hisobot_vaqti', '21:00');
  const d = new Date();
  const hozir = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const kun = H.bugun();
  if (hozir === vaqt && oxirgiKunlikHisobot !== kun) {
    oxirgiKunlikHisobot = kun;
    const h = H.kunlik(kun);
    const l = [H.hisobotMatn('Kunlik yakuniy hisobot', h)];
    const kam = H.qoldiqlar(filialId(), true);
    if (kam.length) {
      l.push('', `⚠️ <b>Tugayotgan tovarlar: ${kam.length} ta</b>`);
      kam.slice(0, 10).forEach((t) => l.push(`• ${t.nomi} — ${H.fmtMiqdor(t.qoldiq)} dona`));
    }
    const qarzdor = H.qarzdorlar();
    if (qarzdor.length) {
      const jami = qarzdor.reduce((s, r) => s + r.qarz, 0);
      l.push('', `📝 Qarzdorlar: <b>${H.pul(jami)} so'm</b> (${qarzdor.length} mijoz)`);
    }
    navbatQosh(l.join('\n'));
  }
}

/* ============ ISHGA TUSHIRISH ============ */

function ishgaTushir() {
  if (navbatTimer) return;
  botniSozla().catch(() => {});
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
  if (!token()) throw new Error('Token kiritilmagan');
  if (!chatlar().length) throw new Error('Birorta ham chat qo\'shilmagan');
  await botniSozla(true);
  const natija = [];
  for (const c of chatlar()) {
    try {
      const chat = await apiChaqir('getChat', { chat_id: c });
      const nomi = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || c;
      await xabarYubor(
        c,
        [
          '✅ <b>Ulanish muvaffaqiyatli!</b>',
          '',
          `<b>${sozlama('dokon_nomi')}</b> savdo tizimi shu chatga ulandi.`,
          '',
          'Bundan buyon bu yerga quyidagilar keladi:',
          '• 🧾 Har bir sotuv (chek)',
          '• 📥 Tovar kirimi',
          "• ✅ Qarz to'lovlari",
          '• 💰 Kassa hisobi',
          '• ⚠️ Tugayotgan tovarlar',
          '• 📊 Kunlik yakuniy hisobot',
          '• 💾 Zaxira nusxa',
          '',
          'Hisobotlarni pastdagi tugmalardan ko\'ring 👇',
        ].join('\n'),
        MENYU
      );
      natija.push({ chat_id: c, nomi, ok: true });
    } catch (e) {
      natija.push({ chat_id: c, nomi: c, ok: false, xato: e.message });
    }
  }
  return natija;
}

// Sozlamalar oynasi uchun: chatlar haqida ma'lumot
async function chatMalumot(chat_id) {
  const chat = await apiChaqir('getChat', { chat_id });
  return {
    id: String(chat.id),
    nomi: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || String(chat.id),
    turi: chat.type,
    username: chat.username || '',
  };
}

module.exports = {
  navbatQosh,
  navbatniYubor,
  navbatHolati,
  chekXabari,
  kirimXabari,
  qarzTolovXabari,
  faylYubor,
  chatlar,
  chatMalumot,
  korilganChatlar,
  botniSozla,
  ishgaTushir,
  toxtat,
  sinov,
  sozlanganmi,
  apiChaqir,
  MENYU,
  TUGMALAR,
  javobMatni, // sinov uchun
  kalitniTop,
};
