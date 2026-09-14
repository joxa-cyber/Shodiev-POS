import React, { useState } from 'react';
import { pul, sanaChiroyli } from '../api.js';

// Oddiy SVG grafik - hech qanday kutubxona kerak emas, shuning uchun juda tez
export default function Grafik({ malumot, foydaKorsat = true, balandlik = 220 }) {
  const [tanlangan, setTanlangan] = useState(null);
  if (!malumot || !malumot.length) return <p className="xira">Ma'lumot yo'q</p>;

  const eni = 1000;
  const past = 26; // pastki yozuvlar uchun joy
  const tepa = 10;
  const chizmaB = balandlik - past - tepa;
  const maks = Math.max(...malumot.map((d) => d.savdo), 1);
  const ustunEni = eni / malumot.length;
  const tanaEni = Math.max(4, ustunEni * 0.62);

  const oraliq = Math.ceil(malumot.length / 8);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${eni} ${balandlik}`} style={{ width: '100%', height: balandlik }}>
        {/* yordamchi chiziqlar */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1="0"
            x2={eni}
            y1={tepa + chizmaB * p}
            y2={tepa + chizmaB * p}
            stroke="var(--chegara)"
            strokeWidth="1"
            strokeDasharray={p === 1 ? '0' : '4 6'}
          />
        ))}

        {malumot.map((d, i) => {
          const h = (d.savdo / maks) * chizmaB;
          const x = i * ustunEni + (ustunEni - tanaEni) / 2;
          const y = tepa + chizmaB - h;
          const fh = foydaKorsat ? (Math.max(0, d.foyda) / maks) * chizmaB : 0;
          const tanlandi = tanlangan === i;
          return (
            <g key={d.kun} onMouseEnter={() => setTanlangan(i)} onMouseLeave={() => setTanlangan(null)}>
              <rect x={i * ustunEni} y={0} width={ustunEni} height={balandlik} fill="transparent" />
              {/* savdo */}
              <rect
                x={x}
                y={y}
                width={tanaEni}
                height={Math.max(h, d.savdo > 0 ? 2 : 0)}
                rx="3"
                fill={tanlandi ? '#7fd6ae' : '#cfeadd'}
              />
              {/* shundan foyda */}
              {fh > 0 && (
                <rect
                  x={x}
                  y={tepa + chizmaB - fh}
                  width={tanaEni}
                  height={Math.max(fh, 2)}
                  rx="3"
                  fill={tanlandi ? '#0b7a4c' : 'var(--yashil)'}
                />
              )}
            </g>
          );
        })}

        {/* sanalar - har 5-kun */}
        {malumot.map((d, i) =>
          (i % oraliq === 0 && i < malumot.length - 2) || i === malumot.length - 1 ? (
            <text
              key={d.kun}
              x={i * ustunEni + ustunEni / 2}
              y={balandlik - 8}
              textAnchor="middle"
              fontSize="20"
              fill="var(--xira)"
            >
              {d.kun.slice(8, 10)}.{d.kun.slice(5, 7)}
            </text>
          ) : null
        )}
      </svg>

      {tanlangan !== null && (
        <div
          className="karta"
          style={{
            position: 'absolute',
            top: 0,
            left: `${Math.min(78, (tanlangan / malumot.length) * 100)}%`,
            padding: '8px 12px',
            pointerEvents: 'none',
            fontSize: 13,
            zIndex: 5,
            boxShadow: 'var(--soya2)',
          }}
        >
          <div className="qalin">{sanaChiroyli(malumot[tanlangan].kun)}</div>
          <div>
            Savdo: <b>{pul(malumot[tanlangan].savdo)}</b>
          </div>
          {foydaKorsat && (
            <div style={{ color: 'var(--yashil)' }}>
              Foyda: <b>{pul(malumot[tanlangan].foyda)}</b>
              {malumot[tanlangan].savdo > 0 && (
                <span className="xira">
                  {' '}
                  ({Math.round((malumot[tanlangan].foyda / malumot[tanlangan].savdo) * 100)}%)
                </span>
              )}
            </div>
          )}
          <div className="xira">{malumot[tanlangan].chek} ta chek</div>
        </div>
      )}

      <div className="qator kichik xira" style={{ gap: 16, marginTop: 6, justifyContent: 'center' }}>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#cfeadd', borderRadius: 2 }} />{' '}
          Savdo
        </span>
        {foydaKorsat && (
          <span>
            <span
              style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--yashil)', borderRadius: 2 }}
            />{' '}
            shundan foyda
          </span>
        )}
      </div>
    </div>
  );
}
