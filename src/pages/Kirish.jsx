import React, { useEffect, useRef, useState } from 'react';
import { amal } from '../api.js';

export default function Kirish({ kirdi }) {
  const [login, setLogin] = useState('');
  const [parol, setParol] = useState('');
  const [xato, setXato] = useState('');
  const [kutish, setKutish] = useState(false);
  const loginRef = useRef();

  useEffect(() => {
    loginRef.current?.focus();
  }, []);

  async function yubor(e) {
    e.preventDefault();
    setXato('');
    setKutish(true);
    try {
      const u = await amal('auth.kirish', { login, parol });
      kirdi(u);
    } catch (err) {
      setXato(err.message);
      setParol('');
    } finally {
      setKutish(false);
    }
  }

  return (
    <div className="kirish-fon">
      <form className="karta kirish-karta" onSubmit={yubor}>
        <div className="kirish-logo">S</div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>SHODIEV OPTOM MARKET</h2>
        <p className="xira kichik" style={{ marginBottom: 22 }}>
          Savdo tizimiga kirish
        </p>

        <div className="maydon" style={{ textAlign: 'left' }}>
          <label className="yorliq">Login</label>
          <input
            ref={loginRef}
            className="inp"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="rahbar"
            autoComplete="off"
          />
        </div>
        <div className="maydon" style={{ textAlign: 'left' }}>
          <label className="yorliq">Parol</label>
          <input
            className="inp"
            type="password"
            value={parol}
            onChange={(e) => setParol(e.target.value)}
            placeholder="••••"
          />
        </div>

        {xato && (
          <div className="nishon n-qizil" style={{ display: 'block', padding: '10px', marginBottom: 12 }}>
            {xato}
          </div>
        )}

        <button className="btn btn-yashil btn-katta" style={{ width: '100%', justifyContent: 'center' }} disabled={kutish}>
          {kutish ? 'Tekshirilmoqda...' : 'Kirish'}
        </button>
      </form>
    </div>
  );
}
