import React, { useCallback, useEffect, useState } from 'react';
import { amal, pul, vaqtChiroyli } from '../api.js';
import { Modal } from '../components/Ui.jsx';

export default function Mijozlar({ user, filial, toast }) {
  const [royxat, setRoyxat] = useState([]);
  const [qidiruv, setQidiruv] = useState('');
  const [faqatQarzdor, setFaqatQarzdor] = useState(false);
  const [tahrir, setTahrir] = useState(null);
  const [tolov, setTolov] = useState(null);
  const [tarix, setTarix] = useState(null);

  const yukla = useCallback(() => {
    amal('mijoz.royxat', { qidiruv, faqatQarzdor })
      .then(setRoyxat)
      .catch((e) => toast.xato(e.message));
  }, [qidiruv, faqatQarzdor]);

  useEffect(yukla, [yukla]);

  const qarzJami = royxat.reduce((s, m) => s + m.qarz, 0);

  async function saqla(m) {
    try {
      await amal('mijoz.saqla', m);
      toast.ok(m.id ? 'Mijoz yangilandi' : "Mijoz qo'shildi");
      setTahrir(null);
      yukla();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <div className="sahifa">
      <div className="qator" style={{ marginBottom: 14 }}>
        <input
          className="inp"
          style={{ maxWidth: 340 }}
          placeholder="Mijoz ismi yoki telefoni..."
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
        />
        <label className="qator kichik" style={{ gap: 6 }}>
          <input type="checkbox" checked={faqatQarzdor} onChange={(e) => setFaqatQarzdor(e.target.checked)} />
          Faqat qarzdorlar
        </label>
        <span className="xira kichik">
          {royxat.length} ta mijoz · umumiy qarz: <b style={{ color: 'var(--sariq)' }}>{pul(qarzJami)} so'm</b>
        </span>
        <button className="btn btn-yashil qator-oxiri" onClick={() => setTahrir({ ism: '', telefon: '', izoh: '' })}>
          + Yangi mijoz
        </button>
      </div>

      <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 165px)' }}>
        <table className="jadval">
          <thead>
            <tr>
              <th>Ism</th>
              <th>Telefon</th>
              <th>Izoh</th>
              <th className="ong">Qarz</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {royxat.map((m) => (
              <tr key={m.id}>
                <td className="qalin">{m.ism}</td>
                <td>{m.telefon || '—'}</td>
                <td className="xira kichik">{m.izoh || '—'}</td>
                <td className="ong">
                  {m.qarz > 0.4 ? (
                    <span className="nishon n-sariq">{pul(m.qarz)}</span>
                  ) : m.qarz < -0.4 ? (
                    <span className="nishon n-kok" title="Oldindan to'lov">
                      +{pul(-m.qarz)}
                    </span>
                  ) : (
                    <span className="xira">—</span>
                  )}
                </td>
                <td className="ong">
                  {m.qarz > 0.4 && (
                    <button className="btn btn-kichik btn-yashil" onClick={() => setTolov(m)}>
                      Qarz to'lash
                    </button>
                  )}
                  <button
                    className="btn btn-kichik"
                    style={{ marginLeft: 6 }}
                    onClick={() => amal('mijoz.tarix', { id: m.id }).then(setTarix)}
                  >
                    Tarix
                  </button>
                  <button className="btn btn-kichik" style={{ marginLeft: 6 }} onClick={() => setTahrir({ ...m })}>
                    ✎
                  </button>
                </td>
              </tr>
            ))}
            {!royxat.length && (
              <tr>
                <td colSpan={5} className="markaz xira" style={{ padding: 30 }}>
                  Mijoz yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tahrirlash */}
      <Modal
        ochiq={!!tahrir}
        yop={() => setTahrir(null)}
        sarlavha={tahrir?.id ? 'Mijozni tahrirlash' : 'Yangi mijoz'}
        past={
          <>
            <button className="btn" onClick={() => setTahrir(null)}>
              Bekor
            </button>
            <button className="btn btn-yashil" onClick={() => saqla(tahrir)}>
              Saqlash
            </button>
          </>
        }
      >
        {tahrir && (
          <>
            <div className="maydon">
              <label className="yorliq">Ism *</label>
              <input
                className="inp"
                autoFocus
                value={tahrir.ism}
                onChange={(e) => setTahrir({ ...tahrir, ism: e.target.value })}
                placeholder="Alisher aka (Chorsu do'kon)"
              />
            </div>
            <div className="maydon">
              <label className="yorliq">Telefon</label>
              <input
                className="inp"
                value={tahrir.telefon || ''}
                onChange={(e) => setTahrir({ ...tahrir, telefon: e.target.value })}
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div className="maydon">
              <label className="yorliq">Izoh</label>
              <textarea
                className="inp"
                rows={2}
                value={tahrir.izoh || ''}
                onChange={(e) => setTahrir({ ...tahrir, izoh: e.target.value })}
              />
            </div>
          </>
        )}
      </Modal>

      <QarzTolov
        mijoz={tolov}
        yop={() => setTolov(null)}
        filial={filial}
        toast={toast}
        tayyor={() => {
          setTolov(null);
          yukla();
        }}
      />

      <Modal ochiq={!!tarix} yop={() => setTarix(null)} sarlavha={`${tarix?.mijoz?.ism || ''} — tarix`} kenglik={680}>
        {tarix && (
          <>
            <div className="karta" style={{ marginBottom: 14 }}>
              Joriy qarz: <b style={{ color: 'var(--sariq)' }}>{pul(tarix.mijoz.qarz)} so'm</b>
            </div>
            <h4 style={{ marginBottom: 8, fontSize: 14 }}>Sotuvlar</h4>
            <table className="jadval" style={{ marginBottom: 18 }}>
              <tbody>
                {tarix.sotuvlar.map((s) => (
                  <tr key={s.id}>
                    <td className="kichik">{vaqtChiroyli(s.sana)}</td>
                    <td className="kichik xira">№{s.raqam}</td>
                    <td className="ong">{pul(s.jami)}</td>
                    <td className="ong kichik" style={{ color: s.qarz > 0 ? 'var(--sariq)' : 'var(--xira)' }}>
                      {s.qarz > 0 ? `qarzga ${pul(s.qarz)}` : "to'langan"}
                    </td>
                  </tr>
                ))}
                {!tarix.sotuvlar.length && (
                  <tr>
                    <td className="xira">Sotuv yo'q</td>
                  </tr>
                )}
              </tbody>
            </table>
            <h4 style={{ marginBottom: 8, fontSize: 14 }}>Qarz to'lovlari</h4>
            <table className="jadval">
              <tbody>
                {tarix.tolovlar.map((t) => (
                  <tr key={t.id}>
                    <td className="kichik">{vaqtChiroyli(t.sana)}</td>
                    <td className="kichik">{t.usul}</td>
                    <td className="kichik xira">{t.hodim}</td>
                    <td className="ong qalin" style={{ color: 'var(--yashil)' }}>
                      {pul(t.summa)}
                    </td>
                  </tr>
                ))}
                {!tarix.tolovlar.length && (
                  <tr>
                    <td className="xira">To'lov yo'q</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </div>
  );
}

function QarzTolov({ mijoz, yop, filial, toast, tayyor }) {
  const [summa, setSumma] = useState('');
  const [usul, setUsul] = useState('naqd');

  useEffect(() => {
    if (mijoz) {
      setSumma(String(Math.round(mijoz.qarz)));
      setUsul('naqd');
    }
  }, [mijoz]);

  async function yubor() {
    try {
      const r = await amal('qarz.tolov', {
        mijoz_id: mijoz.id,
        summa: Number(summa) || 0,
        usul,
        filial_id: filial,
      });
      toast.ok(`To'lov qabul qilindi. Qolgan qarz: ${pul(r.qoldiq)} so'm`);
      tayyor();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <Modal
      ochiq={!!mijoz}
      yop={yop}
      sarlavha={`Qarz to'lovi — ${mijoz?.ism || ''}`}
      past={
        <>
          <button className="btn" onClick={yop}>
            Bekor
          </button>
          <button className="btn btn-yashil" onClick={yubor} disabled={!(Number(summa) > 0)}>
            Qabul qilish
          </button>
        </>
      }
    >
      {mijoz && (
        <>
          <div className="karta" style={{ marginBottom: 14 }}>
            Joriy qarz: <b style={{ color: 'var(--sariq)', fontSize: 20 }}>{pul(mijoz.qarz)} so'm</b>
          </div>
          <div className="maydon">
            <label className="yorliq">To'lov summasi</label>
            <input
              className="inp"
              autoFocus
              value={summa}
              onChange={(e) => setSumma(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
          <div className="maydon">
            <label className="yorliq">To'lov usuli</label>
            <div className="qator">
              {[
                ['naqd', '💵 Naqd'],
                ['karta', '💳 Karta'],
                ['terminal', '🏧 Terminal'],
              ].map(([k, n]) => (
                <button key={k} className={'btn' + (usul === k ? ' btn-yashil' : '')} onClick={() => setUsul(k)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
