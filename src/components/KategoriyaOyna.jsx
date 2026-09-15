import React, { useCallback, useEffect, useState } from 'react';
import { amal, pul, miqdorFmt } from '../api.js';
import { Modal } from './Ui.jsx';

// Kategoriyalarni yaratish, nomini o'zgartirish, o'chirish va tovarlarni biriktirish
export default function KategoriyaOyna({ ochiq, yop, filial, toast, yangilandi }) {
  const [royxat, setRoyxat] = useState([]);
  const [tanlangan, setTanlangan] = useState(null);
  const [tovarlar, setTovarlar] = useState([]);
  const [biriktirish, setBiriktirish] = useState(false);
  const [yangiNom, setYangiNom] = useState('');
  const [tahrir, setTahrir] = useState(null);
  const [belgilangan, setBelgilangan] = useState([]);
  const [kochirTo, setKochirTo] = useState('');

  const yukla = useCallback(() => {
    amal('kategoriya.royxat')
      .then(setRoyxat)
      .catch((e) => toast.xato(e.message));
  }, []);

  useEffect(() => {
    if (ochiq) {
      yukla();
      setTanlangan(null);
      setYangiNom('');
    }
  }, [ochiq, yukla]);

  useEffect(() => {
    setBelgilangan([]);
    setKochirTo('');
    if (tanlangan === null) return setTovarlar([]);
    amal('kategoriya.tovarlar', { kategoriya_id: tanlangan.id, filial_id: filial })
      .then(setTovarlar)
      .catch(() => {});
  }, [tanlangan, filial]);

  async function qosh() {
    const nomi = yangiNom.trim();
    if (!nomi) return;
    try {
      await amal('kategoriya.saqla', { nomi });
      toast.ok(`«${nomi}» kategoriyasi qo'shildi`);
      setYangiNom('');
      yukla();
      yangilandi && yangilandi();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  async function nomOzgartir() {
    try {
      await amal('kategoriya.saqla', { id: tahrir.id, nomi: tahrir.nomi.trim() });
      toast.ok('Nomi o‘zgartirildi');
      setTahrir(null);
      yukla();
      yangilandi && yangilandi();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  async function kochir(tovar_idlar, maqsad_id, maqsadNomi) {
    if (!tovar_idlar.length) return;
    try {
      await amal('kategoriya.biriktir', { kategoriya_id: maqsad_id || null, tovar_idlar });
      toast.ok(
        `${tovar_idlar.length} ta tovar «${maqsad_id ? maqsadNomi : 'kategoriyasiz'}» ga ko'chirildi`
      );
      setBelgilangan([]);
      setKochirTo('');
      const yangi = await amal('kategoriya.tovarlar', {
        kategoriya_id: tanlangan.id,
        filial_id: filial,
      });
      setTovarlar(yangi);
      yukla();
      yangilandi && yangilandi();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  async function ochir(k) {
    const savol =
      k.tovar_soni > 0
        ? `«${k.nomi}» kategoriyasida ${k.tovar_soni} ta tovar bor. Kategoriya o'chirilsa, tovarlar "kategoriyasiz" bo'lib qoladi (tovarlar o'chmaydi). Davom etamizmi?`
        : `«${k.nomi}» kategoriyasi o'chirilsinmi?`;
    if (!confirm(savol)) return;
    try {
      await amal('kategoriya.ochir', { id: k.id });
      toast.ok("Kategoriya o'chirildi");
      if (tanlangan && tanlangan.id === k.id) setTanlangan(null);
      yukla();
      yangilandi && yangilandi();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <>
      <Modal
        ochiq={ochiq}
        yop={yop}
        sarlavha="Kategoriyalar"
        kenglik={880}
        past={
          <button className="btn" onClick={yop}>
            Yopish
          </button>
        }
      >
        <div className="qator" style={{ marginBottom: 16 }}>
          <input
            className="inp"
            placeholder="Yangi kategoriya nomi (masalan: Bankali ichimliklar)"
            value={yangiNom}
            onChange={(e) => setYangiNom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && qosh()}
          />
          <button className="btn btn-yashil" onClick={qosh} disabled={!yangiNom.trim()}>
            + Qo'shish
          </button>
        </div>

        <div className="ustun-2" style={{ alignItems: 'start', gap: 16 }}>
          {/* chap: kategoriyalar */}
          <div className="karta" style={{ padding: 0, maxHeight: 420, overflow: 'auto' }}>
            <table className="jadval">
              <thead>
                <tr>
                  <th>Kategoriya</th>
                  <th className="ong">Tovar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {royxat.map((k) => (
                  <tr
                    key={k.id}
                    style={{
                      cursor: 'pointer',
                      background: tanlangan && tanlangan.id === k.id ? 'var(--yashil-och)' : undefined,
                    }}
                    onClick={() => setTanlangan(k)}
                  >
                    <td className="qalin">{k.nomi}</td>
                    <td className="ong">
                      <span className={'nishon ' + (k.tovar_soni > 0 ? 'n-yashil' : 'n-qizil')}>{k.tovar_soni}</span>
                    </td>
                    <td className="ong" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-kichik" onClick={() => setTahrir({ ...k })} title="Nomini o'zgartirish">
                        ✎
                      </button>
                      <button className="btn btn-kichik" style={{ marginLeft: 4 }} onClick={() => ochir(k)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
                {!royxat.length && (
                  <tr>
                    <td colSpan={3} className="markaz xira" style={{ padding: 24 }}>
                      Kategoriya yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* o'ng: tanlangan kategoriyadagi tovarlar */}
          <div className="karta" style={{ maxHeight: 420, overflow: 'auto' }}>
            {!tanlangan ? (
              <p className="xira" style={{ padding: 20, textAlign: 'center' }}>
                Chapdan kategoriyani tanlang — ichidagi tovarlar shu yerda ko'rinadi
              </p>
            ) : (
              <>
                <div className="qator" style={{ marginBottom: 10 }}>
                  <b>{tanlangan.nomi}</b>
                  <span className="xira kichik">{tovarlar.length} ta tovar</span>
                  <button className="btn btn-kichik btn-yashil qator-oxiri" onClick={() => setBiriktirish(true)}>
                    + Tovar biriktirish
                  </button>
                </div>

                {tovarlar.length > 0 && (
                  <div
                    className="karta"
                    style={{ padding: 10, marginBottom: 10, background: 'var(--fon4)' }}
                  >
                    <div className="qator kichik" style={{ marginBottom: 8 }}>
                      <label className="qator" style={{ gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={belgilangan.length === tovarlar.length && tovarlar.length > 0}
                          onChange={(e) => setBelgilangan(e.target.checked ? tovarlar.map((t) => t.id) : [])}
                        />
                        Hammasini belgilash
                      </label>
                      {belgilangan.length > 0 && (
                        <span className="nishon n-yashil qator-oxiri">{belgilangan.length} ta tanlandi</span>
                      )}
                    </div>
                    <div className="qator">
                      <select
                        className="inp"
                        value={kochirTo}
                        onChange={(e) => setKochirTo(e.target.value)}
                        disabled={!belgilangan.length}
                      >
                        <option value="">— Qaysi kategoriyaga ko'chirilsin? —</option>
                        {royxat
                          .filter((k) => k.id !== tanlangan.id)
                          .map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.nomi}
                            </option>
                          ))}
                        <option value="yoq">Kategoriyasiz qoldirish</option>
                      </select>
                      <button
                        className="btn btn-yashil"
                        disabled={!belgilangan.length || !kochirTo}
                        onClick={() => {
                          const maqsad = kochirTo === 'yoq' ? null : Number(kochirTo);
                          const nomi = royxat.find((k) => k.id === maqsad)?.nomi;
                          kochir(belgilangan, maqsad, nomi);
                        }}
                      >
                        ➜ Ko'chirish
                      </button>
                    </div>
                  </div>
                )}
                <table className="jadval">
                  <tbody>
                    {tovarlar.map((t) => (
                      <tr key={t.id}>
                        <td style={{ width: 28 }}>
                          <input
                            type="checkbox"
                            checked={belgilangan.includes(t.id)}
                            onChange={(e) =>
                              setBelgilangan(
                                e.target.checked
                                  ? [...belgilangan, t.id]
                                  : belgilangan.filter((x) => x !== t.id)
                              )
                            }
                          />
                        </td>
                        <td>{t.nomi}</td>
                        <td className="ong xira kichik">{miqdorFmt(t.qoldiq)} dona</td>
                        <td className="ong qalin">{pul(t.sotuv_narx)}</td>
                        <td className="ong">
                          <button
                            className="btn btn-kichik"
                            title="Kategoriyadan chiqarish"
                            onClick={() => kochir([t.id], null)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!tovarlar.length && (
                      <tr>
                        <td className="xira markaz" style={{ padding: 20 }}>
                          Bu kategoriyada tovar yo'q
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* nomni o'zgartirish */}
      <Modal
        ochiq={!!tahrir}
        yop={() => setTahrir(null)}
        sarlavha="Kategoriya nomi"
        kenglik={420}
        past={
          <>
            <button className="btn" onClick={() => setTahrir(null)}>
              Bekor
            </button>
            <button className="btn btn-yashil" onClick={nomOzgartir}>
              Saqlash
            </button>
          </>
        }
      >
        {tahrir && (
          <input
            className="inp"
            autoFocus
            value={tahrir.nomi}
            onChange={(e) => setTahrir({ ...tahrir, nomi: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && nomOzgartir()}
          />
        )}
      </Modal>

      <BiriktirishOynasi
        ochiq={biriktirish}
        yop={() => setBiriktirish(false)}
        kategoriya={tanlangan}
        filial={filial}
        toast={toast}
        tayyor={() => {
          setBiriktirish(false);
          amal('kategoriya.tovarlar', { kategoriya_id: tanlangan.id, filial_id: filial }).then(setTovarlar);
          yukla();
          yangilandi && yangilandi();
        }}
      />
    </>
  );
}

/* ---------- Tovarlarni kategoriyaga biriktirish ---------- */
function BiriktirishOynasi({ ochiq, yop, kategoriya, filial, toast, tayyor }) {
  const [hammasi, setHammasi] = useState([]);
  const [qidiruv, setQidiruv] = useState('');
  const [tanlangan, setTanlangan] = useState([]);

  useEffect(() => {
    if (!ochiq) return;
    setTanlangan([]);
    setQidiruv('');
    amal('tovar.royxat', { filial_id: filial, limit: 5000 })
      .then(setHammasi)
      .catch(() => {});
  }, [ochiq, filial]);

  if (!ochiq || !kategoriya) return null;
  const q = qidiruv.trim().toLowerCase();
  const korinadi = hammasi.filter(
    (t) => t.kategoriya !== kategoriya.nomi && (!q || t.nomi.toLowerCase().includes(q))
  );

  async function saqla() {
    try {
      await amal('kategoriya.biriktir', { kategoriya_id: kategoriya.id, tovar_idlar: tanlangan });
      toast.ok(`${tanlangan.length} ta tovar «${kategoriya.nomi}» ga biriktirildi`);
      tayyor();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <Modal
      ochiq={ochiq}
      yop={yop}
      sarlavha={`«${kategoriya.nomi}» ga tovar biriktirish`}
      kenglik={560}
      past={
        <>
          <button className="btn" onClick={yop}>
            Bekor
          </button>
          <button className="btn btn-yashil" onClick={saqla} disabled={!tanlangan.length}>
            Biriktirish ({tanlangan.length})
          </button>
        </>
      }
    >
      <input
        className="inp"
        style={{ marginBottom: 12 }}
        placeholder="Tovarni qidirish..."
        value={qidiruv}
        onChange={(e) => setQidiruv(e.target.value)}
        autoFocus
      />
      <div style={{ maxHeight: 360, overflow: 'auto' }}>
        {korinadi.map((t) => (
          <label
            key={t.id}
            className="qator"
            style={{ padding: '8px 10px', borderBottom: '1px solid var(--chegara2)', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={tanlangan.includes(t.id)}
              onChange={(e) =>
                setTanlangan(e.target.checked ? [...tanlangan, t.id] : tanlangan.filter((x) => x !== t.id))
              }
            />
            <span>{t.nomi}</span>
            {t.kategoriya && <span className="xira kichik">({t.kategoriya})</span>}
            <span className="xira kichik qator-oxiri">{pul(t.sotuv_narx)}</span>
          </label>
        ))}
        {!korinadi.length && <p className="xira markaz" style={{ padding: 20 }}>Tovar topilmadi</p>}
      </div>
    </Modal>
  );
}
