// Vaqtinchalik sinov skripti (keyin o'chiriladi)
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(app.getPath('temp'), 'pos-sinov-' + Date.now()));

app.on('window-all-closed', () => {}); // sinov davomida dastur yopilib qolmasin

app.whenReady().then(async () => {
  const DB = require('./db');
  const { amallar } = require('./ipc');
  const Printer = require('./printer');
  const H = require('./hisobot');
  const ok = (n, v) => console.log('  ✓', n, v === undefined ? '' : JSON.stringify(v));

  try {
    DB.ochish();
    console.log('\n=== 1. Kirish ===');
    const u = amallar['auth.kirish']({ login: 'rahbar', parol: '1234' });
    ok('rahbar kirdi', { id: u.id, rol: u.rol, filiallar: u.filiallar.length });

    try {
      amallar['auth.kirish']({ login: 'rahbar', parol: 'xato' });
      console.log('  ✗ XATO: noto\'g\'ri parol qabul qilindi!');
    } catch (e) {
      ok("noto'g'ri parol rad etildi");
    }

    console.log('\n=== 2. Tovarlar ===');
    const t1 = amallar['tovar.saqla']({ nomi: 'Pepsi 1.5L', barcode: '4870204391234', blok_soni: 6, sotuv_narx: 12000, tan_narx: 0, qoldiq: 0 });
    const t2 = amallar['tovar.saqla']({ nomi: 'Qarshi suv gazsiz 1L', barcode: '4780015551234', blok_soni: 12, sotuv_narx: 5000 });
    const t3 = amallar['tovar.saqla']({ nomi: 'Fanta 2L', blok_soni: 6, sotuv_narx: 18000, qoldiq: 30 });
    ok('3 ta tovar yaratildi', [t1, t2, t3]);

    const topildi = amallar['tovar.barcode']({ kod: '4870204391234' });
    ok('shtrix-kod bilan topildi', topildi.nomi);

    console.log('\n=== 3. Kirim (o\'rtacha tan narx) ===');
    amallar['kirim.yarat']({
      taminotchi: 'Pepsi Uzbekistan',
      qatorlar: [
        { tovar_id: t1, miqdor: 100, tan_narx: 9000 },
        { tovar_id: t2, miqdor: 120, tan_narx: 3500 },
      ],
    });
    let p = amallar['tovar.royxat']({ qidiruv: 'Pepsi' })[0];
    ok('1-kirimdan keyin', { qoldiq: p.qoldiq, tan_narx: p.tan_narx });

    amallar['kirim.yarat']({ qatorlar: [{ tovar_id: t1, miqdor: 100, tan_narx: 10000 }] });
    p = amallar['tovar.royxat']({ qidiruv: 'Pepsi' })[0];
    ok("2-kirimdan keyin (o'rtacha 9500 bo'lishi kerak)", { qoldiq: p.qoldiq, tan_narx: p.tan_narx });
    if (Math.abs(p.tan_narx - 9500) > 1) console.log("  ✗ XATO: o'rtacha tan narx noto'g'ri!");

    console.log('\n=== 4. Mijoz va sotuv ===');
    const m1 = amallar['mijoz.saqla']({ ism: 'Alisher aka', telefon: '+998901234567' });
    const sotuv = amallar['sotuv.yarat']({
      mijoz_id: m1,
      qatorlar: [
        { tovar_id: t1, miqdor: 12, narx: 12000 },
        { tovar_id: t2, miqdor: 24, narx: 5000 },
      ],
      naqd: 100000,
      terminal: 64000,
      qarz: 100000,
      chopEt: false,
    });
    ok('sotuv yaratildi', sotuv);

    const mijoz = amallar['mijoz.royxat']({})[0];
    ok('mijoz qarzi', mijoz.qarz);
    p = amallar['tovar.royxat']({ qidiruv: 'Pepsi' })[0];
    ok('Pepsi qoldiq (200-12=188)', p.qoldiq);

    try {
      amallar['sotuv.yarat']({ qatorlar: [{ tovar_id: t1, miqdor: 1, narx: 12000 }], naqd: 5000, chopEt: false });
      console.log("  ✗ XATO: noto'g'ri to'lov qabul qilindi!");
    } catch (e) {
      ok("to'lov summasi mos kelmasa rad etildi");
    }

    console.log('\n=== 5. Qarz to\'lovi ===');
    const qt = amallar['qarz.tolov']({ mijoz_id: m1, summa: 40000, usul: 'naqd' });
    ok('qarz to\'landi, qoldiq', qt.qoldiq);

    console.log('\n=== 6. Hisobotlar ===');
    const h = amallar['hisobot.oraliq']({ dan: H.bugun(), gacha: H.bugun() });
    ok('savdo', h.savdo);
    ok('foyda', h.foyda);
    ok('naqd (sotuv 100000 + qarz to\'lovi 40000)', h.kassa_naqd);
    ok('terminal', h.kassa_terminal);
    ok('qarzga', h.qarz);
    ok('top tovarlar', h.top.map((x) => x.nomi));
    const panel = amallar['hisobot.panel']({});
    ok('panel: ombor qiymati', Math.round(panel.ombor_qiymati));

    console.log('\n=== 7. Xodim va ruxsatlar ===');
    const x1 = amallar['foydalanuvchi.saqla']({
      ism: 'Aziz', login: 'aziz', parol: '1111', rol: 'hodim',
      ruxsatlar: { sotuv: 1, kirim: 1, mijozlar: 1, qarz: 1 }, filiallar: [1], aktiv: 1,
    });
    ok('xodim yaratildi', x1);
    amallar['auth.kirish']({ login: 'aziz', parol: '1111' });
    try {
      amallar['sozlama.saqla']({ dokon_nomi: 'XAKER' });
      console.log('  ✗ XATO: xodim sozlamani o\'zgartira oldi!');
    } catch (e) {
      ok('xodimga sozlama taqiqlandi:', e.message);
    }
    try {
      amallar['tovar.narx']({ id: t1, sotuv_narx: 1 });
      console.log('  ✗ XATO: xodim narxni o\'zgartira oldi!');
    } catch (e) {
      ok('xodimga narx o\'zgartirish taqiqlandi');
    }
    const xodimSotuv = amallar['sotuv.yarat']({ qatorlar: [{ tovar_id: t3, miqdor: 2, narx: 18000 }], naqd: 36000, chopEt: false });
    ok('xodim sotuv qila oldi', xodimSotuv.raqam);

    console.log('\n=== 8. Chek (HTML) ===');
    amallar['auth.kirish']({ login: 'rahbar', parol: '1234' });
    const bitta = amallar['sotuv.bitta']({ id: sotuv.id });
    const html = Printer.chekHtml(bitta.sotuv, bitta.qatorlar, { hodim: 'Rahbar', mijoz: 'Alisher aka', qaytim: 0, mijoz_qarzi: 60000 });
    const chekYol = path.join(app.getPath('temp'), 'chek-namuna.html');
    fs.writeFileSync(chekYol, html);
    ok('chek HTML yaratildi', chekYol);

    console.log('\n=== 9. Telegram navbati ===');
    const n = amallar['telegram.holat']();
    ok('navbat holati (token yo\'q - kutmoqda)', n);

    console.log('\n=== 10. Printerlar ===');
    const pr = await amallar['printer.royxat']();
    ok('topilgan printerlar', pr.map((x) => x.nomi));

    console.log('\n=== 11. Bekor qilish ===');
    amallar['sotuv.bekor']({ id: sotuv.id, sabab: 'sinov' });
    p = amallar['tovar.royxat']({ qidiruv: 'Pepsi' })[0];
    const m = amallar['mijoz.royxat']({})[0];
    ok('bekordan keyin Pepsi qoldiq (200 ga qaytdi)', p.qoldiq);
    ok('bekordan keyin mijoz qarzi (-40000)', m.qarz);

    console.log('\n=== 12. Zaxira nusxa ===');
    const Backup = require('./backup');
    const yol = await Backup.backupYarat(false);
    ok('backup yaratildi', { yol, hajm: fs.statSync(yol).size });

    console.log('\n=== 13. Kassa hisobi ===');
    let kh = amallar['kassa.holat']({});
    ok("kutilgan naqd (xodim sotuvi 36000 + qarz to'lovi 40000)", kh.kutilgan_naqd);
    const ky = amallar['kassa.yopish']({ sanalgan: kh.kutilgan_naqd - 5000, izoh: 'sinov' });
    ok('kassa yopildi, farq (-5000 bo\'lishi kerak)', ky.farq);
    kh = amallar['kassa.holat']({});
    ok('yopgandan keyin hisob noldan boshlandi', kh.kutilgan_naqd);
    ok('kassa tarixi yozuvlari', amallar['kassa.tarix']({}).length);

    console.log('\n=== 14. Narx tarixi ===');
    amallar['tovar.narx']({ id: t3, sotuv_narx: 19000 });
    amallar['tovar.saqla']({ id: t3, nomi: 'Fanta 2L', sotuv_narx: 20000, tan_narx: 15000, blok_soni: 6 });
    const nt = amallar['hisobot.narxTarix']({});
    ok("narx o'zgarishlari yozildi", nt.length);
    ok('oxirgi yozuv', { nomi: nt[0].nomi, tur: nt[0].tur, eski: nt[0].eski, yangi: nt[0].yangi, kim: nt[0].ism });

    console.log('\n=== 15. Grafik ===');
    const g = amallar['hisobot.grafik']({ kunlar: 7 });
    ok('7 kunlik grafik', g.length + ' kun, bugungi savdo: ' + g[g.length - 1].savdo);

    console.log('\n=== 16. Tugayotgan tovar ogohlantirishi ===');
    amallar['tovar.saqla']({ nomi: 'Sinov suvi', sotuv_narx: 5000, min_qoldiq: 10, qoldiq: 12 });
    const sinovId = amallar['tovar.royxat']({ qidiruv: 'Sinov suvi' })[0].id;
    const navbat1 = amallar['telegram.holat']().kutmoqda;
    amallar['sotuv.yarat']({ qatorlar: [{ tovar_id: sinovId, miqdor: 5, narx: 5000 }], naqd: 25000, chopEt: false });
    const navbat2 = amallar['telegram.holat']().kutmoqda;
    ok('qoldiq 7 (chegara 10) -> ogohlantirish yuborildi', navbat2 === navbat1 + 2);
    amallar['sotuv.yarat']({ qatorlar: [{ tovar_id: sinovId, miqdor: 1, narx: 5000 }], naqd: 5000, chopEt: false });
    const navbat3 = amallar['telegram.holat']().kutmoqda;
    ok('bir kunda takror ogohlantirmaydi', navbat3 === navbat2 + 1);

    console.log('\n=== 17. Demo va tozalash ===');
    const d = amallar['tizim.demoQosh']({});
    ok("demo tovarlar qo'shildi", d.qoshildi);
    const demoTovar = amallar['tovar.royxat']({ qidiruv: 'Red Bull' })[0];
    ok('demo tovar', {
      nomi: demoTovar.nomi,
      sotuv: demoTovar.sotuv_narx,
      tan: demoTovar.tan_narx,
      qoldiq: demoTovar.qoldiq,
    });
    const tz = amallar['tizim.sotuvlarniTozala']();
    ok('sotuvlar tozalandi', tz);
    ok('tozalashdan keyin sotuvlar soni', amallar['sotuv.royxat']({}).length);
    ok('mijoz qarzi nolga tushdi', amallar['mijoz.royxat']({})[0].qarz);
    ok('qoldiq kirimlardan qayta hisoblandi (Red Bull)', amallar['tovar.royxat']({ qidiruv: 'Red Bull' })[0].qoldiq);
    ok("bo'sh kategoriyalar tozalandi", amallar['kategoriya.boshlarniOchir']());

    console.log('\n=== 18. QARZ HISOBI (batafsil) ===');
    const tekshir = (nom, kutilgan, haqiqiy) => {
      const togri = Math.abs(kutilgan - haqiqiy) < 0.5;
      console.log(`  ${togri ? '✓' : '✗ XATO!'} ${nom}: kutilgan ${kutilgan}, natija ${haqiqiy}`);
      if (!togri) xatolar++;
    };
    let xatolar = 0;

    const mq = amallar['mijoz.saqla']({ ism: 'Qarzdor mijoz' });
    const tq = amallar['tovar.saqla']({ nomi: 'Qarz suvi', sotuv_narx: 1000, tan_narx: 700, qoldiq: 10000 });
    const qarzSot = (summa) =>
      amallar['sotuv.yarat']({
        mijoz_id: mq,
        qatorlar: [{ tovar_id: tq, miqdor: summa / 1000, narx: 1000 }],
        qarz: summa,
        chopEt: false,
      });
    const mijozQarzi = () => amallar['mijoz.royxat']({ qidiruv: 'Qarzdor' })[0].qarz;

    const s1 = qarzSot(100000);
    const s2 = qarzSot(200000);
    const s3 = qarzSot(300000);
    tekshir('3 ta qarzli sotuvdan keyin', 600000, mijozQarzi());

    amallar['qarz.tolov']({ mijoz_id: mq, summa: 150000, usul: 'naqd' });
    tekshir("150 000 to'lovdan keyin", 450000, mijozQarzi());
    let taf = amallar['qarz.tafsilot']({ mijoz_id: mq });
    const chek1 = taf.cheklar.find((c) => c.id === s1.id);
    const chek2 = taf.cheklar.find((c) => c.id === s2.id);
    tekshir('1-chek to\'liq yopildi', 0, chek1.qarz_qoldiq);
    tekshir('2-chekdan 50 000 yechildi', 150000, chek2.qarz_qoldiq);
    tekshir('3-chek tegilmadi', 300000, taf.cheklar.find((c) => c.id === s3.id).qarz_qoldiq);

    amallar['qarz.tolov']({ mijoz_id: mq, summa: 500000, usul: 'karta' });
    tekshir("500 000 to'lov (50 000 ortiqcha)", -50000, mijozQarzi());
    taf = amallar['qarz.tafsilot']({ mijoz_id: mq });
    tekshir('avansda saqlandi', 50000, taf.mijoz.avans);
    tekshir('hamma cheklar yopildi', 0, taf.cheklar.reduce((s, c) => s + c.qarz_qoldiq, 0));

    const s4 = qarzSot(200000);
    tekshir('yangi qarzdan avans yechildi (200k - 50k)', 150000, mijozQarzi());

    amallar['sotuv.bekor']({ id: s4.id, sabab: 'sinov' });
    tekshir('bekor qilingandan keyin', -50000, mijozQarzi());

    const s5 = qarzSot(80000);
    amallar['qarz.tolov']({ mijoz_id: mq, summa: 30000, usul: 'naqd' });
    tekshir("80k qarz - 50k avans - 30k to'lov", 0, mijozQarzi());

    const t = amallar['qarz.tekshir']();
    tekshir('nazorat tekshiruvi farq topmadi', 0, t.tuzatilgan.length);

    // qisman to'lov tovarlar kesimida to'g'ri ko'rinadimi
    const s6 = qarzSot(100000); // 100 dona
    amallar['qarz.tolov']({ mijoz_id: mq, summa: 40000, usul: 'naqd' });
    taf = amallar['qarz.tafsilot']({ mijoz_id: mq });
    const chek6 = taf.cheklar.find((c) => c.id === s6.id);
    tekshir('qisman to\'langan chek qoldig\'i', 60000, chek6.qarz_qoldiq);
    tekshir('qarzdagi tovar miqdori (100 dona -> 60 dona)', 60, chek6.qatorlar[0].qarzdagi_miqdor);
    console.log(`  ${xatolar === 0 ? '✓ QARZ HISOBIDA XATO YO\'Q' : '✗ ' + xatolar + ' TA XATO BOR!'}`);

    console.log('\n=== 19. Yangi hisobotlar ===');
    ok('kategoriyalar kesimi', amallar['hisobot.kategoriya']({ dan: '2000-01-01' }).length + ' ta kategoriya');
    const tt = amallar['hisobot.tovarTahlil']({});
    ok('tovar tahlili', tt.length + ' ta tovar');
    const eng = tt.filter((x) => x.sotilgan > 0).sort((a, b) => b.sotilgan - a.sotilgan)[0];
    if (eng) ok('eng ko\'p sotilgan', { nomi: eng.nomi, sotilgan: eng.sotilgan, kunlik: eng.kunlik_ortacha, yetadi: eng.yetadi_kun });
    ok('tovar tarixi (30 kun)', amallar['hisobot.tovarTarix']({ tovar_id: tq, kunlar: 30 }).length);
    const tam = amallar['hisobot.taminotchilar']({});
    ok("ta'minotchilar", tam.royxat.map((x) => `${x.taminotchi}: ${x.jami}`));
    const kunlik = amallar['sotuv.kunlik']({});
    ok('bugungi savdo', { cheklar: kunlik.cheklar.length, savdo: kunlik.jami.savdo, tovarlar: kunlik.tovarlar.length });

    console.log('\n=== 20. Kategoriya boshqaruvi ===');
    const katId = amallar['kategoriya.saqla']({ nomi: 'Sinov kategoriyasi' });
    amallar['kategoriya.biriktir']({ kategoriya_id: katId, tovar_idlar: [tq, t1] });
    ok('kategoriyaga biriktirildi', amallar['kategoriya.tovarlar']({ kategoriya_id: katId }).map((x) => x.nomi));
    amallar['kategoriya.saqla']({ id: katId, nomi: 'Nomi ozgardi' });
    ok('nomi o\'zgartirildi', amallar['kategoriya.royxat']().find((k) => k.id === katId).nomi);
    const och = amallar['kategoriya.ochir']({ id: katId });
    ok("o'chirildi, tovarlar kategoriyasiz qoldi", och);
    ok('tovar saqlanib qoldi', amallar['tovar.royxat']({ qidiruv: 'Qarz suvi' }).length === 1);

    console.log('\n=== 21. Boshlang\'ich qoldiq kirimga tushadimi ===');
    const kirimOldin = amallar['kirim.royxat']({}).length;
    const bq = amallar['tovar.saqla']({
      nomi: 'Boshlangich qoldiqli tovar',
      sotuv_narx: 5000,
      tan_narx: 4000,
      qoldiq: 50,
    });
    const kirimKeyin = amallar['kirim.royxat']({});
    ok('kirim hujjati yaratildi', kirimKeyin.length === kirimOldin + 1);
    ok('kirim izohi', kirimKeyin[0].izoh + ' · ' + kirimKeyin[0].jami + " so'm");
    const bqTovar = amallar['tovar.royxat']({ qidiruv: 'Boshlangich' })[0];
    ok('qoldiq va tan narx', { qoldiq: bqTovar.qoldiq, tan_narx: bqTovar.tan_narx });
    // kirim ro'yxatida tovar ko'rinadimi (kirim oynasi shu ro'yxatdan foydalanadi)
    ok('tovar kirim ro\'yxatida bor', amallar['tovar.royxat']({}).some((t) => t.id === bq));
    // tozalashdan keyin ham qoldiq saqlanib qoladimi
    amallar['tizim.sotuvlarniTozala']();
    ok('sotuvlar tozalangach qoldiq saqlandi', amallar['tovar.royxat']({ qidiruv: 'Boshlangich' })[0].qoldiq);

    console.log('\n✅ BARCHA SINOVLAR TUGADI\n');
  } catch (e) {
    console.error('\n❌ SINOV XATOSI:', e);
  }
  app.exit(0);
});
