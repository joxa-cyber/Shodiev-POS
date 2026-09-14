import React, { useCallback, useEffect, useState } from 'react';
import { amal, pul, vaqtChiroyli } from '../api.js';
import { Modal } from '../components/Ui.jsx';

// Pul birliklari - sanashni osonlashtirish uchun
const BIRLIKLAR = [200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export default function Kassa({ user, filial, toast }) {
  const [h, setH] = useState(null);
  const [tarix, setTarix] = useState([]);
  const [oyna, setOyna] = useState(false);

  const yukla = useCallback(() => {
    amal('kassa.holat', { filial_id: filial })
      .then(setH)
      .catch((e) => toast.xato(e.message));
    amal('kassa.tarix', { filial_id: filial, limit: 30 })
      .then(setTarix)
      .catch(() => {});
  }, [filial]);

  useEffect(() => {
    yukla();
    const t = setInterval(yukla, 20000);
    return () => clearInterval(t);
  }, [yukla]);

  if (!h) return <div className="yuklanmoqda">Yuklanmoqda...</div>;

  return (
    <div className="sahifa">
      <div className="karta" style={{ marginBottom: 16 }}>
        <div className="qator" style={{ marginBottom: 4 }}>
          <div>
            <div className="stat-yorliq">Kassada bo'lishi kerak (naqd)</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--yashil)', lineHeight: 1.2 }}>
              {pul(h.kutilgan_naqd)} <span style={{ fontSize: 20 }}>so'm</span>
            </div>
            <div className="xira kichik" style={{ marginTop: 4 }}>
              {h.oxirgi_hisob
                ? `Oxirgi hisob: ${vaqtChiroyli(h.oxirgi_hisob.sana)} · o'shandan beri`
                : 'Bugun kun boshidan beri'}
              {' · '}
              {h.chek_soni} ta chek
            </div>
          </div>
          <button className="btn btn-yashil btn-katta qator-oxiri" onClick={() => setOyna(true)}>
            💰 Kassani sanash
          </button>
        </div>
      </div>

      <div className="stat-setka" style={{ marginBottom: 16 }}>
        <Stat yorliq="Savdo (jami)" qiymat={pul(h.savdo)} izoh={`${h.chek_soni} ta chek`} />
        <Stat yorliq="Sotuvdan naqd" qiymat={pul(h.sotuv_naqd)} />
        <Stat yorliq="Qarz to'lovidan naqd" qiymat={pul(h.qarz_tolov_naqd)} />
        <Stat yorliq="Karta" qiymat={pul(h.karta)} izoh="kassada emas" />
        <Stat yorliq="Terminal" qiymat={pul(h.terminal)} izoh="kassada emas" />
        {h.qarz > 0 && <Stat yorliq="Qarzga berilgan" qiymat={pul(h.qarz)} rang="var(--sariq)" />}
      </div>

      <h3 className="bolim-sarlavha">Oldingi hisoblar</h3>
      <div className="karta" style={{ padding: 0, overflow: 'auto' }}>
        <table className="jadval">
          <thead>
            <tr>
              <th>Vaqt</th>
              <th>Kim</th>
              <th className="ong">Bo'lishi kerak</th>
              <th className="ong">Sanaldi</th>
              <th className="ong">Farq</th>
              <th>Izoh</th>
            </tr>
          </thead>
          <tbody>
            {tarix.map((k) => (
              <tr key={k.id}>
                <td className="kichik">{vaqtChiroyli(k.sana)}</td>
                <td className="kichik">{k.hodim}</td>
                <td className="ong">{pul(k.kutilgan)}</td>
                <td className="ong qalin">{pul(k.sanalgan)}</td>
                <td className="ong">
                  <span
                    className={
                      'nishon ' + (Math.abs(k.farq) < 1 ? 'n-yashil' : k.farq > 0 ? 'n-sariq' : 'n-qizil')
                    }
                  >
                    {k.farq > 0 ? '+' : ''}
                    {pul(k.farq)}
                  </span>
                </td>
                <td className="kichik xira">{k.izoh || '—'}</td>
              </tr>
            ))}
            {!tarix.length && (
              <tr>
                <td colSpan={6} className="markaz xira" style={{ padding: 30 }}>
                  Hali kassa sanalmagan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SanashOynasi
        ochiq={oyna}
        yop={() => setOyna(false)}
        holat={h}
        filial={filial}
        toast={toast}
        tayyor={() => {
          setOyna(false);
          yukla();
        }}
      />
    </div>
  );
}

function SanashOynasi({ ochiq, yop, holat, filial, toast, tayyor }) {
  const [sanoq, setSanoq] = useState({});
  const [qolda, setQolda] = useState('');
  const [izoh, setIzoh] = useState('');
  const [band, setBand] = useState(false);

  useEffect(() => {
    if (ochiq) {
      setSanoq({});
      setQolda('');
      setIzoh('');
    }
  }, [ochiq]);

  const birlikJami = BIRLIKLAR.reduce((s, b) => s + b * (Number(sanoq[b]) || 0), 0);
  const sanalgan = qolda !== '' ? Number(qolda) || 0 : birlikJami;
  const farq = sanalgan - holat.kutilgan_naqd;

  async function yubor() {
    setBand(true);
    try {
      const r = await amal('kassa.yopish', { filial_id: filial, sanalgan, izoh });
      toast.ok(
        Math.abs(r.farq) < 1
          ? "Kassa to'g'ri keldi ✓"
          : r.farq > 0
          ? `Kassada ${pul(r.farq)} so'm ortiqcha`
          : `Kassada ${pul(-r.farq)} so'm kam`
      );
      tayyor();
    } catch (e) {
      toast.xato(e.message);
    } finally {
      setBand(false);
    }
  }

  return (
    <Modal
      ochiq={ochiq}
      yop={yop}
      sarlavha="Kassani sanash"
      kenglik={620}
      past={
        <>
          <button className="btn" onClick={yop}>
            Bekor
          </button>
          <button className="btn btn-yashil" onClick={yubor} disabled={band || sanalgan <= 0}>
            {band ? 'Saqlanmoqda...' : 'Hisobni saqlash'}
          </button>
        </>
      }
    >
      <p className="xira kichik" style={{ marginBottom: 14 }}>
        Kassadagi naqd pulni sanang. Har bir pul turidan nechta borligini yozsangiz, summani o'zi hisoblaydi.
      </p>

      <table className="jadval" style={{ marginBottom: 14 }}>
        <tbody>
          {BIRLIKLAR.map((b) => (
            <tr key={b}>
              <td style={{ width: 110 }} className="qalin">
                {pul(b)}
              </td>
              <td style={{ width: 20 }} className="xira">
                ×
              </td>
              <td style={{ width: 110 }}>
                <input
                  className="miqdor-inp"
                  style={{ width: 90 }}
                  value={sanoq[b] || ''}
                  onChange={(e) => setSanoq({ ...sanoq, [b]: e.target.value.replace(/[^\d]/g, '') })}
                  placeholder="0"
                  disabled={qolda !== ''}
                />
              </td>
              <td className="ong">{sanoq[b] ? pul(b * Number(sanoq[b])) : <span className="xira">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="maydon">
        <label className="yorliq">Yoki umumiy summani o'zingiz yozing</label>
        <input
          className="inp"
          value={qolda}
          onChange={(e) => setQolda(e.target.value.replace(/[^\d]/g, ''))}
          placeholder={pul(birlikJami)}
        />
      </div>

      <div className="maydon">
        <label className="yorliq">Izoh (ixtiyoriy)</label>
        <input
          className="inp"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Masalan: tushlikka 50 000 olindi"
        />
      </div>

      <div
        className="karta"
        style={{
          background: Math.abs(farq) < 1 ? 'var(--yashil-och)' : farq > 0 ? 'var(--sariq-och)' : 'var(--qizil-och)',
          borderColor: Math.abs(farq) < 1 ? 'var(--yashil)' : farq > 0 ? 'var(--sariq)' : 'var(--qizil)',
        }}
      >
        <div className="qator">
          <span>Bo'lishi kerak:</span>
          <b className="qator-oxiri">{pul(holat.kutilgan_naqd)}</b>
        </div>
        <div className="qator">
          <span>Sanaldi:</span>
          <b className="qator-oxiri">{pul(sanalgan)}</b>
        </div>
        <div className="qator" style={{ marginTop: 6, fontSize: 18 }}>
          <b>Farq:</b>
          <b className="qator-oxiri">
            {Math.abs(farq) < 1 ? "to'g'ri ✓" : `${farq > 0 ? '+' : ''}${pul(farq)} so'm`}
          </b>
        </div>
      </div>
      <p className="xira kichik" style={{ marginTop: 10 }}>
        Hisob saqlangach rahbarga Telegramga xabar ketadi.
      </p>
    </Modal>
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
