import React, { useEffect, useState } from 'react';
import { amal } from './api.js';
import { Ikonka, useToast } from './components/Ui.jsx';
import Kirish from './pages/Kirish.jsx';
import Sotuv from './pages/Sotuv.jsx';
import Panel from './pages/Panel.jsx';
import Tovarlar from './pages/Tovarlar.jsx';
import Kirim from './pages/Kirim.jsx';
import Kassa from './pages/Kassa.jsx';
import Savdo from './pages/Savdo.jsx';
import Qarzlar from './pages/Qarzlar.jsx';
import Mijozlar from './pages/Mijozlar.jsx';
import Hisobot from './pages/Hisobot.jsx';
import Foydalanuvchilar from './pages/Foydalanuvchilar.jsx';
import Sozlamalar from './pages/Sozlamalar.jsx';

const MENYU = [
  { kalit: 'sotuv', nom: 'Sotuv', ikon: 'sotuv', ruxsat: 'sotuv' },
  { kalit: 'savdo', nom: 'Savdo', ikon: 'chop', ruxsat: 'sotuv' },
  { kalit: 'panel', nom: 'Panel', ikon: 'panel', ruxsat: null },
  { kalit: 'tovarlar', nom: 'Tovarlar', ikon: 'tovar', ruxsat: 'tovarlar' },
  { kalit: 'kirim', nom: 'Kirim', ikon: 'kirim', ruxsat: 'kirim' },
  { kalit: 'mijozlar', nom: 'Mijozlar', ikon: 'mijoz', ruxsat: 'mijozlar' },
  { kalit: 'qarzlar', nom: 'Qarzlar', ikon: 'qarz', ruxsat: 'qarz' },
  { kalit: 'kassa', nom: 'Kassa', ikon: 'kassa', ruxsat: 'sotuv' },
  { kalit: 'hisobot', nom: 'Hisobot', ikon: 'hisobot', ruxsat: 'hisobot' },
  { kalit: 'xodimlar', nom: 'Xodimlar', ikon: 'odamlar', ruxsat: 'foydalanuvchilar', faqatRahbar: true },
  { kalit: 'sozlamalar', nom: 'Sozlama', ikon: 'sozlama', ruxsat: 'sozlamalar', faqatRahbar: true },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [sahifa, setSahifa] = useState('sotuv');
  const [filial, setFilial] = useState(null);
  const [soat, setSoat] = useState(new Date());
  const [tgHolat, setTgHolat] = useState(null);
  const [yangilanish, setYangilanish] = useState(null);
  // Savatlar shu yerda turadi - bo'lim almashtirilganda yo'qolmasligi uchun
  const [savatlar, setSavatlar] = useState([{ id: 1, nom: 'Mijoz 1', qatorlar: [], mijoz: null }]);
  const [faolSavat, setFaolSavat] = useState(1);
  const toast = useToast();

  useEffect(() => {
    const t = setInterval(() => setSoat(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!window.pos.yangilanishKuzat) return;
    amal('yangilanish.holat').then(setYangilanish).catch(() => {});
    return window.pos.yangilanishKuzat((h) => setYangilanish(h));
  }, []);

  useEffect(() => {
    if (!user || user.rol !== 'rahbar') return;
    const yukla = () => amal('telegram.holat').then(setTgHolat).catch(() => {});
    yukla();
    const t = setInterval(yukla, 15000);
    return () => clearInterval(t);
  }, [user]);

  function kirdi(u) {
    setUser(u);
    setFilial(u.filiallar[0] ? u.filiallar[0].id : 1);
    setSahifa(u.ruxsatlar.sotuv ? 'sotuv' : 'panel');
  }

  async function chiqish() {
    const bor = savatlar.some((x) => x.qatorlar.length);
    if (bor && !confirm("Yakunlanmagan savatlar bor. Baribir chiqasizmi?")) return;
    await amal('auth.chiqish');
    setSavatlar([{ id: 1, nom: 'Mijoz 1', qatorlar: [], mijoz: null }]);
    setFaolSavat(1);
    setUser(null);
  }

  if (!user) return <Kirish kirdi={kirdi} />;

  const menyu = MENYU.filter((m) => {
    if (m.faqatRahbar && user.rol !== 'rahbar') return false;
    if (!m.ruxsat) return true;
    return user.rol === 'rahbar' || user.ruxsatlar[m.ruxsat];
  });

  const umumiy = { user, filial, toast };

  return (
    <div className="app">
      <nav className="yon">
        <div className="yon-logo">S</div>
        {menyu.map((m) => (
          <button
            key={m.kalit}
            className={'yon-btn' + (sahifa === m.kalit ? ' faol' : '')}
            onClick={() => setSahifa(m.kalit)}
          >
            <Ikonka nom={m.ikon} />
            {m.nom}
            {m.kalit === 'sotuv' && savatlar.filter((x) => x.qatorlar.length).length > 0 && (
              <span className="yon-belgi">{savatlar.filter((x) => x.qatorlar.length).length}</span>
            )}
          </button>
        ))}
        <div className="yon-past">
          <button className="yon-btn" onClick={chiqish} title="Chiqish">
            <Ikonka nom="chiqish" />
            Chiqish
          </button>
        </div>
      </nav>

      <div className="asosiy">
        <header className="tepa">
          <h1>{menyu.find((m) => m.kalit === sahifa)?.nom || 'Shodiev POS'}</h1>
          {user.filiallar.length > 1 && (
            <select
              className="inp"
              style={{ width: 190 }}
              value={filial || ''}
              onChange={(e) => setFilial(Number(e.target.value))}
            >
              {user.filiallar.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nomi}
                </option>
              ))}
            </select>
          )}
          {yangilanish && yangilanish.yuklandi && (
            <button
              className="btn btn-yashil btn-kichik"
              onClick={async () => {
                if (confirm(`Yangi versiya (${yangilanish.yangi}) tayyor. Dastur qayta ishga tushadi. Davom etamizmi?`)) {
                  await amal('yangilanish.ornat');
                }
              }}
              title="Yangi versiya yuklab olindi"
            >
              ⬆ Yangilash ({yangilanish.yangi})
            </button>
          )}
          {yangilanish && !yangilanish.yuklandi && yangilanish.yangi && (
            <span className="nishon n-kok" title="Yangi versiya yuklanmoqda">
              ⬇ Yangi versiya yuklanmoqda {yangilanish.foiz}%
            </span>
          )}
          <div className="tepa-ong">
            {tgHolat && user.rol === 'rahbar' && (
              <span
                className={'nishon ' + (!tgHolat.sozlangan ? 'n-sariq' : tgHolat.kutmoqda > 0 ? 'n-kok' : 'n-yashil')}
                title={
                  !tgHolat.sozlangan
                    ? 'Telegram sozlanmagan'
                    : tgHolat.kutmoqda > 0
                    ? `${tgHolat.kutmoqda} ta xabar navbatda (internet kelganda yuboriladi)`
                    : 'Telegram ulangan'
                }
              >
                {!tgHolat.sozlangan
                  ? '⚠ Telegram sozlanmagan'
                  : tgHolat.kutmoqda > 0
                  ? `⏳ Navbatda ${tgHolat.kutmoqda}`
                  : '✓ Telegram'}
              </span>
            )}
            <span className="xira">
              {soat.toLocaleDateString('ru-RU')} · {soat.toLocaleTimeString('ru-RU')}
            </span>
            <span className="qalin">
              {user.ism} <span className="xira kichik">({user.rol === 'rahbar' ? 'rahbar' : 'xodim'})</span>
            </span>
          </div>
        </header>

        {sahifa === 'sotuv' && (
          <Sotuv
            {...umumiy}
            savatlar={savatlar}
            setSavatlar={setSavatlar}
            faolId={faolSavat}
            setFaolId={setFaolSavat}
          />
        )}
        {sahifa === 'panel' && <Panel {...umumiy} />}
        {sahifa === 'tovarlar' && <Tovarlar {...umumiy} />}
        {sahifa === 'kirim' && <Kirim {...umumiy} />}
        {sahifa === 'mijozlar' && <Mijozlar {...umumiy} />}
        {sahifa === 'kassa' && <Kassa {...umumiy} />}
        {sahifa === 'savdo' && <Savdo {...umumiy} />}
        {sahifa === 'qarzlar' && <Qarzlar {...umumiy} />}
        {sahifa === 'hisobot' && <Hisobot {...umumiy} />}
        {sahifa === 'xodimlar' && <Foydalanuvchilar {...umumiy} />}
        {sahifa === 'sozlamalar' && <Sozlamalar {...umumiy} />}
      </div>
    </div>
  );
}
