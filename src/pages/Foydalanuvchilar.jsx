import React, { useCallback, useEffect, useState } from 'react';
import { amal } from '../api.js';
import { Modal, Tasdiq } from '../components/Ui.jsx';

const RUXSATLAR = [
  ['sotuv', 'Sotuv qilish'],
  ['kirim', 'Tovar qabul qilish (kirim)'],
  ['tovarlar', "Tovarlarni qo'shish / tahrirlash (narxlari bilan)"],
  ['mijozlar', 'Mijozlar bilan ishlash'],
  ['qarz', "Qarz to'lovini qabul qilish"],
  ['hisobot', 'Hisobotlarni ko\'rish (foyda bilan)'],
];

const BOSH = {
  ism: '',
  login: '',
  parol: '',
  rol: 'hodim',
  aktiv: 1,
  ruxsatlar: { sotuv: 1, kirim: 1, tovarlar: 1, mijozlar: 1, qarz: 1 },
  filiallar: [],
};

export default function Foydalanuvchilar({ user, toast }) {
  const [royxat, setRoyxat] = useState([]);
  const [filiallar, setFiliallar] = useState([]);
  const [tahrir, setTahrir] = useState(null);
  const [ochirish, setOchirish] = useState(null);
  const [filialTahrir, setFilialTahrir] = useState(null);

  const yukla = useCallback(() => {
    amal('foydalanuvchi.royxat').then(setRoyxat).catch((e) => toast.xato(e.message));
    amal('filial.royxat').then(setFiliallar).catch(() => {});
  }, []);

  useEffect(yukla, [yukla]);

  async function saqla(u) {
    try {
      await amal('foydalanuvchi.saqla', u);
      toast.ok(u.id ? 'Saqlandi' : "Xodim qo'shildi");
      setTahrir(null);
      yukla();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  async function filialSaqla(f) {
    try {
      await amal('filial.saqla', f);
      toast.ok('Filial saqlandi');
      setFilialTahrir(null);
      yukla();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <div className="sahifa">
      <div className="qator" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 16 }}>Xodimlar</h3>
        <button
          className="btn btn-yashil qator-oxiri"
          onClick={() => setTahrir({ ...BOSH, filiallar: filiallar.length ? [filiallar[0].id] : [] })}
        >
          + Yangi xodim
        </button>
      </div>

      <div className="karta" style={{ padding: 0, overflow: 'auto', marginBottom: 26 }}>
        <table className="jadval">
          <thead>
            <tr>
              <th>Ism</th>
              <th>Login</th>
              <th>Rol</th>
              <th>Filiallar</th>
              <th>Ruxsatlar</th>
              <th>Holat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {royxat.map((u) => (
              <tr key={u.id}>
                <td className="qalin">{u.ism}</td>
                <td className="xira">{u.login}</td>
                <td>
                  <span className={'nishon ' + (u.rol === 'rahbar' ? 'n-kok' : 'n-yashil')}>
                    {u.rol === 'rahbar' ? 'Rahbar' : 'Xodim'}
                  </span>
                </td>
                <td className="kichik">
                  {u.rol === 'rahbar'
                    ? 'hammasi'
                    : u.filiallar.map((id) => filiallar.find((f) => f.id === id)?.nomi).filter(Boolean).join(', ') || '—'}
                </td>
                <td className="kichik xira">
                  {u.rol === 'rahbar'
                    ? "to'liq"
                    : RUXSATLAR.filter(([k]) => u.ruxsatlar[k]).map(([, n]) => n.split(' ')[0]).join(', ') || '—'}
                </td>
                <td>
                  {u.aktiv ? <span className="nishon n-yashil">faol</span> : <span className="nishon n-qizil">o'chirilgan</span>}
                </td>
                <td className="ong">
                  <button className="btn btn-kichik" onClick={() => setTahrir({ ...u, parol: '' })}>
                    Tahrirlash
                  </button>
                  {u.id !== user.id && u.aktiv === 1 && (
                    <button className="btn btn-kichik" style={{ marginLeft: 6 }} onClick={() => setOchirish(u)}>
                      🗑
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="qator" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 16 }}>Filiallar</h3>
        <button
          className="btn qator-oxiri"
          onClick={() => setFilialTahrir({ nomi: '', manzil: '', telefon: '', aktiv: 1 })}
        >
          + Yangi filial
        </button>
      </div>

      <div className="karta" style={{ padding: 0, overflow: 'auto' }}>
        <table className="jadval">
          <thead>
            <tr>
              <th>Nomi</th>
              <th>Manzil</th>
              <th>Telefon</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filiallar.map((f) => (
              <tr key={f.id}>
                <td className="qalin">{f.nomi}</td>
                <td className="kichik xira">{f.manzil || '—'}</td>
                <td className="kichik">{f.telefon || '—'}</td>
                <td className="ong">
                  <button className="btn btn-kichik" onClick={() => setFilialTahrir({ ...f })}>
                    Tahrirlash
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Xodim oynasi */}
      <Modal
        ochiq={!!tahrir}
        yop={() => setTahrir(null)}
        sarlavha={tahrir?.id ? 'Xodimni tahrirlash' : 'Yangi xodim'}
        kenglik={560}
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
            <div className="ustun-2">
              <div className="maydon">
                <label className="yorliq">Ism *</label>
                <input
                  className="inp"
                  autoFocus
                  value={tahrir.ism}
                  onChange={(e) => setTahrir({ ...tahrir, ism: e.target.value })}
                  placeholder="Aziz"
                />
              </div>
              <div className="maydon">
                <label className="yorliq">Login *</label>
                <input
                  className="inp"
                  value={tahrir.login}
                  onChange={(e) => setTahrir({ ...tahrir, login: e.target.value })}
                  placeholder="aziz"
                />
              </div>
            </div>

            <div className="ustun-2">
              <div className="maydon">
                <label className="yorliq">{tahrir.id ? "Yangi parol (bo'sh qoldirsangiz o'zgarmaydi)" : 'Parol *'}</label>
                <input
                  className="inp"
                  value={tahrir.parol || ''}
                  onChange={(e) => setTahrir({ ...tahrir, parol: e.target.value })}
                  placeholder="••••"
                />
              </div>
              <div className="maydon">
                <label className="yorliq">Rol</label>
                <select className="inp" value={tahrir.rol} onChange={(e) => setTahrir({ ...tahrir, rol: e.target.value })}>
                  <option value="hodim">Xodim (kassir)</option>
                  <option value="rahbar">Rahbar (to'liq huquq)</option>
                </select>
              </div>
            </div>

            <div className="maydon">
              <label className="yorliq">Qaysi filiallarda ishlaydi?</label>
              {filiallar.map((f) => (
                <label key={f.id} className="qator kichik" style={{ gap: 8, padding: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={tahrir.filiallar.includes(f.id)}
                    onChange={(e) =>
                      setTahrir({
                        ...tahrir,
                        filiallar: e.target.checked
                          ? [...tahrir.filiallar, f.id]
                          : tahrir.filiallar.filter((x) => x !== f.id),
                      })
                    }
                  />
                  {f.nomi}
                </label>
              ))}
            </div>

            {tahrir.rol !== 'rahbar' && (
              <div className="maydon">
                <label className="yorliq">Ruxsatlar</label>
                {RUXSATLAR.map(([k, n]) => (
                  <label key={k} className="qator kichik" style={{ gap: 8, padding: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={!!tahrir.ruxsatlar[k]}
                      onChange={(e) =>
                        setTahrir({ ...tahrir, ruxsatlar: { ...tahrir.ruxsatlar, [k]: e.target.checked ? 1 : 0 } })
                      }
                    />
                    {n}
                  </label>
                ))}
                <div className="xira kichik" style={{ marginTop: 8 }}>
                  Eslatma: tan narx va foyda faqat rahbarga va «Hisobot» ruxsati berilgan xodimga ko'rinadi.
                </div>
              </div>
            )}

            {tahrir.id && (
              <label className="qator kichik" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!tahrir.aktiv}
                  onChange={(e) => setTahrir({ ...tahrir, aktiv: e.target.checked ? 1 : 0 })}
                />
                Faol (belgini olib tashlasangiz tizimga kira olmaydi)
              </label>
            )}
          </>
        )}
      </Modal>

      {/* Filial oynasi */}
      <Modal
        ochiq={!!filialTahrir}
        yop={() => setFilialTahrir(null)}
        sarlavha={filialTahrir?.id ? 'Filialni tahrirlash' : 'Yangi filial'}
        past={
          <>
            <button className="btn" onClick={() => setFilialTahrir(null)}>
              Bekor
            </button>
            <button className="btn btn-yashil" onClick={() => filialSaqla(filialTahrir)}>
              Saqlash
            </button>
          </>
        }
      >
        {filialTahrir && (
          <>
            <div className="maydon">
              <label className="yorliq">Filial nomi *</label>
              <input
                className="inp"
                autoFocus
                value={filialTahrir.nomi}
                onChange={(e) => setFilialTahrir({ ...filialTahrir, nomi: e.target.value })}
                placeholder="Pushkin maktab oldidagi filial"
              />
            </div>
            <div className="maydon">
              <label className="yorliq">Manzil</label>
              <input
                className="inp"
                value={filialTahrir.manzil || ''}
                onChange={(e) => setFilialTahrir({ ...filialTahrir, manzil: e.target.value })}
              />
            </div>
            <div className="maydon">
              <label className="yorliq">Telefon</label>
              <input
                className="inp"
                value={filialTahrir.telefon || ''}
                onChange={(e) => setFilialTahrir({ ...filialTahrir, telefon: e.target.value })}
              />
            </div>
          </>
        )}
      </Modal>

      <Tasdiq
        ochiq={!!ochirish}
        yop={() => setOchirish(null)}
        matn={`"${ochirish?.ism}" xodimini o'chirasizmi? U endi tizimga kira olmaydi.`}
        tasdiqla={async () => {
          try {
            await amal('foydalanuvchi.ochir', { id: ochirish.id });
            toast.ok("Xodim o'chirildi");
            yukla();
          } catch (e) {
            toast.xato(e.message);
          }
        }}
      />
    </div>
  );
}
