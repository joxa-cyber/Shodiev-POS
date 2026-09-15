import React, { useCallback, useEffect, useState } from 'react';
import { amal } from '../api.js';
import { Modal } from './Ui.jsx';

// Telegram botni sozlash: token, chatlar (shaxsiy + guruh), xabar turlari
export default function TelegramSozlama({ s, setS, saqla, toast }) {
  const [chatlar, setChatlar] = useState([]);
  const [topilgan, setTopilgan] = useState([]);
  const [yangiChat, setYangiChat] = useState('');
  const [band, setBand] = useState(false);
  const [natija, setNatija] = useState(null);
  const [yordam, setYordam] = useState(false);

  const chatRoyxati = () =>
    (s.telegram_chat_id || '')
      .split(/[\s,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);

  const chatlarniYukla = useCallback(() => {
    if (!s.telegram_token || !s.telegram_chat_id) return setChatlar([]);
    amal('telegram.chatlar')
      .then(setChatlar)
      .catch(() => setChatlar([]));
  }, [s.telegram_token, s.telegram_chat_id]);

  useEffect(() => {
    chatlarniYukla();
  }, [chatlarniYukla]);

  async function chatQosh(id) {
    const kod = String(id).trim();
    if (!kod) return;
    if (chatRoyxati().includes(kod)) return toast.ogoh('Bu chat allaqachon qo\'shilgan');
    setBand(true);
    try {
      await amal('sozlama.saqla', { telegram_token: s.telegram_token });
      const m = await amal('telegram.chatMalumot', { chat_id: kod });
      const yangi = [...chatRoyxati(), kod].join(',');
      setS({ ...s, telegram_chat_id: yangi });
      await amal('sozlama.saqla', { telegram_chat_id: yangi });
      toast.ok(`«${m.nomi}» qo'shildi`);
      setYangiChat('');
      setTopilgan([]);
      setTimeout(chatlarniYukla, 300);
    } catch (e) {
      toast.xato(
        'Chat topilmadi: ' + e.message + '. Guruh bo\'lsa — botni guruhga qo\'shganingizga ishonch hosil qiling.'
      );
    } finally {
      setBand(false);
    }
  }

  async function chatOchir(id) {
    const yangi = chatRoyxati()
      .filter((x) => x !== String(id))
      .join(',');
    setS({ ...s, telegram_chat_id: yangi });
    await amal('sozlama.saqla', { telegram_chat_id: yangi });
    toast.ok("Chat ro'yxatdan chiqarildi");
    setTimeout(chatlarniYukla, 300);
  }

  async function aniqla() {
    setBand(true);
    try {
      await amal('sozlama.saqla', { telegram_token: s.telegram_token });
      const r = await amal('telegram.chatIdTop');
      setTopilgan(r);
      if (!r.length)
        toast.ogoh(
          "Hech kim botga yozmagan. Shaxsiy chatda /start bosing yoki guruhga xabar yozing, keyin qayta urinib ko'ring."
        );
    } catch (e) {
      toast.xato(e.message);
    } finally {
      setBand(false);
    }
  }

  async function sinovYubor() {
    setBand(true);
    setNatija(null);
    try {
      await saqla();
      const r = await amal('telegram.sinov');
      setNatija(r);
      const ok = r.filter((x) => x.ok).length;
      if (ok === r.length) toast.ok(`${ok} ta chatga sinov xabari yuborildi ✓`);
      else toast.ogoh(`${ok}/${r.length} ta chatga yuborildi — natijani pastdan ko'ring`);
      chatlarniYukla();
    } catch (e) {
      toast.xato(e.message);
    } finally {
      setBand(false);
    }
  }

  const belgi = (k) => (e) => setS({ ...s, [k]: e.target.checked ? '1' : '0' });

  return (
    <div className="karta">
      <div className="qator" style={{ marginBottom: 14 }}>
        <h4 style={{ fontSize: 15 }}>Telegram bot</h4>
        <button className="btn btn-kichik qator-oxiri" onClick={() => setYordam(true)}>
          ❓ Qanday sozlanadi
        </button>
      </div>

      <div className="maydon">
        <label className="yorliq">Bot tokeni (@BotFather dan olinadi)</label>
        <input
          className="inp"
          value={s.telegram_token}
          onChange={(e) => setS({ ...s, telegram_token: e.target.value })}
          placeholder="1234567890:AAG..."
        />
      </div>

      {/* ---- Ulangan chatlar ---- */}
      <div className="maydon">
        <label className="yorliq">Xabar yuboriladigan chatlar</label>

        {chatlar.length > 0 ? (
          <div style={{ marginBottom: 10 }}>
            {chatlar.map((c) => (
              <div
                key={c.id}
                className="qator"
                style={{
                  padding: '10px 12px',
                  border: '1px solid var(--chegara)',
                  borderRadius: 10,
                  marginBottom: 6,
                  background: c.ok ? 'var(--fon2)' : 'var(--qizil-och)',
                }}
              >
                <span style={{ fontSize: 18 }}>{c.turi === 'private' ? '🙍' : '👥'}</span>
                <div>
                  <div className="qalin">{c.nomi}</div>
                  <div className="xira kichik">
                    {c.turi === 'private' ? 'shaxsiy chat' : c.turi === 'channel' ? 'kanal' : 'guruh'} ·{' '}
                    <code>{c.id}</code>
                    {!c.ok && <span style={{ color: 'var(--qizil)' }}> · {c.xato}</span>}
                  </div>
                </div>
                <button className="btn btn-kichik qator-oxiri" onClick={() => chatOchir(c.id)} title="Ro'yxatdan chiqarish">
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="xira kichik" style={{ marginBottom: 10 }}>
            Hali birorta chat qo'shilmagan. Quyidan qo'shing.
          </p>
        )}

        <div className="qator">
          <input
            className="inp"
            placeholder="Chat ID (masalan 6923137415 yoki -1003581568441)"
            value={yangiChat}
            onChange={(e) => setYangiChat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && chatQosh(yangiChat)}
          />
          <button className="btn btn-yashil" onClick={() => chatQosh(yangiChat)} disabled={band || !yangiChat.trim()}>
            + Qo'shish
          </button>
          <button className="btn" onClick={aniqla} disabled={band || !s.telegram_token}>
            🔍 Aniqlash
          </button>
        </div>

        {topilgan.length > 0 && (
          <div className="karta" style={{ marginTop: 10, padding: 8 }}>
            <div className="xira kichik" style={{ padding: '4px 10px' }}>
              Botga yozgan chatlar — qo'shish uchun bosing:
            </div>
            {topilgan.map((c) => (
              <div
                key={c.id}
                className="qator"
                style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 8 }}
                onClick={() => chatQosh(c.id)}
              >
                <span>{c.turi === 'private' ? '🙍' : '👥'}</span>
                <span>
                  {c.ism} {c.username && <span className="xira">@{c.username}</span>}
                </span>
                <span className="xira kichik qator-oxiri">{c.id}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Qanday xabarlar yuborilsin ---- */}
      <div className="maydon" style={{ marginTop: 18 }}>
        <label className="yorliq">Qanday xabarlar yuborilsin?</label>
        {[
          ['telegram_chek_yuborish', '🧾 Har bir sotuv (chek)'],
          ['telegram_kirim_yuborish', '📥 Tovar kirimi'],
          ['telegram_qarz_yuborish', "✅ Qarz to'lovlari"],
          ['telegram_kassa_yuborish', '💰 Kassa hisobi (sanalganda)'],
          ['telegram_tugash_yuborish', '⚠️ Tovar tugayotgani'],
          ['telegram_kunlik_hisobot', '📊 Kunlik yakuniy hisobot'],
        ].map(([k, n]) => (
          <label key={k} className="qator kichik" style={{ gap: 8, padding: '5px 0' }}>
            <input type="checkbox" checked={s[k] === '1'} onChange={belgi(k)} />
            {n}
          </label>
        ))}
        <div className="maydon" style={{ maxWidth: 200, marginTop: 8 }}>
          <label className="yorliq">Kunlik hisobot vaqti</label>
          <input
            className="inp"
            type="time"
            value={s.telegram_hisobot_vaqti}
            onChange={(e) => setS({ ...s, telegram_hisobot_vaqti: e.target.value })}
          />
        </div>
        <label className="qator kichik" style={{ gap: 8, padding: '5px 0' }}>
          <input type="checkbox" checked={s.backup_telegram === '1'} onChange={belgi('backup_telegram')} />
          💾 Zaxira nusxa (kuniga bir marta baza fayli)
        </label>
      </div>

      <div className="qator" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-kok" onClick={sinovYubor} disabled={band || !s.telegram_token}>
          📨 Sinov xabarini yuborish
        </button>
        <button
          className="btn"
          disabled={band || !s.telegram_token}
          onClick={async () => {
            setBand(true);
            try {
              await amal('sozlama.saqla', { telegram_token: s.telegram_token });
              await amal('telegram.botniSozla');
              toast.ok("Bot menyusi va buyruqlari yangilandi");
            } catch (e) {
              toast.xato(e.message);
            } finally {
              setBand(false);
            }
          }}
        >
          ⚙️ Bot buyruqlarini yangilash
        </button>
      </div>

      {natija && (
        <div className="karta" style={{ marginTop: 12, padding: 12 }}>
          {natija.map((r) => (
            <div key={r.chat_id} className="qator kichik" style={{ padding: '3px 0' }}>
              <span>{r.ok ? '✅' : '❌'}</span>
              <span>{r.nomi}</span>
              {!r.ok && <span style={{ color: 'var(--qizil)' }}>{r.xato}</span>}
            </div>
          ))}
        </div>
      )}

      <Modal ochiq={yordam} yop={() => setYordam(false)} sarlavha="Telegram botni sozlash" kenglik={560}>
        <ol style={{ paddingLeft: 20, lineHeight: 1.9 }}>
          <li>
            Telegramda <b>@BotFather</b> ga kiring → <code>/newbot</code> → bot nomi va username bering →{' '}
            <b>token</b> beradi.
          </li>
          <li>Tokenni yuqoridagi maydonga joylang.</li>
          <li>
            <b>Shaxsiy chat uchun:</b> botni topib <code>/start</code> bosing → «🔍 Aniqlash» tugmasini bosing → o'zingizni
            tanlang.
          </li>
          <li>
            <b>Guruh uchun:</b> botni guruhga a'zo qilib qo'shing → guruhda biror xabar yozing → «🔍 Aniqlash» →
            guruhni tanlang.
          </li>
          <li>«📨 Sinov xabarini yuborish» — ikkala joyga ham xabar kelsa, tayyor.</li>
        </ol>
        <p className="xira kichik" style={{ marginTop: 12 }}>
          Bot yopiq: faqat shu ro'yxatdagi chatlarga javob beradi. Boshqa odam botga yozsa, hech narsa ko'rmaydi.
        </p>
      </Modal>
    </div>
  );
}
