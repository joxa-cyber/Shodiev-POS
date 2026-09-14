import React, { useEffect, useState } from 'react';
import { amal, pul, miqdorFmt } from '../api.js';
import Grafik from '../components/Grafik.jsx';

export default function Panel({ user, filial, toast }) {
  const [d, setD] = useState(null);
  const [grafik, setGrafik] = useState(null);
  const [kunSoni, setKunSoni] = useState(30);

  useEffect(() => {
    const yukla = () =>
      amal('hisobot.panel', { filial_id: filial })
        .then(setD)
        .catch((e) => toast.xato(e.message));
    yukla();
    const t = setInterval(yukla, 20000);
    return () => clearInterval(t);
  }, [filial]);

  useEffect(() => {
    if (user.rol !== 'rahbar' && !user.ruxsatlar.hisobot) return;
    amal('hisobot.grafik', { kunlar: kunSoni, filial_id: filial })
      .then(setGrafik)
      .catch(() => {});
  }, [filial, kunSoni, user]);

  if (!d) return <div className="yuklanmoqda">Yuklanmoqda...</div>;
  const rahbarmi = user.rol === 'rahbar';

  return (
    <div className="sahifa">
      <div className="stat-setka">
        <Stat yorliq="Bugungi savdo" qiymat={pul(d.bugun.savdo)} izoh={`${d.bugun.chek_soni} ta chek`} rang="var(--yashil)" />
        {rahbarmi && <Stat yorliq="Bugungi foyda" qiymat={pul(d.bugun.foyda)} izoh="sof foyda" rang="var(--yashil)" />}
        <Stat yorliq="Naqd" qiymat={pul(d.bugun.naqd)} izoh="kassada" />
        <Stat yorliq="Karta + Terminal" qiymat={pul(d.bugun.karta + d.bugun.terminal)} izoh="bank orqali" />
        {d.bugun.qarz > 0 && <Stat yorliq="Bugun qarzga" qiymat={pul(d.bugun.qarz)} rang="var(--sariq)" />}
      </div>

      {rahbarmi && (
        <>
          <h3 className="bolim-sarlavha">Umumiy ko‘rsatkichlar</h3>
          <div className="stat-setka">
            <Stat yorliq="Shu hafta (7 kun)" qiymat={pul(d.hafta.savdo)} izoh={`foyda: ${pul(d.hafta.foyda)}`} />
            <Stat yorliq="Shu oy" qiymat={pul(d.oy.savdo)} izoh={`foyda: ${pul(d.oy.foyda)}`} />
            <Stat yorliq="Ombor qiymati" qiymat={pul(d.ombor_qiymati)} izoh="tan narxda" />
            <Stat
              yorliq="Qarzdorlar"
              qiymat={pul(d.qarz_jami)}
              izoh={`${d.qarzdor_soni} ta mijoz`}
              rang={d.qarz_jami > 0 ? 'var(--sariq)' : undefined}
            />
          </div>
        </>
      )}

      {grafik && (
        <div className="karta" style={{ marginTop: 22 }}>
          <div className="qator" style={{ marginBottom: 10 }}>
            <h3 style={{ fontSize: 15 }}>Savdo dinamikasi</h3>
            <div className="qator qator-oxiri" style={{ gap: 6 }}>
              {[7, 30, 90].map((k) => (
                <button
                  key={k}
                  className={'chip' + (kunSoni === k ? ' faol' : '')}
                  onClick={() => setKunSoni(k)}
                >
                  {k} kun
                </button>
              ))}
            </div>
          </div>
          <Grafik malumot={grafik} foydaKorsat={rahbarmi} />
        </div>
      )}

      <div className="ustun-2" style={{ marginTop: 22, alignItems: 'start' }}>
        <div className="karta">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Bugun eng ko‘p sotilgan</h3>
          {d.top.length ? (
            <table className="jadval">
              <tbody>
                {d.top.map((t, i) => (
                  <tr key={i}>
                    <td style={{ width: 26 }} className="xira">
                      {i + 1}
                    </td>
                    <td>{t.nomi}</td>
                    <td className="ong">{miqdorFmt(t.miqdor)} dona</td>
                    <td className="ong qalin">{pul(t.summa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="xira">Bugun hali savdo bo‘lmagan</p>
          )}
        </div>

        {rahbarmi && (
          <div className="karta">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Tugayotgan tovarlar</h3>
            {d.kam_tovar.length ? (
              <table className="jadval">
                <tbody>
                  {d.kam_tovar.map((t) => (
                    <tr key={t.id}>
                      <td>{t.nomi}</td>
                      <td className="ong">
                        <span className={'nishon ' + (t.qoldiq <= 0 ? 'n-qizil' : 'n-sariq')}>
                          {miqdorFmt(t.qoldiq)} dona
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="xira">Hammasi yetarli ✓</p>
            )}
          </div>
        )}
      </div>
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
