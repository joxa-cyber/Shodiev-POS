import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { amal, pul, miqdorFmt } from '../api.js';
import { Modal } from '../components/Ui.jsx';

export default function Sotuv({ user, filial, toast, savatlar, setSavatlar, faolId, setFaolId }) {
  const [tovarlar, setTovarlar] = useState([]);
  const [qidiruv, setQidiruv] = useState('');
  const [kategoriya, setKategoriya] = useState('');
  const [mijozlar, setMijozlar] = useState([]);
  const [tolovOchiq, setTolovOchiq] = useState(false);
  const qidiruvRef = useRef();
  const skanerBufer = useRef({ matn: '', vaqt: 0 });

  const faol = savatlar.find((x) => x.id === faolId) || savatlar[0];
  const savat = faol.qatorlar;
  const mijoz = faol.mijoz;

  const savatYangila = (f) =>
    setSavatlar((lar) => lar.map((x) => (x.id === faol.id ? { ...x, qatorlar: f(x.qatorlar) } : x)));
  const setMijoz = (m) => setSavatlar((lar) => lar.map((x) => (x.id === faol.id ? { ...x, mijoz: m } : x)));

  const yukla = useCallback(() => {
    amal('tovar.royxat', { filial_id: filial, limit: 5000 })
      .then(setTovarlar)
      .catch((e) => toast.xato(e.message));
  }, [filial]);

  const mijozlarniYukla = useCallback(() => amal('mijoz.royxat', {}).then(setMijozlar).catch(() => {}), []);

  useEffect(() => {
    yukla();
    mijozlarniYukla();
  }, [yukla, mijozlarniYukla]);

  useEffect(() => {
    qidiruvRef.current?.focus();
  }, []);

  /* ---------- Shtrix-kod skaneri ---------- */
  useEffect(() => {
    function bosildi(e) {
      if (tolovOchiq) return;
      const hozir = Date.now();
      if (e.key === 'Enter') {
        const kod = skanerBufer.current.matn;
        skanerBufer.current = { matn: '', vaqt: hozir };
        if (kod.length >= 6) {
          e.preventDefault();
          barcodeQidir(kod);
          return;
        }
        if (e.target.tagName === 'INPUT' && qidiruv.trim()) birinchiniQosh();
        return;
      }
      if (e.key.length === 1) {
        if (hozir - skanerBufer.current.vaqt > 120) skanerBufer.current.matn = '';
        skanerBufer.current.matn += e.key;
        skanerBufer.current.vaqt = hozir;
      }
      if (e.key === 'F2' && savat.length) {
        e.preventDefault();
        setTolovOchiq(true);
      }
    }
    window.addEventListener('keydown', bosildi);
    return () => window.removeEventListener('keydown', bosildi);
  });

  async function barcodeQidir(kod) {
    const bor = tovarlar.find((t) => t.barcode === kod);
    if (bor) {
      qoshish(bor, 1);
      setQidiruv('');
      return;
    }
    try {
      const t = await amal('tovar.barcode', { kod, filial_id: filial });
      if (t) {
        qoshish(t, 1);
        setQidiruv('');
      } else {
        toast.ogoh(`Shtrix-kod topilmadi: ${kod}`);
        setQidiruv(kod);
      }
    } catch (e) {
      toast.xato(e.message);
    }
  }

  const kategoriyalar = useMemo(() => {
    const k = [];
    for (const t of tovarlar) if (t.kategoriya && !k.includes(t.kategoriya)) k.push(t.kategoriya);
    return k.sort();
  }, [tovarlar]);

  const natijalar = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    return tovarlar
      .filter(
        (t) =>
          (!kategoriya || t.kategoriya === kategoriya) &&
          (!q || t.nomi.toLowerCase().includes(q) || (t.barcode || '').includes(q))
      )
      .slice(0, 80);
  }, [qidiruv, tovarlar, kategoriya]);

  function birinchiniQosh() {
    if (natijalar.length) {
      qoshish(natijalar[0], 1);
      setQidiruv('');
    }
  }

  function qoshish(t, miqdor = 1) {
    savatYangila((s) => {
      const bor = s.find((x) => x.tovar_id === t.id);
      if (bor) return s.map((x) => (x.tovar_id === t.id ? { ...x, miqdor: x.miqdor + miqdor } : x));
      return [
        ...s,
        { tovar_id: t.id, nomi: t.nomi, narx: t.sotuv_narx, miqdor, blok_soni: t.blok_soni, qoldiq: t.qoldiq },
      ];
    });
  }

  const miqdorOzgar = (id, yangi) =>
    savatYangila((s) =>
      s.map((x) => (x.tovar_id === id ? { ...x, miqdor: Math.max(0, yangi) } : x)).filter((x) => x.miqdor > 0)
    );
  const narxOzgar = (id, narx) =>
    savatYangila((s) => s.map((x) => (x.tovar_id === id ? { ...x, narx: Number(narx) || 0 } : x)));
  const ochir = (id) => savatYangila((s) => s.filter((x) => x.tovar_id !== id));

  function tozala() {
    savatYangila(() => []);
    setMijoz(null);
    setQidiruv('');
    qidiruvRef.current?.focus();
  }

  function yangiSavat() {
    const id = Math.max(0, ...savatlar.map((x) => x.id)) + 1;
    setSavatlar([...savatlar, { id, nom: `Mijoz ${id}`, qatorlar: [], mijoz: null }]);
    setFaolId(id);
    setQidiruv('');
    setTimeout(() => qidiruvRef.current?.focus(), 50);
  }

  function savatniYop(id) {
    const qolgan = savatlar.filter((x) => x.id !== id);
    if (!qolgan.length) {
      setSavatlar([{ id: 1, nom: 'Mijoz 1', qatorlar: [], mijoz: null }]);
      setFaolId(1);
      return;
    }
    setSavatlar(qolgan);
    if (faolId === id) setFaolId(qolgan[0].id);
  }

  const jami = savat.reduce((s, x) => s + x.miqdor * x.narx, 0);
  const dona = savat.reduce((s, x) => s + x.miqdor, 0);

  async function sotuvniYakunla(tolov) {
    try {
      const natija = await amal('sotuv.yarat', {
        filial_id: filial,
        mijoz_id: mijoz ? mijoz.id : null,
        qatorlar: savat.map((x) => ({ tovar_id: x.tovar_id, nomi: x.nomi, miqdor: x.miqdor, narx: x.narx })),
        ...tolov,
      });
      toast.ok(`Chek №${natija.raqam} · ${pul(natija.jami)} so'm`);
      setTolovOchiq(false);
      if (savatlar.length > 1) savatniYop(faol.id);
      else tozala();
      yukla();
      mijozlarniYukla();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <div className="sotuv">
      {/* CHAP: qidiruv va tovarlar */}
      <div className="sotuv-chap">
        <div className="qidiruv-qator">
          <input
            ref={qidiruvRef}
            className="qidiruv"
            value={qidiruv}
            onChange={(e) => setQidiruv(e.target.value)}
            placeholder="Tovar nomi yoki shtrix-kod...  (skanerni bemalol o'qiting)"
            autoComplete="off"
          />
          {qidiruv && (
            <button className="btn" onClick={() => setQidiruv('')}>
              Tozalash
            </button>
          )}
        </div>

        {kategoriyalar.length > 0 && (
          <div className="chip-qator">
            <button className={'chip' + (kategoriya === '' ? ' faol' : '')} onClick={() => setKategoriya('')}>
              Hammasi
            </button>
            {kategoriyalar.map((k) => (
              <button
                key={k}
                className={'chip' + (kategoriya === k ? ' faol' : '')}
                onClick={() => setKategoriya(kategoriya === k ? '' : k)}
              >
                {k}
              </button>
            ))}
          </div>
        )}

        <div className="tovar-setka">
          {natijalar.map((t) => (
            <div key={t.id} className="tovar-karta" onClick={() => qoshish(t, 1)}>
              <div className="tovar-nom">{t.nomi}</div>
              <div className="tovar-narx">{pul(t.sotuv_narx)}</div>
              <div className="qator" style={{ justifyContent: 'space-between' }}>
                <span className={'tovar-qoldiq ' + (t.qoldiq <= 0 ? 'n-qizil nishon' : '')}>
                  {t.qoldiq <= 0 ? 'Qoldiq yo‘q' : `${miqdorFmt(t.qoldiq)} dona`}
                </span>
                {t.blok_soni > 1 && (
                  <button
                    className="btn btn-kichik"
                    onClick={(e) => {
                      e.stopPropagation();
                      qoshish(t, t.blok_soni);
                    }}
                    title={`1 blok = ${t.blok_soni} dona`}
                  >
                    +blok
                  </button>
                )}
              </div>
            </div>
          ))}
          {!natijalar.length && (
            <div className="xira" style={{ padding: 20 }}>
              Tovar topilmadi. «Tovarlar» bo‘limidan qo‘shishingiz mumkin.
            </div>
          )}
        </div>
      </div>

      {/* O'NG: savatlar */}
      <div className="sotuv-ong">
        <div className="savat-tablar">
          {savatlar.map((x) => {
            const summa = x.qatorlar.reduce((s, q) => s + q.miqdor * q.narx, 0);
            return (
              <button
                key={x.id}
                className={'savat-tab' + (x.id === faol.id ? ' faol' : '')}
                onClick={() => setFaolId(x.id)}
                title={x.mijoz ? x.mijoz.ism : 'Mijoz tanlanmagan'}
              >
                <span>{x.mijoz ? x.mijoz.ism.split(' ')[0] : x.nom}</span>
                {summa > 0 && <span className="savat-tab-summa">{pul(summa)}</span>}
                {savatlar.length > 1 && (
                  <span
                    className="savat-tab-yopish"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!x.qatorlar.length || confirm('Bu savatdagi tovarlar ochiriladi. Davom etamizmi?'))
                        savatniYop(x.id);
                    }}
                  >
                    ✕
                  </span>
                )}
              </button>
            );
          })}
          <button className="savat-tab qosh" onClick={yangiSavat} title="Yangi mijoz uchun savat">
            + Mijoz
          </button>
        </div>

        <div className="savat-tepa">
          <strong>Savat</strong>
          <span className="xira kichik">
            {savat.length} tur · {miqdorFmt(dona)} dona
          </span>
          {savat.length > 0 && (
            <button className="btn btn-kichik qator-oxiri" onClick={tozala}>
              Tozalash
            </button>
          )}
        </div>

        {savat.length === 0 ? (
          <div className="bosh-savat">
            <div style={{ fontSize: 40 }}>🛒</div>
            <div>Savat bo‘sh</div>
            <div className="kichik">Tovarni tanlang yoki shtrix-kodni o‘qing</div>
          </div>
        ) : (
          <div className="savat-royxat">
            {savat.map((x) => (
              <div key={x.tovar_id} className="savat-qator">
                <div className="savat-nom">
                  {x.nomi}
                  {x.blok_soni > 1 && x.miqdor >= x.blok_soni && (
                    <span className="xira kichik"> · {miqdorFmt(Math.floor(x.miqdor / x.blok_soni))} blok</span>
                  )}
                </div>
                <button className="btn btn-kichik" onClick={() => ochir(x.tovar_id)} title="O'chirish">
                  ✕
                </button>
                <div className="miqdor-boshqaruv">
                  <button className="miqdor-btn" onClick={() => miqdorOzgar(x.tovar_id, x.miqdor - 1)}>
                    −
                  </button>
                  <input
                    className="miqdor-inp"
                    value={x.miqdor}
                    onChange={(e) => miqdorOzgar(x.tovar_id, Number(e.target.value.replace(/[^\d.]/g, '')) || 0)}
                  />
                  <button className="miqdor-btn" onClick={() => miqdorOzgar(x.tovar_id, x.miqdor + 1)}>
                    +
                  </button>
                  {x.blok_soni > 1 && (
                    <button
                      className="btn btn-kichik"
                      onClick={() => miqdorOzgar(x.tovar_id, x.miqdor + x.blok_soni)}
                      title={`+1 blok (${x.blok_soni} dona)`}
                    >
                      +blok
                    </button>
                  )}
                  {user.rol === 'rahbar' && (
                    <input
                      className="miqdor-inp"
                      style={{ width: 86 }}
                      value={x.narx}
                      onChange={(e) => narxOzgar(x.tovar_id, e.target.value.replace(/[^\d]/g, ''))}
                      title="Narxni o'zgartirish (faqat rahbar)"
                    />
                  )}
                </div>
                <div className="ong qalin">{pul(x.miqdor * x.narx)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="savat-past">
          <MijozTanlash
            mijoz={mijoz}
            tanla={setMijoz}
            mijozlar={mijozlar}
            yangilandi={mijozlarniYukla}
            toast={toast}
          />
          <div className="jami-qator">
            <span className="xira">JAMI</span>
            <span className="jami-summa">{pul(jami)}</span>
          </div>
          <button
            className="btn btn-yashil btn-katta"
            style={{ justifyContent: 'center' }}
            disabled={!savat.length}
            onClick={() => setTolovOchiq(true)}
          >
            To‘lovga o‘tish (F2)
          </button>
        </div>
      </div>

      <TolovOyna
        ochiq={tolovOchiq}
        yop={() => setTolovOchiq(false)}
        jami={jami}
        mijoz={mijoz}
        mijozlar={mijozlar}
        mijozTanla={setMijoz}
        mijozlarniYukla={mijozlarniYukla}
        toast={toast}
        yakunla={sotuvniYakunla}
      />
    </div>
  );
}

/* ================= MIJOZ TANLASH (qidiruvli + yangi qo'shish) ================= */
export function MijozTanlash({ mijoz, tanla, mijozlar, yangilandi, toast, majburiy = false }) {
  const [ochiq, setOchiq] = useState(false);
  const [q, setQ] = useState('');
  const [yangiOyna, setYangiOyna] = useState(false);
  const [yangi, setYangi] = useState({ ism: '', telefon: '' });

  const topilgan = useMemo(() => {
    const s = q.trim().toLowerCase();
    return mijozlar
      .filter((m) => !s || m.ism.toLowerCase().includes(s) || (m.telefon || '').includes(s))
      .slice(0, 60);
  }, [q, mijozlar]);

  async function yangiSaqla() {
    if (!yangi.ism.trim()) return;
    try {
      const id = await amal('mijoz.saqla', yangi);
      await yangilandi();
      const royxat = await amal('mijoz.royxat', {});
      tanla(royxat.find((m) => m.id === id) || { id, ism: yangi.ism, qarz: 0 });
      toast.ok(`«${yangi.ism}» qo'shildi va tanlandi`);
      setYangiOyna(false);
      setYangi({ ism: '', telefon: '' });
      setOchiq(false);
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <>
      <button
        className="btn"
        style={{
          width: '100%',
          justifyContent: 'space-between',
          borderColor: majburiy && !mijoz ? 'var(--qizil)' : undefined,
        }}
        onClick={() => {
          setOchiq(true);
          setQ('');
        }}
      >
        <span>
          {mijoz ? (
            <>
              🙍 <b>{mijoz.ism}</b>
              {mijoz.qarz > 0.4 && <span className="xira kichik"> · qarzi {pul(mijoz.qarz)}</span>}
            </>
          ) : majburiy ? (
            <span style={{ color: 'var(--qizil)' }}>⚠ Mijozni tanlang</span>
          ) : (
            <span className="xira">Mijoz tanlanmagan (oddiy xaridor)</span>
          )}
        </span>
        <span className="xira">▾</span>
      </button>

      <Modal ochiq={ochiq} yop={() => setOchiq(false)} sarlavha="Mijozni tanlang" kenglik={520}>
        <div className="qator" style={{ marginBottom: 12 }}>
          <input
            className="inp"
            autoFocus
            placeholder="Ism yoki telefon bo'yicha qidirish..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-yashil" onClick={() => setYangiOyna(true)}>
            + Yangi
          </button>
        </div>

        <div style={{ maxHeight: 380, overflow: 'auto' }}>
          {!majburiy && (
            <div
              className="qator"
              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--chegara2)' }}
              onClick={() => {
                tanla(null);
                setOchiq(false);
              }}
            >
              <span className="xira">Mijozsiz (oddiy xaridor)</span>
            </div>
          )}
          {topilgan.map((m) => (
            <div
              key={m.id}
              className="qator"
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--chegara2)',
                background: mijoz && mijoz.id === m.id ? 'var(--yashil-och)' : undefined,
              }}
              onClick={() => {
                tanla(m);
                setOchiq(false);
              }}
            >
              <div>
                <div className="qalin">{m.ism}</div>
                {m.telefon && <div className="xira kichik">{m.telefon}</div>}
              </div>
              <div className="qator-oxiri">
                {m.qarz > 0.4 ? (
                  <span className="nishon n-sariq">qarz {pul(m.qarz)}</span>
                ) : m.qarz < -0.4 ? (
                  <span className="nishon n-kok">avans {pul(-m.qarz)}</span>
                ) : (
                  <span className="xira kichik">qarzi yo'q</span>
                )}
              </div>
            </div>
          ))}
          {!topilgan.length && (
            <p className="xira markaz" style={{ padding: 20 }}>
              Mijoz topilmadi. «+ Yangi» tugmasi bilan qo'shing.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        ochiq={yangiOyna}
        yop={() => setYangiOyna(false)}
        sarlavha="Yangi mijoz"
        kenglik={420}
        past={
          <>
            <button className="btn" onClick={() => setYangiOyna(false)}>
              Bekor
            </button>
            <button className="btn btn-yashil" onClick={yangiSaqla} disabled={!yangi.ism.trim()}>
              Saqlash va tanlash
            </button>
          </>
        }
      >
        <div className="maydon">
          <label className="yorliq">Ism *</label>
          <input
            className="inp"
            autoFocus
            value={yangi.ism}
            onChange={(e) => setYangi({ ...yangi, ism: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && yangiSaqla()}
            placeholder="Alisher aka (Chorsu do'kon)"
          />
        </div>
        <div className="maydon">
          <label className="yorliq">Telefon</label>
          <input
            className="inp"
            value={yangi.telefon}
            onChange={(e) => setYangi({ ...yangi, telefon: e.target.value })}
            placeholder="+998 90 123 45 67"
          />
        </div>
      </Modal>
    </>
  );
}

/* ================= TO'LOV OYNASI ================= */
function TolovOyna({ ochiq, yop, jami, mijoz, mijozlar, mijozTanla, mijozlarniYukla, toast, yakunla }) {
  const [naqd, setNaqd] = useState(0);
  const [karta, setKarta] = useState(0);
  const [terminal, setTerminal] = useState(0);
  const [qarz, setQarz] = useState(0);
  const [berilgan, setBerilgan] = useState('');
  const [yuborilmoqda, setYuborilmoqda] = useState(false);
  const naqdRef = useRef();

  useEffect(() => {
    if (ochiq) {
      setNaqd(jami);
      setKarta(0);
      setTerminal(0);
      setQarz(0);
      setBerilgan('');
      setTimeout(() => naqdRef.current?.select(), 60);
    }
  }, [ochiq, jami]);

  const tolangan = Number(naqd) + Number(karta) + Number(terminal) + Number(qarz);
  const farq = jami - tolangan;
  const qaytim = Math.max(0, (Number(berilgan) || 0) - Number(naqd));
  const son = (v) => Number(String(v).replace(/[^\d]/g, '')) || 0;

  function faqat(usul) {
    setNaqd(usul === 'naqd' ? jami : 0);
    setKarta(usul === 'karta' ? jami : 0);
    setTerminal(usul === 'terminal' ? jami : 0);
    setQarz(usul === 'qarz' ? jami : 0);
    setBerilgan('');
  }

  const qolganini = (setter, boshqalar) => setter(Math.max(0, jami - boshqalar));

  async function yubor() {
    if (Math.abs(farq) >= 1) return;
    if (qarz > 0 && !mijoz) {
      toast.ogoh('Qarzga yozish uchun mijozni tanlang');
      return;
    }
    setYuborilmoqda(true);
    try {
      await yakunla({
        naqd: Number(naqd),
        karta: Number(karta),
        terminal: Number(terminal),
        qarz: Number(qarz),
        qaytim,
      });
    } finally {
      setYuborilmoqda(false);
    }
  }

  return (
    <Modal
      ochiq={ochiq}
      yop={yop}
      sarlavha={`To‘lov · ${pul(jami)} so‘m`}
      kenglik={640}
      past={
        <>
          <button className="btn" onClick={yop}>
            Orqaga (Esc)
          </button>
          <button
            className="btn btn-yashil btn-katta"
            onClick={yubor}
            disabled={Math.abs(farq) >= 1 || yuborilmoqda || (qarz > 0 && !mijoz)}
          >
            {yuborilmoqda ? 'Saqlanmoqda...' : 'Sotuvni yakunlash'}
          </button>
        </>
      }
    >
      <div className="qator" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-yashil" onClick={() => faqat('naqd')}>
          💵 Naqd
        </button>
        <button className="btn btn-kok" onClick={() => faqat('karta')}>
          💳 Karta
        </button>
        <button className="btn btn-sariq" onClick={() => faqat('terminal')}>
          🏧 Terminal
        </button>
        <button className="btn" onClick={() => faqat('qarz')}>
          📝 Qarzga
        </button>
      </div>

      <div className="ustun-2">
        <div className="maydon">
          <label className="yorliq">Naqd</label>
          <input
            ref={naqdRef}
            className="inp"
            value={naqd}
            onChange={(e) => setNaqd(son(e.target.value))}
            onDoubleClick={() => qolganini(setNaqd, Number(karta) + Number(terminal) + Number(qarz))}
          />
        </div>
        <div className="maydon">
          <label className="yorliq">Karta (o‘tkazma)</label>
          <input
            className="inp"
            value={karta}
            onChange={(e) => setKarta(son(e.target.value))}
            onDoubleClick={() => qolganini(setKarta, Number(naqd) + Number(terminal) + Number(qarz))}
          />
        </div>
        <div className="maydon">
          <label className="yorliq">Terminal</label>
          <input
            className="inp"
            value={terminal}
            onChange={(e) => setTerminal(son(e.target.value))}
            onDoubleClick={() => qolganini(setTerminal, Number(naqd) + Number(karta) + Number(qarz))}
          />
        </div>
        <div className="maydon">
          <label className="yorliq">Qarzga</label>
          <input
            className="inp"
            value={qarz}
            onChange={(e) => setQarz(son(e.target.value))}
            onDoubleClick={() => qolganini(setQarz, Number(naqd) + Number(karta) + Number(terminal))}
            style={{ borderColor: qarz > 0 ? 'var(--sariq)' : undefined }}
          />
        </div>
      </div>

      {/* Qarzga yozilsa - mijoz majburiy */}
      <div
        className="karta"
        style={{
          marginBottom: 14,
          background: qarz > 0 ? 'var(--sariq-och)' : 'var(--fon4)',
          borderColor: qarz > 0 ? (mijoz ? 'var(--sariq)' : 'var(--qizil)') : 'var(--chegara)',
        }}
      >
        <label className="yorliq" style={{ marginBottom: 8 }}>
          {qarz > 0 ? 'Qarz kimga yoziladi? (majburiy)' : 'Mijoz (ixtiyoriy)'}
        </label>
        <MijozTanlash
          mijoz={mijoz}
          tanla={mijozTanla}
          mijozlar={mijozlar}
          yangilandi={mijozlarniYukla}
          toast={toast}
          majburiy={qarz > 0}
        />
        {qarz > 0 && mijoz && (
          <div className="kichik" style={{ marginTop: 8 }}>
            {mijoz.qarz > 0.4 ? (
              <>
                Joriy qarzi: <b>{pul(mijoz.qarz)}</b> → bu sotuvdan keyin:{' '}
                <b style={{ color: 'var(--sariq)' }}>{pul(mijoz.qarz + Number(qarz))} so'm</b>
              </>
            ) : mijoz.qarz < -0.4 ? (
              <>
                Mijozda <b>{pul(-mijoz.qarz)}</b> avans bor — shundan yechiladi
              </>
            ) : (
              <>
                Yangi qarz: <b style={{ color: 'var(--sariq)' }}>{pul(qarz)} so'm</b>
              </>
            )}
          </div>
        )}
      </div>

      {naqd > 0 && (
        <div className="maydon">
          <label className="yorliq">Mijoz bergan naqd pul (qaytim hisoblash uchun)</label>
          <div className="qator" style={{ flexWrap: 'wrap' }}>
            <input
              className="inp"
              style={{ maxWidth: 160 }}
              value={berilgan}
              onChange={(e) => setBerilgan(son(e.target.value))}
              placeholder="0"
            />
            {[50000, 100000, 200000, 500000].map((v) => (
              <button key={v} className="btn btn-kichik" onClick={() => setBerilgan((Number(berilgan) || 0) + v)}>
                +{pul(v)}
              </button>
            ))}
            {berilgan !== '' && (
              <button className="btn btn-kichik" onClick={() => setBerilgan('')}>
                Tozalash
              </button>
            )}
          </div>
          {qaytim > 0 && (
            <div className="qalin" style={{ marginTop: 10, fontSize: 20, color: 'var(--sariq)' }}>
              Qaytim: {pul(qaytim)} so‘m
            </div>
          )}
        </div>
      )}

      <div
        className="karta"
        style={{
          marginTop: 8,
          borderColor: Math.abs(farq) < 1 ? 'var(--yashil)' : 'var(--qizil)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>To‘langan: {pul(tolangan)}</span>
        <span className="qalin" style={{ color: Math.abs(farq) < 1 ? 'var(--yashil)' : 'var(--qizil)' }}>
          {Math.abs(farq) < 1 ? '✓ To‘g‘ri' : farq > 0 ? `Kam: ${pul(farq)}` : `Ortiqcha: ${pul(-farq)}`}
        </span>
      </div>
    </Modal>
  );
}
