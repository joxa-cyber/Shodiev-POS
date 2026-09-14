import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/* ---------- Xabarlar (toast) ---------- */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [royxat, setRoyxat] = useState([]);
  const qosh = useCallback((matn, tur = 'ok', muddat = 3200) => {
    const id = Date.now() + Math.random();
    setRoyxat((r) => [...r, { id, matn, tur }]);
    setTimeout(() => setRoyxat((r) => r.filter((x) => x.id !== id)), muddat);
  }, []);
  const api = {
    ok: (m) => qosh(m, 'ok'),
    xato: (m) => qosh(m, 'xato', 5000),
    ogoh: (m) => qosh(m, 'ogoh', 4000),
  };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toastlar">
        {royxat.map((t) => (
          <div key={t.id} className={'toast ' + (t.tur === 'ok' ? '' : t.tur)}>
            {t.matn}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({ ochiq, yop, sarlavha, children, past, kenglik = 520 }) {
  useEffect(() => {
    if (!ochiq) return;
    const h = (e) => {
      if (e.key === 'Escape') yop();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [ochiq, yop]);

  if (!ochiq) return null;
  return (
    <div className="qoplama" onMouseDown={(e) => e.target === e.currentTarget && yop()}>
      <div className="modal" style={{ maxWidth: kenglik }}>
        <div className="modal-tepa">
          <h3>{sarlavha}</h3>
          <button className="btn btn-kichik qator-oxiri" onClick={yop}>
            ✕
          </button>
        </div>
        <div className="modal-tana">{children}</div>
        {past && <div className="modal-past">{past}</div>}
      </div>
    </div>
  );
}

/* ---------- Tasdiqlash ---------- */
export function Tasdiq({ ochiq, yop, sarlavha = 'Tasdiqlang', matn, tasdiqla, tugma = "Ha, o'chirish" }) {
  return (
    <Modal
      ochiq={ochiq}
      yop={yop}
      sarlavha={sarlavha}
      kenglik={420}
      past={
        <>
          <button className="btn" onClick={yop}>
            Bekor qilish
          </button>
          <button
            className="btn btn-qizil"
            onClick={() => {
              tasdiqla();
              yop();
            }}
          >
            {tugma}
          </button>
        </>
      }
    >
      <p>{matn}</p>
    </Modal>
  );
}

/* ---------- Ikonkalar ---------- */
const yollar = {
  sotuv: 'M3 3h2l2.6 12.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  panel: 'M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h8v8H3v-8Zm10-3h8v11h-8V10Z',
  tovar: 'M21 8 12 3 3 8v8l9 5 9-5V8Zm-9 3L3.5 7.2M12 11l8.5-3.8M12 11v10',
  kirim: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  mijoz: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-2a4 4 0 0 0-3-3.9M16.5 3.1a4 4 0 0 1 0 7.7',
  hisobot: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  odamlar: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12.5 10v-2a4 4 0 0 0-3-3.9',
  sozlama:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a8.4 8.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a8.3 8.3 0 0 0-2.2-1.3L15.3 2h-4l-.4 2.6c-.8.3-1.5.7-2.2 1.3l-2.4-1-2 3.4 2 1.6a8.4 8.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1c.7.6 1.4 1 2.2 1.3l.4 2.6h4l.4-2.6c.8-.3 1.5-.7 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.3Z',
  chiqish: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  qidir: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3',
  chop: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8Z',
  qarz: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  kassa: 'M3 10h18M3 10l1.5-5h15L21 10M3 10v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-9M9 14h6',
};

export function Ikonka({ nom, size = 22 }) {
  const d = yollar[nom] || yollar.panel;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
