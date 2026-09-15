import React, { useEffect, useState } from 'react';
import { amal, pul, miqdorFmt, vaqtChiroyli } from '../api.js';
import { Modal } from './Ui.jsx';

// Chekdagi tovarlarni qaytarish: bittasini ham, hammasini ham
export default function QaytarishOyna({ sotuv_id, yop, toast, tayyor }) {
  const [d, setD] = useState(null);
  const [miqdorlar, setMiqdorlar] = useState({});
  const [usul, setUsul] = useState('naqd');
  const [izoh, setIzoh] = useState('');
  const [band, setBand] = useState(false);

  useEffect(() => {
    if (!sotuv_id) return setD(null);
    setMiqdorlar({});
    setIzoh('');
    amal('sotuv.qaytarishHolati', { sotuv_id })
      .then((r) => {
        setD(r);
        // qarzga olingan bo'lsa, pulni qarzdan yechish mantiqiyroq
        setUsul(r.sotuv.qarz_qoldiq > 0 ? 'qarz' : r.sotuv.naqd > 0 ? 'naqd' : r.sotuv.karta > 0 ? 'karta' : 'naqd');
      })
      .catch((e) => {
        toast.xato(e.message);
        yop();
      });
  }, [sotuv_id]);

  if (!sotuv_id || !d) return null;

  const oz = (tovar_id, qiymat, maks) => {
    const n = Math.max(0, Math.min(Number(qiymat) || 0, maks));
    setMiqdorlar({ ...miqdorlar, [tovar_id]: n });
  };

  const hammasini = () => {
    const yangi = {};
    for (const q of d.qatorlar) if (q.qoldiq > 0) yangi[q.tovar_id] = q.qoldiq;
    setMiqdorlar(yangi);
  };

  const tanlangan = d.qatorlar
    .map((q) => ({ ...q, qaytariladi: Number(miqdorlar[q.tovar_id]) || 0 }))
    .filter((q) => q.qaytariladi > 0);
  const summa = tanlangan.reduce((s, q) => s + q.qaytariladi * q.narx, 0);
  const qaytarishMumkin = d.qatorlar.some((q) => q.qoldiq > 0);

  async function yubor() {
    setBand(true);
    try {
      const r = await amal('sotuv.qaytarish', {
        sotuv_id,
        qatorlar: tanlangan.map((q) => ({ tovar_id: q.tovar_id, miqdor: q.qaytariladi })),
        usul,
        izoh,
      });
      toast.ok(`Qaytarish №${r.raqam} · ${pul(r.summa)} so'm qaytarildi`);
      tayyor();
    } catch (e) {
      toast.xato(e.message);
    } finally {
      setBand(false);
    }
  }

  const USULLAR = [
    ['naqd', '💵 Naqd berildi'],
    ['karta', '💳 Kartaga'],
    ['terminal', '🏧 Terminalga'],
    ...(d.sotuv.qarz_qoldiq > 0 ? [['qarz', '📝 Qarzdan yechish']] : []),
  ];

  return (
    <Modal
      ochiq={!!sotuv_id}
      yop={yop}
      sarlavha={`Qaytarish — chek №${d.sotuv.raqam}`}
      kenglik={700}
      past={
        <>
          <button className="btn" onClick={yop}>
            Bekor
          </button>
          <button className="btn btn-qizil" onClick={yubor} disabled={band || !summa || !d.ruxsat}>
            {band ? 'Saqlanmoqda...' : `↩️ Qaytarish (${pul(summa)})`}
          </button>
        </>
      }
    >
      <div className="qator kichik xira" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span>{vaqtChiroyli(d.sotuv.sana)}</span>
        <span>· {d.sotuv.hodim}</span>
        {d.sotuv.mijoz && <span>· 🙍 {d.sotuv.mijoz}</span>}
        <span className="qator-oxiri">
          Chek summasi: <b>{pul(d.sotuv.jami)}</b>
        </span>
      </div>

      {!d.ruxsat && (
        <div className="karta" style={{ marginBottom: 12, background: 'var(--qizil-och)', borderColor: 'var(--qizil)' }}>
          ⚠️ {d.sabab}
        </div>
      )}

      {d.qaytarilgan_summa > 0 && (
        <div className="karta" style={{ marginBottom: 12, background: 'var(--sariq-och)', borderColor: 'var(--sariq)' }}>
          Bu chekdan avval <b>{pul(d.qaytarilgan_summa)} so'm</b> qaytarilgan ({d.qaytarishlar.length} marta)
        </div>
      )}

      {!qaytarishMumkin ? (
        <div className="karta markaz xira" style={{ padding: 24 }}>
          Bu chekdagi hamma tovar qaytarib bo'lingan
        </div>
      ) : (
        <>
          <div className="qator" style={{ marginBottom: 8 }}>
            <b className="kichik">Nimani qaytaramiz?</b>
            <button className="btn btn-kichik qator-oxiri" onClick={hammasini} disabled={!d.ruxsat}>
              Hammasini qaytarish
            </button>
            {Object.keys(miqdorlar).length > 0 && (
              <button className="btn btn-kichik" onClick={() => setMiqdorlar({})}>
                Tozalash
              </button>
            )}
          </div>

          <table className="jadval" style={{ marginBottom: 14 }}>
            <thead>
              <tr>
                <th>Tovar</th>
                <th className="ong">Sotilgan</th>
                <th className="ong">Qaytgan</th>
                <th className="ong" style={{ width: 150 }}>Qaytariladi</th>
                <th className="ong">Summa</th>
              </tr>
            </thead>
            <tbody>
              {d.qatorlar.map((q) => {
                const n = Number(miqdorlar[q.tovar_id]) || 0;
                return (
                  <tr key={q.id} style={{ opacity: q.qoldiq > 0 ? 1 : 0.5 }}>
                    <td>
                      <div className="qalin">{q.nomi}</div>
                      <div className="xira kichik">{pul(q.narx)} / dona</div>
                    </td>
                    <td className="ong">{miqdorFmt(q.miqdor)}</td>
                    <td className="ong xira">{q.qaytgan > 0 ? miqdorFmt(q.qaytgan) : '—'}</td>
                    <td className="ong">
                      {q.qoldiq > 0 ? (
                        <div className="miqdor-boshqaruv" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="miqdor-btn"
                            onClick={() => oz(q.tovar_id, n - 1, q.qoldiq)}
                            disabled={!d.ruxsat}
                          >
                            −
                          </button>
                          <input
                            className="miqdor-inp"
                            value={n || ''}
                            placeholder="0"
                            disabled={!d.ruxsat}
                            onChange={(e) => oz(q.tovar_id, e.target.value.replace(/[^\d.]/g, ''), q.qoldiq)}
                          />
                          <button
                            className="miqdor-btn"
                            onClick={() => oz(q.tovar_id, n + 1, q.qoldiq)}
                            disabled={!d.ruxsat}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="nishon n-yashil">to'liq qaytgan</span>
                      )}
                    </td>
                    <td className="ong qalin">{n > 0 ? pul(n * q.narx) : <span className="xira">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {summa > 0 && (
            <>
              <div className="maydon">
                <label className="yorliq">Pul qanday qaytariladi?</label>
                <div className="qator" style={{ flexWrap: 'wrap' }}>
                  {USULLAR.map(([k, n]) => (
                    <button
                      key={k}
                      className={'btn' + (usul === k ? ' btn-yashil' : '')}
                      onClick={() => setUsul(k)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {usul === 'qarz' && (
                  <div className="xira kichik" style={{ marginTop: 6 }}>
                    Mijozning shu chekdagi qarzi {pul(summa)} ga kamayadi
                  </div>
                )}
              </div>

              <div className="maydon">
                <label className="yorliq">Sabab (ixtiyoriy)</label>
                <input
                  className="inp"
                  value={izoh}
                  onChange={(e) => setIzoh(e.target.value)}
                  placeholder="Masalan: mijozga kerak bo'lmadi"
                />
              </div>

              <div className="karta" style={{ background: 'var(--qizil-och)', borderColor: 'var(--qizil)' }}>
                <div className="qator">
                  <span>Qaytariladigan summa:</span>
                  <b className="qator-oxiri" style={{ fontSize: 20 }}>
                    {pul(summa)} so'm
                  </b>
                </div>
                <div className="qator kichik xira" style={{ marginTop: 4 }}>
                  <span>Chekda qoladi:</span>
                  <span className="qator-oxiri">{pul(d.sotuv.jami - d.qaytarilgan_summa - summa)} so'm</span>
                </div>
              </div>
              <p className="xira kichik" style={{ marginTop: 10 }}>
                Tovar omborga qaytadi, savdo va kassa hisobidan avtomatik ayiriladi. Rahbarga xabar yuboriladi
                va qaytarish cheki bosiladi.
              </p>
            </>
          )}
        </>
      )}

      {d.qaytarishlar.length > 0 && (
        <>
          <h4 style={{ fontSize: 14, margin: '16px 0 8px' }}>Avvalgi qaytarishlar</h4>
          <table className="jadval">
            <tbody>
              {d.qaytarishlar.map((x) => (
                <tr key={x.id}>
                  <td className="kichik">{vaqtChiroyli(x.sana)}</td>
                  <td className="kichik xira">№{x.raqam}</td>
                  <td className="kichik">{x.hodim}</td>
                  <td className="ong qalin" style={{ color: 'var(--qizil)' }}>
                    {pul(-x.jami)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
