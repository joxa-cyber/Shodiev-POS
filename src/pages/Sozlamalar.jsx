import React, { useEffect, useState } from 'react';
import { amal, vaqtChiroyli } from '../api.js';
import { Tasdiq } from '../components/Ui.jsx';
import TelegramSozlama from '../components/TelegramSozlama.jsx';

export default function Sozlamalar({ toast }) {
  const [s, setS] = useState(null);
  const [printerlar, setPrinterlar] = useState([]);
  const [tab, setTab] = useState('dokon');
  const [backuplar, setBackuplar] = useState([]);
  const [band, setBand] = useState(false);
  const [tasdiq, setTasdiq] = useState(null);
  const [kategoriyalar, setKategoriyalar] = useState([]);
  const [dastur, setDastur] = useState(null);
  const [fon, setFon] = useState(null);

  useEffect(() => {
    amal('sozlama.hammasi').then(setS).catch((e) => toast.xato(e.message));
    amal('printer.royxat').then(setPrinterlar).catch(() => {});
    amal('backup.royxat').then(setBackuplar).catch(() => {});
    amal('kategoriya.royxat').then(setKategoriyalar).catch(() => {});
    amal('yangilanish.holat').then(setDastur).catch(() => {});
    amal('tizim.fonHolati').then(setFon).catch(() => {});
  }, []);

  if (!s) return <div className="yuklanmoqda">Yuklanmoqda...</div>;
  const oz = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const belgi = (k) => (e) => setS({ ...s, [k]: e.target.checked ? '1' : '0' });

  async function saqla() {
    setBand(true);
    try {
      await amal('sozlama.saqla', s);
      toast.ok('Sozlamalar saqlandi');
    } catch (e) {
      toast.xato(e.message);
    } finally {
      setBand(false);
    }
  }

  async function printerSinov() {
    try {
      await amal('sozlama.saqla', { printer_nomi: s.printer_nomi, chek_eni: s.chek_eni });
      await amal('printer.sinov');
      toast.ok('Sinov cheki printerga yuborildi');
    } catch (e) {
      toast.xato('Chop etishda xato: ' + e.message);
    }
  }

  async function backupYarat() {
    setBand(true);
    try {
      await amal('backup.yarat', { telegramga: true });
      toast.ok('Zaxira nusxa yaratildi va Telegramga yuborildi');
      amal('backup.royxat').then(setBackuplar);
    } catch (e) {
      toast.xato(e.message);
    } finally {
      setBand(false);
    }
  }

  return (
    <div className="sahifa">
      <div className="tab-qator">
        {[
          ['dokon', "Do'kon ma'lumotlari"],
          ['chek', 'Chek va printer'],
          ['telegram', 'Telegram bot'],
          ['backup', 'Zaxira nusxa'],
          ['demo', 'Demo / Tozalash'],
          ['dastur', 'Dastur'],
        ].map(([k, n]) => (
          <button key={k} className={'tab' + (tab === k ? ' faol' : '')} onClick={() => setTab(k)}>
            {n}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 780 }}>
        {tab === 'dokon' && (
          <div className="karta">
            <div className="maydon">
              <label className="yorliq">Do'kon nomi (chekda va botda chiqadi)</label>
              <input className="inp" value={s.dokon_nomi} onChange={oz('dokon_nomi')} />
            </div>
            <div className="maydon">
              <label className="yorliq">Manzil</label>
              <input className="inp" value={s.dokon_manzil} onChange={oz('dokon_manzil')} />
            </div>
            <div className="maydon">
              <label className="yorliq">Telefon</label>
              <input className="inp" value={s.dokon_telefon} onChange={oz('dokon_telefon')} />
            </div>
            <div className="maydon">
              <label className="yorliq">Chek oxiridagi matn</label>
              <input className="inp" value={s.chek_pastki_matn} onChange={oz('chek_pastki_matn')} />
            </div>
          </div>
        )}

        {tab === 'chek' && (
          <div className="karta">
            <div className="maydon">
              <label className="yorliq">Chek printeri</label>
              <select className="inp" value={s.printer_nomi} onChange={oz('printer_nomi')}>
                <option value="">— Windowsdagi asosiy printer —</option>
                {printerlar.map((p) => (
                  <option key={p.nomi} value={p.nomi}>
                    {p.nomi} {p.standart ? '(asosiy)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="maydon">
              <label className="yorliq">Chek eni</label>
              <select className="inp" value={s.chek_eni} onChange={oz('chek_eni')}>
                <option value="80">80 mm (XP-80T va shunga o'xshash)</option>
                <option value="58">58 mm (kichik printerlar)</option>
              </select>
            </div>
            <label className="qator kichik" style={{ gap: 8, marginBottom: 14 }}>
              <input type="checkbox" checked={s.avto_chop === '1'} onChange={belgi('avto_chop')} />
              Sotuv yakunlanganda chek avtomatik chop etilsin
            </label>
            <button className="btn btn-kok" onClick={printerSinov}>
              🖨 Sinov chekini chiqarish
            </button>
            <p className="xira kichik" style={{ marginTop: 10 }}>
              Chek yuqorisida do'kon logotipi avtomatik chop etiladi.
            </p>
          </div>
        )}

        {tab === 'telegram' && <TelegramSozlama s={s} setS={setS} saqla={saqla} toast={toast} />}

        {tab === 'backup' && (
          <div className="karta">
            <p className="xira kichik" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              Zaxira nusxa har kuni avtomatik yaratiladi: kompyuterdagi papkaga saqlanadi va Telegram orqali rahbarga
              yuboriladi. Kompyuter buzilsa, yangi kompyuterga shu fayl tiklanadi.
            </p>
            <label className="qator kichik" style={{ gap: 8, marginBottom: 14 }}>
              <input type="checkbox" checked={s.backup_telegram === '1'} onChange={belgi('backup_telegram')} />
              Zaxira nusxa Telegramga ham yuborilsin
            </label>
            <div className="qator" style={{ marginBottom: 18 }}>
              <button className="btn btn-yashil" onClick={backupYarat} disabled={band}>
                💾 Hozir zaxira nusxa yaratish
              </button>
              <button className="btn" onClick={() => amal('backup.papkaOch')}>
                📂 Papkani ochish
              </button>
            </div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Oxirgi nusxalar</h4>
            <table className="jadval">
              <tbody>
                {backuplar.slice(0, 10).map((b) => (
                  <tr key={b.nomi}>
                    <td className="kichik">{b.nomi}</td>
                    <td className="kichik xira">{vaqtChiroyli(b.sana)}</td>
                    <td className="ong kichik">{Math.round(b.hajm / 1024)} KB</td>
                  </tr>
                ))}
                {!backuplar.length && (
                  <tr>
                    <td className="xira kichik">Hali nusxa yaratilmagan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'demo' && (
          <div className="karta">
            <h4 style={{ fontSize: 15, marginBottom: 6 }}>Test uchun demo tovarlar</h4>
            <p className="xira kichik" style={{ marginBottom: 14, lineHeight: 1.6 }}>
              20 ta tanish ichimlik (Pepsi, Coca-Cola, Fanta, Qarshi suv, Red Bull...) kategoriyalari,
              narxlari va qoldig'i bilan qo'shiladi. Kelgan narxi sotuv narxidan 500–1000 so'm arzon
              qilib belgilanadi, shunda foyda hisobini ko'rib sinaysiz.
            </p>
            <button
              className="btn btn-yashil"
              disabled={band}
              onClick={async () => {
                setBand(true);
                try {
                  const r = await amal('tizim.demoQosh', {});
                  toast.ok(r.qoshildi ? `${r.qoshildi} ta demo tovar qo'shildi` : 'Demo tovarlar allaqachon mavjud');
                  setKategoriyalar(await amal('kategoriya.royxat'));
                } catch (e) {
                  toast.xato(e.message);
                } finally {
                  setBand(false);
                }
              }}
            >
              📦 Demo tovarlarni qo'shish
            </button>

            <hr style={{ margin: '22px 0', border: 0, borderTop: '1px solid var(--chegara)' }} />

            <h4 style={{ fontSize: 15, marginBottom: 6 }}>Kategoriyalar</h4>
            <p className="xira kichik" style={{ marginBottom: 12 }}>
              Tovari yo'q kategoriyalarni bir bosishda tozalab tashlash mumkin.
            </p>
            <div className="chip-qator" style={{ marginBottom: 12 }}>
              {kategoriyalar.map((k) => (
                <span key={k.id} className="chip" style={{ cursor: 'default' }}>
                  {k.nomi}
                  <b className="xira" style={{ marginLeft: 6 }}>{k.tovar_soni}</b>
                  {k.tovar_soni === 0 && (
                    <span
                      style={{ marginLeft: 8, color: 'var(--qizil)', cursor: 'pointer', fontWeight: 700 }}
                      title="O'chirish"
                      onClick={async () => {
                        try {
                          await amal('kategoriya.ochir', { id: k.id });
                          setKategoriyalar(await amal('kategoriya.royxat'));
                        } catch (e) {
                          toast.xato(e.message);
                        }
                      }}
                    >
                      ✕
                    </span>
                  )}
                </span>
              ))}
              {!kategoriyalar.length && <span className="xira kichik">Kategoriya yo'q</span>}
            </div>
            <button
              className="btn"
              onClick={async () => {
                try {
                  const r = await amal('kategoriya.boshlarniOchir');
                  toast.ok(`${r.ochirildi} ta bo'sh kategoriya o'chirildi`);
                  setKategoriyalar(await amal('kategoriya.royxat'));
                } catch (e) {
                  toast.xato(e.message);
                }
              }}
            >
              🧽 Bo'sh kategoriyalarni tozalash
            </button>

            <hr style={{ margin: '22px 0', border: 0, borderTop: '1px solid var(--chegara)' }} />

            <h4 style={{ fontSize: 15, marginBottom: 6 }}>Tozalash</h4>
            <p className="xira kichik" style={{ marginBottom: 14, lineHeight: 1.6 }}>
              Sinov qilib bo'lgach, test sotuvlarini tozalab, toza holatdan ishni boshlang.
            </p>
            <div className="qator" style={{ flexWrap: 'wrap' }}>
              <button
                className="btn btn-sariq"
                onClick={() =>
                  setTasdiq({
                    sarlavha: 'Sotuvlarni tozalash',
                    matn: "Barcha sotuvlar, qarzlar va qarz to'lovlari o'chiriladi. Tovarlar, narxlar va kirimlar joyida qoladi, qoldiq kirimlar bo'yicha qayta hisoblanadi. Davom etasizmi?",
                    tugma: 'Ha, sotuvlarni tozalash',
                    ish: async () => {
                      const r = await amal('tizim.sotuvlarniTozala');
                      toast.ok(`${r.ochirildi} ta chek o'chirildi, qoldiqlar qayta hisoblandi`);
                    },
                  })
                }
              >
                🧹 Sotuvlarni tozalash
              </button>
              <button
                className="btn btn-qizil"
                onClick={() =>
                  setTasdiq({
                    sarlavha: 'HAMMASINI tozalash',
                    matn: "Tovarlar, kirimlar, sotuvlar, mijozlar — HAMMASI ochiriladi. Faqat xodimlar, filiallar va sozlamalar qoladi. Bu amalni ortga qaytarib bo'lmaydi!",
                    tugma: 'Ha, hammasini tozalash',
                    ish: async () => {
                      await amal('tizim.hammasiniTozala');
                      toast.ok("Hamma ma'lumot tozalandi — toza boshlash mumkin");
                    },
                  })
                }
              >
                🗑 Hammasini tozalash
              </button>
            </div>
            <p className="xira kichik" style={{ marginTop: 12 }}>
              Maslahat: tozalashdan oldin «Zaxira nusxa» bo'limidan nusxa olib qo'ying.
            </p>
          </div>
        )}

        {tab === 'dastur' && fon && (
          <div className="karta" style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 15, marginBottom: 6 }}>Fon rejimi</h4>
            <p className="xira kichik" style={{ marginBottom: 14, lineHeight: 1.6 }}>
              Fon rejimi yoqilgan bo'lsa, dastur oynasini yopganingizda ham u soat yonidagi belgida
              ishlashda davom etadi. Shunda <b>Telegram bot javob beraveradi</b>, savdo xabarlari va
              zaxira nusxa yuboriladi. Butunlay yopish uchun belgini o'ng tugma bilan bosib
              «Butunlay chiqish» ni tanlaysiz.
            </p>
            <label className="qator kichik" style={{ gap: 8, padding: '5px 0' }}>
              <input
                type="checkbox"
                checked={fon.fon_rejimi}
                onChange={async (e) => {
                  const r = await amal('tizim.fonSozla', { fon_rejimi: e.target.checked });
                  setFon(r);
                  toast.ok(e.target.checked ? 'Fon rejimi yoqildi' : "Fon rejimi o'chirildi");
                }}
              />
              Oyna yopilganda dastur fonda ishlashda davom etsin (tavsiya etiladi)
            </label>
            <label className="qator kichik" style={{ gap: 8, padding: '5px 0' }}>
              <input
                type="checkbox"
                checked={fon.avto_ishga_tushish}
                onChange={async (e) => {
                  const r = await amal('tizim.fonSozla', { avto_ishga_tushish: e.target.checked });
                  setFon(r);
                  toast.ok(
                    e.target.checked
                      ? 'Kompyuter yoqilganda dastur o\u2018zi ishga tushadi'
                      : 'Avtomatik ishga tushish o\u2018chirildi'
                  );
                }}
              />
              Kompyuter yoqilganda dastur avtomatik ishga tushsin (fonda)
            </label>
          </div>
        )}

        {tab === 'dastur' && dastur && (
          <div className="karta">
            <h4 style={{ fontSize: 15, marginBottom: 10 }}>Dastur haqida</h4>
            <table className="jadval" style={{ marginBottom: 18 }}>
              <tbody>
                <tr>
                  <td className="xira">Versiya</td>
                  <td className="qalin">{dastur.versiya}</td>
                </tr>
                <tr>
                  <td className="xira">Holat</td>
                  <td>
                    {!dastur.paketlangan ? (
                      <span className="nishon n-sariq">Dasturchi rejimi (yangilanish ishlamaydi)</span>
                    ) : dastur.yuklandi ? (
                      <span className="nishon n-yashil">Yangi versiya tayyor: {dastur.yangi}</span>
                    ) : dastur.yangi ? (
                      <span className="nishon n-kok">Yuklanmoqda: {dastur.foiz}%</span>
                    ) : (
                      <span className="nishon n-yashil">Eng so'nggi versiya ✓</span>
                    )}
                  </td>
                </tr>
                {dastur.xato && (
                  <tr>
                    <td className="xira">Xato</td>
                    <td className="kichik" style={{ color: 'var(--qizil)' }}>{dastur.xato}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="qator">
              <button
                className="btn btn-kok"
                disabled={band}
                onClick={async () => {
                  setBand(true);
                  try {
                    const r = await amal('yangilanish.tekshir');
                    setDastur(r);
                    toast.ok(r.yangi ? `Yangi versiya topildi: ${r.yangi}` : "Sizda eng so'nggi versiya");
                  } catch (e) {
                    toast.xato(e.message);
                  } finally {
                    setBand(false);
                  }
                }}
              >
                🔄 Yangilanishni tekshirish
              </button>
              {dastur.yuklandi && (
                <button className="btn btn-yashil" onClick={() => amal('yangilanish.ornat')}>
                  ⬆ Yangilash va qayta ishga tushirish
                </button>
              )}
            </div>

            <p className="xira kichik" style={{ marginTop: 14, lineHeight: 1.6 }}>
              Dastur har 4 soatda yangilanishni o'zi tekshiradi. Yangi versiya chiqsa, orqa fonda
              yuklab oladi va yuqorida «Yangilash» tugmasi paydo bo'ladi — savdo yarim qolmasligi uchun
              qayta ishga tushirishni o'zingiz tanlaysiz.
            </p>
          </div>
        )}

        {tab !== 'demo' && tab !== 'dastur' && (
          <div className="qator" style={{ marginTop: 18 }}>
            <button className="btn btn-yashil btn-katta" onClick={saqla} disabled={band}>
              Sozlamalarni saqlash
            </button>
          </div>
        )}

        <Tasdiq
          ochiq={!!tasdiq}
          yop={() => setTasdiq(null)}
          sarlavha={tasdiq?.sarlavha}
          matn={tasdiq?.matn}
          tugma={tasdiq?.tugma}
          tasdiqla={async () => {
            setBand(true);
            try {
              await tasdiq.ish();
            } catch (e) {
              toast.xato(e.message);
            } finally {
              setBand(false);
            }
          }}
        />
      </div>
    </div>
  );
}
