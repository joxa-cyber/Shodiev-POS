import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { amal, pul, miqdorFmt, sanaChiroyli, vaqtChiroyli } from '../api.js';
import { Modal } from '../components/Ui.jsx';
import Grafik from '../components/Grafik.jsx';

// Har bir tovar bo'yicha tahlil: nima ko'p sotilyapti, nima yotib qolgan
export default function TovarTahlil({ dan, gacha, filial, toast, rahbarmi }) {
  const [royxat, setRoyxat] = useState(null);
  const [tartib, setTartib] = useState('savdo');
  const [qidiruv, setQidiruv] = useState('');
  const [faqat, setFaqat] = useState('hammasi');
  const [tanlangan, setTanlangan] = useState(null);

  const yukla = useCallback(() => {
    amal('hisobot.tovarTahlil', { dan, gacha, filial_id: filial })
      .then(setRoyxat)
      .catch((e) => toast.xato(e.message));
  }, [dan, gacha, filial]);

  useEffect(yukla, [yukla]);

  const korinadi = useMemo(() => {
    if (!royxat) return [];
    const q = qidiruv.trim().toLowerCase();
    let r = royxat.filter((t) => !q || t.nomi.toLowerCase().includes(q));
    if (faqat === 'sotilgan') r = r.filter((t) => t.sotilgan > 0);
    if (faqat === 'sotilmagan') r = r.filter((t) => t.sotilgan === 0);
    if (faqat === 'tugayotgan') r = r.filter((t) => t.yetadi_kun !== null && t.yetadi_kun <= 7);
    const tartiblar = {
      savdo: (a, b) => b.savdo - a.savdo,
      miqdor: (a, b) => b.sotilgan - a.sotilgan,
      foyda: (a, b) => b.foyda - a.foyda,
      kam: (a, b) => a.sotilgan - b.sotilgan,
      nomi: (a, b) => a.nomi.localeCompare(b.nomi),
      qoldiq: (a, b) => b.qoldiq - a.qoldiq,
    };
    return [...r].sort(tartiblar[tartib]);
  }, [royxat, qidiruv, tartib, faqat]);

  if (!royxat) return <div className="yuklanmoqda">Yuklanmoqda...</div>;

  const kunSoni = royxat[0] ? royxat[0].kun_soni : 1;
  const jamiSavdo = korinadi.reduce((s, t) => s + t.savdo, 0);
  const sotilmagan = royxat.filter((t) => t.sotilgan === 0).length;

  return (
    <>
      <div className="qator" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="inp"
          style={{ maxWidth: 260 }}
          placeholder="Tovarni qidirish..."
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
        />
        <select className="inp" style={{ width: 190 }} value={tartib} onChange={(e) => setTartib(e.target.value)}>
          <option value="savdo">Savdo bo'yicha (ko'pdan)</option>
          <option value="miqdor">Dona bo'yicha (ko'pdan)</option>
          {rahbarmi && <option value="foyda">Foyda bo'yicha</option>}
          <option value="kam">Eng kam sotilgan</option>
          <option value="qoldiq">Qoldiq bo'yicha</option>
          <option value="nomi">Nomi bo'yicha</option>
        </select>
        <div className="chip-qator">
          {[
            ['hammasi', 'Hammasi'],
            ['sotilgan', 'Sotilganlar'],
            ['sotilmagan', `Sotilmaganlar (${sotilmagan})`],
            ['tugayotgan', '7 kunga yetmaydi'],
          ].map(([k, n]) => (
            <button key={k} className={'chip' + (faqat === k ? ' faol' : '')} onClick={() => setFaqat(k)}>
              {n}
            </button>
          ))}
        </div>
        <span className="xira kichik qator-oxiri">
          {korinadi.length} ta tovar · {pul(jamiSavdo)} so'm · {kunSoni} kunlik
        </span>
      </div>

      <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
        <table className="jadval">
          <thead>
            <tr>
              <th>Tovar</th>
              <th className="ong">Sotilgan</th>
              <th className="ong">Kuniga o'rtacha</th>
              <th className="ong">Savdo</th>
              {rahbarmi && <th className="ong">Foyda</th>}
              <th className="ong">Qoldiq</th>
              <th className="ong">Yetadi</th>
              <th>Oxirgi sotuv</th>
            </tr>
          </thead>
          <tbody>
            {korinadi.map((t) => (
              <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setTanlangan(t)}>
                <td>
                  <div className="qalin">{t.nomi}</div>
                  {t.kategoriya && <div className="xira kichik">{t.kategoriya}</div>}
                </td>
                <td className="ong qalin">{t.sotilgan > 0 ? `${miqdorFmt(t.sotilgan)} dona` : <span className="xira">—</span>}</td>
                <td className="ong xira">{t.kunlik_ortacha > 0 ? miqdorFmt(t.kunlik_ortacha) : '—'}</td>
                <td className="ong qalin">{pul(t.savdo)}</td>
                {rahbarmi && (
                  <td className="ong" style={{ color: 'var(--yashil)' }}>
                    {pul(t.foyda)}
                  </td>
                )}
                <td className="ong">{miqdorFmt(t.qoldiq)}</td>
                <td className="ong">
                  {t.yetadi_kun === null ? (
                    <span className="xira">—</span>
                  ) : (
                    <span className={'nishon ' + (t.yetadi_kun <= 3 ? 'n-qizil' : t.yetadi_kun <= 7 ? 'n-sariq' : 'n-yashil')}>
                      {t.yetadi_kun} kun
                    </span>
                  )}
                </td>
                <td className="kichik xira">{t.oxirgi ? vaqtChiroyli(t.oxirgi) : 'sotilmagan'}</td>
              </tr>
            ))}
            {!korinadi.length && (
              <tr>
                <td colSpan={8} className="markaz xira" style={{ padding: 30 }}>
                  Tovar topilmadi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TovarOynasi tovar={tanlangan} yop={() => setTanlangan(null)} filial={filial} rahbarmi={rahbarmi} />
    </>
  );
}

/* ---------- Bitta tovarning dinamikasi ---------- */
function TovarOynasi({ tovar, yop, filial, rahbarmi }) {
  const [kunlar, setKunlar] = useState(null);
  const [oylar, setOylar] = useState(null);
  const [korinish, setKorinish] = useState('kun');

  useEffect(() => {
    if (!tovar) return;
    setKunlar(null);
    setOylar(null);
    amal('hisobot.tovarTarix', { tovar_id: tovar.id, kunlar: 30, filial_id: filial })
      .then(setKunlar)
      .catch(() => {});
    amal('hisobot.tovarTarix', { tovar_id: tovar.id, oylik: true, filial_id: filial })
      .then(setOylar)
      .catch(() => {});
  }, [tovar, filial]);

  if (!tovar) return null;

  return (
    <Modal ochiq={!!tovar} yop={yop} sarlavha={tovar.nomi} kenglik={760}>
      <div className="stat-setka" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat-yorliq">Sotilgan ({tovar.kun_soni} kun)</div>
          <div className="stat-qiymat">{miqdorFmt(tovar.sotilgan)}</div>
          <div className="stat-izoh">kuniga o'rtacha {miqdorFmt(tovar.kunlik_ortacha)} dona</div>
        </div>
        <div className="stat">
          <div className="stat-yorliq">Savdo</div>
          <div className="stat-qiymat">{pul(tovar.savdo)}</div>
          <div className="stat-izoh">{tovar.chek} ta chekda</div>
        </div>
        {rahbarmi && (
          <div className="stat">
            <div className="stat-yorliq">Foyda</div>
            <div className="stat-qiymat" style={{ color: 'var(--yashil)' }}>
              {pul(tovar.foyda)}
            </div>
            <div className="stat-izoh">
              1 donadan {pul(tovar.sotuv_narx - tovar.tan_narx)}
            </div>
          </div>
        )}
        <div className="stat">
          <div className="stat-yorliq">Qoldiq</div>
          <div className="stat-qiymat">{miqdorFmt(tovar.qoldiq)}</div>
          <div className="stat-izoh">
            {tovar.yetadi_kun !== null ? `~${tovar.yetadi_kun} kunga yetadi` : 'sotuv yo‘q'}
          </div>
        </div>
      </div>

      <div className="tab-qator">
        <button className={'tab' + (korinish === 'kun' ? ' faol' : '')} onClick={() => setKorinish('kun')}>
          Kunlik (30 kun)
        </button>
        <button className={'tab' + (korinish === 'oy' ? ' faol' : '')} onClick={() => setKorinish('oy')}>
          Oylik (1 yil)
        </button>
      </div>

      {korinish === 'kun' &&
        (kunlar ? (
          <Grafik
            malumot={kunlar.map((k) => ({ ...k, savdo: k.savdo, chek: k.miqdor }))}
            foydaKorsat={rahbarmi}
            balandlik={200}
          />
        ) : (
          <div className="yuklanmoqda">Yuklanmoqda...</div>
        ))}

      {korinish === 'oy' &&
        (oylar ? (
          <table className="jadval">
            <thead>
              <tr>
                <th>Oy</th>
                <th className="ong">Sotilgan</th>
                <th className="ong">Savdo</th>
                {rahbarmi && <th className="ong">Foyda</th>}
              </tr>
            </thead>
            <tbody>
              {oylar.map((o) => (
                <tr key={o.kun}>
                  <td className="qalin">{o.kun}</td>
                  <td className="ong">{miqdorFmt(o.miqdor)} dona</td>
                  <td className="ong qalin">{pul(o.savdo)}</td>
                  {rahbarmi && (
                    <td className="ong" style={{ color: 'var(--yashil)' }}>
                      {pul(o.foyda)}
                    </td>
                  )}
                </tr>
              ))}
              {!oylar.length && (
                <tr>
                  <td colSpan={4} className="markaz xira" style={{ padding: 20 }}>
                    Ma'lumot yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="yuklanmoqda">Yuklanmoqda...</div>
        ))}
    </Modal>
  );
}
