import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { amal, pul, miqdorFmt, vaqtChiroyli, bugun, sanaQoshish } from '../api.js';
import { Modal } from '../components/Ui.jsx';

export default function Kirim({ user, filial, toast }) {
  const [tab, setTab] = useState('yangi');
  return (
    <div className="sahifa">
      <div className="tab-qator">
        <button className={'tab' + (tab === 'yangi' ? ' faol' : '')} onClick={() => setTab('yangi')}>
          Yangi kirim
        </button>
        <button className={'tab' + (tab === 'tarix' ? ' faol' : '')} onClick={() => setTab('tarix')}>
          Kirimlar tarixi
        </button>
      </div>
      {tab === 'yangi' ? (
        <YangiKirim user={user} filial={filial} toast={toast} />
      ) : (
        <KirimTarixi filial={filial} toast={toast} />
      )}
    </div>
  );
}

function YangiKirim({ user, filial, toast }) {
  const [tovarlar, setTovarlar] = useState([]);
  const [qidiruv, setQidiruv] = useState('');
  const [qatorlar, setQatorlar] = useState([]);
  const [taminotchi, setTaminotchi] = useState('');
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [fokus, setFokus] = useState(false);
  const [yangiTovar, setYangiTovar] = useState(null);
  const qidiruvRef = useRef();
  const skaner = useRef({ matn: '', vaqt: 0 });

  const yukla = useCallback(() => {
    amal('tovar.royxat', { filial_id: filial, limit: 5000 })
      .then(setTovarlar)
      .catch((e) => toast.xato(e.message));
  }, [filial]);

  useEffect(yukla, [yukla]);
  useEffect(() => qidiruvRef.current?.focus(), []);

  // shtrix-kod skaneri
  useEffect(() => {
    function bosildi(e) {
      const hozir = Date.now();
      if (e.key === 'Enter') {
        const kod = skaner.current.matn;
        skaner.current = { matn: '', vaqt: hozir };
        if (kod.length >= 6) {
          const t = tovarlar.find((x) => x.barcode === kod);
          if (t) {
            qosh(t);
            setQidiruv('');
          } else {
            toast.ogoh(`Shtrix-kod topilmadi: ${kod} — avval tovarni yarating`);
          }
          e.preventDefault();
        }
        return;
      }
      if (e.key.length === 1) {
        if (hozir - skaner.current.vaqt > 120) skaner.current.matn = '';
        skaner.current.matn += e.key;
        skaner.current.vaqt = hozir;
      }
    }
    window.addEventListener('keydown', bosildi);
    return () => window.removeEventListener('keydown', bosildi);
  });

  const natijalar = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    const qoshilgan = new Set(qatorlar.map((x) => x.tovar_id));
    return tovarlar
      .filter((t) => !qoshilgan.has(t.id) && (!q || t.nomi.toLowerCase().includes(q) || (t.barcode || '').includes(q)))
      .slice(0, 14);
  }, [qidiruv, tovarlar, qatorlar]);

  function qosh(t) {
    setQatorlar((r) => {
      if (r.find((x) => x.tovar_id === t.id)) return r;
      return [
        ...r,
        {
          tovar_id: t.id,
          nomi: t.nomi,
          blok_soni: t.blok_soni,
          miqdor: t.blok_soni > 1 ? t.blok_soni : 1,
          tan_narx: t.tan_narx || '',
          sotuv_narx: t.sotuv_narx || '',
          eski_sotuv: t.sotuv_narx,
        },
      ];
    });
    setQidiruv('');
    qidiruvRef.current?.focus();
  }

  const oz = (id, k, v) => setQatorlar((r) => r.map((x) => (x.tovar_id === id ? { ...x, [k]: v } : x)));
  const ochir = (id) => setQatorlar((r) => r.filter((x) => x.tovar_id !== id));

  const jami = qatorlar.reduce((s, x) => s + (Number(x.miqdor) || 0) * (Number(x.tan_narx) || 0), 0);

  async function saqla() {
    if (!qatorlar.length) return;
    setSaqlanmoqda(true);
    try {
      await amal('kirim.yarat', {
        filial_id: filial,
        taminotchi,
        qatorlar: qatorlar.map((x) => ({
          tovar_id: x.tovar_id,
          miqdor: Number(x.miqdor) || 0,
          tan_narx: Number(x.tan_narx) || 0,
          sotuv_narx: Number(x.sotuv_narx) || 0,
        })),
      });
      toast.ok(`Kirim saqlandi · ${pul(jami)} so'm`);
      setQatorlar([]);
      setTaminotchi('');
      yukla();
    } catch (e) {
      toast.xato(e.message);
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <>
      <div className="karta" style={{ marginBottom: 14 }}>
        <div className="qator">
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={qidiruvRef}
              className="inp"
              placeholder="Tovarni qidiring yoki shtrix-kodni o'qing... (ro'yxatni ko'rish uchun bosing)"
              value={qidiruv}
              onChange={(e) => setQidiruv(e.target.value)}
              onFocus={() => setFokus(true)}
              onBlur={() => setTimeout(() => setFokus(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && natijalar.length && qidiruv.length < 6) qosh(natijalar[0]);
              }}
            />
            {fokus && natijalar.length > 0 && (
              <div
                className="karta"
                style={{ position: 'absolute', top: 46, left: 0, right: 0, zIndex: 10, padding: 6, maxHeight: 320, overflow: 'auto' }}
              >
                {natijalar.map((t) => (
                  <div
                    key={t.id}
                    className="qator"
                    style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
                    onClick={() => qosh(t)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fon3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>{t.nomi}</span>
                    <span className="xira kichik qator-oxiri">qoldiq: {miqdorFmt(t.qoldiq)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            className="inp"
            style={{ maxWidth: 240 }}
            placeholder="Ta'minotchi (ixtiyoriy)"
            value={taminotchi}
            onChange={(e) => setTaminotchi(e.target.value)}
          />
          <button
            className="btn btn-yashil"
            onClick={() => setYangiTovar({ nomi: qidiruv, barcode: '', blok_soni: '', sotuv_narx: '', tan_narx: '' })}
            title="Bazada yo'q tovarni shu yerda yaratish"
          >
            + Yangi tovar
          </button>
        </div>
      </div>

      <div className="karta" style={{ padding: 0, overflow: 'auto' }}>
        <table className="jadval">
          <thead>
            <tr>
              <th>Tovar</th>
              <th className="ong" style={{ width: 150 }}>Miqdor (dona)</th>
              <th className="ong" style={{ width: 150 }}>Tan narx</th>
              <th className="ong" style={{ width: 150 }}>Sotuv narx</th>
              <th className="ong" style={{ width: 130 }}>Summa</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {qatorlar.map((x) => (
              <tr key={x.tovar_id}>
                <td>
                  <div className="qalin">{x.nomi}</div>
                  {x.blok_soni > 1 && (
                    <button
                      className="btn btn-kichik"
                      style={{ marginTop: 4 }}
                      onClick={() => oz(x.tovar_id, 'miqdor', (Number(x.miqdor) || 0) + x.blok_soni)}
                    >
                      +1 blok ({x.blok_soni} dona)
                    </button>
                  )}
                </td>
                <td className="ong">
                  <input
                    className="inp ong"
                    value={x.miqdor}
                    onChange={(e) => oz(x.tovar_id, 'miqdor', e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </td>
                <td className="ong">
                  <input
                    className="inp ong"
                    value={x.tan_narx}
                    onChange={(e) => oz(x.tovar_id, 'tan_narx', e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </td>
                <td className="ong">
                  <input
                    className="inp ong"
                    value={x.sotuv_narx}
                    onChange={(e) => oz(x.tovar_id, 'sotuv_narx', e.target.value.replace(/[^\d.]/g, ''))}
                  />
                  {Number(x.sotuv_narx) !== x.eski_sotuv && (
                    <div className="kichik" style={{ color: 'var(--sariq)' }}>
                      eski: {pul(x.eski_sotuv)}
                    </div>
                  )}
                </td>
                <td className="ong qalin">{pul((Number(x.miqdor) || 0) * (Number(x.tan_narx) || 0))}</td>
                <td className="ong">
                  <button className="btn btn-kichik" onClick={() => ochir(x.tovar_id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {!qatorlar.length && (
              <tr>
                <td colSpan={6} className="markaz xira" style={{ padding: 34 }}>
                  Tovar qo'shing — yuqoridagi qidiruvdan yoki shtrix-kod skaneri bilan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <YangiTovarOyna
        tovar={yangiTovar}
        yop={() => setYangiTovar(null)}
        filial={filial}
        toast={toast}
        yaratildi={async (id) => {
          setYangiTovar(null);
          const royxat = await amal('tovar.royxat', { filial_id: filial, limit: 5000 });
          setTovarlar(royxat);
          const t = royxat.find((x) => x.id === id);
          if (t) qosh(t);
        }}
      />

      {qatorlar.length > 0 && (
        <div className="karta qator" style={{ marginTop: 14 }}>
          <div>
            <div className="xira kichik">Kirim summasi</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{pul(jami)} so'm</div>
          </div>
          <button className="btn btn-yashil btn-katta qator-oxiri" onClick={saqla} disabled={saqlanmoqda}>
            {saqlanmoqda ? 'Saqlanmoqda...' : 'Kirimni saqlash'}
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- Kirim paytida yangi tovar yaratish ---------- */
function YangiTovarOyna({ tovar, yop, filial, toast, yaratildi }) {
  const [f, setF] = useState({ nomi: '', barcode: '', blok_soni: '', sotuv_narx: '', tan_narx: '' });

  useEffect(() => {
    if (tovar) setF({ nomi: '', barcode: '', blok_soni: '', sotuv_narx: '', tan_narx: '', ...tovar });
  }, [tovar]);

  if (!tovar) return null;
  const oz = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const son = (k) => (e) => setF({ ...f, [k]: e.target.value.replace(/[^\d.]/g, '') });
  const foyda = (Number(f.sotuv_narx) || 0) - (Number(f.tan_narx) || 0);

  async function saqla() {
    if (!f.nomi.trim()) return toast.ogoh('Tovar nomini kiriting');
    try {
      // qoldiq 0 - miqdor kirim jadvalidan kiritiladi
      const id = await amal('tovar.saqla', { ...f, qoldiq: 0, filial_id: filial });
      toast.ok(`«${f.nomi}» yaratildi va ro'yxatga qo'shildi`);
      yaratildi(id);
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <Modal
      ochiq={!!tovar}
      yop={yop}
      sarlavha="Yangi tovar (kirim uchun)"
      kenglik={560}
      past={
        <>
          <button className="btn" onClick={yop}>Bekor</button>
          <button className="btn btn-yashil" onClick={saqla}>Yaratish va qo'shish</button>
        </>
      }
    >
      <div className="maydon">
        <label className="yorliq">Tovar nomi *</label>
        <input className="inp" autoFocus value={f.nomi} onChange={oz('nomi')} placeholder="Pepsi 1.5L" />
      </div>
      <div className="ustun-2">
        <div className="maydon">
          <label className="yorliq">Shtrix-kod</label>
          <input className="inp" value={f.barcode} onChange={oz('barcode')} placeholder="Skanerni o'qiting" />
        </div>
        <div className="maydon">
          <label className="yorliq">1 blokda nechta dona</label>
          <input className="inp" value={f.blok_soni} onChange={son('blok_soni')} placeholder="6" />
        </div>
      </div>
      <div className="ustun-2">
        <div className="maydon">
          <label className="yorliq">Kelgan narxi (tan narx)</label>
          <input className="inp" value={f.tan_narx} onChange={son('tan_narx')} placeholder="11000" />
        </div>
        <div className="maydon">
          <label className="yorliq">Sotuv narxi *</label>
          <input className="inp" value={f.sotuv_narx} onChange={son('sotuv_narx')} placeholder="12000" />
        </div>
      </div>
      {(Number(f.sotuv_narx) > 0 || Number(f.tan_narx) > 0) && (
        <div className="karta" style={{ background: foyda > 0 ? 'var(--yashil-och)' : 'var(--qizil-och)', borderColor: foyda > 0 ? 'var(--yashil)' : 'var(--qizil)' }}>
          1 donadan foyda: <b>{pul(foyda)} so'm</b>
        </div>
      )}
      <p className="xira kichik" style={{ marginTop: 10 }}>
        Miqdorni quyidagi kirim jadvalida kiritasiz.
      </p>
    </Modal>
  );
}

function KirimTarixi({ filial, toast }) {
  const [royxat, setRoyxat] = useState([]);
  const [tanlangan, setTanlangan] = useState(null);

  useEffect(() => {
    amal('kirim.royxat', { dan: sanaQoshish(bugun(), -60), gacha: bugun(), filial_id: filial })
      .then(setRoyxat)
      .catch((e) => toast.xato(e.message));
  }, [filial]);

  return (
    <div className="karta" style={{ padding: 0, overflow: 'auto' }}>
      <table className="jadval">
        <thead>
          <tr>
            <th>Sana</th>
            <th>Ta'minotchi</th>
            <th>Kiritdi</th>
            <th className="ong">Summa</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {royxat.map((k) => (
            <tr key={k.id}>
              <td>{vaqtChiroyli(k.sana)}</td>
              <td>{k.taminotchi || '—'}</td>
              <td>{k.hodim}</td>
              <td className="ong qalin">{pul(k.jami)}</td>
              <td className="ong">
                <button
                  className="btn btn-kichik"
                  onClick={() => amal('kirim.bitta', { id: k.id }).then(setTanlangan)}
                >
                  Ko'rish
                </button>
              </td>
            </tr>
          ))}
          {!royxat.length && (
            <tr>
              <td colSpan={5} className="markaz xira" style={{ padding: 30 }}>
                Hali kirim qilinmagan
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal ochiq={!!tanlangan} yop={() => setTanlangan(null)} sarlavha="Kirim tafsiloti">
        {tanlangan && (
          <>
            <p className="xira kichik" style={{ marginBottom: 10 }}>
              {vaqtChiroyli(tanlangan.kirim.sana)} · {tanlangan.kirim.taminotchi || 'ta\'minotchi ko\'rsatilmagan'}
            </p>
            <table className="jadval">
              <tbody>
                {tanlangan.qatorlar.map((q) => (
                  <tr key={q.id}>
                    <td>{q.nomi}</td>
                    <td className="ong">{miqdorFmt(q.miqdor)} × {pul(q.tan_narx)}</td>
                    <td className="ong qalin">{pul(q.summa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="qator" style={{ marginTop: 14, fontSize: 18 }}>
              <b>Jami:</b>
              <b className="qator-oxiri">{pul(tanlangan.kirim.jami)} so'm</b>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
