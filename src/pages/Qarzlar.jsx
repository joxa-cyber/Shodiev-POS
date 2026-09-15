import React, { useCallback, useEffect, useState } from 'react';
import { amal, pul, miqdorFmt, vaqtChiroyli, sanaChiroyli } from '../api.js';
import { Modal } from '../components/Ui.jsx';

const NISHON = { qarzdor: 'n-qizil', qisman: 'n-sariq', yopilgan: 'n-yashil', avans: 'n-kok' };

export default function Qarzlar({ user, filial, toast }) {
  const [royxat, setRoyxat] = useState([]);
  const [qidiruv, setQidiruv] = useState('');
  const [holat, setHolat] = useState('qarzdor');
  const [tanlangan, setTanlangan] = useState(null); // tafsilot
  const [tolov, setTolov] = useState(null);
  const [harakatlar, setHarakatlar] = useState(null);
  const [korinish, setKorinish] = useState('mijozlar');
  const rahbarmi = user.rol === 'rahbar';

  const yukla = useCallback(() => {
    amal('qarz.mijozlar', { qidiruv, holat })
      .then(setRoyxat)
      .catch((e) => toast.xato(e.message));
  }, [qidiruv, holat]);

  useEffect(() => {
    if (korinish === 'tarix') {
      amal('qarz.harakatlar', { limit: 300 }).then(setHarakatlar).catch(() => {});
    }
  }, [korinish]);

  useEffect(yukla, [yukla]);

  const jami = royxat.reduce((s, m) => s + Math.max(0, m.qarz), 0);
  const jamiTolangan = royxat.reduce((s, m) => s + m.tolangan, 0);

  async function tafsilotOch(mijoz_id) {
    try {
      setTanlangan(await amal('qarz.tafsilot', { mijoz_id }));
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <div className="sahifa">
      <div className="tab-qator">
        <button className={'tab' + (korinish === 'mijozlar' ? ' faol' : '')} onClick={() => setKorinish('mijozlar')}>
          Mijozlar
        </button>
        <button className={'tab' + (korinish === 'tarix' ? ' faol' : '')} onClick={() => setKorinish('tarix')}>
          Qarz tarixi
        </button>
      </div>

      {korinish === 'mijozlar' && (
      <>
      <div className="qator" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="inp"
          style={{ maxWidth: 300 }}
          placeholder="Mijoz ismi yoki telefoni..."
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
        />
        <div className="chip-qator">
          {[
            ['qarzdor', 'Qarzdorlar'],
            ['yopilgan', 'Yopilganlar'],
            ['hammasi', 'Hammasi'],
          ].map(([k, n]) => (
            <button key={k} className={'chip' + (holat === k ? ' faol' : '')} onClick={() => setHolat(k)}>
              {n}
            </button>
          ))}
        </div>
        <div className="karta" style={{ padding: '8px 16px' }}>
          Qoldiq qarz: <b style={{ color: 'var(--sariq)', fontSize: 18 }}>{pul(jami)} so'm</b>
          <span className="xira kichik">
            {' '}
            · qaytgan: <b style={{ color: 'var(--yashil)' }}>{pul(jamiTolangan)}</b> · {royxat.length} ta mijoz
          </span>
        </div>
        {rahbarmi && (
          <button
            className="btn qator-oxiri"
            title="Barcha hisob-kitoblarni qayta tekshiradi"
            onClick={async () => {
              try {
                const r = await amal('qarz.tekshir');
                toast.ok(
                  r.tuzatilgan.length
                    ? `${r.tuzatilgan.length} ta mijozda farq topildi va to'g'rilandi`
                    : `${r.tekshirildi} ta mijoz tekshirildi — hammasi to'g'ri ✓`
                );
                yukla();
              } catch (e) {
                toast.xato(e.message);
              }
            }}
          >
            ✓ Hisobni tekshirish
          </button>
        )}
      </div>

      <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 190px)' }}>
        <table className="jadval">
          <thead>
            <tr>
              <th>Mijoz</th>
              <th>Holat</th>
              <th className="ong">Qarzga olgan</th>
              <th className="ong">To'lagan</th>
              <th className="ong">Qoldiq</th>
              <th className="ong">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {royxat.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="qalin">{m.ism}</div>
                  <div className="xira kichik">
                    {m.telefon || 'telefon yo\u2018q'}
                    {m.cheklar > 0 ? ` \u00b7 ${m.cheklar} ta chek` : ''}
                    {m.oxirgi_qarz ? ` \u00b7 oxirgi: ${sanaChiroyli(m.oxirgi_qarz)}` : ''}
                  </div>
                </td>
                <td>
                  <span className={'nishon ' + NISHON[m.status]}>{m.status_nomi}</span>
                  {m.ochiq_cheklar > 0 && (
                    <div className="xira kichik" style={{ marginTop: 3 }}>
                      {m.ochiq_cheklar} ta ochiq chek
                    </div>
                  )}
                </td>
                <td className="ong">{pul(m.qarzga_olgan)}</td>
                <td className="ong" style={{ color: 'var(--yashil)' }}>
                  {pul(m.tolangan)}
                </td>
                <td className="ong">
                  {m.qarz > 0.4 ? (
                    <b style={{ color: 'var(--sariq)', fontSize: 15 }}>{pul(m.qarz)}</b>
                  ) : m.qarz < -0.4 ? (
                    <span className="nishon n-kok">avans {pul(-m.qarz)}</span>
                  ) : (
                    <span className="nishon n-yashil">\u2713 0</span>
                  )}
                </td>
                <td className="ong">
                  <button className="btn btn-kichik" onClick={() => tafsilotOch(m.id)}>
                    Tafsilot
                  </button>
                  {m.qarz > 0.4 && (
                    <button className="btn btn-kichik btn-yashil" style={{ marginLeft: 6 }} onClick={() => setTolov(m)}>
                      To'lov
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!royxat.length && (
              <tr>
                <td colSpan={6} className="markaz xira" style={{ padding: 34 }}>
                  {holat === 'qarzdor' ? "Qarzdor yo'q \u2713" : "Ma'lumot yo'q"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      </>
      )}

      {korinish === 'tarix' &&
        (harakatlar ? (
          <>
            <div className="stat-setka" style={{ marginBottom: 14 }}>
              <div className="stat">
                <div className="stat-yorliq">Jami qarzga berilgan</div>
                <div className="stat-qiymat" style={{ color: 'var(--sariq)' }}>
                  {pul(harakatlar.jami_qarzga)}
                </div>
              </div>
              <div className="stat">
                <div className="stat-yorliq">Jami qaytarilgan</div>
                <div className="stat-qiymat" style={{ color: 'var(--yashil)' }}>
                  {pul(harakatlar.jami_tolov)}
                </div>
              </div>
              <div className="stat">
                <div className="stat-yorliq">Farq</div>
                <div className="stat-qiymat">{pul(harakatlar.jami_qarzga - harakatlar.jami_tolov)}</div>
              </div>
            </div>

            <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
              <table className="jadval">
                <thead>
                  <tr>
                    <th>Sana</th>
                    <th>Nima bo'ldi</th>
                    <th>Mijoz</th>
                    <th>Kim</th>
                    <th className="ong">Summa</th>
                    <th>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {harakatlar.harakatlar.map((h) => (
                    <tr key={h.tur + h.id}>
                      <td className="kichik">{vaqtChiroyli(h.sana)}</td>
                      <td>
                        {h.tur === 'qarz' ? (
                          <>
                            <span className="nishon n-sariq">Qarzga berildi</span>
                            <span className="xira kichik"> \u2116{h.raqam}</span>
                          </>
                        ) : (
                          <>
                            <span className="nishon n-yashil">To'lov qabul qilindi</span>
                            <span className="xira kichik"> {h.usul}</span>
                            {h.izoh && <div className="xira kichik">{h.izoh}</div>}
                          </>
                        )}
                      </td>
                      <td className="kichik qalin">{h.mijoz || '\u2014'}</td>
                      <td className="kichik xira">{h.hodim}</td>
                      <td
                        className="ong qalin"
                        style={{ color: h.tur === 'qarz' ? 'var(--sariq)' : 'var(--yashil)' }}
                      >
                        {h.tur === 'qarz' ? '+' : '\u2212'}
                        {pul(h.summa)}
                      </td>
                      <td>
                        {h.tur === 'qarz' &&
                          (h.holat === 'yopilgan' ? (
                            <span className="nishon n-yashil">To'langan</span>
                          ) : h.holat === 'qisman' ? (
                            <span className="nishon n-sariq">Qoldi: {pul(h.qarz_qoldiq)}</span>
                          ) : (
                            <span className="nishon n-qizil">To'lanmagan</span>
                          ))}
                      </td>
                    </tr>
                  ))}
                  {!harakatlar.harakatlar.length && (
                    <tr>
                      <td colSpan={6} className="markaz xira" style={{ padding: 34 }}>
                        Hali qarz operatsiyalari bo'lmagan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="yuklanmoqda">Yuklanmoqda...</div>
        ))}

      <Tafsilot
        d={tanlangan}
        yop={() => setTanlangan(null)}
        tolovOch={(m) => {
          setTanlangan(null);
          setTolov(m);
        }}
      />

      <TolovOynasi
        mijoz={tolov}
        yop={() => setTolov(null)}
        filial={filial}
        toast={toast}
        tayyor={(mijoz_id) => {
          setTolov(null);
          yukla();
          tafsilotOch(mijoz_id);
        }}
      />
    </div>
  );
}

/* ---------- Mijoz qarzining to'liq tafsiloti ---------- */
function Tafsilot({ d, yop, tolovOch }) {
  const [tab, setTab] = useState('cheklar');
  if (!d) return null;

  return (
    <Modal
      ochiq={!!d}
      yop={yop}
      sarlavha={`${d.mijoz.ism} — qarz tafsiloti`}
      kenglik={820}
      past={
        <>
          <button className="btn" onClick={yop}>
            Yopish
          </button>
          <button className="btn btn-yashil" onClick={() => tolovOch(d.mijoz)}>
            To'lov qabul qilish
          </button>
        </>
      }
    >
      <div className="ustun-3" style={{ marginBottom: 16 }}>
        <div className="karta" style={{ padding: 12 }}>
          <div className="stat-yorliq">Jami qarzga olgan</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{pul(d.jami_qarz)}</div>
        </div>
        <div className="karta" style={{ padding: 12 }}>
          <div className="stat-yorliq">To'lagan</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--yashil)' }}>{pul(d.jami_tolangan)}</div>
        </div>
        <div className="karta" style={{ padding: 12, borderColor: 'var(--sariq)' }}>
          <div className="stat-yorliq">Qolgan qarz</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--sariq)' }}>{pul(d.qoldiq)}</div>
        </div>
      </div>

      {d.mijoz.avans > 0.4 && (
        <div className="karta" style={{ marginBottom: 14, background: 'var(--kok-och)', borderColor: 'var(--kok)' }}>
          Oldindan to'langan (avans): <b>{pul(d.mijoz.avans)} so'm</b> — keyingi qarzdan yechiladi
        </div>
      )}

      <div className="tab-qator">
        {[
          ['cheklar', `Cheklar (${d.cheklar.length})`],
          ['tovarlar', `Qarzdagi tovarlar (${d.tovarlar.length})`],
          ['tolovlar', `To'lovlar (${d.tolovlar.length})`],
        ].map(([k, n]) => (
          <button key={k} className={'tab' + (tab === k ? ' faol' : '')} onClick={() => setTab(k)}>
            {n}
          </button>
        ))}
      </div>

      {tab === 'cheklar' &&
        d.cheklar.map((c) => (
          <div
            key={c.id}
            className="karta"
            style={{
              marginBottom: 12,
              borderColor: c.qarz_qoldiq > 0.4 ? 'var(--sariq)' : 'var(--chegara)',
              opacity: c.qarz_qoldiq > 0.4 ? 1 : 0.75,
            }}
          >
            <div className="qator" style={{ marginBottom: 8 }}>
              <div>
                <b>Chek №{c.raqam}</b>
                <span className="xira kichik"> · {vaqtChiroyli(c.sana)} · {c.hodim}</span>
              </div>
              <div className="qator-oxiri">
                {c.qarz_qoldiq > 0.4 ? (
                  <span className="nishon n-sariq">Qolgan: {pul(c.qarz_qoldiq)}</span>
                ) : (
                  <span className="nishon n-yashil">To'liq to'langan ✓</span>
                )}
              </div>
            </div>

            <table className="jadval">
              <thead>
                <tr>
                  <th>Tovar</th>
                  <th className="ong">Olgan</th>
                  <th className="ong">Summa</th>
                  <th className="ong">Shundan qarzda</th>
                </tr>
              </thead>
              <tbody>
                {c.qatorlar.map((q, i) => (
                  <tr key={i}>
                    <td>{q.nomi}</td>
                    <td className="ong">{miqdorFmt(q.miqdor)} dona</td>
                    <td className="ong">{pul(q.summa)}</td>
                    <td className="ong qalin" style={{ color: q.qarzdagi_summa > 0 ? 'var(--sariq)' : 'var(--xira)' }}>
                      {q.qarzdagi_summa > 0 ? `${miqdorFmt(q.qarzdagi_miqdor)} dona · ${pul(q.qarzdagi_summa)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="qator kichik" style={{ marginTop: 8, gap: 18 }}>
              <span className="xira">Chek summasi: <b>{pul(c.jami)}</b></span>
              <span className="xira">Shundan qarzga: <b>{pul(c.qarz)}</b></span>
              <span style={{ color: 'var(--yashil)' }}>To'langan: <b>{pul(c.tolangan)}</b></span>
            </div>

            {c.tolovlar.length > 0 && (
              <div className="kichik" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--chegara)' }}>
                <span className="xira">Shu chekka yozilgan to'lovlar: </span>
                {c.tolovlar.map((t, i) => (
                  <span key={i} className="nishon n-yashil" style={{ marginRight: 6 }}>
                    {sanaChiroyli(t.sana)} · {pul(t.summa)} ({t.usul})
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

      {tab === 'tovarlar' && (
        <table className="jadval">
          <thead>
            <tr>
              <th>Tovar</th>
              <th className="ong">Qarzga olingan</th>
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
          </tbody>
        </table>
      )}

      {tab === 'tolovlar' && (
        <table className="jadval">
          <thead>
            <tr>
              <th>Sana</th>
              <th>Usul</th>
              <th>Qabul qildi</th>
              <th>Izoh</th>
              <th className="ong">Summa</th>
            </tr>
          </thead>
          <tbody>
            {d.tolovlar.map((t) => (
              <tr key={t.id}>
                <td className="kichik">{vaqtChiroyli(t.sana)}</td>
                <td className="kichik">{t.usul}</td>
                <td className="kichik">{t.hodim}</td>
                <td className="kichik xira">{t.izoh || '—'}</td>
                <td className="ong qalin" style={{ color: 'var(--yashil)' }}>
                  {pul(t.summa)}
                </td>
              </tr>
            ))}
            {!d.tolovlar.length && (
              <tr>
                <td colSpan={5} className="xira markaz" style={{ padding: 20 }}>
                  Hali to'lov qilinmagan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/* ---------- To'lov qabul qilish ---------- */
function TolovOynasi({ mijoz, yop, filial, toast, tayyor }) {
  const [summa, setSumma] = useState('');
  const [usul, setUsul] = useState('naqd');
  const [izoh, setIzoh] = useState('');
  const [band, setBand] = useState(false);

  useEffect(() => {
    if (mijoz) {
      setSumma(String(Math.round(mijoz.qarz)));
      setUsul('naqd');
      setIzoh('');
    }
  }, [mijoz]);

  if (!mijoz) return null;
  const s = Number(summa) || 0;
  const qolar = Math.round((mijoz.qarz - s) * 100) / 100;

  async function yubor() {
    setBand(true);
    try {
      const r = await amal('qarz.tolov', { mijoz_id: mijoz.id, summa: s, usul, izoh, filial_id: filial });
      toast.ok(
        r.qoldiq > 0.4
          ? `To'lov qabul qilindi. Qolgan qarz: ${pul(r.qoldiq)} so'm`
          : "Qarz to'liq yopildi ✓"
      );
      tayyor(mijoz.id);
    } catch (e) {
      toast.xato(e.message);
    } finally {
      setBand(false);
    }
  }

  return (
    <Modal
      ochiq={!!mijoz}
      yop={yop}
      sarlavha={`To'lov qabul qilish — ${mijoz.ism}`}
      past={
        <>
          <button className="btn" onClick={yop}>
            Bekor
          </button>
          <button className="btn btn-yashil" onClick={yubor} disabled={band || s <= 0}>
            {band ? 'Saqlanmoqda...' : 'Qabul qilish'}
          </button>
        </>
      }
    >
      <div className="karta" style={{ marginBottom: 14, background: 'var(--sariq-och)', borderColor: 'var(--sariq)' }}>
        Joriy qarz: <b style={{ fontSize: 20 }}>{pul(mijoz.qarz)} so'm</b>
      </div>

      <div className="maydon">
        <label className="yorliq">To'lov summasi</label>
        <input className="inp" autoFocus value={summa} onChange={(e) => setSumma(e.target.value.replace(/[^\d]/g, ''))} />
        <div className="qator" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-kichik" onClick={() => setSumma(String(Math.round(mijoz.qarz)))}>
            Hammasi
          </button>
          <button className="btn btn-kichik" onClick={() => setSumma(String(Math.round(mijoz.qarz / 2)))}>
            Yarmi
          </button>
          {[100000, 500000, 1000000].map((v) => (
            <button key={v} className="btn btn-kichik" onClick={() => setSumma(String((Number(summa) || 0) + v))}>
              +{pul(v)}
            </button>
          ))}
          <button className="btn btn-kichik" onClick={() => setSumma('')}>
            Tozalash
          </button>
        </div>
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

      <div className="maydon">
        <label className="yorliq">Izoh (ixtiyoriy)</label>
        <input className="inp" value={izoh} onChange={(e) => setIzoh(e.target.value)} placeholder="Masalan: 50 tasiga pul keltirdi" />
      </div>

      <div
        className="karta"
        style={{
          background: qolar <= 0.4 ? 'var(--yashil-och)' : 'var(--fon4)',
          borderColor: qolar <= 0.4 ? 'var(--yashil)' : 'var(--chegara)',
        }}
      >
        {qolar > 0.4 ? (
          <>
            To'lovdan keyin qoladi: <b style={{ color: 'var(--sariq)' }}>{pul(qolar)} so'm</b>
          </>
        ) : qolar < -0.4 ? (
          <>
            Qarz to'liq yopiladi, ortiqcha <b>{pul(-qolar)} so'm</b> avans sifatida saqlanadi
          </>
        ) : (
          <b style={{ color: 'var(--yashil)' }}>Qarz to'liq yopiladi ✓</b>
        )}
      </div>
      <p className="xira kichik" style={{ marginTop: 10 }}>
        To'lov eng eski chekdan boshlab yopiladi. Qaysi chekka qancha yozilgani tafsilotda ko'rinadi.
      </p>
    </Modal>
  );
}
