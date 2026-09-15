import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { amal, pul, miqdorFmt } from '../api.js';
import { Modal, Tasdiq } from '../components/Ui.jsx';
import KategoriyaOyna from '../components/KategoriyaOyna.jsx';

const BOSH = {
  nomi: '',
  barcode: '',
  kategoriya: '',
  kategoriya_id: null,
  blok_soni: 0,
  sotuv_narx: '',
  tan_narx: '',
  min_qoldiq: 0,
  qoldiq: '',
};

export default function Tovarlar({ user, filial, toast }) {
  const [royxat, setRoyxat] = useState([]);
  const [qidiruv, setQidiruv] = useState('');
  const [kategoriyalar, setKategoriyalar] = useState([]);
  const [katFiltr, setKatFiltr] = useState('');
  const [tahrir, setTahrir] = useState(null);
  const [ochirish, setOchirish] = useState(null);
  const [faqatKam, setFaqatKam] = useState(false);
  const [katOyna, setKatOyna] = useState(false);
  const rahbarmi = user.rol === 'rahbar';
  // tan narxni tovar boshqara oladigan har kim ko'radi (xodim ham kirim narxini kiritishi kerak)
  const narxKoradi = rahbarmi || !!user.ruxsatlar.tovarlar;

  const yukla = useCallback(() => {
    amal('tovar.royxat', { filial_id: filial, limit: 5000 })
      .then(setRoyxat)
      .catch((e) => toast.xato(e.message));
    amal('kategoriya.royxat').then(setKategoriyalar).catch(() => {});
  }, [filial]);

  useEffect(yukla, [yukla]);

  const korinadi = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    return royxat.filter(
      (t) =>
        (!q || t.nomi.toLowerCase().includes(q) || (t.barcode || '').includes(q)) &&
        (!katFiltr || t.kategoriya === katFiltr) &&
        (!faqatKam || t.qoldiq <= t.min_qoldiq)
    );
  }, [royxat, qidiruv, faqatKam, katFiltr]);

  const omborQiymati = korinadi.reduce((s, t) => s + t.qoldiq * t.tan_narx, 0);

  async function saqla(t) {
    try {
      await amal('tovar.saqla', { ...t, filial_id: filial });
      toast.ok(t.id ? 'Tovar yangilandi' : "Tovar qo'shildi");
      setTahrir(null);
      yukla();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  async function ochir(id) {
    try {
      await amal('tovar.ochir', { id });
      toast.ok("Tovar o'chirildi");
      yukla();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <div className="sahifa">
      <div className="qator" style={{ marginBottom: 12 }}>
        <input
          className="inp"
          style={{ maxWidth: 360 }}
          placeholder="Tovar nomi yoki shtrix-kod bo'yicha qidirish..."
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
        />
        <label className="qator kichik" style={{ gap: 6 }}>
          <input type="checkbox" checked={faqatKam} onChange={(e) => setFaqatKam(e.target.checked)} />
          Faqat tugayotganlar
        </label>
        <span className="xira kichik">
          {korinadi.length} ta tovar
          {narxKoradi && (
            <>
              {' · '}ombor: <b>{pul(omborQiymati)} so'm</b>
            </>
          )}
        </span>
        <button className="btn qator-oxiri" onClick={() => setKatOyna(true)}>
          🗂 Kategoriyalar
        </button>
        <button className="btn btn-yashil" onClick={() => setTahrir({ ...BOSH })}>
          + Yangi tovar
        </button>
      </div>

      <div className="chip-qator" style={{ marginBottom: 12 }}>
        <button className={'chip' + (katFiltr === '' ? ' faol' : '')} onClick={() => setKatFiltr('')}>
          Hammasi
        </button>
        {kategoriyalar.map((k) => (
          <button
            key={k.id}
            className={'chip' + (katFiltr === k.nomi ? ' faol' : '')}
            onClick={() => setKatFiltr(katFiltr === k.nomi ? '' : k.nomi)}
          >
            {k.nomi}
          </button>
        ))}
      </div>

      <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 215px)' }}>
        <table className="jadval">
          <thead>
            <tr>
              <th>Nomi</th>
              <th>Shtrix-kod</th>
              <th className="ong">Blok</th>
              <th className="ong">Qoldiq</th>
              {narxKoradi && <th className="ong">Kelgan narx</th>}
              <th className="ong">Sotuv narx</th>
              {narxKoradi && <th className="ong">Foyda</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {korinadi.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="qalin">{t.nomi}</div>
                  {t.kategoriya && <div className="xira kichik">{t.kategoriya}</div>}
                </td>
                <td className="xira kichik">{t.barcode || '—'}</td>
                <td className="ong">{t.blok_soni > 1 ? `${t.blok_soni} dona` : '—'}</td>
                <td className="ong">
                  <span
                    className={
                      'nishon ' + (t.qoldiq <= 0 ? 'n-qizil' : t.qoldiq <= t.min_qoldiq ? 'n-sariq' : 'n-yashil')
                    }
                  >
                    {miqdorFmt(t.qoldiq)}
                  </span>
                </td>
                {narxKoradi && <td className="ong xira">{pul(t.tan_narx)}</td>}
                <td className="ong qalin">{pul(t.sotuv_narx)}</td>
                {narxKoradi && (
                  <td
                    className="ong"
                    style={{ color: t.sotuv_narx - t.tan_narx > 0 ? 'var(--yashil)' : 'var(--qizil)' }}
                  >
                    {pul(t.sotuv_narx - t.tan_narx)}
                  </td>
                )}
                <td className="ong">
                  <button className="btn btn-kichik" onClick={() => setTahrir({ ...t })}>
                    Tahrirlash
                  </button>
                  {rahbarmi && (
                    <button className="btn btn-kichik" style={{ marginLeft: 6 }} onClick={() => setOchirish(t)}>
                      🗑
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!korinadi.length && (
              <tr>
                <td colSpan={8} className="markaz xira" style={{ padding: 30 }}>
                  Tovar yo'q. «+ Yangi tovar» tugmasi orqali qo'shing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TovarOyna
        tovar={tahrir}
        yop={() => setTahrir(null)}
        saqla={saqla}
        kategoriyalar={kategoriyalar}
        narxKoradi={narxKoradi}
        filial={filial}
        toast={toast}
        yangilandi={yukla}
      />

      <KategoriyaOyna
        ochiq={katOyna}
        yop={() => setKatOyna(false)}
        filial={filial}
        toast={toast}
        yangilandi={yukla}
      />

      <Tasdiq
        ochiq={!!ochirish}
        yop={() => setOchirish(null)}
        matn={`"${ochirish?.nomi}" tovarini o'chirasizmi? Eski sotuvlar saqlanib qoladi.`}
        tasdiqla={() => ochir(ochirish.id)}
      />
    </div>
  );
}

function TovarOyna({ tovar, yop, saqla, kategoriyalar, narxKoradi, filial, toast, yangilandi }) {
  const [f, setF] = useState(BOSH);
  const [yangiKat, setYangiKat] = useState(false);
  const nomRef = useRef();

  useEffect(() => {
    if (tovar) {
      setF({ ...BOSH, ...tovar, kategoriya: tovar.kategoriya || '' });
      setYangiKat(false);
      setTimeout(() => nomRef.current?.focus(), 50);
    }
  }, [tovar]);

  if (!tovar) return null;
  const yangi = !f.id;
  const oz = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const son = (k) => (e) => setF({ ...f, [k]: e.target.value.replace(/[^\d.]/g, '') });
  const foyda = (Number(f.sotuv_narx) || 0) - (Number(f.tan_narx) || 0);

  async function qoldiqTuzat() {
    const yangiQoldiq = prompt(`"${f.nomi}" uchun haqiqiy qoldiqni kiriting (dona):`, f.qoldiq);
    if (yangiQoldiq === null) return;
    try {
      await amal('tovar.qoldiqTuzat', { tovar_id: f.id, filial_id: filial, qoldiq: Number(yangiQoldiq) || 0 });
      toast.ok("Qoldiq to'g'rilandi");
      setF({ ...f, qoldiq: Number(yangiQoldiq) || 0 });
      yangilandi();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <Modal
      ochiq={!!tovar}
      yop={yop}
      sarlavha={yangi ? 'Yangi tovar' : 'Tovarni tahrirlash'}
      kenglik={620}
      past={
        <>
          <button className="btn" onClick={yop}>
            Bekor
          </button>
          <button className="btn btn-yashil" onClick={() => saqla(f)}>
            Saqlash
          </button>
        </>
      }
    >
      <div className="maydon">
        <label className="yorliq">Tovar nomi *</label>
        <input ref={nomRef} className="inp" value={f.nomi} onChange={oz('nomi')} placeholder="Pepsi 1.5L" />
      </div>

      <div className="ustun-2">
        <div className="maydon">
          <label className="yorliq">Shtrix-kod (skanerni shu yerda o'qiting)</label>
          <input className="inp" value={f.barcode || ''} onChange={oz('barcode')} placeholder="Ixtiyoriy" />
        </div>
        <div className="maydon">
          <label className="yorliq">Kategoriya</label>
          {yangiKat ? (
            <div className="qator">
              <input
                className="inp"
                autoFocus
                value={f.kategoriya}
                onChange={oz('kategoriya')}
                placeholder="Yangi kategoriya nomi"
              />
              <button
                className="btn btn-kichik"
                onClick={() => {
                  setYangiKat(false);
                  setF({ ...f, kategoriya: tovar.kategoriya || '' });
                }}
              >
                Bekor
              </button>
            </div>
          ) : (
            <select
              className="inp"
              value={f.kategoriya || ''}
              onChange={(e) => {
                if (e.target.value === '__yangi__') {
                  setYangiKat(true);
                  setF({ ...f, kategoriya: '' });
                } else {
                  setF({ ...f, kategoriya: e.target.value });
                }
              }}
            >
              <option value="">— Kategoriyasiz —</option>
              {kategoriyalar.map((k) => (
                <option key={k.id} value={k.nomi}>
                  {k.nomi}
                </option>
              ))}
              <option value="__yangi__">➕ Yangi kategoriya yaratish...</option>
            </select>
          )}
          {!yangi && tovar.kategoriya && f.kategoriya !== tovar.kategoriya && (
            <div className="kichik" style={{ marginTop: 6, color: 'var(--sariq)' }}>
              «{tovar.kategoriya}» → «{f.kategoriya || 'Kategoriyasiz'}» ga ko'chiriladi
            </div>
          )}
        </div>
      </div>

      <div className="ustun-2">
        {narxKoradi && (
          <div className="maydon">
            <label className="yorliq">Kelgan narxi (tan narx, 1 dona)</label>
            <input className="inp" value={f.tan_narx} onChange={son('tan_narx')} placeholder="11000" />
          </div>
        )}
        <div className="maydon">
          <label className="yorliq">Sotuv narxi (1 dona) *</label>
          <input className="inp" value={f.sotuv_narx} onChange={son('sotuv_narx')} placeholder="12000" />
        </div>
      </div>

      {narxKoradi && (Number(f.sotuv_narx) > 0 || Number(f.tan_narx) > 0) && (
        <div
          className="karta"
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: foyda > 0 ? 'var(--yashil-och)' : 'var(--qizil-och)',
            borderColor: foyda > 0 ? 'var(--yashil)' : 'var(--qizil)',
          }}
        >
          1 donadan foyda: <b>{pul(foyda)} so'm</b>
          {Number(f.tan_narx) > 0 && Number(f.sotuv_narx) > 0 && (
            <span className="xira"> ({Math.round((foyda / Number(f.sotuv_narx)) * 100)}%)</span>
          )}
        </div>
      )}

      <div className="ustun-2">
        <div className="maydon">
          <label className="yorliq">1 blokda nechta dona?</label>
          <input className="inp" value={f.blok_soni} onChange={son('blok_soni')} placeholder="6" />
          <div className="xira kichik" style={{ marginTop: 4 }}>
            Tezkor kiritish uchun. Narx baribir 1 dona narxida hisoblanadi.
          </div>
        </div>
        <div className="maydon">
          <label className="yorliq">Ogohlantirish chegarasi</label>
          <input className="inp" value={f.min_qoldiq} onChange={son('min_qoldiq')} placeholder="12" />
          <div className="xira kichik" style={{ marginTop: 4 }}>
            Qoldiq shundan kam bo'lsa ogohlantiriladi
          </div>
        </div>
      </div>

      {yangi ? (
        <div className="maydon">
          <label className="yorliq">Boshlang'ich qoldiq (dona)</label>
          <input className="inp" value={f.qoldiq} onChange={son('qoldiq')} placeholder="0" />
        </div>
      ) : (
        <div className="qator">
          <span className="xira">
            Joriy qoldiq: <b>{miqdorFmt(f.qoldiq)} dona</b>
          </span>
          <button className="btn btn-kichik" onClick={qoldiqTuzat}>
            Qoldiqni to'g'rilash
          </button>
        </div>
      )}
    </Modal>
  );
}
