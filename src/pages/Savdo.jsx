import React, { useCallback, useEffect, useState } from 'react';
import { amal, pul, miqdorFmt, bugun, sanaQoshish, sanaChiroyli } from '../api.js';
import { Tasdiq } from '../components/Ui.jsx';

// Bugungi (yoki tanlangan kundagi) savdo: cheklar, tarkibi, qayta chop etish
export default function Savdo({ user, filial, toast }) {
  const [sana, setSana] = useState(bugun());
  const [d, setD] = useState(null);
  const [ochiq, setOchiq] = useState(null); // ochilgan chek id
  const [bekor, setBekor] = useState(null);
  const [korinish, setKorinish] = useState('cheklar');
  const rahbarmi = user.rol === 'rahbar';

  const yukla = useCallback(() => {
    amal('sotuv.kunlik', { sana, filial_id: filial })
      .then(setD)
      .catch((e) => toast.xato(e.message));
  }, [sana, filial]);

  useEffect(() => {
    yukla();
    const t = setInterval(yukla, 15000);
    return () => clearInterval(t);
  }, [yukla]);

  async function qaytaChop(id, raqam) {
    try {
      await amal('sotuv.qaytaChop', { id });
      toast.ok(`Chek №${raqam} qayta chop etildi (savdoga qo'shilmaydi)`);
    } catch (e) {
      toast.xato(e.message);
    }
  }

  if (!d) return <div className="yuklanmoqda">Yuklanmoqda...</div>;

  return (
    <div className="sahifa">
      <div className="qator" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-kichik" onClick={() => setSana(sanaQoshish(sana, -1))}>
          ‹ Oldingi kun
        </button>
        <input type="date" className="inp" style={{ width: 165 }} value={sana} onChange={(e) => setSana(e.target.value)} />
        <button
          className="btn btn-kichik"
          onClick={() => setSana(sanaQoshish(sana, 1))}
          disabled={sana >= bugun()}
        >
          Keyingi kun ›
        </button>
        {sana !== bugun() && (
          <button className="btn btn-kichik btn-yashil" onClick={() => setSana(bugun())}>
            Bugunga qaytish
          </button>
        )}
        <span className="xira kichik qator-oxiri">{sanaChiroyli(sana)}</span>
      </div>

      <div className="stat-setka" style={{ marginBottom: 16 }}>
        <Stat yorliq="Savdo" qiymat={pul(d.jami.savdo)} izoh={`${d.jami.chek_soni} ta chek`} rang="var(--yashil)" />
        {d.jami.foyda !== null && <Stat yorliq="Foyda" qiymat={pul(d.jami.foyda)} />}
        <Stat yorliq="Naqd" qiymat={pul(d.jami.naqd)} />
        <Stat yorliq="Karta" qiymat={pul(d.jami.karta)} />
        <Stat yorliq="Terminal" qiymat={pul(d.jami.terminal)} />
        {d.jami.qarz > 0 && <Stat yorliq="Qarzga" qiymat={pul(d.jami.qarz)} rang="var(--sariq)" />}
      </div>

      <div className="tab-qator">
        <button className={'tab' + (korinish === 'cheklar' ? ' faol' : '')} onClick={() => setKorinish('cheklar')}>
          Cheklar ({d.cheklar.length})
        </button>
        <button className={'tab' + (korinish === 'tovarlar' ? ' faol' : '')} onClick={() => setKorinish('tovarlar')}>
          Sotilgan tovarlar ({d.tovarlar.length})
        </button>
      </div>

      {korinish === 'cheklar' && (
        <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
          <table className="jadval">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>Vaqt</th>
                <th>Chek №</th>
                <th>Xodim</th>
                <th>Mijoz</th>
                <th className="ong">Summa</th>
                <th>To'lov</th>
                <th className="ong">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {d.cheklar.map((c) => (
                <React.Fragment key={c.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setOchiq(ochiq === c.id ? null : c.id)}>
                    <td className="xira markaz">{ochiq === c.id ? '▾' : '▸'}</td>
                    <td className="kichik">{c.sana.slice(11, 19)}</td>
                    <td className="kichik xira">{c.raqam}</td>
                    <td className="kichik">{c.hodim}</td>
                    <td className="kichik">{c.mijoz || '—'}</td>
                    <td className="ong qalin">{pul(c.jami)}</td>
                    <td className="kichik">
                      {c.naqd > 0 && <span className="nishon n-yashil" style={{ marginRight: 4 }}>naqd</span>}
                      {c.karta > 0 && <span className="nishon n-kok" style={{ marginRight: 4 }}>karta</span>}
                      {c.terminal > 0 && <span className="nishon n-kok" style={{ marginRight: 4 }}>terminal</span>}
                      {c.qarz > 0 && <span className="nishon n-sariq">qarz</span>}
                    </td>
                    <td className="ong" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-kichik" onClick={() => qaytaChop(c.id, c.raqam)} title="Chekni qayta chiqarish">
                        🖨 Qayta chop
                      </button>
                      {rahbarmi && (
                        <button className="btn btn-kichik" style={{ marginLeft: 6 }} onClick={() => setBekor(c)}>
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                  {ochiq === c.id && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--fon4)', padding: '10px 20px' }}>
                        <table className="jadval" style={{ background: 'transparent' }}>
                          <tbody>
                            {c.qatorlar.map((q) => (
                              <tr key={q.id}>
                                <td style={{ width: '45%' }}>{q.nomi}</td>
                                <td className="ong xira">
                                  {miqdorFmt(q.miqdor)} dona × {pul(q.narx)}
                                </td>
                                <td className="ong qalin">{pul(q.summa)}</td>
                                {rahbarmi && q.tan_narx !== undefined && (
                                  <td className="ong kichik" style={{ color: 'var(--yashil)' }}>
                                    foyda {pul(q.summa - q.tan_narx * q.miqdor)}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!d.cheklar.length && (
                <tr>
                  <td colSpan={8} className="markaz xira" style={{ padding: 34 }}>
                    Bu kunda savdo bo'lmagan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {korinish === 'tovarlar' && (
        <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
          <table className="jadval">
            <thead>
              <tr>
                <th>Tovar</th>
                <th className="ong">Sotilgan</th>
                <th className="ong">Summa</th>
              </tr>
            </thead>
            <tbody>
              {d.tovarlar.map((t, i) => (
                <tr key={i}>
                  <td className="qalin">{t.nomi}</td>
                  <td className="ong">{miqdorFmt(t.miqdor)} dona</td>
                  <td className="ong qalin">{pul(t.summa)}</td>
                </tr>
              ))}
              {!d.tovarlar.length && (
                <tr>
                  <td colSpan={3} className="markaz xira" style={{ padding: 34 }}>
                    Bu kunda tovar sotilmagan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Tasdiq
        ochiq={!!bekor}
        yop={() => setBekor(null)}
        sarlavha="Chekni bekor qilish"
        matn={`№${bekor?.raqam} chek (${pul(bekor?.jami || 0)} so'm) bekor qilinadi. Tovarlar omborga qaytadi, qarz bo'lsa u ham bekor bo'ladi.`}
        tugma="Ha, bekor qilish"
        tasdiqla={async () => {
          try {
            await amal('sotuv.bekor', { id: bekor.id, sabab: 'Rahbar bekor qildi' });
            toast.ok('Chek bekor qilindi');
            yukla();
          } catch (e) {
            toast.xato(e.message);
          }
        }}
      />
    </div>
  );
}

function Stat({ yorliq, qiymat, izoh, rang }) {
  return (
    <div className="stat">
      <div className="stat-yorliq">{yorliq}</div>
      <div className="stat-qiymat" style={rang ? { color: rang } : undefined}>
        {qiymat}
      </div>
      {izoh && <div className="stat-izoh">{izoh}</div>}
    </div>
  );
}
